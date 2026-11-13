import { describe, expect, it } from "vitest";
import { estimateTime } from "../../src/lib/timeEstimate.js";

const long = (n) => "word ".repeat(Math.ceil(n / 5));

describe("estimateTime", () => {
  it.each([
    ["a typo fix", { title: "Fix typo in README", labels: "good first issue, documentation", body: "Says 'teh'." }, "quick"],
    ["a short docs task", { title: "Update install docs", body: "The install command changed." }, "quick"],
    ["a medium test task", { title: "Add tests for date helpers", labels: "good first issue", body: long(600) }, "medium"],
    ["an unlabeled, ordinary issue", { title: "Button looks wrong on mobile", body: long(800) }, "medium"],
    ["a feature", { title: "Implement dark mode", labels: "enhancement", body: long(800) }, "long"],
    ["a long checklist", {
      title: "Improve the importer",
      body: `${long(2000)}\n- [ ] one\n- [ ] two\n- [ ] three\nSee a.py b.py c.py d.py`,
    }, "long"],
  ])("%s", (_, issue, expected) => {
    expect(estimateTime(issue)).toBe(expected);
  });

  it("copes with missing text, and doesn't call a short bug report quick", () => {
    expect(estimateTime({})).toBe("medium");
    expect(estimateTime({ title: "Crash when saving", body: "It crashes." })).toBe("medium");
  });
});
