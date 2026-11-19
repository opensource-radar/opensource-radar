// Fetches Radar's and GitHub's answers for the panel. Doing it here, with the
// extension's host permissions, avoids cross-site limits on github.com pages.
// Nothing is stored and no cookies are sent.
importScripts("lib.js");

const { SITE, countOpenPullRequests } = globalThis.RadarExtension;
const TIMEOUT_MS = 10000;
const REPO = /^[\w.-]+\/[\w.-]+$/;

async function getJson(url, headers = {}) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", ...headers },
    credentials: "omit",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function lookup(repo, number) {
  const [friendliness, details, timeline] = await Promise.allSettled([
    getJson(`${SITE}/api/friendliness?names=${encodeURIComponent(repo)}`),
    getJson(`${SITE}/api/issue?repo=${encodeURIComponent(repo)}&issue=${number}`),
    getJson(`https://api.github.com/repos/${repo}/issues/${number}/timeline?per_page=100`, {
      Accept: "application/vnd.github+json",
    }),
  ]);
  const issue = details.status === "fulfilled" ? details.value.issue : null;
  return {
    friendliness: friendliness.status === "fulfilled" ? (friendliness.value.friendliness?.[repo] ?? null) : null,
    issue: issue ? { state: issue.state, assigned: issue.assigned, title: issue.title } : null,
    openPullRequests: timeline.status === "fulfilled" ? countOpenPullRequests(timeline.value) : null,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "radar-lookup" || !REPO.test(message.repo ?? "") || !Number.isSafeInteger(message.number)) {
    return false;
  }
  lookup(message.repo, message.number)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch(() => sendResponse({ ok: false }));
  return true; // answers asynchronously
});
