import { loadSession } from "./auth.js";
import { getConfig } from "./session.js";
import { redis, storeAvailable } from "./store.js";

// Shared by the public lookups (project details, friendliness, label health…).

export function clientIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

// True when this network has made more than `limit` lookups of this kind in
// the last minute. Never blocks when the database is unavailable.
export async function overRateLimit(request, kind, limit) {
  if (!storeAvailable()) return false;
  const key = `${kind}-rate:${clientIp(request)}`;
  try {
    const count = await redis(["INCR", key]);
    if (count === 1) await redis(["EXPIRE", key, 60]);
    return count > limit;
  } catch {
    return false;
  }
}

// The signed-in user's GitHub token, or the shared read-only server token for
// visitors (rate limited). Returns { token, cookies } or { error, cookies }.
export async function lookupToken(request, kind, visitorLimit) {
  const config = getConfig();
  const { session, cookies } = config.configured
    ? await loadSession(request, config)
    : { session: null, cookies: [] };
  if (session?.accessToken) return { token: session.accessToken, cookies };

  const token = process.env.GITHUB_READ_TOKEN || "";
  if (!token) return { error: "unavailable", status: 503, cookies };
  if (await overRateLimit(request, kind, visitorLimit)) return { error: "rate_limited", status: 429, cookies };
  return { token, cookies };
}

export async function cachedJson(key) {
  if (!storeAvailable()) return null;
  try {
    const value = await redis(["GET", key]);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export async function cacheJson(key, value, seconds) {
  if (!storeAvailable()) return;
  try {
    await redis(["SET", key, JSON.stringify(value), "EX", seconds]);
  } catch {
    // Not cached this time.
  }
}
