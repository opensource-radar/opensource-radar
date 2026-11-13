import { useEffect, useState } from "react";
import CopyButton from "../devagents/CopyButton";
import { isPlainClick } from "../lib/links";
import { setPageMeta } from "../lib/pageMeta";
import { SITE_URL } from "../lib/seoPages";
import Icon from "./Icon";

const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

// Search engines only list a profile when its owner chose that.
function useRobots(allowed) {
  useEffect(() => {
    if (allowed) return undefined;
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.append(meta);
    return () => meta.remove();
  }, [allowed]);
}

function ProfilePage({ login, onBack }) {
  const [state, setState] = useState({ status: "loading" });
  useRobots(state.status === "ready" && state.profile.indexable);

  useEffect(() => {
    let cancelled = false;
    setPageMeta({
      path: `/u/${login}`,
      title: `${login}'s open-source contributions | OpenSource Radar`,
      description: `Pull requests ${login} got merged in open-source projects.`,
    });
    fetch(`/api/profile?login=${encodeURIComponent(login)}`, { headers: { Accept: "application/json" } })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (cancelled) return;
        if (response.ok && data?.profile) setState({ status: "ready", profile: data.profile });
        else setState({ status: response.status === 404 ? "not_public" : "error" });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [login]);

  const back = (
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
      Find your own first issue
    </a>
  );

  if (state.status !== "ready") {
    return (
      <article className="aboutpage">
        {back}
        <p className="profile-status">
          {state.status === "loading"
            ? "Loading…"
            : state.status === "not_public"
              ? "This profile isn't public."
              : "We couldn't load this profile right now. Try again later."}
        </p>
      </article>
    );
  }

  const { profile } = state;
  const radarCount = profile.pullRequests.filter((pr) => pr.madeWithRadar).length;
  const url = `${SITE_URL}/u/${profile.login}`;
  return (
    <article className="aboutpage profile-page">
      {back}
      <header className="profile-header">
        <img src={profile.avatarUrl} alt="" width="72" height="72" />
        <div>
          <h1>{profile.name}</h1>
          <a href={`https://github.com/${profile.login}`} target="_blank" rel="noopener noreferrer">
            @{profile.login}
          </a>
        </div>
      </header>

      <p className="profile-stats">
        <span>
          <strong>{profile.totalMerged}</strong> merged pull {profile.totalMerged === 1 ? "request" : "requests"}
        </span>
        {radarCount > 0 && (
          <span>
            <strong>{radarCount}</strong> made with Radar
          </span>
        )}
      </p>

      {profile.pullRequests.length === 0 ? (
        <p>No merged pull requests in public projects yet.</p>
      ) : (
        <ul className="pr-list profile-prs">
          {profile.pullRequests.map((pr) => (
            <li key={pr.url} className="pr-item">
              <span className="pr-icon pr-merged" title="Merged">
                <Icon name="gitMerge" />
              </span>
              <div className="pr-text">
                <a href={pr.url} target="_blank" rel="noopener noreferrer">
                  {pr.title}
                </a>
                <span className="pr-meta">
                  {pr.repo} #{pr.number}
                  {pr.mergedAt ? ` · merged ${dateFormat.format(new Date(pr.mergedAt))}` : ""}
                </span>
                {pr.madeWithRadar && (
                  <span className="pr-extras">
                    <span className="pr-radar">Made with Radar</span>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="profile-share">
        <CopyButton text={url} label="Copy profile link" className="secondary-button" />
      </p>
    </article>
  );
}

export default ProfilePage;
