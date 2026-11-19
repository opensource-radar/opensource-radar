import { useEffect, useState } from "react";
import IssueCard from "./IssueCard";

// "From GitLab": beginner issues from a curated list of GitLab projects, shown
// under the GitHub results when "Also search: GitLab projects" is on.
function GitLabResults({ language, text, savedIds, onToggleSave }) {
  const key = `${language}|${text}`;
  const [state, setState] = useState({ key, status: "loading", issues: [] });
  if (state.key !== key) setState({ key, status: "loading", issues: [] });

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (language) params.set("language", language);
    if (text) params.set("q", text);
    fetch(`/api/gitlab?${params}`, { headers: { Accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((data) => {
        if (!cancelled) setState({ key, status: "ready", issues: Array.isArray(data.issues) ? data.issues : [] });
      })
      .catch(() => {
        if (!cancelled) setState({ key, status: "error", issues: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [key, language, text]);

  return (
    <section className="gitlab-results" aria-labelledby="gitlab-results-heading">
      <h2 id="gitlab-results-heading">From GitLab</h2>
      <p className="gitlab-results-note">
        Beginner issues nobody is assigned to, from active GitLab projects that label them.
      </p>
      {state.status === "loading" && <p className="empty-state">Searching GitLab…</p>}
      {state.status === "error" && <p className="empty-state">Couldn&rsquo;t reach GitLab just now. Try again later.</p>}
      {state.status === "ready" && state.issues.length === 0 && (
        <p className="empty-state">
          No GitLab issues match{language ? ` in ${language}` : ""}
          {text ? ` for “${text}”` : ""} right now.
        </p>
      )}
      <div className="issues-list">
        {state.issues.map((issue) => (
          <IssueCard
            key={issue.id}
            source="gitlab"
            title={issue.title}
            description={issue.description}
            label={issue.label}
            language={issue.language}
            repo={issue.repo}
            url={issue.url}
            comments={issue.comments}
            updatedAt={issue.updatedAt}
            number={issue.number}
            author={issue.author}
            createdAt={issue.createdAt}
            saved={savedIds.has(issue.id)}
            onToggleSave={() => onToggleSave(issue)}
          />
        ))}
      </div>
    </section>
  );
}

export default GitLabResults;
