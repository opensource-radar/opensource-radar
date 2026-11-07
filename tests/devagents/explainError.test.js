import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callAction, enableDevAgents, fakeWorld } from "./helpers.js";

const github = {
  "/repos/a/b": { default_branch: "main" },
  "/repos/a/b/branches/main": { commit: { sha: "abc" } },
  "/repos/a/b/contents/README.md": "Run make test",
};
const answer = { meaning: "A package is missing", nextSteps: ["Install it"] };
const send = (errorText) => callAction("explain-error", { repo: "a/b", issue: 1, errorText });
const prompt = (world) => JSON.parse(world.llmCalls()[0].init.body).messages[1].content;

beforeEach(enableDevAgents);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("explain-error", () => {
  it("explains an error, using the README", async () => {
    const world = fakeWorld({ github, llm: [answer] });
    const { body } = await send("ModuleNotFoundError: x");
    expect(body.data).toEqual(answer);
    expect(prompt(world)).toContain("Run make test");
  });

  it("removes a token from errorText before the LLM call", async () => {
    const world = fakeWorld({ github, llm: [answer] });
    await send("auth failed for ghp_secretTOKEN123 at x");
    expect(prompt(world)).not.toContain("ghp_secretTOKEN123");
    expect(prompt(world)).toContain("[removed]");
  });

  it("keeps only the last 8,000 characters", async () => {
    const world = fakeWorld({ github, llm: [answer] });
    await send(`${"a".repeat(9000)}END`);
    const text = prompt(world);
    expect(text).toContain("END");
    expect(text.match(/a+/g).sort((x, y) => y.length - x.length)[0].length).toBeLessThanOrEqual(8000);
  });

  it.each([[""], ["   "], [null], [42]])("rejects %j with invalid_request", async (errorText) => {
    const world = fakeWorld({ github, llm: [answer] });
    expect((await send(errorText)).status).toBe(400);
    expect(world.llmCalls()).toHaveLength(0);
  });
});

describe("validate-key", () => {
  const validate = (key) =>
    callAction("validate-key", {}, { headers: key ? { "X-User-LLM-Key": key } : {} });
  const groq = (status) =>
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status })));

  it("says valid for a working key, and checks it with Groq", async () => {
    groq(200);
    expect((await validate("gsk_good")).body.data).toEqual({ valid: true });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/models");
    expect(init.headers.Authorization).toBe("Bearer gsk_good");
  });

  it("returns valid:false on 401, and doesn't store or log the key", async () => {
    const world = fakeWorld();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetch.mockImplementationOnce(async () => new Response("{}", { status: 401 }));
    expect((await validate("gsk_bad")).body.data).toEqual({ valid: false });
    expect(JSON.stringify([...world.db])).not.toContain("gsk_bad");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("gsk_bad");
  });

  it("returns unavailable when Groq can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect((await validate("gsk_x")).body).toEqual({ error: "unavailable" });
  });

  it("doesn't call a key usable when own keys can't be used", async () => {
    vi.stubEnv("DEVAGENTS_GROQ_MODEL", "");
    groq(200);
    expect((await validate("gsk_good")).body).toEqual({ error: "unavailable" });
  });

  it("rejects a request with no key", async () => {
    groq(200);
    expect((await validate(null)).status).toBe(400);
  });
});
