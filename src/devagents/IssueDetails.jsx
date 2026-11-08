import { useEffect, useState } from "react";
import Icon from "../components/Icon";

const GITHUB_LOGIN = /^[A-Za-z0-9-]{1,39}$/;
const dateFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? dateFormat.format(date) : "";
};

const looksValid = (data) =>
  typeof data?.issue?.title === "string" && typeof data.issue.url === "string";

// The issue itself and its project, readable without signing in. Everything
// from GitHub is shown as plain text.
function IssueDetails({ repo, number, onLoaded }) {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({ repo, issue: String(number) });
    fetch(`/api/issue?${query}`, { headers: { Accept: "application/json" } })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (cancelled) return;
        if (response.status === 404) return setState({ status: "not_found" });
        if (!response.ok || !looksValid(data)) return setState({ status: "error" });
        setState({ status: "ready", data });
        onLoaded?.(data.issue.title);
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [repo, number, onLoaded]);

  if (state.status === "loading") {
    return <p className="helppage-issue-status">Loading the issue…</p>;
  }
  if (state.status === "not_found") {
    return (
      <p className="helppage-issue-status">
        We couldn't find this issue on GitHub. It may have been deleted, moved or made private.
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <p className="helppage-issue-status">
        We couldn't load this issue's details right now. You can still read it on GitHub.
      </p>
    );
  }

  const { issue, repo: project, setupHint } = state.data;
  const created = formatDate(issue.createdAt);
  const updated = formatDate(issue.updatedAt);
  const author = GITHUB_LOGIN.test(issue.author ?? "") ? issue.author : "";
  const labels = Array.isArray(issue.labels) ? issue.labels.filter((label) => typeof label === "string") : [];

  return (
    <section className="helppage-issue" aria-label="About this issue">
      {labels.length > 0 && (
        <p className="helppage-issue-labels">
          {labels.map((label) => (
            <span key={label} className="issue-label">
              {label}
            </span>
          ))}
        </p>
      )}

      {(created || author) && (
        <p className="helppage-issue-meta">
          {created ? `Opened on ${created}` : "Opened"}
          {author && (
            <>
              {" by "}
              <a href={`https://github.com/${author}`} target="_blank" rel="noopener noreferrer">
                {author}
              </a>
            </>
          )}
          {updated && `, updated ${updated}`}
        </p>
      )}

      {issue.body ? (
        <p className="helppage-issue-body devagents-text">{issue.body}</p>
      ) : (
        <p className="helppage-issue-body devagents-muted">No description provided.</p>
      )}
      {issue.bodyTruncated && (
        <p>
          <a href={issue.url} target="_blank" rel="noopener noreferrer">
            Read the rest on GitHub ↗
          </a>
        </p>
      )}

      {project && (
        <p className="helppage-issue-project">
          <span>
            <Icon name="star" />
            {Number(project.stars || 0).toLocaleString()} stars
          </span>
          {project.language && <span>{project.language}</span>}
          {project.archived && <span>Archived</span>}
          {project.contributingUrl && (
            <a href={project.contributingUrl} target="_blank" rel="noopener noreferrer">
              Contributing guide ↗
            </a>
          )}
        </p>
      )}

      {setupHint?.text && (
        <div className="helppage-issue-setup">
          <h2>{setupHint.heading}, from the README</h2>
          <p className="devagents-text">{setupHint.text}</p>
        </div>
      )}
    </section>
  );
}

export default IssueDetails;
