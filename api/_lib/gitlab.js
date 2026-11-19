// Beginner issues from GitLab.com. GitLab can't search issues across all of
// GitLab quickly (those requests time out), so Radar asks a curated list of
// active projects that label beginner tasks, each with its own labels.
// Project issue lists are public, so no token is needed; with GITLAB_TOKEN
// set, requests use it for GitLab's higher limits.

export const GITLAB_PROJECTS = [
  { path: "gitlab-org/gitlab", language: "Ruby", labels: ["quick win", "Seeking community contributions"] },
  { path: "gitlab-org/gitlab-runner", language: "Go", labels: ["quick win", "Seeking community contributions"] },
  { path: "gitlab-org/cli", language: "Go", labels: ["quick win", "Seeking community contributions"] },
  { path: "gitlab-org/gitlab-vscode-extension", language: "TypeScript", labels: ["quick win"] },
  { path: "gitlab-org/omnibus-gitlab", language: "Ruby", labels: ["quick win", "Seeking community contributions"] },
  { path: "gitlab-org/gitlab-development-kit", language: "Ruby", labels: ["quick win"] },
  { path: "gitlab-org/editor-extensions/gitlab-jetbrains-plugin", language: "Kotlin", labels: ["quick win"] },
  { path: "gitlab-org/gitlab-pages", language: "Go", labels: ["quick win"] },
  { path: "gitlab-org/container-registry", language: "Go", labels: ["quick win"] },
  { path: "gitlab-org/gitlab-shell", language: "Go", labels: ["quick win"] },
  { path: "gitlab-org/charts/gitlab", language: "Go", labels: ["quick win"] },
  { path: "inkscape/inkscape", language: "C++", labels: ["help wanted"] },
  { path: "veloren/veloren", language: "Rust", labels: ["beginner"] },
  { path: "mailman/mailman", language: "Python", labels: ["easy"] },
  { path: "mailman/postorius", language: "Python", labels: ["easy"] },
];

export const PER_PROJECT = 8;
export const MAX_ISSUES = 20;
const TIMEOUT_MS = 8000;
const MAX_TEXT = 100;
const USERNAME = /^[\w.-]{1,255}$/;

const text = (value, max) => (typeof value === "string" ? value.slice(0, max) : "");

// The projects to ask: all of them, or only those in one language.
export function projectsFor(language) {
  if (!language) return GITLAB_PROJECTS;
  const lower = language.toLowerCase();
  return GITLAB_PROJECTS.filter((project) => project.language.toLowerCase() === lower);
}

// One request per label (GitLab's "labels=" means "has all of these").
export function issuesUrl(project, label, words = "") {
  const params = new URLSearchParams({
    state: "opened",
    labels: label,
    assignee_id: "None",
    order_by: "updated_at",
    sort: "desc",
    per_page: String(PER_PROJECT),
  });
  const search = text(words, MAX_TEXT).trim();
  if (search) params.set("search", search);
  return `https://gitlab.com/api/v4/projects/${encodeURIComponent(project.path)}/issues?${params}`;
}

// A GitLab issue in the shape Radar's issue cards use. Ids are negative so
// they never clash with GitHub's in Saved.
export function toRadarIssue(item, project) {
  const labels = Array.isArray(item?.labels) ? item.labels.map((label) => text(label, 100)).filter(Boolean) : [];
  const url = text(item?.web_url, 300);
  if (!Number.isSafeInteger(item?.id) || !url.startsWith("https://gitlab.com/")) return null;
  const author = text(item.author?.username, 255);
  return {
    id: -item.id,
    source: "gitlab",
    title: text(item.title, 300) || "Untitled issue",
    description: text(item.description, 1000) || "No description provided.",
    labels,
    label: labels.join(", ") || "Unlabeled",
    language: project.language,
    repo: project.path.split("/").slice(-2).join(" / "),
    project: project.path,
    url,
    comments: Number.isSafeInteger(item.user_notes_count) ? item.user_notes_count : 0,
    number: Number.isSafeInteger(item.iid) ? item.iid : null,
    author: USERNAME.test(author) ? author : "",
    createdAt: text(item.created_at, 40),
    updatedAt: text(item.updated_at, 40),
  };
}

// Newest activity first, each issue once (it can carry two of the labels).
export function mergeIssues(lists) {
  const byId = new Map();
  for (const issue of lists.flat()) if (issue && !byId.has(issue.id)) byId.set(issue.id, issue);
  return [...byId.values()]
    .sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0))
    .slice(0, MAX_ISSUES);
}

export async function fetchGitLabIssues({ language = "", words = "", token = "", fetcher = fetch } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers["PRIVATE-TOKEN"] = token;
  const requests = projectsFor(language).flatMap((project) =>
    project.labels.map(async (label) => {
      const response = await fetcher(issuesUrl(project, label, words), {
        headers,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`GitLab answered ${response.status}`);
      const items = await response.json();
      return Array.isArray(items) ? items.map((item) => toRadarIssue(item, project)) : [];
    }),
  );
  const settled = await Promise.allSettled(requests);
  const answered = settled.filter((result) => result.status === "fulfilled");
  if (requests.length > 0 && answered.length === 0) throw new Error("GitLab didn't answer");
  return mergeIssues(answered.map((result) => result.value));
}
