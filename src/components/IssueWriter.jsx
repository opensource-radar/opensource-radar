import { useId, useState } from "react";
import CopyButton from "../devagents/CopyButton";
import { checkIssue } from "../lib/issueCheck";
import "./IssueCheck.css";

const MESSAGES = {
  invalid_idea: "Describe the idea in a sentence or two (10 to 1,500 characters).",
  rate_limited: "Too many drafts in a minute. Try again shortly.",
  unavailable: "The writer isn't available right now. Try again later.",
};
// The checks about the text itself; labels and assignees are set on GitHub.
const TEXT_CHECKS = new Set(["explains", "done", "files", "length"]);

function IssueWriter() {
  const fieldId = useId();
  const [idea, setIdea] = useState("");
  const [state, setState] = useState({ status: "idle" });

  const write = async (event) => {
    event.preventDefault();
    setState({ status: "loading" });
    try {
      const response = await fetch("/api/issue-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: idea.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.title && data?.body) return setState({ status: "ready", draft: data });
      setState({ status: "error", reason: MESSAGES[data?.error] ? data.error : "unavailable" });
    } catch {
      setState({ status: "error", reason: "unavailable" });
    }
  };

  const draft = state.draft;
  const checks = draft ? checkIssue({ body: draft.body, state: "open" }).filter((c) => TEXT_CHECKS.has(c.id)) : [];

  return (
    <section className="aboutpage-section">
      <h2>Write a good first issue</h2>
      <p>Describe a small task in your own words, and get a clear issue to edit and post. AI-written, so check it before you post.</p>
      <form className="maintainers-form" onSubmit={write}>
        <label htmlFor={fieldId}>Your idea</label>
        <textarea
          id={fieldId}
          className="issuewriter-idea"
          rows={4}
          value={idea}
          placeholder="The search box doesn't clear when you press Escape. It's in src/components/SearchBar.jsx."
          onChange={(event) => setIdea(event.target.value)}
        />
        <button type="submit" className="primary-button" disabled={state.status === "loading" || idea.trim().length < 10}>
          {state.status === "loading" ? "Writing…" : "Write the issue"}
        </button>
      </form>

      {state.status === "error" && (
        <p className="maintainers-message" role="alert">
          {MESSAGES[state.reason]}
        </p>
      )}

      {draft && (
        <div className="maintainers-result" aria-live="polite">
          <h3>{draft.title}</h3>
          <CopyButton text={draft.title} label="Copy title" className="secondary-button" />
          <pre className="maintainers-markdown issuewriter-body">{draft.body}</pre>
          <CopyButton text={draft.body} label="Copy description" className="secondary-button" />
          <p className="devagents-muted">
            Fill in anything in [square brackets], then add the &ldquo;good first issue&rdquo; label when you post it.
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

export default IssueWriter;
