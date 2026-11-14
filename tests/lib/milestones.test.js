import { describe, expect, it } from "vitest";
import { milestones } from "../../src/lib/milestones.js";

const prs = (repos, radar = false) => repos.map((repo, index) => ({ repo, madeWithRadar: radar && index === 0 }));
const ids = (input) => milestones(input).earned.map((m) => m.id);

describe("milestones", () => {
  it("has nothing before the first merge, and points to it", () => {
    expect(milestones({ totalMerged: 0, pullRequests: [] })).toEqual({ earned: [], next: { label: "First merged pull request", toGo: 1 } });
  });

  it("counts merges, different projects and Radar-made pull requests", () => {
    expect(ids({ totalMerged: 1, pullRequests: prs(["a/b"]) })).toEqual(["merged-1"]);
    expect(ids({ totalMerged: 6, pullRequests: prs(["a/b", "A/B", "c/d", "e/f"], true) })).toEqual(["merged-1", "merged-5", "projects-3", "radar"]);
  });

  it("uses GitHub's total when it knows of more merges than are loaded", () => {
    const result = milestones({ totalMerged: 12, pullRequests: prs(["a/b"]) });
    expect(result.earned.map((m) => m.id)).toContain("merged-10");
    expect(result.next).toEqual({ label: "25 merged pull requests", toGo: 13 });
  });
});
