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
  const validate = (key, provider) =>
    callAction("validate-key", {}, {
      headers: {
        ...(key && { "X-User-LLM-Key": key }),
        ...(provider && { "X-User-LLM-Provider": provider }),
      },
    });
  const models = (ids) => Response.json({ data: ids.map((id) => ({ id })) });
  const replyWith = (make) => vi.stubGlobal("fetch", vi.fn(async () => make()));

  it("checks a key with Groq by default, and lists its chat models", async () => {
    replyWith(() => models(["b-model", "a-model", "whisper-large-v3", "meta-llama/llama-prompt-guard-2", "x/orpheus-v1"]));
    const { body } = await validate("gsk_good");
    expect(body.data).toEqual({ valid: true, models: ["a-model", "b-model"] });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/models");
    expect(init.headers.Authorization).toBe("Bearer gsk_good");
  });

  it.each([
    ["groq", "https://api.groq.com/openai/v1/models"],
    ["gemini", "https://generativelanguage.googleapis.com/v1beta/openai/models"],
    ["cerebras", "https://api.cerebras.ai/v1/models"],
    ["mistral", "https://api.mistral.ai/v1/models"],
    ["openrouter", "https://openrouter.ai/api/v1/models"],
    ["openai", "https://api.openai.com/v1/models"],
  ])("checks %s keys at its own address", async (provider, url) => {
    replyWith(() => models(["m"]));
    await validate("k", provider);
    expect(fetch.mock.calls[0][0]).toBe(url);
  });

  it("removes Gemini's models/ prefix", async () => {
    replyWith(() => models(["models/gemini-x"]));
    expect((await validate("k", "gemini")).body.data.models).toEqual(["gemini-x"]);
  });

  it.each([["https://evil.test/v1"], ["constructor"], ["own"], ["GROQ"]])(
    "refuses the provider %s, so a key can't be sent anywhere else",
    async (provider) => {
      replyWith(() => models(["m"]));
      const { status } = await validate("k", provider);
      expect(status).toBe(400);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it.each([[401], [403], [400]])("returns valid:false on %i, without storing or logging the key", async (status) => {
    const world = fakeWorld();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetch.mockImplementationOnce(async () => new Response("{}", { status }));
    expect((await validate("gsk_bad")).body.data).toEqual({ valid: false, models: [] });
    expect(JSON.stringify([...world.db])).not.toContain("gsk_bad");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("gsk_bad");
  });

  it("returns unavailable when the provider can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect((await validate("gsk_x")).body).toEqual({ error: "unavailable" });
  });

  it("still works when the model list has an odd shape", async () => {
    replyWith(() => Response.json({ surprise: true }));
    expect((await validate("k")).body.data).toEqual({ valid: true, models: [] });
  });

  it("rejects a request with no key", async () => {
    replyWith(() => models([]));
    expect((await validate(null)).status).toBe(400);
  });
});
