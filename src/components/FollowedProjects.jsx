import { useEffect, useRef, useState } from "react";
import { helpPath } from "../devagents/links";
import { followedIssuesPath, isNewSince, SHOWN_ISSUES } from "../lib/follows";
import { githubUrl } from "../lib/github";
import { isPlainClick } from "../lib/links";
import { toIssue } from "../lib/search";
import Icon from "./Icon";

const CACHE_KEY = "opensource-radar-following-issues";
const CACHE_MS = 10 * 60 * 1000;
const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

// Reuses a recent answer for the same projects, so coming back to the page
// doesn't spend another search from GitHub's hourly limit.
function cached(path, storage = globalThis.sessionStorage) {
  try {
    const entry = JSON.parse(storage.getItem(CACHE_KEY));
    if (entry?.path === path && Date.now() - entry.at < CACHE_MS && Array.isArray(entry.items)) return entry.items;
  } catch {
    // No cache: ask GitHub.
  }
  return null;
}

function remember(path, items, storage = globalThis.sessionStorage) {
  try {
    storage.setItem(CACHE_KEY, JSON.stringify({ path, at: Date.now(), items }));
  } catch {
    // Storage unavailable: it just asks again next time.
  }
}

// "New in projects you follow": recent beginner issues from followed projects,
// with the ones opened since the last visit marked new.
function FollowedProjects({ repos, lastVisit, signedIn, ready, onUnfollow, onSeen, onOpenHelp }) {
  const path = followedIssuesPath(repos);
  const [state, setState] = useState(() => {
    const items = cached(path);
    return items ? { status: "ready", path, items } : { status: "loading", path, items: [] };
  });
  // When the followed projects change, the list starts over.
  if (state.path !== path) {
    const items = cached(path);
    setState(items ? { status: "ready", path, items } : { status: "loading", path, items: [] });
  }
  // Which issues count as new is fixed for this visit, even after it's recorded.
  const [since] = useState(lastVisit);

  useEffect(() => {
    if (!ready || state.status !== "loading") return undefined;
    let cancelled = false;
    fetch(githubUrl(path, signedIn), { headers: { Accept: "application/vnd.github+json" } })
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((data) => {
        if (cancelled) return;
        const items = (data.items || []).slice(0, SHOWN_ISSUES).map((item) => toIssue(item));
        remember(path, items);
        setState({ status: "ready", path, items });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", path, items: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [path, signedIn, ready, state.status]);

  // Coming back later counts from now. Recorded once per visit.
  const recorded = useRef(false);
  useEffect(() => {
    if (state.status !== "ready" || recorded.current) return;
    recorded.current = true;
    onSeen();
  }, [state.status, onSeen]);

  const newCount = state.items.filter((issue) => isNewSince(issue, since)).length;

  return (
    <section className="followed" aria-labelledby="followed-heading">
      <div className="followed-header">
        <h2 id="followed-heading">
          <Icon name="star" />
          New in projects you follow
        </h2>
        {newCount > 0 && (
          <span className="followed-count">
            {newCount} new since your last visit
          </span>
        )}
      </div>

      {state.status === "loading" && <p className="followed-message">Checking your projects…</p>}
      {state.status === "error" && (
        <p className="followed-message">Couldn&rsquo;t check your projects just now. Try again later.</p>
      )}
      {state.status === "ready" && state.items.length === 0 && (
        <p className="followed-message">No new beginner issues in these projects in the last 30 days.</p>
      )}
      {state.items.length > 0 && (
        <ul className="followed-list">
          {state.items.map((issue) => {
            const repo = issue.repo.replace(" / ", "/");
            const help = issue.number ? helpPath(repo, issue.number) : null;
            const created = issue.createdAt ? new Date(issue.createdAt) : null;
            return (
              <li key={issue.id}>
                {isNewSince(issue, since) && <span className="followed-new">New</span>}
                <a
                  className="followed-title"
                  href={help ?? issue.url}
                  {...(help ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                  onClick={(event) => {
                    if (!help || !isPlainClick(event)) return;
                    event.preventDefault();
                    onOpenHelp(issue);
                  }}
                >
                  {issue.title}
                </a>
                <span className="followed-meta">
                  {issue.repo}
                  {created && !Number.isNaN(created.getTime()) && ` · ${dateFormat.format(created)}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="followed-projects">
        <span className="followed-projects-label">Following:</span>
        {repos.map((repo) => (
          <span key={repo} className="followed-chip">
            {repo}
            <button
              type="button"
              className="followed-chip-remove"
              aria-label={`Stop following ${repo}`}
              onClick={() => onUnfollow(repo)}
            >
              <Icon name="x" />
            </button>
          </span>
        ))}
      </div>
    </section>
  );
}

export default FollowedProjects;
