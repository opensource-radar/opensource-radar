import { describe, expect, it } from "vitest";
import { friendliestFirst } from "../../src/lib/friendliness.js";

describe("friendliestFirst", () => {
  it("puts the friendliest projects first and keeps the order otherwise, unscored last", () => {
    const issue = (id, repo) => ({ id, repo });
    const issues = [issue(1, "a / low"), issue(2, "a / none"), issue(3, "a / high"), issue(4, "a / medium"), issue(5, "a / high")];
    const scores = { "a/low": { level: "low" }, "a/high": { level: "high" }, "a/medium": { level: "medium" }, "a/none": { level: null } };
    expect(friendliestFirst(issues, scores).map((i) => i.id)).toEqual([3, 5, 4, 1, 2]);
    expect(issues.map((i) => i.id)).toEqual([1, 2, 3, 4, 5]);
  });
});
