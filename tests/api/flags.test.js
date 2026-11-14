import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../../api/projects/[kind].js";
import { seal } from "../../api/_lib/session.js";

const SECRET = "test-session-secret-0123456789abcdef0123456789abcdef";
const REDIS = "https://fake-redis.test";
let counters;
let sets;
let zset;

// Just the Redis commands the flags endpoint uses.
function fakeRedis(url, init) {
  const [command, key, ...args] = JSON.parse(init.body);
  const result = (value) => Response.json({ result: value });
  switch (command) {
    case "INCR":
      counters.set(key, (counters.get(key) ?? 0) + 1);
      return result(counters.get(key));
    case "SADD":
      sets.set(key, new Set([...(sets.get(key) ?? []), args[0]]));
      return result(1);
    case "SCARD":
      return result(sets.get(key)?.size ?? 0);
    case "ZADD": {
      const [, score, member] = args;
      if (!zset.has(member)) zset.set(member, Number(score));
      return result(1);
    }
    case "ZREMRANGEBYSCORE":
      for (const [member, score] of zset) if (score <= Number(args[1])) zset.delete(member);
      return result(0);
    case "ZRANGE":
      return result([...zset.keys()]);
    default:
      return result("OK");
  }
}

async function cookie(login) {
  const session = { accessToken: "t", refreshToken: null, accessExpiresAt: null, refreshExpiresAt: null, user: { login, name: login, avatarUrl: "" } };
  return `osr_session=${await seal(session, SECRET)}`;
}
const report = async (body, { login, ip = "1.1.1.1" } = {}) =>
  POST(new Request("http://localhost/api/flags", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip, ...(login ? { cookie: await cookie(login) } : {}) },
    body: JSON.stringify(body),
  }));
const hidden = async () => (await (await GET(new Request("http://localhost/api/flags"))).json()).hidden;

beforeEach(() => {
  counters = new Map();
  sets = new Map();
  zset = new Map();
  vi.stubEnv("KV_REST_API_URL", REDIS);
  vi.stubEnv("KV_REST_API_TOKEN", "t");
  vi.stubEnv("GITHUB_CLIENT_ID", "id");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "secret");
  vi.stubEnv("SESSION_SECRET", SECRET);
  vi.stubGlobal("fetch", vi.fn(fakeRedis));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("/api/flags", () => {
  it("hides an issue for everyone only after 3 different people report it", async () => {
    const issue = "A/B#12";
    expect(await (await report({ issue, reason: "spam" }, { ip: "1.1.1.1" })).json()).toEqual({ ok: true, hidden: false });
    // The same person again doesn't count twice.
    await report({ issue, reason: "spam" }, { ip: "1.1.1.1" });
    await report({ issue, reason: "done" }, { login: "sam", ip: "1.1.1.1" });
    expect(await hidden()).toEqual([]);
    expect(await (await report({ issue, reason: "broken" }, { ip: "2.2.2.2" })).json()).toEqual({ ok: true, hidden: true });
    expect(await hidden()).toEqual(["a/b#12"]);
  });

  it("stops hiding it after 30 days", async () => {
    for (const ip of ["1", "2", "3"]) await report({ issue: "a/b#1", reason: "spam" }, { ip });
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 31 * 24 * 60 * 60 * 1000);
    expect(await hidden()).toEqual([]);
    vi.restoreAllMocks();
  });

  it("rejects anything that isn't an issue and a known reason", async () => {
    expect((await report({ issue: "nope", reason: "spam" })).status).toBe(400);
    expect((await report({ issue: "a/b#1", reason: "rude" })).status).toBe(400);
  });

  it("limits how many reports one address sends", async () => {
    for (let n = 1; n <= 20; n += 1) expect((await report({ issue: `a/b#${n}`, reason: "spam" })).status).toBe(200);
    expect((await report({ issue: "a/b#99", reason: "spam" })).status).toBe(429);
  });

  it("answers with nothing hidden when there's no database", async () => {
    vi.stubEnv("KV_REST_API_URL", "");
    expect(await hidden()).toEqual([]);
    expect((await report({ issue: "a/b#1", reason: "spam" })).status).toBe(503);
  });
});
