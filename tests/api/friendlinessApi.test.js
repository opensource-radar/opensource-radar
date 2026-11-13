import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../api/_lib/routes/friendliness.js";

const REDIS = "https://fake-redis.test";
let db;
let graphqlCalls;

function fakeFetch(url, init = {}) {
  url = String(url);
  if (url === REDIS) {
    const [command, ...args] = JSON.parse(init.body);
    if (command === "MGET") return Response.json({ result: args.map((key) => db.get(key) ?? null) });
    if (command === "SET") {
      db.set(args[0], args[1]);
      return Response.json({ result: "OK" });
    }
    if (command === "INCR") return Response.json({ result: 1 });
    return Response.json({ result: 1 });
  }
  if (url === "https://api.github.com/graphql") {
    graphqlCalls.push(JSON.parse(init.body));
    return Response.json({
      data: {
        r0: {
          contributingGuidelines: { url: "https://x" },
          workflows: { entries: [{ name: "ci.yml" }] },
          issues: { nodes: [] },
          pullRequests: { nodes: [{ merged: true, authorAssociation: "NONE" }, { merged: true, authorAssociation: "NONE" }, { merged: false, authorAssociation: "NONE" }] },
        },
      },
    });
  }
  return new Response("not found", { status: 404 });
}

const get = (names) => GET(new Request(`http://localhost/api/friendliness?names=${encodeURIComponent(names)}`));

beforeEach(() => {
  db = new Map();
  graphqlCalls = [];
  vi.stubEnv("KV_REST_API_URL", REDIS);
  vi.stubEnv("KV_REST_API_TOKEN", "t");
  vi.stubEnv("GITHUB_CLIENT_ID", "");
  vi.stubEnv("GITHUB_READ_TOKEN", "server-token");
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/friendliness", () => {
  it("rejects bad names", async () => {
    expect((await get("not a repo")).status).toBe(400);
    expect((await get(Array.from({ length: 11 }, (_, i) => `a/r${i}`).join(","))).status).toBe(400);
  });

  it("works it out from GitHub and caches it for a day", async () => {
    const response = await get("a/b");
    expect(response.status).toBe(200);
    const { friendliness } = await response.json();
    expect(friendliness["a/b"]).toMatchObject({ outsideMerged: 2, outsideClosed: 3, hasCi: true, hasContributing: true });
    // It asked GitHub for the slower friendliness fields.
    expect(graphqlCalls[0].query).toContain("pullRequests");
    expect(db.has("friendly:v1:a/b")).toBe(true);
  });

  it("answers from the cache without asking GitHub, even with no token", async () => {
    db.set("friendly:v1:a/b", JSON.stringify({ level: "high", replyHours: 5 }));
    vi.stubEnv("GITHUB_READ_TOKEN", "");
    const response = await get("a/b");
    expect(response.status).toBe(200);
    expect((await response.json()).friendliness["a/b"]).toEqual({ level: "high", replyHours: 5 });
    expect(graphqlCalls).toHaveLength(0);
  });

  it("says unavailable when it would need GitHub but has no token", async () => {
    vi.stubEnv("GITHUB_READ_TOKEN", "");
    expect((await get("a/b")).status).toBe(503);
  });
});
