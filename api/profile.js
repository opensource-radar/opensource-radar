import { loadSession } from "./_lib/auth.js";
import { githubHeaders } from "./_lib/github.js";
import { getConfig, json } from "./_lib/session.js";
import { redis, storeAvailable } from "./_lib/store.js";

// Public profiles at /u/<login> are off unless the person turns theirs on.
const GITHUB_LOGIN = /^[A-Za-z0-9-]{1,39}$/;
// DevAgents adds a note with these words to every PR description it writes.
const RADAR_NOTE = "AI assistance from DevAgents";
const MAX_PULL_REQUESTS = 30;
const CACHE_SECONDS = 60 * 60;

const settingsKey = (login) => `profile:v1:${login.toLowerCase()}`;
const cacheKey = (login) => `profile-cache:v1:${login.toLowerCase()}`;

async function readSettings(login) {
  try {
    const stored = await redis(["GET", settingsKey(login)]);
    const settings = stored ? JSON.parse(stored) : null;
    return { enabled: settings?.enabled === true, indexable: settings?.indexable === true };
  } catch {
    return null;
  }
}

async function githubJson(path, token) {
  const response = await fetch(`https://api.github.com${path}`, { headers: githubHeaders(token) });
  if (!response.ok) throw new Error(`GitHub ${response.status}`);
  return response.json();
}

// Only public facts: the person's name and avatar, and their merged pull
// requests in public repositories.
async function buildProfile(login) {
  const token = process.env.GITHUB_READ_TOKEN || "";
  const query = encodeURIComponent(`type:pr author:${login} is:merged is:public`);
  const [user, search] = await Promise.all([
    githubJson(`/users/${login}`, token),
    githubJson(`/search/issues?q=${query}&sort=updated&order=desc&per_page=${MAX_PULL_REQUESTS}`, token),
  ]);
  const pullRequests = (search.items ?? []).map((item) => ({
    title: String(item.title ?? "").slice(0, 300),
    url: item.html_url,
    number: item.number,
    repo: String(item.repository_url ?? "").split("/repos/")[1] ?? "",
    mergedAt: item.pull_request?.merged_at ?? item.closed_at ?? null,
    madeWithRadar: typeof item.body === "string" && item.body.includes(RADAR_NOTE),
  }));
  return {
    login: user.login,
    name: user.name || user.login,
    avatarUrl: user.avatar_url,
    totalMerged: search.total_count ?? pullRequests.length,
    pullRequests,
  };
}

async function signedInUser(request) {
  const config = getConfig();
  if (!config.configured) return { user: null, cookies: [] };
  const { session, cookies } = await loadSession(request, config);
  return { user: session?.user ?? null, cookies };
}

// GET /api/profile?login=octocat: a public profile, if it's turned on.
// GET /api/profile?settings=1: the signed-in user's own settings.
export async function GET(request) {
  if (!storeAvailable()) return json({ error: "unavailable" }, [], 503);
  const params = new URL(request.url).searchParams;

  if (params.get("settings")) {
    const { user, cookies } = await signedInUser(request);
    if (!user) return json({ error: "signed_out" }, cookies, 401);
    const settings = await readSettings(user.login);
    if (!settings) return json({ error: "unavailable" }, cookies, 503);
    return json({ login: user.login, ...settings }, cookies);
  }

  const login = params.get("login") || "";
  if (!GITHUB_LOGIN.test(login)) return json({ error: "not_found" }, [], 404);
  const settings = await readSettings(login);
  if (!settings) return json({ error: "unavailable" }, [], 503);
  if (!settings.enabled) return json({ error: "not_public" }, [], 404);

  let profile;
  try {
    const cached = await redis(["GET", cacheKey(login)]);
    profile = cached ? JSON.parse(cached) : null;
  } catch {
    // Build it from GitHub instead.
  }
  if (!profile) {
    try {
      profile = await buildProfile(login);
    } catch {
      return json({ error: "github_error" }, [], 502);
    }
    try {
      await redis(["SET", cacheKey(login), JSON.stringify(profile), "EX", CACHE_SECONDS]);
    } catch {
      // Not cached this time.
    }
  }
  return json({ profile: { ...profile, indexable: settings.indexable } });
}

// POST /api/profile { enabled, indexable }: the signed-in user turns their
// own public profile on or off.
export async function POST(request) {
  if (!storeAvailable()) return json({ error: "unavailable" }, [], 503);
  const { user, cookies } = await signedInUser(request);
  if (!user) return json({ error: "signed_out" }, cookies, 401);

  const body = await request.json().catch(() => null);
  if (typeof body?.enabled !== "boolean") return json({ error: "invalid_request" }, cookies, 400);
  const settings = { enabled: body.enabled, indexable: body.enabled && body.indexable === true };

  try {
    await redis(["SET", settingsKey(user.login), JSON.stringify(settings)]);
    // A fresh profile is built the next time someone looks.
    await redis(["DEL", cacheKey(user.login)]);
  } catch {
    return json({ error: "unavailable" }, cookies, 503);
  }
  return json({ login: user.login, ...settings }, cookies);
}
