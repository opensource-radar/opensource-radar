import { beforeAll, describe, expect, it } from "vitest";

let lib;
beforeAll(async () => {
  await import("../../extension/lib.js");
  lib = globalThis.RadarExtension;
});

describe("parseIssuePath", () => {
  it("reads owner, repo and number from an issue page", () => {
    expect(lib.parseIssuePath("/facebook/react/issues/123")).toEqual({ repo: "facebook/react", number: 123 });
    expect(lib.parseIssuePath("/a.b/c-d/issues/7/")).toEqual({ repo: "a.b/c-d", number: 7 });
  });

  it("ignores pages that aren't single issues", () => {
    expect(lib.parseIssuePath("/facebook/react/issues")).toBeNull();
    expect(lib.parseIssuePath("/facebook/react/pull/5")).toBeNull();
    expect(lib.parseIssuePath("/facebook/react")).toBeNull();
    expect(lib.parseIssuePath("/orgs/acme/issues/3")).toBeNull();
    expect(lib.parseIssuePath("/facebook/react/issues/new")).toBeNull();
  });
});

describe("helpUrl", () => {
  it("points at Radar's help page", () => {
    expect(lib.helpUrl("a/b", 9)).toBe("https://opensource-radar.com/help/a/b/9");
  });
});

describe("friendlinessSummary", () => {
  it("puts the signals into the same words as the site", () => {
    const summary = lib.friendlinessSummary({
      level: "high",
      replyHours: 30,
      outsideMerged: 21,
      outsideClosed: 26,
      hasCi: true,
      hasContributing: true,
    });
    expect(summary.label).toBe("Very beginner-friendly");
    expect(summary.facts).toEqual([
      "Maintainers usually reply in about 1 day",
      "21 of the last 26 pull requests from outside contributors were merged",
      "Has a contributing guide",
      "Uses automatic checks (GitHub Actions)",
    ]);
  });

  it("says when there isn't enough activity, and nothing when there's no data", () => {
    expect(lib.friendlinessSummary({ level: null, hasCi: false, hasContributing: false }).label).toBe(
      "Not enough activity to rate",
    );
    expect(lib.friendlinessSummary(null)).toBeNull();
  });
});

describe("stillFree", () => {
  it("is free with nobody assigned and no open pull request", () => {
    expect(lib.stillFree({ state: "open", assigned: false, openPullRequests: 0 }).status).toBe("free");
  });

  it("warns when someone is assigned or a pull request is open", () => {
    const taken = lib.stillFree({ state: "open", assigned: true, openPullRequests: 2 });
    expect(taken.status).toBe("taken");
    expect(taken.text).toContain("Someone is assigned to it.");
    expect(taken.text).toContain("2 pull requests are already open for it.");
  });

  it("says when the issue is closed", () => {
    expect(lib.stillFree({ state: "closed", assigned: false, openPullRequests: 0 }).status).toBe("closed");
  });
});

describe("countOpenPullRequests", () => {
  it("counts each open pull request that mentions the issue once", () => {
    const pr = (url, state) => ({ event: "cross-referenced", source: { issue: { pull_request: {}, state, html_url: url } } });
    expect(
      lib.countOpenPullRequests([
        pr("https://github.com/a/b/pull/1", "open"),
        pr("https://github.com/a/b/pull/1", "open"),
        pr("https://github.com/a/b/pull/2", "closed"),
        { event: "cross-referenced", source: { issue: { state: "open", html_url: "x" } } }, // an issue, not a PR
        { event: "labeled" },
      ]),
    ).toBe(1);
    expect(lib.countOpenPullRequests(null)).toBe(0);
  });
});

describe("replyTime", () => {
  it("rounds to days and weeks", () => {
    expect(lib.replyTime(5)).toBe("within a day");
    expect(lib.replyTime(72)).toBe("in about 3 days");
    expect(lib.replyTime(24 * 21)).toBe("in about 3 weeks");
    expect(lib.replyTime(null)).toBeNull();
  });
});
