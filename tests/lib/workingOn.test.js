import { describe, expect, it } from "vitest";
import {
  MAX_WORKING,
  cleanWorking,
  daysSince,
  dueReminder,
  isWorkingOn,
  readWorking,
  snooze,
  stopWorking,
  toggleWorking,
  writeWorking,
} from "../../src/lib/workingOn.js";

const issue = (number, extra = {}) => ({
  repo: "a / b",
  number,
  title: `Issue ${number}`,
  url: `https://github.com/a/b/issues/${number}`,
  ...extra,
});
const at = (iso) => new Date(iso);

const memoryStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
};

describe("working on an issue", () => {
  it("starts and stops tracking", () => {
    const list = toggleWorking([], issue(1), at("2026-11-10T00:00:00Z"));
    expect(isWorkingOn(list, issue(1))).toBe(true);
    expect(list[0].startedAt).toBe("2026-11-10T00:00:00.000Z");
    expect(toggleWorking(list, issue(1))).toEqual([]);
  });

  it("keeps at most the limit, newest first", () => {
    let list = [];
    for (let i = 1; i <= MAX_WORKING + 2; i += 1) list = toggleWorking(list, issue(i));
    expect(list).toHaveLength(MAX_WORKING);
    expect(list[0].number).toBe(MAX_WORKING + 2);
  });

  it("won't track something that isn't a GitHub issue", () => {
    expect(toggleWorking([], issue(1, { url: "https://evil.example/x" }))).toEqual([]);
    expect(toggleWorking([], issue(null))).toEqual([]);
  });

  it("cleans stored data", () => {
    const good = { ...issue(1), startedAt: "2026-11-10T00:00:00Z" };
    expect(cleanWorking([good, good, { ...issue(2), startedAt: "nope" }, "x"])).toHaveLength(1);
    expect(cleanWorking("garbage")).toEqual([]);
  });

  it("saves, reads back, and clears storage when empty", () => {
    const storage = memoryStorage();
    writeWorking(toggleWorking([], issue(1), at("2026-11-10T00:00:00Z")), storage);
    expect(readWorking(storage)).toHaveLength(1);
    writeWorking([], storage);
    expect(storage.getItem("opensource-radar-working-on")).toBeNull();
  });
});

describe("check-ins", () => {
  const started = toggleWorking([], issue(1), at("2026-11-10T00:00:00Z"));

  it("asks after three days, not before", () => {
    expect(dueReminder(started, at("2026-11-12T23:00:00Z"))).toBeNull();
    expect(dueReminder(started, at("2026-11-13T00:00:00Z"))?.number).toBe(1);
  });

  it("'Still on it' asks again three days later", () => {
    const snoozed = snooze(started, issue(1), at("2026-11-13T00:00:00Z"));
    expect(dueReminder(snoozed, at("2026-11-15T00:00:00Z"))).toBeNull();
    expect(dueReminder(snoozed, at("2026-11-16T00:00:00Z"))?.number).toBe(1);
    expect(snoozed[0].startedAt).toBe("2026-11-10T00:00:00.000Z");
  });

  it("asks about the one waiting longest first", () => {
    let list = toggleWorking([], issue(1), at("2026-11-01T00:00:00Z"));
    list = toggleWorking(list, issue(2), at("2026-11-05T00:00:00Z"));
    expect(dueReminder(list, at("2026-11-19T00:00:00Z"))?.number).toBe(1);
  });

  it("'Let it go' stops tracking", () => {
    expect(stopWorking(started, issue(1))).toEqual([]);
  });

  it("counts whole days", () => {
    expect(daysSince("2026-11-10T00:00:00Z", at("2026-11-13T12:00:00Z"))).toBe(3);
  });
});
