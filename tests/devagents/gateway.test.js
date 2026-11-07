import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { actions } from "../../api/_lib/devagents/actions/index.js";
import { cached, chargeIssue } from "../../api/_lib/devagents/limits.js";
import { DevAgentsError } from "../../api/_lib/devagents/errors.js";
import { resetRouterMemory } from "../../api/_lib/devagents/router.js";
import { callAction, enableDevAgents, fakeWorld } from "./helpers.js";

const target = { repo: "a/b", issue: 1 };

beforeEach(() => {
  enableDevAgents();
  actions.ping = { llm: false, handler: async () => ({ pong: true }) };
  actions.think = {
    llm: true,
    handler: async (ctx) => {
      const { value } = await ctx.askJson({
        system: "s",
        user: "u",
        validate: (v) => v,
      });
      return value;
    },
  };
  actions.boom = {
    llm: false,
    handler: async () => {
      throw new Error("secret detail ghp_abc123");
    },
  };
});

afterEach(() => {
  delete actions.ping;
  delete actions.think;
  delete actions.boom;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("gateway", () => {
  it("returns disabled when the switch is off, before reading the session", async () => {
    fakeWorld();
    vi.stubEnv("DEVAGENTS_ENABLED", "");
    const { status, body } = await callAction("ping", {}, { signedIn: false });
    expect(status).toBe(503);
    expect(body).toEqual({ error: "disabled" });
  });

  it("returns disabled for logins outside the allow list", async () => {
    fakeWorld();
    vi.stubEnv("DEVAGENTS_ALLOWED_LOGINS", "someone-else");
    expect((await callAction("ping")).body).toEqual({ error: "disabled" });
  });

  it("returns sign_in when signed out", async () => {
    fakeWorld();
    const { status, body } = await callAction("ping", {}, { signedIn: false });
    expect(status).toBe(401);
    expect(body).toEqual({ error: "sign_in" });
  });

  it.each([
    ["unknown action", "nope", undefined],
    ["inherited name", "constructor", undefined],
    ["bad JSON", "ping", "{not json"],
    ["a JSON array", "ping", "[]"],
  ])("returns invalid_request for %s", async (_name, action, rawBody) => {
    fakeWorld();
    const { status, body } = await callAction(action, {}, { rawBody });
    expect(status).toBe(400);
    expect(body).toEqual({ error: "invalid_request" });
  });

  it.each([["a/b/c"], ["../x"], ["a"], [""]])(
    "returns invalid_request for repo %j on an LLM action",
    async (repo) => {
      fakeWorld();
      const { body } = await callAction("think", { repo, issue: 1 });
      expect(body).toEqual({ error: "invalid_request" });
    },
  );

  it.each([[0], [-1], [1.5], ["1"], [null]])(
    "returns invalid_request for issue %j",
    async (issue) => {
      fakeWorld();
      const { body } = await callAction("think", { repo: "a/b", issue });
      expect(body).toEqual({ error: "invalid_request" });
    },
  );

  it("returns too_large over 20 KB", async () => {
    fakeWorld();
    const { status, body } = await callAction("ping", { text: "x".repeat(21000) });
    expect(status).toBe(413);
    expect(body).toEqual({ error: "too_large" });
  });

  it("returns 200 {data} from a handler", async () => {
    fakeWorld();
    const { status, body } = await callAction("ping");
    expect(status).toBe(200);
    expect(body).toEqual({ data: { pong: true } });
  });

  it("turns an unexpected error into unavailable, with no details", async () => {
    fakeWorld();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { status, body } = await callAction("boom");
    expect(status).toBe(503);
    expect(body).toEqual({ error: "unavailable" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("ghp_abc123");
  });
});

describe("limits", () => {
  const llm = Array(20).fill({ ok: true });

  it("allows 5 issues a day, and repeats don't charge again", async () => {
    fakeWorld({ llm });
    for (const issue of [1, 2, 3, 4, 5, 5, 5]) {
      expect((await callAction("think", { repo: "a/b", issue })).status).toBe(200);
    }
    const sixth = await callAction("think", { repo: "a/b", issue: 6 });
    expect(sixth.status).toBe(429);
    expect(sixth.body).toEqual({ error: "limit" });
    // A rejected issue must not use up a place, and a known one still works.
    expect((await callAction("think", { repo: "a/b", issue: 5 })).status).toBe(200);
  });

  it("allows 40 LLM calls a day", async () => {
    fakeWorld({ llm: Array(50).fill({ ok: true }) });
    for (let i = 0; i < 40; i += 1) {
      expect((await callAction("think", target)).status).toBe(200);
    }
    expect((await callAction("think", target)).body).toEqual({ error: "limit" });
  });

  it("keeps each user's limits separate", async () => {
    fakeWorld({ llm });
    for (const issue of [1, 2, 3, 4, 5]) await callAction("think", { repo: "a/b", issue });
    const other = await callAction("think", { repo: "a/b", issue: 9 }, { login: "other" });
    expect(other.status).toBe(200);
  });

  it("an own key skips both limits", async () => {
    const world = fakeWorld({ llm: Array(10).fill({ ok: true }), redisDown: true });
    const headers = { "X-User-LLM-Key": "gsk_mine" };
    for (const issue of [1, 2, 3, 4, 5, 6, 7]) {
      const { status } = await callAction("think", { repo: "a/b", issue }, { headers });
      expect(status).toBe(200);
    }
    expect(world.llmCalls()[0].init.headers.Authorization).toBe("Bearer gsk_mine");
  });

  it("a failing own key falls back to shared capacity and says so", async () => {
    fakeWorld({ llm: [new Response("no", { status: 401 }), { ok: true }] });
    const { status, body } = await callAction("think", target, {
      headers: { "X-User-LLM-Key": "gsk_bad" },
    });
    expect(status).toBe(200);
    expect(body.ownKeyFailed).toBe(true);
  });

  describe("when no answer comes back", () => {
    const date = () => new Date().toISOString().slice(0, 10);
    const issuesKey = () => `da:issues:octocat:${date()}`;
    const llmKey = () => `da:llm:octocat:${date()}`;
    const rest = (world) =>
      world.db.set("da:v1:provider:groq", JSON.stringify({ cooldownUntil: Date.now() + 600000 }));

    it("busy answers don't use up the daily limit", async () => {
      const world = fakeWorld();
      rest(world);
      for (let issue = 1; issue <= 8; issue += 1) {
        expect((await callAction("think", { repo: "a/b", issue })).body).toEqual({ error: "unavailable" });
      }
      expect(world.db.get(issuesKey())?.size ?? 0).toBe(0);
      expect(Number(world.db.get(llmKey()) ?? 0)).toBe(0);
    });

    it("people can still use their 5 issues after a busy spell", async () => {
      const world = fakeWorld({ llm: Array(8).fill({ ok: true }) });
      rest(world);
      for (let issue = 1; issue <= 8; issue += 1) await callAction("think", { repo: "a/b", issue });
      world.db.delete("da:v1:provider:groq");
      resetRouterMemory();
      for (let issue = 11; issue <= 15; issue += 1) {
        expect((await callAction("think", { repo: "a/b", issue })).status).toBe(200);
      }
      expect((await callAction("think", { repo: "a/b", issue: 16 })).body).toEqual({ error: "limit" });
    });

    it("a repeat of an issue already paid for keeps its place", async () => {
      const world = fakeWorld({ llm: [{ ok: true }] });
      expect((await callAction("think", target)).status).toBe(200);
      rest(world);
      resetRouterMemory();
      await callAction("think", target);
      expect(world.db.get(issuesKey()).size).toBe(1);
    });

    it("a successful AI call stays charged when a later one fails", async () => {
      actions.twice = {
        llm: true,
        handler: async (ctx) => {
          const options = { system: "s", user: "u", validate: (v) => v };
          await ctx.askJson(options);
          return ctx.askJson(options);
        },
      };
      const world = fakeWorld({ llm: [{ ok: true }, "not json"] });
      expect((await callAction("twice", target)).body).toEqual({ error: "unavailable" });
      delete actions.twice;
      expect(Number(world.db.get(llmKey()))).toBe(1);
      expect(world.db.get(issuesKey())?.size ?? 0).toBe(0);
    });

    it("a deleted issue doesn't use up a place either", async () => {
      actions.gone = {
        llm: true,
        handler: async () => {
          throw new DevAgentsError("not_found", 404);
        },
      };
      const world = fakeWorld();
      expect((await callAction("gone", target)).status).toBe(404);
      delete actions.gone;
      expect(world.db.get(issuesKey())?.size ?? 0).toBe(0);
    });

    it("a broken key that falls back gets its charges back too", async () => {
      const world = fakeWorld({ badKeys: ["garbage"] });
      rest(world);
      await callAction("think", target, { headers: { "X-User-LLM-Key": "garbage" } });
      expect(world.db.get(issuesKey())?.size ?? 0).toBe(0);
      expect(Number(world.db.get(llmKey()) ?? 0)).toBe(0);
    });

    it("hitting the limit is never refunded", async () => {
      const world = fakeWorld({ llm: Array(50).fill({ ok: true }) });
      for (let i = 0; i < 42; i += 1) await callAction("think", target);
      expect(Number(world.db.get(llmKey()))).toBeGreaterThanOrEqual(40);
    });

    it("still refuses when limits can't be checked", async () => {
      const world = fakeWorld({ llm: [{ ok: true }], redisDown: true });
      expect((await callAction("think", target)).body).toEqual({ error: "unavailable" });
      expect(world.llmCalls()).toHaveLength(0);
    });
  });

  describe("with a key that doesn't work", () => {
    const headers = { "X-User-LLM-Key": "garbage" };
    const many = () => Array(60).fill({ ok: true });
    const tryIssues = async (count) => {
      const results = [];
      for (let issue = 1; issue <= count; issue += 1) {
        results.push(await callAction("think", { repo: "a/b", issue }, { headers }));
      }
      return results;
    };

    it("still allows only 5 issues a day on shared capacity", async () => {
      const world = fakeWorld({ llm: many(), badKeys: ["garbage"] });
      const results = await tryIssues(8);
      expect(world.sharedLlmCalls()).toHaveLength(5);
      expect(results.at(-1).body).toEqual({ error: "limit" });
    });

    it("still allows only 40 shared calls a day", async () => {
      const world = fakeWorld({ llm: many(), badKeys: ["garbage"] });
      for (let i = 0; i < 45; i += 1) await callAction("think", target, { headers });
      expect(world.sharedLlmCalls()).toHaveLength(40);
    });

    it("uses no shared capacity when limits can't be checked", async () => {
      const world = fakeWorld({ llm: many(), badKeys: ["garbage"], redisDown: true });
      const results = await tryIssues(3);
      expect(world.sharedLlmCalls()).toHaveLength(0);
      expect(results[0].body).toEqual({ error: "unavailable" });
    });

    it("is limited the same way when own keys can't be used at all", async () => {
      vi.stubEnv("DEVAGENTS_GROQ_MODEL", "");
      vi.stubEnv("DEVAGENTS_GEMINI_KEY", "gemini-key");
      vi.stubEnv("DEVAGENTS_GEMINI_MODEL", "gemini-model");
      const world = fakeWorld({ llm: many() });
      await tryIssues(8);
      expect(world.llmCalls()).toHaveLength(5);
    });
  });

  it("LLM actions return unavailable when the store is down", async () => {
    const world = fakeWorld({ llm, redisDown: true });
    expect((await callAction("think", target)).body).toEqual({ error: "unavailable" });
    expect(world.llmCalls()).toHaveLength(0);
  });

  it("no-LLM actions still work when the store is down", async () => {
    fakeWorld({ redisDown: true });
    expect((await callAction("ping")).status).toBe(200);
  });

  it("the switch being off stops LLM calls entirely", async () => {
    const world = fakeWorld({ llm });
    vi.stubEnv("DEVAGENTS_ENABLED", "false");
    await callAction("think", target);
    expect(world.llmCalls()).toHaveLength(0);
  });

  it("chargeIssue throws limit with a code the gateway understands", async () => {
    fakeWorld();
    for (const issue of [1, 2, 3, 4, 5]) await chargeIssue("me", "a/b", issue);
    await expect(chargeIssue("me", "a/b", 6)).rejects.toMatchObject({
      code: "limit",
      status: 429,
    });
  });
});

describe("cached", () => {
  it("runs produce once", async () => {
    fakeWorld();
    const produce = vi.fn(async () => ({ n: 1 }));
    expect(await cached("da:v1:k", 60, produce)).toEqual({ n: 1 });
    expect(await cached("da:v1:k", 60, produce)).toEqual({ n: 1 });
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it("still returns a value when Redis fails", async () => {
    fakeWorld({ redisDown: true });
    const produce = vi.fn(async () => ({ n: 1 }));
    expect(await cached("da:v1:k", 60, produce)).toEqual({ n: 1 });
  });

  it("doesn't cache failures", async () => {
    fakeWorld();
    const produce = vi
      .fn()
      .mockRejectedValueOnce(new Error("x"))
      .mockResolvedValueOnce({ n: 2 });
    await expect(cached("da:v1:k", 60, produce)).rejects.toThrow();
    expect(await cached("da:v1:k", 60, produce)).toEqual({ n: 2 });
  });
});
