import { describe, expect, it } from "vitest";
import { computeFriendliness } from "../../api/_lib/friendliness.js";
import { friendlinessFacts, replyLine, replyTime } from "../../src/lib/friendliness.js";

const NOW = Date.parse("2026-11-13T12:00:00Z");
const daysAgo = (days) => new Date(NOW - days * 24 * 3600 * 1000).toISOString();
const hoursAfter = (iso, hours) => new Date(Date.parse(iso) + hours * 3600 * 1000).toISOString();

const issue = (openedDaysAgo, replyHours, { by = "NONE", replier = "MEMBER" } = {}) => {
  const createdAt = daysAgo(openedDaysAgo);
  return {
    createdAt,
    authorAssociation: by,
    comments: {
      nodes:
        replyHours === null
          ? []
          : [
              { createdAt: hoursAfter(createdAt, 1), authorAssociation: "NONE" },
              { createdAt: hoursAfter(createdAt, replyHours), authorAssociation: replier },
            ],
    },
  };
};
const prs = (merged, closed, association = "CONTRIBUTOR") =>
  Array.from({ length: closed }, (_, i) => ({ merged: i < merged, authorAssociation: association }));

const repo = ({ issues = [], pulls = [], ci = true, contributing = true } = {}) => ({
  contributingGuidelines: contributing ? { url: "https://x/CONTRIBUTING.md" } : null,
  workflows: ci ? { entries: [{ name: "ci.yml" }] } : null,
  issues: { nodes: issues },
  pullRequests: { nodes: pulls },
});

describe("computeFriendliness", () => {
  it("rates a responsive, welcoming project high", () => {
    const result = computeFriendliness(
      repo({ issues: [issue(30, 10), issue(20, 30), issue(15, 50)], pulls: prs(8, 10) }),
      NOW,
    );
    expect(result).toMatchObject({ level: "high", replyHours: 30, outsideMerged: 8, outsideClosed: 10, hasCi: true });
  });

  it("measures the first maintainer reply, not other people's comments", () => {
    const result = computeFriendliness(repo({ issues: [issue(30, 48), issue(30, 48), issue(30, 48)] }), NOW);
    expect(result.replyHours).toBe(48);
  });

  it("ignores maintainers' own issues and very new ones without replies", () => {
    const result = computeFriendliness(
      repo({ issues: [issue(30, null, { by: "OWNER" }), issue(2, null), issue(1, null)] }),
      NOW,
    );
    expect(result).toMatchObject({ level: null, replyHours: null, replyRate: null });
  });

  it("counts old unanswered issues against the reply rate", () => {
    const result = computeFriendliness(
      repo({ issues: [issue(40, 5), issue(40, 5), issue(40, 5), issue(40, null), issue(40, null), issue(40, null)] }),
      NOW,
    );
    expect(result.replyRate).toBe(0.5);
  });

  it("rates slow, closed-off projects low", () => {
    const result = computeFriendliness(
      repo({ issues: [issue(90, 24 * 30), issue(90, 24 * 30), issue(90, 24 * 30)], pulls: prs(0, 10), ci: false, contributing: false }),
      NOW,
    );
    expect(result.level).toBe("low");
  });

  it("only counts pull requests from outside contributors", () => {
    const result = computeFriendliness(repo({ pulls: [...prs(5, 5, "MEMBER"), ...prs(1, 4)] }), NOW);
    expect(result).toMatchObject({ outsideMerged: 1, outsideClosed: 4 });
  });

  it("says nothing for a missing repository", () => {
    expect(computeFriendliness(null, NOW)).toBeNull();
  });
});

describe("friendliness wording", () => {
  it.each([
    [3, "within a day"],
    [30, "in about 1 day"],
    [72, "in about 3 days"],
    [24 * 21, "in about 3 weeks"],
    [null, null],
  ])("replyTime(%s)", (hours, text) => {
    expect(replyTime(hours)).toBe(text);
  });

  it("builds the card line and the help page facts", () => {
    const f = { level: "high", replyHours: 30, outsideMerged: 8, outsideClosed: 10, hasCi: true, hasContributing: false };
    expect(replyLine(f)).toBe("Maintainers usually reply in about 1 day");
    expect(friendlinessFacts(f)).toEqual([
      "Maintainers usually reply in about 1 day",
      "8 of the last 10 pull requests from outside contributors were merged",
      "No contributing guide",
      "Uses automatic checks (GitHub Actions)",
    ]);
    expect(replyLine({ replyHours: null })).toBeNull();
  });
});
