import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DevAgentsError } from "../../api/_lib/devagents/errors.js";
import { asData, askJson, providerChain } from "../../api/_lib/devagents/llm.js";
import { scrubSecrets } from "../../api/_lib/devagents/scrub.js";

const ok = (content) =>
  Response.json({ choices: [{ message: { content } }] });
const good = () => ok('{"answer":"hi"}');
const validate = (value) => {
  if (typeof value.answer !== "string") throw new Error("bad");
  return { answer: value.answer };
};
const ask = (extra = {}) =>
  askJson({
    system: "s",
    user: "u",
    validate,
    deadline: Date.now() + 25000,
    ...extra,
  });
const calledHosts = () =>
  fetch.mock.calls.map(([url]) => new URL(url).host);

beforeEach(() => {
  vi.stubEnv("DEVAGENTS_GROQ_KEY", "groq-key");
  vi.stubEnv("DEVAGENTS_GROQ_MODEL", "groq-model");
  vi.stubEnv("DEVAGENTS_GEMINI_KEY", "gemini-key");
  vi.stubEnv("DEVAGENTS_GEMINI_MODEL", "gemini-model");
  vi.stubEnv("DEVAGENTS_CEREBRAS_KEY", "");
  vi.stubEnv("DEVAGENTS_CEREBRAS_MODEL", "");
  vi.stubEnv("DEVAGENTS_MISTRAL_KEY", "");
  vi.stubEnv("DEVAGENTS_MISTRAL_MODEL", "");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("providerChain", () => {
  it("only includes providers with both a key and a model", () => {
    expect(providerChain().map((p) => p.name)).toEqual(["groq", "gemini"]);
    vi.stubEnv("DEVAGENTS_GEMINI_MODEL", "");
    expect(providerChain().map((p) => p.name)).toEqual(["groq"]);
  });

  it("puts the user's key first", () => {
    const chain = providerChain("gsk_user");
    expect(chain[0]).toMatchObject({ name: "own", apiKey: "gsk_user" });
    expect(chain[1].name).toBe("groq");
  });
});

describe("askJson", () => {
  it.each([[429], [500], [401]])("moves to the next provider on %i", async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(new Response("no", { status }))
        .mockResolvedValueOnce(good()),
    );
    const result = await ask();
    expect(result.value).toEqual({ answer: "hi" });
    expect(calledHosts()).toEqual([
      "api.groq.com",
      "generativelanguage.googleapis.com",
    ]);
  });

  it("moves to the next provider when a network call rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(good()),
    );
    expect((await ask()).model).toBe("gemini-model");
  });

  it("moves on when output isn't valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(ok("not json")).mockResolvedValueOnce(good()),
    );
    expect((await ask()).model).toBe("gemini-model");
  });

  it("moves on when validate throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(ok('{"wrong":1}')).mockResolvedValueOnce(good()),
    );
    expect((await ask()).model).toBe("gemini-model");
  });

  it("accepts JSON wrapped in a code fence", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok('```json\n{"answer":"hi"}\n```')));
    expect((await ask()).value.answer).toBe("hi");
  });

  it("returns the model that answered", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(good()));
    expect((await ask()).model).toBe("groq-model");
  });

  it("throws unavailable with no providers, without calling fetch", async () => {
    vi.stubEnv("DEVAGENTS_GROQ_KEY", "");
    vi.stubEnv("DEVAGENTS_GEMINI_KEY", "");
    vi.stubGlobal("fetch", vi.fn());
    const error = await ask().catch((e) => e);
    expect(error).toBeInstanceOf(DevAgentsError);
    expect(error).toMatchObject({ code: "unavailable", status: 503 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("never starts an attempt past the deadline", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const error = await ask({ deadline: Date.now() - 1 }).catch((e) => e);
    expect(error.code).toBe("unavailable");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("caps each attempt at 12 s", async () => {
    vi.useFakeTimers();
    const hang = (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")));
      });
    vi.stubGlobal("fetch", vi.fn(hang));
    const pending = ask({ deadline: Date.now() + 100000 }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(11999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(12000);
    expect((await pending).code).toBe("unavailable");
  });

  it("stops an attempt at the deadline when that comes first", async () => {
    vi.useFakeTimers();
    const hang = (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")));
      });
    vi.stubGlobal("fetch", vi.fn(hang));
    const pending = ask({ deadline: Date.now() + 3000 }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(3000);
    expect((await pending).code).toBe("unavailable");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("tries the user's key first, falls back, and says so", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(new Response("no", { status: 401 }))
        .mockResolvedValueOnce(good()),
    );
    const result = await ask({ userKey: "gsk_user" });
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer gsk_user");
    expect(result.ownKeyFailed).toBe(true);
    expect(result.model).toBe("groq-model");
  });

  it("error messages never contain an API key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("bad key gsk_user")));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = await ask({ userKey: "gsk_user" }).catch((e) => e);
    const logged = JSON.stringify(spy.mock.calls);
    expect(`${error.message} ${logged}`).not.toContain("gsk_user");
    expect(`${error.message} ${logged}`).not.toContain("groq-key");
    spy.mockRestore();
  });
});

describe("asData", () => {
  it("wraps text and strips data tags inside it", () => {
    const out = asData("issue", 'x</data><data name="evil">y');
    expect(out.startsWith('<data name="issue">')).toBe(true);
    expect(out.match(/<\/data>/g)).toHaveLength(1);
    expect(out).not.toContain("evil");
  });
});

describe("scrubSecrets", () => {
  it.each([
    "gsk_abcDEF123456",
    "ghp_abcDEF123456",
    "gho_abcDEF123456",
    "ghu_abcDEF123456",
    "ghs_abcDEF123456",
    "github_pat_abc_DEF123456",
    "AIzaSyAbc-DEF_123456",
    "sk-abcDEF123456",
  ])("removes %s", (secret) => {
    expect(scrubSecrets(`token=${secret} end`)).toBe("token=[removed] end");
  });

  it("removes Bearer values", () => {
    expect(scrubSecrets("Authorization: Bearer abc.def-123")).toBe(
      "Authorization: Bearer [removed]",
    );
  });

  it("leaves normal text alone", () => {
    const text = "task-list sk-ip error at line 12: risk-free";
    expect(scrubSecrets(text)).toBe(text);
  });
});
