import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../api/issue.js";
import { seal } from "../../api/_lib/session.js";

const SESSION_SECRET = "test-session-secret-0123456789abcdef0123456789abcdef";
const REDIS_URL = "https://fake-redis.test";
let db;
let github;
let calls;

const ISSUE = {
  number: 24,
  title: "Respect reduced motion",
  body: "Please respect the setting.",
  labels: [{ name: "good first issue" }, { name: "accessibility" }],
  user: { login: "octocat" },
  created_at: "2026-11-01T10:00:00Z",
  updated_at: "2026-11-05T10:00:00Z",
  state: "open",
  comments: 3,
  html_url: "https://github.com/a/b/issues/24",
};

function fakeFetch(url, init = {}) {
  url = String(url);
  calls.push({ url, auth: init.headers?.Authorization, method: init.method ?? "GET" });
  if (url === REDIS_URL) {
    const [command, key, value] = JSON.parse(init.body);
    if (command === "GET") return Response.json({ result: db.get(key) ?? null });
    if (command === "SET") {
      db.set(key, value);
      return Response.json({ result: "OK" });
    }
    if (command === "INCR") {
      const next = (Number(db.get(key)) || 0) + 1;
      db.set(key, String(next));
      return Response.json({ result: next });
    }
    return Response.json({ result: 1 });
  }
  if (url === "https://api.github.com/graphql") {
    return Response.json({ data: { r0: github.repo } });
  }
  const route = github[new URL(url).pathname];
  if (route === undefined) return new Response("{}", { status: 404 });
  if (route instanceof Response) return route;
  return typeof route === "string" ? new Response(route) : Response.json(route);
}

const ask = (query, headers = {}) =>
  GET(new Request(`http://localhost/api/issue?${query}`, { headers }));

async function sessionCookie() {
  const session = { accessToken: "user-token", refreshToken: null, accessExpiresAt: null, refreshExpiresAt: null, user: { login: "me", name: "Me", avatarUrl: "" } };
  return `osr_session=${await seal(session, SESSION_SECRET)}`;
}

beforeEach(() => {
  db = new Map();
  calls = [];
  github = {
    "/repos/a/b/issues/24": ISSUE,
    "/repos/a/b/readme": "# B\n\n## Getting started\n\nnpm install\n\n## License\n\nMIT",
    repo: { stargazerCount: 1234, isArchived: false, primaryLanguage: { name: "JavaScript" }, contributingGuidelines: { url: "https://github.com/a/b/blob/main/CONTRIBUTING.md" } },
  };
  vi.stubEnv("GITHUB_CLIENT_ID", "id");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "secret");
  vi.stubEnv("SESSION_SECRET", SESSION_SECRET);
  vi.stubEnv("KV_REST_API_URL", REDIS_URL);
  vi.stubEnv("KV_REST_API_TOKEN", "t");
  vi.stubEnv("GITHUB_READ_TOKEN", "server-token");
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/issue", () => {
  it("gives a signed-out visitor the issue, project and setup hint, with the server token", async () => {
    const response = await ask("repo=a/b&issue=24");
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.issue).toEqual({
      number: 24,
      title: "Respect reduced motion",
      body: "Please respect the setting.",
      bodyTruncated: false,
      labels: ["good first issue", "accessibility"],
      author: "octocat",
      createdAt: "2026-11-01T10:00:00Z",
      updatedAt: "2026-11-05T10:00:00Z",
      state: "open",
      comments: 3,
      url: "https://github.com/a/b/issues/24",
    });
    expect(data.repo).toEqual({
      stars: 1234,
      language: "JavaScript",
      archived: false,
      contributingUrl: "https://github.com/a/b/blob/main/CONTRIBUTING.md",
    });
    expect(data.setupHint).toEqual({ heading: "Getting started", text: "npm install" });
    const githubCalls = calls.filter((call) => call.url.startsWith("https://api.github.com"));
    expect(githubCalls.every((call) => call.auth === "Bearer server-token")).toBe(true);
  });

  it("uses a signed-in visitor's own token", async () => {
    await ask("repo=a/b&issue=24", { cookie: await sessionCookie() });
    const githubCalls = calls.filter((call) => call.url.startsWith("https://api.github.com"));
    expect(githubCalls.every((call) => call.auth === "Bearer user-token")).toBe(true);
  });

  it("only ever reads from GitHub", async () => {
    await ask("repo=a/b&issue=24");
    const githubCalls = calls.filter((call) => call.url.startsWith("https://api.github.com"));
    expect(githubCalls.filter((call) => call.method !== "GET" && !call.url.endsWith("/graphql"))).toEqual([]);
  });

  it("serves a repeat from the cache, without asking GitHub again", async () => {
    await ask("repo=a/b&issue=24");
    const before = calls.filter((call) => call.url.startsWith("https://api.github.com")).length;
    const again = await (await ask("repo=a/b&issue=24")).json();
    expect(again.issue.title).toBe("Respect reduced motion");
    expect(calls.filter((call) => call.url.startsWith("https://api.github.com")).length).toBe(before);
  });

  it("shortens a long description and says so", async () => {
    github["/repos/a/b/issues/24"] = { ...ISSUE, body: "x".repeat(5000) };
    const { issue } = await (await ask("repo=a/b&issue=24")).json();
    expect(issue.body.length).toBeLessThanOrEqual(1500);
    expect(issue.bodyTruncated).toBe(true);
  });

  it("copes with a missing README, description and project details", async () => {
    delete github["/repos/a/b/readme"];
    github["/repos/a/b/issues/24"] = { ...ISSUE, body: null, labels: undefined, user: null };
    github.repo = null;
    const data = await (await ask("repo=a/b&issue=24")).json();
    expect(data.issue).toMatchObject({ body: "", labels: [], author: "" });
    expect(data.repo).toBeNull();
    expect(data.setupHint).toBeNull();
  });

  it.each([[404], [410]])("says not_found when GitHub answers %i", async (status) => {
    github["/repos/a/b/issues/24"] = new Response("{}", { status });
    const response = await ask("repo=a/b&issue=24");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("says not_found for a pull request number", async () => {
    github["/repos/a/b/issues/24"] = { ...ISSUE, pull_request: {} };
    expect((await ask("repo=a/b&issue=24")).status).toBe(404);
  });

  it.each([
    ["repo=a&issue=1"],
    ["repo=a/b/c&issue=1"],
    ["repo=../x&issue=1"],
    ["repo=a/b&issue=0"],
    ["repo=a/b&issue=1.5"],
    ["repo=a/b"],
  ])("rejects %s", async (query) => {
    expect((await ask(query)).status).toBe(400);
    expect(calls.filter((call) => call.url.startsWith("https://api.github.com"))).toEqual([]);
  });

  it("says unavailable when there's no token for visitors", async () => {
    vi.stubEnv("GITHUB_READ_TOKEN", "");
    const response = await ask("repo=a/b&issue=24");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable" });
  });

  it("says unavailable when GitHub fails", async () => {
    github["/repos/a/b/issues/24"] = new Response("{}", { status: 500 });
    expect((await ask("repo=a/b&issue=24")).status).toBe(503);
  });

  it("limits how often one visitor can ask", async () => {
    let last;
    for (let issue = 1; issue <= 31; issue += 1) {
      github[`/repos/a/b/issues/${issue}`] = { ...ISSUE, number: issue };
      last = await ask(`repo=a/b&issue=${issue}`, { "x-forwarded-for": "9.9.9.9" });
    }
    expect(last.status).toBe(429);
  });
});
