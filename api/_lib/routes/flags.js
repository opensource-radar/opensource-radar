import { loadSession } from "../auth.js";
import { getConfig, json } from "../session.js";
import { redis, storeAvailable } from "../store.js";

// "Report this issue" on the cards. One report hides an issue only for the
// person who sent it (in their browser). For everyone, an issue is hidden once
// 3 different people report it, and only for 30 days.
export const FLAG_REASONS = ["done", "spam", "broken"];
const ISSUE_KEY = /^[\w.-]+\/[\w.-]+#\d{1,9}$/;
export const REPORTS_TO_HIDE = 3;
const HIDE_SECONDS = 30 * 24 * 60 * 60;
const REPORTS_PER_HOUR = 20;
const MAX_HIDDEN = 500;
// Issue keys, scored by when they stop being hidden (milliseconds).
const HIDDEN_SET = "flags:v1:hidden";
const reportsKey = (issue) => `flags:v1:reports:${issue}`;

function clientIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

// GET /api/flags: the issues hidden for everyone right now.
export async function GET() {
  let hidden = [];
  if (storeAvailable()) {
    try {
      await redis(["ZREMRANGEBYSCORE", HIDDEN_SET, "-inf", Date.now()]);
      hidden = (await redis(["ZRANGE", HIDDEN_SET, 0, MAX_HIDDEN - 1])) ?? [];
    } catch {
      // Nothing hidden this time.
    }
  }
  return new Response(JSON.stringify({ hidden }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
  });
}

// POST /api/flags { issue: "owner/repo#12", reason }
export async function POST(request) {
  if (!storeAvailable()) return json({ error: "unavailable" }, [], 503);
  const body = await request.json().catch(() => null);
  const issue = typeof body?.issue === "string" ? body.issue.toLowerCase() : "";
  if (!ISSUE_KEY.test(issue) || !FLAG_REASONS.includes(body?.reason)) {
    return json({ error: "invalid_request" }, [], 400);
  }

  const config = getConfig();
  const { session, cookies } = config.configured
    ? await loadSession(request, config)
    : { session: null, cookies: [] };
  const ip = clientIp(request);
  // Signed-in people count once per account, visitors once per address.
  const reporter = session?.user?.login ? `user:${session.user.login.toLowerCase()}` : `ip:${ip}`;

  try {
    const rateKey = `flags-rate:${ip}`;
    const sent = await redis(["INCR", rateKey]);
    if (sent === 1) await redis(["EXPIRE", rateKey, 60 * 60]);
    if (sent > REPORTS_PER_HOUR) return json({ error: "rate_limited" }, cookies, 429);

    const key = reportsKey(issue);
    await redis(["SADD", key, reporter]);
    const reports = await redis(["SCARD", key]);
    if (reports === 1) await redis(["EXPIRE", key, HIDE_SECONDS]);
    const hidden = reports >= REPORTS_TO_HIDE;
    if (hidden) await redis(["ZADD", HIDDEN_SET, "NX", Date.now() + HIDE_SECONDS * 1000, issue]);
    return json({ ok: true, hidden }, cookies);
  } catch {
    return json({ error: "unavailable" }, cookies, 503);
  }
}
