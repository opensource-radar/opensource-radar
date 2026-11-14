import { useId, useState } from "react";
import { checkIssue, parseIssue } from "../lib/issueCheck";
import "./IssueCheck.css";

const MESSAGES = {
  invalid: "Paste an issue link, like https://github.com/owner/repo/issues/12.",
  not_found: "We couldn't find that issue. Is it a public repository, and an issue (not a pull request)?",
  rate_limited: "Too many checks in a minute. Try again shortly.",
  unavailable: "The check isn't available right now. Try again later.",
};

function IssueCheck() {
  const inputId = useId();
  const [input, setInput] = useState("");
  const [state, setState] = useState({ status: "idle" });

  const check = async (event) => {
    event.preventDefault();
    const target = parseIssue(input);
    if (!target) return setState({ status: "error", reason: "invalid" });

    setState({ status: "loading" });
    try {
      const params = new URLSearchParams({ repo: target.repo, issue: String(target.number) });
      const response = await fetch(`/api/issue?${params}`, { headers: { Accept: "application/json" } });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.issue) return setState({ status: "ready", issue: data.issue });
      setState({ status: "error", reason: MESSAGES[data?.error] ? data.error : "unavailable" });
    } catch {
      setState({ status: "error", reason: "unavailable" });
    }
  };

  const checks = state.status === "ready" ? checkIssue(state.issue) : [];
  const passed = checks.filter((item) => item.passed).length;

  return (
    <section className="aboutpage-section">
      <h2>Is this a good first issue?</h2>
      <p>Paste one of your issues and get a quick checklist. Simple rules, no AI.</p>
      <form className="maintainers-form" onSubmit={check}>
        <label htmlFor={inputId}>Issue link</label>
        <div className="maintainers-form-row">
          <input
            id={inputId}
            type="text"
            value={input}
            placeholder="https://github.com/owner/repo/issues/12"
            autoComplete="off"
            spellCheck="false"
            onChange={(event) => setInput(event.target.value)}
          />
          <button type="submit" className="primary-button" disabled={state.status === "loading"}>
            {state.status === "loading" ? "Checking…" : "Check issue"}
          </button>
        </div>
      </form>

      {state.status === "error" && (
        <p className="maintainers-message" role="alert">
          {MESSAGES[state.reason]}
        </p>
      )}

      {state.status === "ready" && (
        <div className="maintainers-result" aria-live="polite">
          <h3>
            <a href={state.issue.url} target="_blank" rel="noopener noreferrer">
              #{state.issue.number} {state.issue.title}
            </a>
          </h3>
          <p className="issuecheck-score">
            {passed === checks.length
              ? "Looks like a great first issue. 🎉"
              : `${passed} of ${checks.length} checks pass.`}
          </p>
          <ul className="issuecheck-list">
            {checks.map((item) => (
              <li key={item.id} className={item.passed ? "is-passed" : "is-missing"}>
                <span aria-hidden="true">{item.passed ? "✓" : "✗"}</span>
                <span>
                  <span className="sr-only">{item.passed ? "Passed: " : "Missing: "}</span>
                  {item.label}
                  {!item.passed && <span className="issuecheck-tip">{item.tip}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default IssueCheck;
