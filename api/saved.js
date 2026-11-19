import { loadSession } from "./_lib/auth.js";
import { getConfig, json } from "./_lib/session.js";
import { redis, storeAvailable } from "./_lib/store.js";

const MAX_SAVED = 200;
const MAX_BODY_LENGTH = 400_000;

const GITHUB_LOGIN = /^[A-Za-z0-9-]{1,39}$/;
const GITLAB_USER = /^[\w.-]{1,60}$/;
const text = (value, max) =>
  typeof value === "string" ? value.slice(0, max) : "";

// Only keep the fields the site shows, with sane sizes, so the stored list
// can't be used to park arbitrary data in the database.
function cleanIssue(issue) {
  if (!issue || !Number.isSafeInteger(issue.id)) return null;


  const url = text(issue.url, 300);
  // GitHub issues, and GitLab ones from "Include GitLab projects".
  if (!url.startsWith("https://github.com/") && !url.startsWith("https://gitlab.com/")) return null;

  return {
    id: issue.id,
    title: text(issue.title, 300) || "Untitled issue",
    description: text(issue.description, 1000),
    labels: Array.isArray(issue.labels)
      ? issue.labels.slice(0, 20).map((label) => text(label, 100))
      : [],
    label: text(issue.label, 400),
    language: text(issue.language, 50),
    repo: text(issue.repo, 120),
    url,
    updatedAt: text(issue.updatedAt, 40),
    number: Number.isSafeInteger(issue.number) && issue.number > 0 ? issue.number : null,
    author: (url.startsWith("https://gitlab.com/") ? GITLAB_USER : GITHUB_LOGIN).test(issue.author ?? "")
      ? issue.author
      : "",
    createdAt: text(issue.createdAt, 40),
    savedAt: Number.isFinite(issue.savedAt) ? issue.savedAt : Date.now(),
  };
}

async function signedInUser(request) {
  const config = getConfig();
  if (!config.configured) return { user: null, cookies: [] };

  const { session, cookies } = await loadSession(request, config);
  return { user: session?.user ?? null, cookies };
}

const keyFor = (user) => `saved:${user.login.toLowerCase()}`;

// Where someone got to on each issue's help page, so they can carry on from
// another device. "owner/repo#12" -> { step, visited, at }.
const progressKey = (user) => `help-progress:v1:${user.login.toLowerCase()}`;
const ISSUE_KEY = /^[\w.-]+\/[\w.-]+#\d{1,9}$/;
const MAX_PROGRESS = 100;
const MAX_STEP = 20;
const isStep = (value) => Number.isInteger(value) && value >= 0 && value < MAX_STEP;

async function readProgress(user) {
  const stored = await redis(["GET", progressKey(user)]);
  const value = stored ? JSON.parse(stored) : {};
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function saveProgress(user, body) {
  const key = typeof body?.issue === "string" ? body.issue.toLowerCase() : "";
  if (!ISSUE_KEY.test(key) || !isStep(body.step)) return null;
  const visited = Array.isArray(body.visited) ? [...new Set(body.visited.filter(isStep))] : [];
  const all = { ...(await readProgress(user)), [key]: { step: body.step, visited, at: Date.now() } };
  // Keep the most recent ones.
  const kept = Object.fromEntries(
    Object.entries(all)
      .sort(([, a], [, b]) => (b?.at ?? 0) - (a?.at ?? 0))
      .slice(0, MAX_PROGRESS),
  );
  await redis(["SET", progressKey(user), JSON.stringify(kept)]);
  return kept[key];
}

// GET /api/saved: the signed-in user's saved issues from the database.
// GET /api/saved?progress=owner/repo#12: how far they got on that issue's help page.
export async function GET(request) {
  if (!storeAvailable()) return json({ error: "sync_unavailable" }, [], 503);

  const { user, cookies } = await signedInUser(request);
  if (!user) return json({ error: "signed_out" }, cookies, 401);

  const issue = new URL(request.url).searchParams.get("progress");
  if (issue !== null) {
    try {
      const progress = (await readProgress(user))[issue.toLowerCase()] ?? null;
      return json({ progress }, cookies);
    } catch {
      return json({ error: "database_error" }, cookies, 502);
    }
  }

  try {
    const stored = await redis(["GET", keyFor(user)]);
    const items = stored ? JSON.parse(stored) : [];
    return json({ items: Array.isArray(items) ? items : [] }, cookies);
  } catch {
    return json({ error: "database_error" }, cookies, 502);
  }
}

// PUT /api/saved: replaces the signed-in user's saved list.
// PUT /api/saved?progress=1 { issue, step, visited }: saves help page progress.
// Requiring a JSON body means another site can't send this request with the
// user's cookie (browsers block it without a CORS preflight we never allow).
export async function PUT(request) {
  if (!storeAvailable()) return json({ error: "sync_unavailable" }, [], 503);
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "json_required" }, [], 415);
  }

  const { user, cookies } = await signedInUser(request);
  if (!user) return json({ error: "signed_out" }, cookies, 401);

  const body = await request.text();
  if (body.length > MAX_BODY_LENGTH) {
    return json({ error: "too_large" }, cookies, 413);
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return json({ error: "invalid_json" }, cookies, 400);
  }

  if (new URL(request.url).searchParams.has("progress")) {
    try {
      const progress = await saveProgress(user, parsed);
      return progress ? json({ progress }, cookies) : json({ error: "invalid_progress" }, cookies, 400);
    } catch {
      return json({ error: "database_error" }, cookies, 502);
    }
  }

  const items = parsed?.items;
  if (!Array.isArray(items)) return json({ error: "invalid_items" }, cookies, 400);

  const seen = new Set();
  const clean = items
    .map(cleanIssue)
    .filter((issue) => issue && !seen.has(issue.id) && seen.add(issue.id))
    .slice(0, MAX_SAVED);

  try {
    await redis(["SET", keyFor(user), JSON.stringify(clean)]);
    return json({ items: clean }, cookies);
  } catch {
    return json({ error: "database_error" }, cookies, 502);
  }
}
