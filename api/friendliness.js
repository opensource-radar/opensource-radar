import { loadSession } from "./_lib/auth.js";
import { computeFriendliness } from "./_lib/friendliness.js";
import { fetchRepositories } from "./_lib/github.js";
import { getConfig, json } from "./_lib/session.js";
import { redis, storeAvailable } from "./_lib/store.js";

const MAX_NAMES = 10;
const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;
const CACHE_SECONDS = 24 * 60 * 60;
// Only for visitors using the shared server token. These lookups are heavier
// than project details, so the limit is lower.
const LOOKUPS_PER_MINUTE = 10;
const cacheKey = (name) => `friendly:v1:${name.toLowerCase()}`;

function clientIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function overRateLimit(request) {
  if (!storeAvailable()) return false;
  const key = `friendly-rate:${clientIp(request)}`;
  try {
    const count = await redis(["INCR", key]);
    if (count === 1) await redis(["EXPIRE", key, 60]);
    return count > LOOKUPS_PER_MINUTE;
  } catch {
    return false;
  }
}

// GET /api/friendliness?names=owner/repo,owner/repo
// How beginner-friendly each project looks (see api/_lib/friendliness.js).
// It's slower than /api/repos, so the page asks for it separately, after the
// cards are on screen. Answers are cached for a day.
export async function GET(request) {
  const names = [
    ...new Set(
      (new URL(request.url).searchParams.get("names") || "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ];
  if (names.length === 0 || names.length > MAX_NAMES || !names.every((name) => REPO_PATTERN.test(name))) {
    return json({ error: "invalid_names" }, [], 400);
  }

  const result = {};
  let missing = names;
  if (storeAvailable()) {
    try {
      const cached = await redis(["MGET", ...names.map(cacheKey)]);
      missing = names.filter((name, index) => {
        if (!cached?.[index]) return true;
        result[name] = JSON.parse(cached[index]);
        return false;
      });
    } catch {
      missing = names;
    }
  }
  // Cached answers need no token, so they're shared with every visitor.
  if (missing.length === 0) return json({ friendliness: result });

  const config = getConfig();
  const { session, cookies } = config.configured
    ? await loadSession(request, config)
    : { session: null, cookies: [] };
  let token = session?.accessToken;
  if (!token) {
    token = process.env.GITHUB_READ_TOKEN || "";
    if (!token) return json({ friendliness: result, error: "unavailable" }, cookies, 503);
    if (await overRateLimit(request)) {
      return json({ friendliness: result, error: "rate_limited" }, cookies, 429);
    }
  }

  let found;
  try {
    found = await fetchRepositories(token, missing, { friendliness: true });
  } catch {
    return json({ friendliness: result, error: "github_error" }, cookies, 502);
  }

  await Promise.all(
    missing.map(async (name, index) => {
      result[name] = computeFriendliness(found[index]);
      if (!storeAvailable() || result[name] === null) return;
      try {
        await redis(["SET", cacheKey(name), JSON.stringify(result[name]), "EX", CACHE_SECONDS]);
      } catch {
        // Not cached this time.
      }
    }),
  );
  return json({ friendliness: result }, cookies);
}
