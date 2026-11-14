import { githubHeaders } from "../github.js";
import { cacheJson, cachedJson, lookupToken } from "../lookup.js";
import { json } from "../session.js";

const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;
const CACHE_SECONDS = 6 * 60 * 60;
const DAY = 24 * 60 * 60 * 1000;
const STALE_DAYS = 90;
const ASSIGNED_IDLE_DAYS = 30;
const WAITING_DAYS = 7;
const MAINTAINERS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
// Projects spell the label in different ways.
const LABELS = ["good first issue", "good-first-issue", "Good First Issue", "good first issue :+1:", "first-timers-only"];

const QUERY = `query($owner: String!, $name: String!, $labels: [String!]) {
  repository(owner: $owner, name: $name) {
    issues(states: OPEN, labels: $labels, first: 50, orderBy: { field: UPDATED_AT, direction: ASC }) {
      totalCount
      nodes {
        number title url createdAt updatedAt authorAssociation
        assignees(first: 3) { nodes { login } }
        comments(first: 20) { nodes { authorAssociation } }
        timelineItems(itemTypes: [ASSIGNED_EVENT], last: 1) { nodes { ... on AssignedEvent { createdAt } } }
      }
    }
  }
}`;

const daysSince = (date, now) => Math.floor((now - Date.parse(date)) / DAY);

// Sorts a project's open good first issues into the ones that need attention.
export function labelHealth(issues, now = Date.now()) {
  const stale = [];
  const waiting = [];
  const idleAssigned = [];
  for (const issue of issues) {
    const item = { number: issue.number, title: String(issue.title).slice(0, 200), url: issue.url };
    const quietDays = daysSince(issue.updatedAt, now);
    const assigned = (issue.assignees?.nodes ?? []).length > 0;
    const assignedAt = issue.timelineItems?.nodes?.at(-1)?.createdAt ?? issue.updatedAt;
    const maintainerReplied =
      MAINTAINERS.has(issue.authorAssociation) ||
      (issue.comments?.nodes ?? []).some((comment) => MAINTAINERS.has(comment?.authorAssociation));

    if (assigned && quietDays >= ASSIGNED_IDLE_DAYS) {
      idleAssigned.push({ ...item, days: daysSince(assignedAt, now) });
    } else if (quietDays >= STALE_DAYS) {
      stale.push({ ...item, days: quietDays });
    } else if (!maintainerReplied && daysSince(issue.createdAt, now) >= WAITING_DAYS) {
      waiting.push({ ...item, days: daysSince(issue.createdAt, now) });
    }
  }
  return { stale, waiting, idleAssigned };
}

// GET /api/label-health?repo=owner/repo
export async function GET(request) {
  const repo = new URL(request.url).searchParams.get("repo") || "";
  if (!REPO_PATTERN.test(repo)) return json({ error: "invalid_repo" }, [], 400);

  const key = `label-health:v1:${repo.toLowerCase()}`;
  const cached = await cachedJson(key);
  if (cached) return json(cached);

  const access = await lookupToken(request, "label-health", 10);
  if (access.error) return json({ error: access.error }, access.cookies, access.status);

  const [owner, name] = repo.split("/");
  let data;
  try {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { ...githubHeaders(access.token), "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { owner, name, labels: LABELS } }),
    });
    if (!response.ok) return json({ error: "github_error" }, access.cookies, 502);
    data = (await response.json()).data;
  } catch {
    return json({ error: "github_error" }, access.cookies, 502);
  }
  if (!data?.repository) return json({ error: "not_found" }, access.cookies, 404);

  const issues = data.repository.issues;
  const result = { repo, total: issues.totalCount, checked: issues.nodes.length, ...labelHealth(issues.nodes) };
  await cacheJson(key, result, CACHE_SECONDS);
  return json(result, access.cookies);
}
