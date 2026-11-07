import { afterEach, describe, expect, it, vi } from "vitest";
import { callDevAgents } from "../../src/devagents/client.js";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const respondWith = (response) => vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

describe("callDevAgents", () => {
  it("returns the data, and sends a POST with JSON", async () => {
    respondWith(Response.json({ data: { a: 1 } }));
    expect(await callDevAgents("explain", { repo: "a/b" })).toEqual({
      ok: true,
      data: { a: 1 },
      ownKeyFailed: false,
    });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/devagents?action=explain");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ repo: "a/b" });
  });

  it("passes on ownKeyFailed", async () => {
    respondWith(Response.json({ data: {}, ownKeyFailed: true }));
    expect((await callDevAgents("explain", {})).ownKeyFailed).toBe(true);
  });

  it("returns network when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await callDevAgents("explain", {})).toEqual({ ok: false, reason: "network" });
  });

  it("returns timeout when the server hangs", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, { signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(new Error("aborted")));
          }),
      ),
    );
    const pending = callDevAgents("explain", {});
    await vi.advanceTimersByTimeAsync(30000);
    expect(await pending).toEqual({ ok: false, reason: "timeout" });
  });

  it.each([
    ["non-JSON", new Response("<html>")],
    ["a body without data", Response.json({ nope: 1 })],
    ["null", Response.json(null)],
    ["an error with no code", new Response("{}", { status: 500 })],
  ])("returns invalid_response for %s", async (_name, response) => {
    respondWith(response);
    expect(await callDevAgents("explain", {})).toEqual({
      ok: false,
      reason: "invalid_response",
    });
  });

  it.each([
    [401, "sign_in"],
    [429, "limit"],
    [503, "unavailable"],
  ])("returns the server's code for %i", async (status, reason) => {
    respondWith(Response.json({ error: reason }, { status }));
    expect(await callDevAgents("explain", {})).toEqual({ ok: false, reason });
  });
});
