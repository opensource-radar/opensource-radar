import { describe, expect, it } from "vitest";
import { checkIssue, parseIssue } from "../../src/lib/issueCheck.js";

describe("parseIssue", () => {
  it("reads issue links and short references", () => {
    expect(parseIssue("https://github.com/a/b/issues/12")).toEqual({ repo: "a/b", number: 12 });
    expect(parseIssue(" github.com/a/b.js/issues/7#issuecomment-1 ")).toEqual({ repo: "a/b.js", number: 7 });
    expect(parseIssue("a/b#3")).toEqual({ repo: "a/b", number: 3 });
  });

  it("refuses anything else", () => {
    for (const bad of ["", "a/b", "https://github.com/a/b/pull/3", "https://gitlab.com/a/b/issues/1", "../x#1"]) {
      expect(parseIssue(bad)).toBeNull();
    }
  });
});

const passedIds = (issue) => checkIssue(issue).filter((c) => c.passed).map((c) => c.id);

describe("checkIssue", () => {
  it("passes a well written issue", () => {
    const issue = {
      state: "open",
      labels: ["good first issue"],
      assigned: false,
      body:
        "The search box ignores the reduced motion setting and keeps animating the results list, which " +
        "makes some people feel sick.\n\nThe animation lives in `src/components/Results.jsx`.\n\n" +
        "Expected: no animation when prefers-reduced-motion is set.",
    };
    expect(passedIds(issue)).toEqual(["open", "explains", "done", "files", "label", "unassigned", "length"]);
  });

  it("flags what a thin issue is missing, with a tip for each", () => {
    const checks = checkIssue({ state: "closed", labels: ["bug"], assigned: true, body: "fix it", bodyLength: 9000 });
    expect(checks.filter((c) => c.passed).map((c) => c.id)).toEqual([]);
    expect(checks.every((c) => c.tip.length > 10)).toBe(true);
  });

  it("ignores template comments when judging the explanation", () => {
    const body = `<!-- ${"Describe the bug here. ".repeat(10)} -->\nbroken`;
    expect(passedIds({ state: "open", labels: [], body })).not.toContain("explains");
  });

  it("counts a GitHub link to a file as pointing at it", () => {
    expect(passedIds({ body: "See https://github.com/a/b/blob/main/README" })).toContain("files");
  });
});
