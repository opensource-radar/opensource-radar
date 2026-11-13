import { useEffect, useId, useRef, useState } from "react";
import Icon from "./Icon";

const MAX_ISSUES = 20;
const STAGES = [
  { id: "saved", label: "Saved" },
  { id: "claimed", label: "Claimed" },
  { id: "pr", label: "PR opened" },
  { id: "merged", label: "Merged" },
];

const keyFor = (issue) => `${issue.repo.replace(" / ", "/")}#${issue.number}`;

function Progress({ stage }) {
  const reached = STAGES.findIndex((s) => s.id === stage);
  return (
    <ol className="journey-steps" aria-label={`Stage: ${STAGES[reached]?.label ?? "Saved"}`}>
      {STAGES.map((step, index) => (
        <li
          key={step.id}
          className={index < reached ? "is-done" : index === reached ? "is-current" : undefined}
          aria-current={index === reached ? "step" : undefined}
        >
          {step.label}
        </li>
      ))}
    </ol>
  );
}

// Mounted only while open, so each opening checks GitHub afresh.
function JourneyDialog({ savedIssues, onClose }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const issues = savedIssues.filter((issue) => issue.number).slice(0, MAX_ISSUES);
  const keys = issues.map(keyFor).join(",");
  const [result, setResult] = useState({ status: keys ? "loading" : "ready", journey: {} });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) {
      if (dialog.showModal) dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    if (!keys) return undefined;

    let cancelled = false;
    fetch(`/api/journey?issues=${encodeURIComponent(keys)}`, { headers: { Accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((data) => {
        if (!cancelled) setResult({ status: "ready", journey: data.journey ?? {} });
      })
      .catch(() => {
        if (!cancelled) setResult({ status: "error", journey: {} });
      });
    return () => {
      cancelled = true;
    };
  }, [keys]);

  const merged = issues.filter((issue) => result.journey[keyFor(issue)]?.stage === "merged").length;

  return (
    <dialog
      ref={dialogRef}
      className="about-dialog journey-dialog"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current.close();
      }}
      onClose={onClose}
    >
      <div className="about-header">
        <h2 id={titleId}>My journey</h2>
        <button type="button" className="icon-button" aria-label="Close" onClick={() => dialogRef.current?.close()}>
          <Icon name="x" />
        </button>
      </div>

      <div className="about-body">
        {issues.length === 0 && <p>Save an issue you'd like to work on, and its progress shows up here.</p>}
        {result.status === "loading" && issues.length > 0 && <p>Checking your saved issues on GitHub…</p>}
        {result.status === "error" && <p>Couldn&rsquo;t check your saved issues right now. Try again in a moment.</p>}

        {result.status === "ready" && issues.length > 0 && (
          <>
            <p className="journey-summary">
              {merged > 0
                ? `${merged} of your saved issues ${merged === 1 ? "is" : "are"} merged. 🎉`
                : "Claim an issue, open a pull request, and get it merged."}
            </p>
            <ul className="journey-list">
              {issues.map((issue) => {
                const info = result.journey[keyFor(issue)];
                return (
                  <li key={issue.id} className="journey-item">
                    <a href={issue.url} target="_blank" rel="noopener noreferrer">
                      {issue.title}
                    </a>
                    <span className="pr-meta">
                      {issue.repo} #{issue.number}
                      {info?.issueClosed && info.stage !== "merged" ? " · issue closed" : ""}
                    </span>
                    {info ? <Progress stage={info.stage} /> : <span className="pr-meta">Couldn&rsquo;t find this issue.</span>}
                    {info?.pullRequest && (
                      <a className="journey-pr" href={info.pullRequest.url} target="_blank" rel="noopener noreferrer">
                        Your pull request #{info.pullRequest.number}
                        {info.pullRequest.state === "CLOSED" ? " (closed)" : ""} ↗
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="contributions-footer">
              Claimed means you're assigned or have commented. Pull requests count when they mention the issue.
            </p>
          </>
        )}
      </div>
    </dialog>
  );
}

export default JourneyDialog;
