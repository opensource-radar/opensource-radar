import { useEffect, useId, useRef, useState } from "react";
import { githubUrl } from "../lib/github";
import { isRadarPullRequest } from "../lib/shareCard";
import { streakText, weekStreak } from "../lib/streak";
import Icon from "./Icon";
import ProfileSettings from "./ProfileSettings";
import ShareCard from "./ShareCard";
import "./Streak.css";

const PULL_REQUEST_LIMIT = 30;

const STATUS = {
  open: { label: "Open", icon: "gitPullRequest" },
  draft: { label: "Draft", icon: "gitPullRequestDraft" },
  merged: { label: "Merged", icon: "gitMerge" },
  closed: { label: "Closed", icon: "gitPullRequestClosed" },
};

function statusOf(pullRequest) {
  if (pullRequest.pull_request?.merged_at) return "merged";
  if (pullRequest.state === "closed") return "closed";
  return pullRequest.draft ? "draft" : "open";
}

// Mounted only while open (NavMenu renders it on demand), so each opening
// starts fresh and fetches the latest pull requests.
function ContributionsDialog({ login, onClose }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const [result, setResult] = useState({ status: "loading", items: [], total: 0 });
  const [radarOnly, setRadarOnly] = useState(false);
  const [sharing, setSharing] = useState(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) {
      if (dialog.showModal) dialog.showModal();
      else dialog.setAttribute("open", "");
    }

    let cancelled = false;
    const query = encodeURIComponent(`type:pr author:${login}`);

    fetch(
      githubUrl(
        `/search/issues?q=${query}&sort=updated&order=desc&per_page=${PULL_REQUEST_LIMIT}`,
        true,
      ),
    )
      .then((response) =>
        response.ok ? response.json() : Promise.reject(response),
      )
      .then((data) => {
        if (!cancelled) {
          setResult({
            status: "ready",
            items: data.items ?? [],
            total: data.total_count ?? 0,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setResult({ status: "error", items: [], total: 0 });
      });

    return () => {
      cancelled = true;
    };
  }, [login]);

  const counts = result.items.reduce((totals, pullRequest) => {
    const status = statusOf(pullRequest);
    return { ...totals, [status]: (totals[status] || 0) + 1 };
  }, {});

  // PRs written with DevAgents' help, and how many of them were merged.
  const radarItems = result.items.filter(isRadarPullRequest);
  const radarMerged = radarItems.filter((item) => statusOf(item) === "merged").length;
  const shown = radarOnly ? radarItems : result.items;
  // "First" is only certain when every PR is loaded and just one was merged.
  const firstMerge = counts.merged === 1 && result.total <= result.items.length;
  const streak = streakText(weekStreak(result.items.map((item) => item.pull_request?.merged_at)));

  return (
    <dialog
      ref={dialogRef}
      className="about-dialog contributions-dialog"
      aria-labelledby={titleId}
      onClick={(event) => {
        // A click on the dialog element itself is a click on the backdrop.
        if (event.target === dialogRef.current) dialogRef.current.close();
      }}
      onClose={onClose}
    >
      <div className="about-header">
        <h2 id={titleId}>My contributions</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close"
          onClick={() => dialogRef.current?.close()}
        >
          <Icon name="x" />
        </button>
      </div>

      <div className="about-body">
        {result.status === "loading" && <p>Loading your pull requests...</p>}

        {result.status === "error" && (
          <p>Couldn&rsquo;t load your pull requests. Try again in a moment.</p>
        )}

        {result.status === "ready" && result.items.length === 0 && (
          <p>
            You haven&rsquo;t opened a pull request yet. Pick an issue from the
            list and make your first one!
          </p>
        )}

        {result.status === "ready" && result.items.length > 0 && (
          <>
            <p className="contributions-summary">
              {Object.entries(STATUS)
                .filter(([status]) => counts[status])
                .map(([status, { label }]) => (
                  <span key={status} className={`pr-count pr-${status}`}>
                    <Icon name={STATUS[status].icon} />
                    {counts[status]} {label.toLowerCase()}
                  </span>
                ))}
            </p>

            {streak && <p className="contributions-streak">🌱 {streak}</p>}

            {radarItems.length > 0 && (
              <div className="contributions-radar">
                <p>
                  {radarItems.length} made with Radar, {radarMerged} merged (
                  {Math.round((radarMerged / radarItems.length) * 100)}%)
                </p>
                <label>
                  <input
                    type="checkbox"
                    checked={radarOnly}
                    onChange={(event) => setRadarOnly(event.target.checked)}
                  />{" "}
                  Only show PRs made with Radar
                </label>
              </div>
            )}

            <ul className="pr-list">
              {shown.map((pullRequest) => {
                const status = statusOf(pullRequest);
                const repo = pullRequest.repository_url.split("/repos/")[1];
                const isSharing = sharing === pullRequest.id;

                return (
                  <li key={pullRequest.id} className="pr-item">
                    <span
                      className={`pr-icon pr-${status}`}
                      title={STATUS[status].label}
                    >
                      <Icon name={STATUS[status].icon} />
                    </span>
                    <div className="pr-text">
                      <a
                        href={pullRequest.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {pullRequest.title}
                      </a>
                      <span className="pr-meta">
                        <span className="sr-only">{STATUS[status].label}: </span>
                        {repo} #{pullRequest.number} · updated{" "}
                        {new Date(pullRequest.updated_at).toLocaleDateString()}
                      </span>
                      {(isRadarPullRequest(pullRequest) || status === "merged") && (
                        <span className="pr-extras">
                          {isRadarPullRequest(pullRequest) && (
                            <span className="pr-radar">Made with Radar</span>
                          )}
                          {status === "merged" && (
                            <button
                              type="button"
                              className="text-button"
                              aria-label={`Share "${pullRequest.title}"`}
                              aria-expanded={isSharing}
                              onClick={() => setSharing(isSharing ? null : pullRequest.id)}
                            >
                              {isSharing ? "Hide share card" : "Share"}
                            </button>
                          )}
                        </span>
                      )}
                      {isSharing && (
                        <ShareCard
                          pullRequest={{
                            title: pullRequest.title,
                            repo,
                            number: pullRequest.number,
                            mergedAt: pullRequest.pull_request?.merged_at,
                          }}
                          login={login}
                          first={firstMerge}
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {result.status === "ready" && result.total > 0 && (
          <p className="contributions-footer">
            {result.total > result.items.length
              ? `Showing your ${result.items.length} most recent of ${result.total}. `
              : ""}
            <a
              href={`https://github.com/pulls?q=${encodeURIComponent(`is:pr author:${login}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View all on GitHub
            </a>
          </p>
        )}
        <ProfileSettings login={login} />
      </div>
    </dialog>
  );
}

export default ContributionsDialog;
