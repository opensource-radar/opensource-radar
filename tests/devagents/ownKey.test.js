// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callDevAgents } from "../../src/devagents/client.js";
import { clearOwnKey, getOwnKey, setOwnKey } from "../../src/devagents/ownKey.js";

beforeEach(() => {
  localStorage.clear();
  clearOwnKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("own key", () => {
  const own = { provider: "cerebras", model: "m-1", key: "gsk_a" };

  it("stays in memory unless remembered", () => {
    setOwnKey(own, false);
    expect(getOwnKey()).toEqual(own);
    expect(JSON.stringify({ ...localStorage })).not.toContain("gsk_a");
  });

  it("is saved when remembered, and clearing removes it", () => {
    setOwnKey(own, true);
    expect(JSON.stringify({ ...localStorage })).toContain("gsk_a");
    clearOwnKey();
    expect(getOwnKey()).toBeNull();
    expect(JSON.stringify({ ...localStorage })).not.toContain("gsk_a");
  });

  it("reads a key saved by the older version as a Groq key", () => {
    localStorage.setItem("devagents:groq-key", "gsk_old");
    expect(getOwnKey()).toEqual({ provider: "groq", model: null, key: "gsk_old" });
  });

  it("treats a corrupted saved key as no key", () => {
    localStorage.setItem("devagents:own-key", "{bad");
    expect(getOwnKey()).toBeNull();
  });

  it("clearing removes the older saved key too", () => {
    localStorage.setItem("devagents:groq-key", "gsk_old");
    clearOwnKey();
    expect(getOwnKey()).toBeNull();
  });

  it("getOwnKey returns null when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(getOwnKey()).toBeNull();
  });

  it("setOwnKey still works when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    setOwnKey(own, true);
    expect(getOwnKey()).toEqual(own);
  });

  it("the client sends the key only when there is one", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: {} })));
    await callDevAgents("x", {});
    expect(fetch.mock.calls[0][1].headers["X-User-LLM-Key"]).toBeUndefined();
    setOwnKey(own, false);
    await callDevAgents("x", {});
    const { headers } = fetch.mock.calls[1][1];
    expect(headers["X-User-LLM-Key"]).toBe("gsk_a");
    expect(headers["X-User-LLM-Provider"]).toBe("cerebras");
    expect(headers["X-User-LLM-Model"]).toBe("m-1");
  });

  it("the client can try a key that isn't saved yet", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: {} })));
    await callDevAgents("validate-key", {}, { ownKey: { provider: "mistral", key: "gsk_new" } });
    const { headers } = fetch.mock.calls[0][1];
    expect(headers["X-User-LLM-Key"]).toBe("gsk_new");
    expect(headers["X-User-LLM-Provider"]).toBe("mistral");
    expect(headers["X-User-LLM-Model"]).toBeUndefined();
    expect(getOwnKey()).toBeNull();
  });
});
