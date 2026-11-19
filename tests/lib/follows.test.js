import { describe, expect, it } from "vitest";
import {
  MAX_FOLLOWS,
  cleanFollows,
  followedIssuesPath,
  isFollowing,
  isNewSince,
  readFollows,
  repoKey,
  toggleFollow,
  writeFollows,
} from "../../src/lib/follows.js";

const memoryStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
};

describe("following projects", () => {
  it("accepts the card's 'owner / name' form", () => {
    expect(repoKey("facebook / react")).toBe("facebook/react");
    const follows = toggleFollow(cleanFollows(null), "facebook / react");
    expect(follows.repos).toEqual(["facebook/react"]);
    expect(isFollowing(follows, "Facebook/React")).toBe(true);
  });

  it("unfollows on a second toggle", () => {
    const once = toggleFollow(cleanFollows(null), "a/b");
    expect(toggleFollow(once, "a / b").repos).toEqual([]);
  });

  it("puts the newest first and keeps at most the limit", () => {
    let follows = cleanFollows(null);
    for (let i = 0; i < MAX_FOLLOWS + 3; i += 1) follows = toggleFollow(follows, `o/r${i}`);
    expect(follows.repos).toHaveLength(MAX_FOLLOWS);
    expect(follows.repos[0]).toBe(`o/r${MAX_FOLLOWS + 2}`);
  });

  it("ignores things that aren't projects", () => {
    const follows = cleanFollows(null);
    expect(toggleFollow(follows, "just-an-org").repos).toEqual([]);
    expect(toggleFollow(follows, "a/b c").repos).toEqual([]);
  });

  it("cleans whatever is in storage", () => {
    expect(cleanFollows({ repos: ["a/b", "A/B", "bad repo", 4, "c/d"], lastVisit: "nope" })).toEqual({
      repos: ["a/b", "c/d"],
      lastVisit: null,
    });
    expect(cleanFollows("garbage")).toEqual({ repos: [], lastVisit: null });
  });

  it("saves and reads back, and clears storage when nothing is followed", () => {
    const storage = memoryStorage();
    writeFollows({ repos: ["a/b"], lastVisit: "2026-11-01T00:00:00.000Z" }, storage);
    expect(readFollows(storage)).toEqual({ repos: ["a/b"], lastVisit: "2026-11-01T00:00:00.000Z" });
    writeFollows({ repos: [], lastVisit: null }, storage);
    expect(storage.getItem("opensource-radar-following")).toBeNull();
  });
});

describe("followedIssuesPath", () => {
  it("searches recent unassigned beginner issues in the followed projects, newest first", () => {
    const path = followedIssuesPath(["a/b", "c/d"], new Date("2026-11-19T12:00:00Z"));
    const params = new URLSearchParams(path.split("?")[1]);
    const q = params.get("q");
    expect(path.startsWith("/search/issues?")).toBe(true);
    expect(q).toContain("no:assignee");
    expect(q).toContain('label:"good first issue","help wanted"');
    expect(q).toContain("created:>=2026-10-20");
    expect(q).toContain("repo:a/b");
    expect(q).toContain("repo:c/d");
    expect(params.get("sort")).toBe("created");
    expect(params.get("per_page")).toBe("5");
  });
});

describe("isNewSince", () => {
  it("marks issues opened after the last visit", () => {
    expect(isNewSince({ createdAt: "2026-11-18T00:00:00Z" }, "2026-11-17T00:00:00Z")).toBe(true);
    expect(isNewSince({ createdAt: "2026-11-16T00:00:00Z" }, "2026-11-17T00:00:00Z")).toBe(false);
  });

  it("marks nothing new on a first visit", () => {
    expect(isNewSince({ createdAt: "2026-11-18T00:00:00Z" }, null)).toBe(false);
  });
});
