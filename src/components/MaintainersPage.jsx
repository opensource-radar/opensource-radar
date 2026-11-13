import { useId, useState } from "react";
import CopyButton from "../devagents/CopyButton";
import { badgeImage, badgeLink, badgeMarkdown, parseRepo } from "../lib/badge";
import { LEVEL_LABELS, friendlinessFacts } from "../lib/friendliness";
import { isPlainClick } from "../lib/links";
import { MAINTAINERS } from "../lib/seoPages";
import Icon from "./Icon";

const MESSAGES = {
  invalid: "Enter a repository like owner/repo, or paste its GitHub link.",
  not_found: "We couldn't find that public repository on GitHub.",
  rate_limited: "Too many checks in a minute. Try again shortly.",
  unavailable: "The check isn't available right now. Try again later.",
};

function ProjectCheck() {
  const inputId = useId();
  const [input, setInput] = useState("");
  const [state, setState] = useState({ status: "idle" });

  const check = async (event) => {
    event.preventDefault();
    const repo = parseRepo(input);
    if (!repo) return setState({ status: "error", reason: "invalid" });

    setState({ status: "loading", repo });
    try {
      const response = await fetch(`/api/friendliness?names=${encodeURIComponent(repo)}`, {
        headers: { Accept: "application/json" },
      });
      const data = await response.json().catch(() => null);
      const score = data?.friendliness?.[repo];
      if (score) return setState({ status: "ready", repo, score });
      if (response.ok && data?.friendliness && score === null) {
        return setState({ status: "error", reason: "not_found" });
      }
      setState({ status: "error", reason: data?.error === "rate_limited" ? "rate_limited" : "unavailable" });
    } catch {
      setState({ status: "error", reason: "unavailable" });
    }
  };

  const { repo, score } = state;
  return (
    <section className="aboutpage-section maintainers-check">
      <h2>Check your project</h2>
      <form className="maintainers-form" onSubmit={check}>
        <label htmlFor={inputId}>Your repository</label>
        <div className="maintainers-form-row">
          <input
            id={inputId}
            type="text"
            value={input}
            placeholder="owner/repo"
            autoComplete="off"
            spellCheck="false"
            onChange={(event) => setInput(event.target.value)}
          />
          <button type="submit" className="primary-button" disabled={state.status === "loading"}>
            {state.status === "loading" ? "Checking…" : "Check"}
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
          <div className={`helppage-friendliness level-${score.level ?? "unknown"}`}>
            <h3>
              {repo}: {LEVEL_LABELS[score.level] ?? "not enough recent activity to judge"}
            </h3>
            <ul>
              {friendlinessFacts(score).map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
            <p className="devagents-muted">From your recent issues and pull requests, refreshed daily.</p>
          </div>

          <h3>Add the badge to your README</h3>
          <p>It shows how many open, unassigned good first issues you have, and links to them on OpenSource Radar.</p>
          <p className="maintainers-badge">
            <a href={badgeLink(repo)} target="_blank" rel="noopener noreferrer">
              <img src={badgeImage(repo)} alt="Good first issues on OpenSource Radar" height="20" />
            </a>
          </p>
          <pre className="maintainers-markdown">{badgeMarkdown(repo)}</pre>
          <CopyButton text={badgeMarkdown(repo)} label="Copy Markdown" className="secondary-button" />
          <p>
            <a href={badgeLink(repo)}>See your project's good first issues on Radar</a>
          </p>
        </div>
      )}
    </section>
  );
}

function MaintainersPage({ onBack }) {
  return (
    <article className="aboutpage">
      <a
        className="aboutpage-back"
        href="/"
        onClick={(event) => {
          if (!isPlainClick(event)) return;
          event.preventDefault();
          onBack();
        }}
      >
        <Icon name="arrowLeft" />
        Back to search
      </a>

      <header className="aboutpage-intro">
        <p className="eyebrow">FOR MAINTAINERS</p>
        <h1>{MAINTAINERS.heading}</h1>
        <p className="aboutpage-lead">{MAINTAINERS.lead}</p>
      </header>

      <ProjectCheck />

      <section className="aboutpage-section">
        <h2>Questions maintainers ask</h2>
        <div className="search-help-grid">
          {MAINTAINERS.tips.map(({ question, answer }) => (
            <div key={question} className="search-help-item">
              <h3>{question}</h3>
              <p>{answer}</p>
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}

export default MaintainersPage;
