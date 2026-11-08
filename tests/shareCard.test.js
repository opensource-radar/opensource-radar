import { describe, expect, it } from "vitest";
import {
  isRadarPullRequest,
  linkedInShareUrl,
  shareHeadline,
  shareText,
  wrapLines,
  xShareUrl,
} from "../src/shareCard.js";

const merged = (extra = {}) => ({ title: "Fix the thing", repo: "a/b", number: 7, ...extra });

describe("isRadarPullRequest", () => {
  it("recognises PRs written with DevAgents' help by their note", () => {
    expect(isRadarPullRequest({ body: "Fixes #1\\n\\nThis PR was prepared with AI assistance from DevAgents; the changes were made and reviewed by me." })).toBe(true);
    expect(isRadarPullRequest({ body: "My own words" })).toBe(false);
    expect(isRadarPullRequest({ body: null })).toBe(false);
    expect(isRadarPullRequest({})).toBe(false);
  });
});

describe("shareHeadline", () => {
  it("celebrates a first merge differently", () => {
    expect(shareHeadline(true)).toBe("My first open-source pull request was merged");
    expect(shareHeadline(false)).toBe("My open-source pull request was merged");
  });
});

describe("share text and links", () => {
  it("says what was merged and where, with a link to Radar", () => {
    const text = shareText(merged(), true);
    expect(text).toContain("My first open-source pull request was merged");
    expect(text).toContain("a/b");
    expect(text).toContain("Fix the thing");
    expect(text).toContain("OpenSource Radar");
  });

  it("builds an X post link with the text and site", () => {
    const url = new URL(xShareUrl(merged(), false));
    expect(url.origin + url.pathname).toBe("https://x.com/intent/post");
    expect(url.searchParams.get("text")).toContain("Fix the thing");
    expect(url.searchParams.get("url")).toBe("https://opensource-radar.com/");
  });

  it("builds a LinkedIn share link for the site", () => {
    const url = new URL(linkedInShareUrl());
    expect(url.origin + url.pathname).toBe("https://www.linkedin.com/sharing/share-offsite/");
    expect(url.searchParams.get("url")).toBe("https://opensource-radar.com/");
  });
});

describe("wrapLines", () => {
  const measure = (text) => text.length * 10;

  it("wraps words to fit the width", () => {
    expect(wrapLines(measure, "one two three four", 100, 3)).toEqual(["one two", "three four"]);
  });

  it("stops at the line limit with an ellipsis", () => {
    const lines = wrapLines(measure, "aa bb cc dd ee ff gg hh", 50, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
    expect(measure(lines[1])).toBeLessThanOrEqual(50);
  });

  it("breaks a single word that's too long", () => {
    const lines = wrapLines(measure, "abcdefghijklmnop", 50, 3);
    expect(lines.every((line) => measure(line) <= 50)).toBe(true);
  });

  it("returns nothing for empty text", () => {
    expect(wrapLines(measure, "", 50, 2)).toEqual([]);
  });
});
