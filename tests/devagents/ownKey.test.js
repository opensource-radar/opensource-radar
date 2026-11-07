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
  it("stays in memory unless remembered", () => {
    setOwnKey("gsk_a", false);
    expect(getOwnKey()).toBe("gsk_a");
    expect(JSON.stringify({ ...localStorage })).not.toContain("gsk_a");
  });

  it("is saved when remembered, and clearing removes it", () => {
    setOwnKey("gsk_a", true);
    expect(JSON.stringify({ ...localStorage })).toContain("gsk_a");
    clearOwnKey();
    expect(getOwnKey()).toBeNull();
    expect(JSON.stringify({ ...localStorage })).not.toContain("gsk_a");
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
    setOwnKey("gsk_a", true);
    expect(getOwnKey()).toBe("gsk_a");
  });

  it("the client sends the key only when there is one", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: {} })));
    await callDevAgents("x", {});
    expect(fetch.mock.calls[0][1].headers["X-User-LLM-Key"]).toBeUndefined();
    setOwnKey("gsk_a", false);
    await callDevAgents("x", {});
    expect(fetch.mock.calls[1][1].headers["X-User-LLM-Key"]).toBe("gsk_a");
  });

  it("the client can try a key that isn't saved yet", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: {} })));
    await callDevAgents("validate-key", {}, { ownKey: "gsk_new" });
    expect(fetch.mock.calls[0][1].headers["X-User-LLM-Key"]).toBe("gsk_new");
    expect(getOwnKey()).toBeNull();
  });
});
