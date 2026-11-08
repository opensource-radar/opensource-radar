import { loadSession } from "./_lib/auth.js";
import { fetchRepositories, githubHeaders } from "./_lib/github.js";
import { setupHint } from "./_lib/readme.js";
import { getConfig, json } from "./_lib/session.js";
import { redis, storeAvailable } from "./_lib/store.js";

const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;
const MAX_BODY = 1500;
const CACHE_SECONDS = 10 * 60;
const TIMEOUT_MS = 8000;
// Only for visitors using the shared server token.
const LOOKUPS_PER_MINUTE = 30;

function clientIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function overRateLimit(request) {
  if (!storeAvailable()) return false;
  const key = `issue-rate:${clientIp(request)}`;
  try {
    const count = await redis(["INCR", key]);
    if (count === 1) await redis(["EXPIRE", key, 60]);
    return count > LOOKUPS_PER_MINUTE;
  } catch {
    return false;
  }
}

class GitHubError extends Error {
  constructor(status) {
    super(`GitHub answered ${status}`);
    this.status = status;
  }
}

async function getFromGitHub(token, path, accept) {
  const headers = githubHeaders(token);
  if (accept) headers.Accept = accept;
  const response = await fetch(`https://api.github.com${path}`, {
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new GitHubError(response.status);
  return accept ? response.text() : response.json();
}

const text = (value) => (typeof value === "string" ? value : "");

async function loadDetails(token, repo, number) {
  const issue = await getFromGitHub(token, `/repos/${repo}/issues/${number}`);
  if (issue.pull_request) throw new GitHubError(404);

  // Project details and the README are extras: the page still works without them.
  const [project, readme] = await Promise.all([
    fetchRepositories(token, [repo]).then(([found]) => found).catch(() => null),
    getFromGitHub(token, `/repos/${repo}/readme`, "application/vnd.github.raw").catch(() => null),
  ]);

  const body = text(issue.body);
  return {
    issue: {
      number: issue.number,
      title: text(issue.title) || "Untitled issue",
      body: body.slice(0, MAX_BODY),
      bodyTruncated: body.length > MAX_BODY,
      labels: (issue.labels ?? []).map((label) => text(label?.name ?? label)).filter(Boolean),
      author: text(issue.user?.login),
      createdAt: text(issue.created_at),
      updatedAt: text(issue.updated_at),
      state: text(issue.state),
      comments: Number.isSafeInteger(issue.comments) ? issue.comments : 0,
      url: text(issue.html_url),
    },
    repo: project
      ? {
          stars: project.stargazerCount ?? 0,
          language: project.primaryLanguage?.name ?? "",
          archived: Boolean(project.isArchived),
          contributingUrl: project.contributingGuidelines?.url ?? null,
        }
      : null,
    setupHint: setupHint(readme),
  };
}

// GET /api/issue?repo=owner/name&issue=123
// Public details of one issue, for the help page. Anyone can read them, so
// signed-out visitors don't use up their own GitHub allowance: it uses the
// signed-in user's token, or the read-only server token for visitors.
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const repo = params.get("repo") ?? "";
  const number = Number(params.get("issue"));
  if (
    !REPO_PATTERN.test(repo) ||
    repo.split("/").some((part) => /^\.+$/.test(part)) ||
    !Number.isSafeInteger(number) ||
    number < 1
  ) {
    return json({ error: "invalid_request" }, [], 400);
  }

  const config = getConfig();
  const { session, cookies } = config.configured
    ? await loadSession(request, config)
    : { session: null, cookies: [] };

  let token = session?.accessToken;
  if (!token) {
    token = process.env.GITHUB_READ_TOKEN || "";
    if (!token) return json({ error: "unavailable" }, cookies, 503);
    if (await overRateLimit(request)) return json({ error: "rate_limited" }, cookies, 429);
  }

  const key = `issue:${repo.toLowerCase()}#${number}`;
  if (storeAvailable()) {
    try {
      const stored = await redis(["GET", key]);
      if (stored) return json(JSON.parse(stored), cookies);
    } catch {
      // Treated as a miss.
    }
  }

  let details;
  try {
    details = await loadDetails(token, repo, number);
  } catch (error) {
    if (error.status === 404 || error.status === 410) {
      return json({ error: "not_found" }, cookies, 404);
    }
    return json({ error: "unavailable" }, cookies, 503);
  }

  if (storeAvailable()) {
    try {
      await redis(["SET", key, JSON.stringify(details), "EX", CACHE_SECONDS]);
    } catch {
      // Not cached this time.
    }
  }
  return json(details, cookies);
}
