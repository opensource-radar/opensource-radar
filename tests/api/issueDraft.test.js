import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../api/projects/[kind].js";

const REDIS = "https://fake-redis.test";
let db;
let llm;
let prompts;

function fake(url, init = {}) {
  url = String(url);
  if (url === REDIS) {
    const [command, key] = JSON.parse(init.body);
    if (command === "INCR") {
      db.set(key, (db.get(key) ?? 0) + 1);
      return Response.json({ result: db.get(key) });
    }
    return Response.json({ result: "OK" });
  }
  if (url.endsWith("/chat/completions")) {
    prompts.push(JSON.parse(init.body));
    return Response.json({ choices: [{ message: { content: JSON.stringify(llm.shift() ?? {}) } }] });
  }
  return new Response("{}", { status: 404 });
}
const draft = (idea, ip = "1.1.1.1") =>
  POST(new Request("http://x/api/issue-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ idea }),
  }));
const body = "## What's wrong\nThe search box doesn't clear on Escape.\n## Expected\nEscape clears it.";

beforeEach(() => {
  db = new Map();
  llm = [];
  prompts = [];
  vi.stubEnv("KV_REST_API_URL", REDIS);
  vi.stubEnv("KV_REST_API_TOKEN", "t");
  vi.stubEnv("DEVAGENTS_ENABLED", "true");
  vi.stubEnv("DEVAGENTS_GROQ_KEY", "groq-key");
  vi.stubEnv("DEVAGENTS_GROQ_MODEL", "groq-model");
  vi.stubEnv("DEVAGENTS_GROQ_LIGHT_MODEL", "small-model");
  vi.stubEnv("DEVAGENTS_GEMINI_KEY", "");
  vi.stubEnv("DEVAGENTS_CEREBRAS_KEY", "");
  vi.stubEnv("DEVAGENTS_MISTRAL_KEY", "");
  vi.stubGlobal("fetch", vi.fn(fake));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/issue-draft", () => {
  it("turns an idea into a titled draft with the smaller model", async () => {
    llm.push({ title: "Clear the search box on Escape", body });
    const response = await draft("Search box should clear on Escape");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ title: "Clear the search box on Escape", body });
    expect(prompts[0].model).toBe("small-model");
    expect(JSON.stringify(prompts[0].messages)).toContain("Search box should clear on Escape");
  });

  it("rejects ideas that are too short or too long", async () => {
    expect((await draft("short")).status).toBe(400);
    expect((await draft("x".repeat(1501))).status).toBe(400);
    expect(prompts).toHaveLength(0);
  });

  it("limits drafts per minute and per day, and stays off when the helper is off", async () => {
    for (let n = 0; n < 5; n += 1) {
      llm.push({ title: "T", body });
      expect((await draft("A long enough idea", "2.2.2.2")).status).toBe(200);
    }
    expect((await draft("A long enough idea", "2.2.2.2")).status).toBe(429);
    db.set(`issue-draft-daily:${new Date().toISOString().slice(0, 10)}`, 200);
    expect((await draft("A long enough idea", "3.3.3.3")).status).toBe(503);
    vi.stubEnv("DEVAGENTS_ENABLED", "");
    expect((await draft("A long enough idea", "4.4.4.4")).status).toBe(503);
  });
});
