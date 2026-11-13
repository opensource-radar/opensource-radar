import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../../api/profile.js";
import { seal } from "../../api/_lib/session.js";

const SECRET = "test-session-secret-0123456789abcdef0123456789abcdef";
const REDIS = "https://fake-redis.test";
let db;
let githubCalls;

function fakeFetch(url, init = {}) {
  url = String(url);
  if (url === REDIS) {
    const [command, key, value] = JSON.parse(init.body);
    if (command === "GET") return Response.json({ result: db.get(key) ?? null });
    if (command === "SET") db.set(key, value);
    if (command === "DEL") db.delete(key);
    return Response.json({ result: "OK" });
  }
  githubCalls.push(url);
  if (url.startsWith("https://api.github.com/users/")) {
    return Response.json({ login: "sam", name: "Sam Rivera", avatar_url: "https://avatars.example/sam" });
  }
  if (url.startsWith("https://api.github.com/search/issues")) {
    return Response.json({
      total_count: 2,
      items: [
        { title: "Fix docs", html_url: "https://github.com/a/b/pull/6", number: 6, repository_url: "https://api.github.com/repos/a/b", pull_request: { merged_at: "2026-11-08T09:00:00Z" }, body: "Fixes #5\n\nAI assistance from DevAgents" },
        { title: "Add test", html_url: "https://github.com/c/d/pull/2", number: 2, repository_url: "https://api.github.com/repos/c/d", pull_request: { merged_at: "2026-10-01T09:00:00Z" }, body: "" },
      ],
    });
  }
  return new Response("", { status: 404 });
}

async function cookie(login = "sam") {
  const session = { accessToken: "t", refreshToken: null, accessExpiresAt: null, refreshExpiresAt: null, user: { login, name: login, avatarUrl: "" } };
  return `osr_session=${await seal(session, SECRET)}`;
}
const get = async (query, signedIn = false) =>
  GET(new Request(`http://localhost/api/profile?${query}`, { headers: signedIn ? { cookie: await cookie() } : {} }));
const post = async (body, signedIn = true) =>
  POST(new Request("http://localhost/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(signedIn ? { cookie: await cookie() } : {}) },
    body: JSON.stringify(body),
  }));

beforeEach(() => {
  db = new Map();
  githubCalls = [];
  vi.stubEnv("KV_REST_API_URL", REDIS);
  vi.stubEnv("KV_REST_API_TOKEN", "t");
  vi.stubEnv("GITHUB_CLIENT_ID", "id");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "secret");
  vi.stubEnv("SESSION_SECRET", SECRET);
  vi.stubEnv("GITHUB_READ_TOKEN", "server-token");
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("public profile", () => {
  it("is off by default, and doesn't touch GitHub", async () => {
    const response = await get("login=sam");
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("not_public");
    expect(githubCalls).toHaveLength(0);
  });

  it("shows public merged pull requests once its owner turns it on", async () => {
    expect((await (await post({ enabled: true })).json())).toMatchObject({ enabled: true, indexable: false });
    const { profile } = await (await get("login=sam")).json();
    expect(profile).toMatchObject({ login: "sam", name: "Sam Rivera", totalMerged: 2, indexable: false });
    expect(profile.pullRequests).toEqual([
      { title: "Fix docs", url: "https://github.com/a/b/pull/6", number: 6, repo: "a/b", mergedAt: "2026-11-08T09:00:00Z", madeWithRadar: true },
      { title: "Add test", url: "https://github.com/c/d/pull/2", number: 2, repo: "c/d", mergedAt: "2026-10-01T09:00:00Z", madeWithRadar: false },
    ]);
    expect(decodeURIComponent(githubCalls.find((u) => u.includes("search")))).toContain("author:sam is:merged is:public");
  });

  it("caches the profile, and a settings change clears the cache", async () => {
    await post({ enabled: true });
    await get("login=sam");
    await get("login=sam");
    expect(githubCalls.filter((u) => u.includes("search"))).toHaveLength(1);
    await post({ enabled: true, indexable: true });
    const { profile } = await (await get("login=sam")).json();
    expect(profile.indexable).toBe(true);
    expect(githubCalls.filter((u) => u.includes("search"))).toHaveLength(2);
  });

  it("turning it off hides it again, and search listing needs it on", async () => {
    await post({ enabled: true, indexable: true });
    expect(await (await post({ enabled: false, indexable: true })).json()).toMatchObject({ enabled: false, indexable: false });
    expect((await get("login=sam")).status).toBe(404);
  });

  it("only the signed-in owner can change or read their settings", async () => {
    expect((await post({ enabled: true }, false)).status).toBe(401);
    expect((await get("settings=1")).status).toBe(401);
    expect(await (await get("settings=1", true)).json()).toEqual({ login: "sam", enabled: false, indexable: false });
    expect((await post({ enabled: "yes" })).status).toBe(400);
  });

  it("rejects names that can't be GitHub logins", async () => {
    expect((await get("login=../etc")).status).toBe(404);
  });
});
