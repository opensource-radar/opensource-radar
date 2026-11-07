import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { askJson } from "../../api/_lib/devagents/llm.js";
import {
  estimateTokens,
  nextState,
  parseLimits,
  rankProviders,
  resetRouterMemory,
} from "../../api/_lib/devagents/router.js";
import { REDIS_URL, fakeWorld } from "./helpers.js";

const NOW = 1_000_000;
const provider = (name) => ({ name, baseUrl: `https://${name}.test/v1`, apiKey: `${name}-key`, model: `${name}-model` });
const groq = provider("groq");
const gemini = provider("gemini");
const names = (list) => list.map((p) => p.name);
const rank = (states, need = 1000, random = () => 0.5) =>
  rankProviders([groq, gemini], states, { needTokens: need, now: NOW, random });

describe("parseLimits", () => {
  it("reads remaining tokens, requests and reset times", () => {
    const headers = new Headers({
      "x-ratelimit-remaining-tokens": "1500",
      "x-ratelimit-remaining-requests": "20",
      "x-ratelimit-reset-tokens": "7.5s",
      "x-ratelimit-reset-requests": "2m30s",
    });
    expect(parseLimits(headers, NOW)).toEqual({
      remainingTokens: 1500,
      remainingRequests: 20,
      tokensResetAt: NOW + 7500,
      requestsResetAt: NOW + 150000,
    });
  });

  it("understands milliseconds and hours", () => {
    const at = (value) =>
      parseLimits(new Headers({ "x-ratelimit-remaining-tokens": "1", "x-ratelimit-reset-tokens": value }), NOW).tokensResetAt - NOW;
    expect(at("250ms")).toBe(250);
    expect(at("1h2m3s")).toBe(3723000);
  });

  it("returns nothing for providers that don't send limits", () => {
    expect(parseLimits(new Headers(), NOW)).toEqual({});
  });
});

describe("estimateTokens", () => {
  it("counts the prompt and the reply allowance", () => {
    expect(estimateTokens("a".repeat(400), "b".repeat(400), 1200)).toBe(1400);
  });
});

describe("rankProviders", () => {
  it("keeps the listed order when it knows nothing", () => {
    const { ready } = rank({});
    expect(names(ready)).toEqual(["groq", "gemini"]);
  });

  it("skips a provider BEFORE its limit is hit, when a request wouldn't fit", () => {
    const states = { groq: { remainingTokens: 900, tokensResetAt: NOW + 5000 } };
    const { ready, soonestMs } = rank(states);
    expect(names(ready)).toEqual(["gemini"]);
    expect(soonestMs).toBe(5000);
  });

  it("uses that provider again once its limit has reset", () => {
    const states = { groq: { remainingTokens: 900, tokensResetAt: NOW - 1 } };
    expect(names(rank(states).ready)).toContain("groq");
  });

  it("skips a provider that's nearly out of requests", () => {
    const states = { groq: { remainingRequests: 1, requestsResetAt: NOW + 9000 } };
    expect(names(rank(states).ready)).toEqual(["gemini"]);
  });

  it("skips a provider that's cooling down", () => {
    const { ready, soonestMs } = rank({ groq: { cooldownUntil: NOW + 3000 } });
    expect(names(ready)).toEqual(["gemini"]);
    expect(soonestMs).toBe(3000);
  });

  it("prefers the provider with more room", () => {
    const states = {
      groq: { remainingTokens: 1100, tokensResetAt: NOW + 5000 },
      gemini: { remainingTokens: 50000, tokensResetAt: NOW + 5000 },
    };
    expect(names(rank(states).ready)[0]).toBe("gemini");
  });

  it("prefers the faster, more reliable provider", () => {
    expect(names(rank({ groq: { latencyMs: 9000 }, gemini: { latencyMs: 500 } }).ready)[0]).toBe("gemini");
    expect(names(rank({ groq: { failures: 3 } }).ready)[0]).toBe("gemini");
  });

  it("spreads load between equally good providers", () => {
    const first = new Set();
    let i = 0;
    const values = [0.9, 0.1, 0.1, 0.9];
    for (let round = 0; round < 2; round += 1) {
      const { ready } = rank({}, 1000, () => values[i++]);
      first.add(ready[0].name);
    }
    expect(first).toEqual(new Set(["groq", "gemini"]));
  });

  it("reports when nothing is ready", () => {
    const { ready, soonestMs } = rank({
      groq: { cooldownUntil: NOW + 8000 },
      gemini: { cooldownUntil: NOW + 3000 },
    });
    expect(ready).toEqual([]);
    expect(soonestMs).toBe(3000);
  });
});

describe("nextState", () => {
  it("records limits and speed after a success, and clears failures", () => {
    const state = nextState({ failures: 2, latencyMs: 1000 }, { ok: true, latencyMs: 2000, limits: { remainingTokens: 7 } }, NOW);
    expect(state.failures).toBe(0);
    expect(state.remainingTokens).toBe(7);
    expect(state.latencyMs).toBeGreaterThan(1000);
    expect(state.latencyMs).toBeLessThan(2000);
    expect(state.cooldownUntil).toBeUndefined();
  });

  it("cools down for as long as a 429 says", () => {
    expect(nextState({}, { status: 429, retryAfterMs: 1800000 }, NOW).cooldownUntil).toBe(NOW + 1800000);
  });

  it("cools down after a 429 with no time given", () => {
    expect(nextState({}, { status: 429 }, NOW).cooldownUntil).toBeGreaterThan(NOW);
  });

  it("cools down a key that's rejected", () => {
    expect(nextState({}, { status: 401 }, NOW).cooldownUntil).toBeGreaterThanOrEqual(NOW + 300000);
  });

  it("forgives one blip, then backs off", () => {
    const once = nextState({}, { status: 500 }, NOW);
    expect(once.failures).toBe(1);
    expect(once.cooldownUntil).toBeUndefined();
    const twice = nextState(once, { status: 500 }, NOW);
    expect(twice.cooldownUntil).toBeGreaterThan(NOW);
  });
});

describe("askJson routing", () => {
  const body = (content = '{"answer":"hi"}') => JSON.stringify({ choices: [{ message: { content } }] });
  const validate = (value) => value;
  const ask = () => askJson({ system: "s", user: "u", validate, deadline: Date.now() + 25000 });
  const host = (call) => new URL(call.url).host;
  const llmCalls = (world) => world.calls.filter((call) => call.url.endsWith("/chat/completions"));

  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    vi.stubEnv("DEVAGENTS_REDIS_URL", REDIS_URL);
    vi.stubEnv("DEVAGENTS_REDIS_TOKEN", "t");
    vi.stubEnv("DEVAGENTS_GROQ_KEY", "groq-key");
    vi.stubEnv("DEVAGENTS_GROQ_MODEL", "groq-model");
    vi.stubEnv("DEVAGENTS_GEMINI_KEY", "gemini-key");
    vi.stubEnv("DEVAGENTS_GEMINI_MODEL", "gemini-model");
    vi.stubEnv("DEVAGENTS_CEREBRAS_KEY", "");
    vi.stubEnv("DEVAGENTS_MISTRAL_KEY", "");
    vi.stubEnv("DEVAGENTS_FREELLM_URL", "");
    vi.stubEnv("DEVAGENTS_EXTRA_PROVIDERS", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("moves away BEFORE an overload, using what the provider reported", async () => {
    const world = fakeWorld();
    fetch.mockImplementation(async (url, init) => {
      world.calls.push({ url: String(url), init });
      if (String(url) === REDIS_URL) {
        const [cmd, key, ...rest] = JSON.parse(init.body);
        if (cmd === "MGET") return Response.json({ result: [key, ...rest].map((k) => world.db.get(k) ?? null) });
        world.db.set(key, rest[0]);
        return Response.json({ result: "OK" });
      }
      return new Response(body(), {
        headers: { "x-ratelimit-remaining-tokens": "100", "x-ratelimit-reset-tokens": "40s" },
      });
    });
    await ask();
    await ask();
    expect(llmCalls(world).map(host)).toEqual(["api.groq.com", "generativelanguage.googleapis.com"]);
  });

  it("shares what it learned between servers through the database", async () => {
    const world = fakeWorld();
    resetRouterMemory();
    world.db.set(
      "da:v1:provider:groq",
      JSON.stringify({ cooldownUntil: Date.now() + 60000 }),
    );
    world.llm.push({ answer: "hi" });
    await ask();
    expect(llmCalls(world).map(host)).toEqual(["generativelanguage.googleapis.com"]);
  });

  it("answers busy instantly when everything is out for a while", async () => {
    const world = fakeWorld();
    const soon = JSON.stringify({ cooldownUntil: Date.now() + 600000 });
    world.db.set("da:v1:provider:groq", soon);
    world.db.set("da:v1:provider:gemini", soon);
    const started = Date.now();
    await expect(ask()).rejects.toMatchObject({ code: "unavailable" });
    expect(llmCalls(world)).toHaveLength(0);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it("waits briefly when a provider will be ready in moments", async () => {
    vi.useFakeTimers();
    const world = fakeWorld({ llm: [{ answer: "hi" }] });
    world.db.set("da:v1:provider:groq", JSON.stringify({ cooldownUntil: Date.now() + 2000 }));
    world.db.set("da:v1:provider:gemini", JSON.stringify({ cooldownUntil: Date.now() + 2000 }));
    const pending = ask();
    await vi.advanceTimersByTimeAsync(2100);
    expect((await pending).value).toEqual({ answer: "hi" });
  });

  it("still works from memory when the database is down", async () => {
    const world = fakeWorld({ redisDown: true });
    fetch.mockImplementation(async (url, init) => {
      world.calls.push({ url: String(url), init });
      if (String(url) === REDIS_URL) throw new Error("down");
      return new Response(body(), {
        headers: { "x-ratelimit-remaining-tokens": "100", "x-ratelimit-reset-tokens": "40s" },
      });
    });
    await ask();
    await ask();
    expect(llmCalls(world).map(host)).toEqual(["api.groq.com", "generativelanguage.googleapis.com"]);
  });

  it("never stores keys, and never records a user's own key", async () => {
    const world = fakeWorld({ llm: [new Response("{}", { status: 401 }), { answer: "hi" }] });
    await askJson({ system: "s", user: "u", validate, userKey: "gsk_private", deadline: Date.now() + 25000 });
    const stored = JSON.stringify([...world.db]);
    expect(stored).not.toContain("gsk_private");
    expect(stored).not.toContain("groq-key");
    expect([...world.db.keys()].some((key) => key.includes("own"))).toBe(false);
  });
});
