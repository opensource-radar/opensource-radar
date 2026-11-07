import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callAction, enableDevAgents, fakeWorld } from "./helpers.js";

const date = () => new Date().toISOString().slice(0, 10);

beforeEach(enableDevAgents);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("feedback", () => {
  it("counts a vote and a reason", async () => {
    const world = fakeWorld();
    const { body } = await callAction("feedback", { action: "explain", helpful: false, reason: "wrong_file" });
    expect(body.data).toEqual({ saved: true });
    expect(world.db.get(`da:count:feedback:explain:down:${date()}`)).toBe("1");
    expect(world.db.get(`da:count:feedback:explain:wrong_file:${date()}`)).toBe("1");
  });

  it.each([
    [{ action: "nope", helpful: true }],
    [{ action: "constructor", helpful: true }],
    [{ action: "explain", helpful: "yes" }],
    [{ action: "explain", helpful: true, reason: "free text" }],
  ])("rejects %j", async (payload) => {
    fakeWorld();
    expect((await callAction("feedback", payload)).status).toBe(400);
  });

  it("returns saved:false and no error when the store is down", async () => {
    fakeWorld({ redisDown: true });
    const { status, body } = await callAction("feedback", { action: "explain", helpful: true });
    expect(status).toBe(200);
    expect(body.data).toEqual({ saved: false });
  });

  it("never stores login or free text", async () => {
    const world = fakeWorld();
    await callAction("feedback", { action: "explain", helpful: true, note: "my private words" });
    await callAction("event", { name: "explain" });
    const redis = world.calls.filter((call) => call.init.body && call.url.includes("fake-da-redis"));
    const sent = redis.map((call) => call.init.body).join(" ");
    expect(sent).not.toMatch(/octocat/i);
    expect(sent).not.toContain("my private words");
  });

  it("does nothing for signed-out visitors", async () => {
    const world = fakeWorld();
    const { status } = await callAction("event", { name: "explain" }, { signedIn: false });
    expect(status).toBe(401);
    expect(world.db.size).toBe(0);
  });
});

describe("feedback limit", () => {
  it("stops counting after 100 a day, without an error", async () => {
    const world = fakeWorld();
    let last;
    for (let i = 0; i < 101; i += 1) last = await callAction("event", { name: "explain" });
    expect(last.status).toBe(200);
    expect(last.body.data).toEqual({ saved: false });
    expect(world.db.get(`da:count:explain:${date()}`)).toBe("100");
  });

  it("limits each person separately", async () => {
    fakeWorld();
    for (let i = 0; i < 101; i += 1) await callAction("event", { name: "explain" });
    expect((await callAction("event", { name: "explain" }, { login: "other" })).body.data).toEqual({ saved: true });
  });
});

describe("event", () => {
  it("counts known events", async () => {
    const world = fakeWorld();
    expect((await callAction("event", { name: "pr_page_opened" })).body.data).toEqual({ saved: true });
    expect(world.db.get(`da:count:pr_page_opened:${date()}`)).toBe("1");
  });

  it("rejects unknown names", async () => {
    fakeWorld();
    expect((await callAction("event", { name: "hacked" })).status).toBe(400);
  });
});
