import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "../../api/saved.js";
import { seal } from "../../api/_lib/session.js";

const SECRET = "test-session-secret-0123456789abcdef0123456789abcdef";
const REDIS = "https://fake-redis.test";
let db;

async function cookie() {
  const session = { accessToken: "t", refreshToken: null, accessExpiresAt: null, refreshExpiresAt: null, user: { login: "Sam", name: "Sam", avatarUrl: "" } };
  return `osr_session=${await seal(session, SECRET)}`;
}
const put = async (body, signedIn = true) =>
  PUT(new Request("http://localhost/api/saved?progress=1", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(signedIn ? { cookie: await cookie() } : {}) },
    body: JSON.stringify(body),
  }));
const get = async (issue) =>
  (await GET(new Request(`http://localhost/api/saved?progress=${encodeURIComponent(issue)}`, { headers: { cookie: await cookie() } }))).json();

beforeEach(() => {
  db = new Map();
  vi.stubEnv("KV_REST_API_URL", REDIS);
  vi.stubEnv("KV_REST_API_TOKEN", "t");
  vi.stubEnv("GITHUB_CLIENT_ID", "id");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "secret");
  vi.stubEnv("SESSION_SECRET", SECRET);
  vi.stubGlobal("fetch", vi.fn(async (url, init) => {
    const [command, key, value] = JSON.parse(init.body);
    if (command === "GET") return Response.json({ result: db.get(key) ?? null });
    if (command === "SET") db.set(key, value);
    return Response.json({ result: "OK" });
  }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("help page progress on the server", () => {
  it("saves and reads back the step for one issue", async () => {
    const response = await put({ issue: "A/B#7", step: 2, visited: [0, 2, 2, 99, "x"] });
    expect(response.status).toBe(200);
    const { progress } = await get("a/b#7");
    expect(progress).toMatchObject({ step: 2, visited: [0, 2] });
    expect((await get("a/b#8")).progress).toBeNull();
  });

  it("keeps saved issues separate", async () => {
    await put({ issue: "a/b#7", step: 1, visited: [0, 1] });
    expect(db.has("saved:sam")).toBe(false);
  });

  it("rejects bad input and signed-out visitors", async () => {
    expect((await put({ issue: "nope", step: 1, visited: [] })).status).toBe(400);
    expect((await put({ issue: "a/b#1", step: -1, visited: [] })).status).toBe(400);
    expect((await put({ issue: "a/b#1", step: 1, visited: [] }, false)).status).toBe(401);
  });
});
