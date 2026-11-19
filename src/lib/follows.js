import { isValidProject } from "./search";

// Projects someone follows stay in this browser only, like recent searches:
// no account needed. Coming back shows their new beginner issues.
const STORAGE_KEY = "opensource-radar-following";
export const MAX_FOLLOWS = 20;
const LOOKBACK_DAYS = 30;
export const SHOWN_ISSUES = 5;

const lower = (repo) => repo.toLowerCase();

// "owner / name" (as on issue cards) or "owner/name" → "owner/name".
export const repoKey = (repo) => (typeof repo === "string" ? repo.replace(/\s*\/\s*/, "/").trim() : "");

// A safe, de-duplicated list, or the empty state for anything we wouldn't have stored.
export function cleanFollows(value) {
  const repos = [];
  for (const repo of Array.isArray(value?.repos) ? value.repos : []) {
    const key = repoKey(repo);
    if (!key.includes("/") || !isValidProject(key)) continue;
    if (repos.some((kept) => lower(kept) === lower(key))) continue;
    repos.push(key);
    if (repos.length === MAX_FOLLOWS) break;
  }
  const seen = typeof value?.lastVisit === "string" && !Number.isNaN(Date.parse(value.lastVisit));
  return { repos, lastVisit: seen ? value.lastVisit : null };
}

export function readFollows(storage = globalThis.localStorage) {
  try {
    return cleanFollows(JSON.parse(storage.getItem(STORAGE_KEY)));
  } catch {
    return cleanFollows(null);
  }
}

export function writeFollows(follows, storage = globalThis.localStorage) {
  const clean = cleanFollows(follows);
  try {
    if (clean.repos.length > 0) storage.setItem(STORAGE_KEY, JSON.stringify(clean));
    else storage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: following lasts until the page is closed.
  }
  return clean;
}

export const isFollowing = (follows, repo) =>
  follows.repos.some((kept) => lower(kept) === lower(repoKey(repo)));

// Follows or unfollows. Newest first; the oldest drops off past the limit.
export function toggleFollow(follows, repo) {
  const key = repoKey(repo);
  if (isFollowing(follows, key)) {
    return { ...follows, repos: follows.repos.filter((kept) => lower(kept) !== lower(key)) };
  }
  if (!isValidProject(key) || !key.includes("/")) return follows;
  return { ...follows, repos: [key, ...follows.repos].slice(0, MAX_FOLLOWS) };
}

const isoDate = (date) => date.toISOString().slice(0, 10);

// One search for open, unassigned beginner issues opened lately in the
// followed projects, newest first.
export function followedIssuesPath(repos, now = new Date()) {
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 86400000);
  const query = [
    "is:issue",
    "is:open",
    "archived:false",
    "no:assignee",
    'label:"good first issue","help wanted"',
    `created:>=${isoDate(since)}`,
    ...repos.map((repo) => `repo:${repo}`),
  ].join(" ");
  const params = new URLSearchParams({ q: query, sort: "created", order: "desc", per_page: String(SHOWN_ISSUES) });
  return `/search/issues?${params}`;
}

// Issues opened since the person last came back are marked new.
export const isNewSince = (issue, lastVisit) =>
  Boolean(lastVisit && issue.createdAt && Date.parse(issue.createdAt) > Date.parse(lastVisit));
