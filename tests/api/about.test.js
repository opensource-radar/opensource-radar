import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../api/projects/[kind].js";
import { aboutLine } from "../../api/_lib/routes/repos.js";

const REDIS = "https://fake-redis.test";
let db;
let llm;
let calls;

function fake(url, init = {}) {
  url = String(url);
  calls.push(url);
  if (url === REDIS) {
    const [command, key, value] = JSON.parse(init.body);
    if (command === "GET") return Response.json({ result: db.get(key) ?? null });
    if (command === "SET") db.set(key, value);
    if (command === "INCR") {
      db.set(key, (db.get(key) ?? 0) + 1);
      return Response.json({ result: db.get(key) });
    }
    return Response.json({ result: "OK" });
  }
  if (url === "https://api.github.com/repos/a/b/readme") return new Response("# Tool\nA fast linter for Markdown files.");
  if (url === "https://api.github.com/repos/a/empty/readme") return new Response("", { status: 404 });
  if (url.endsWith("/chat/completions")) {
    return Response.json({ choices: [{ message: { content: JSON.stringify(llm.shift() ?? {}) } }] });
  }
  return new Response("{}", { status: 404 });
}
const ask = (repo) => GET(new Request(`http://x/api/about?repo=${encodeURIComponent(repo)}`));
const aiCalls = () => calls.filter((url) => url.endsWith("/chat/completions")).length;

beforeEach(() => {
  db = new Map();
  llm = [];
  calls = [];
  vi.stubEnv("KV_REST_API_URL", REDIS);
  vi.stubEnv("KV_REST_API_TOKEN", "t");
  vi.stubEnv("DEVAGENTS_ENABLED", "true");
  vi.stubEnv("DEVAGENTS_GROQ_KEY", "groq-key");
  vi.stubEnv("DEVAGENTS_GROQ_MODEL", "groq-model");
  vi.stubEnv("DEVAGENTS_GEMINI_KEY", "");
  vi.stubEnv("DEVAGENTS_CEREBRAS_KEY", "");
  vi.stubEnv("DEVAGENTS_MISTRAL_KEY", "");
  vi.stubEnv("GITHUB_READ_TOKEN", "server-token");
  vi.stubGlobal("fetch", vi.fn(fake));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("aboutLine", () => {
  it("tidies a project's description for a card", () => {
    expect(aboutLine(":rocket:  A fast   linter ")).toBe("A fast linter");
    expect(aboutLine("x".repeat(300))).toHaveLength(160);
    expect(aboutLine("hi")).toBeNull();
    expect(aboutLine(null)).toBeNull();
  });
});

describe("GET /api/about", () => {
  it("summarises the README once, then answers from the cache", async () => {
    llm.push({ about: "A fast linter for Markdown files." });
    expect(await (await ask("a/b")).json()).toEqual({ about: "A fast linter for Markdown files.", ai: true });
    expect(await (await ask("a/b")).json()).toEqual({ about: "A fast linter for Markdown files.", ai: true });
    expect(aiCalls()).toBe(1);
  });

  it("doesn't ask the AI when there's no README", async () => {
    expect(await (await ask("a/empty")).json()).toEqual({ about: null });
    expect(aiCalls()).toBe(0);
  });

  it("stays off when the helper is switched off, or the day's allowance is used", async () => {
    vi.stubEnv("DEVAGENTS_ENABLED", "");
    expect((await ask("a/b")).status).toBe(503);
    vi.stubEnv("DEVAGENTS_ENABLED", "true");
    db.set(`about-daily:${new Date().toISOString().slice(0, 10)}`, 300);
    expect((await ask("a/b")).status).toBe(503);
    expect(aiCalls()).toBe(0);
  });

  it("rejects a bad name", async () => {
    expect((await ask("nope")).status).toBe(400);
  });
});
