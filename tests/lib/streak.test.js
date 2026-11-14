import { describe, expect, it } from "vitest";
import { streakText, weekStreak } from "../../src/lib/streak.js";

// Wednesday 2026-11-11.
const NOW = Date.parse("2026-11-11T12:00:00Z");

describe("weekStreak", () => {
  it("counts weeks in a row, Monday to Sunday", () => {
    expect(weekStreak(["2026-11-09T01:00:00Z", "2026-11-08T23:00:00Z", "2026-11-01T10:00:00Z"], NOW)).toBe(3);
  });

  it("doesn't break the streak before this week is over", () => {
    expect(weekStreak(["2026-11-05T10:00:00Z", "2026-10-28T10:00:00Z"], NOW)).toBe(2);
  });

  it("stops at the first week without a merge", () => {
    expect(weekStreak(["2026-11-10T10:00:00Z", "2026-10-28T10:00:00Z"], NOW)).toBe(1);
    expect(weekStreak(["2026-10-20T10:00:00Z"], NOW)).toBe(0);
    expect(weekStreak([null, "nonsense"], NOW)).toBe(0);
  });
});

describe("streakText", () => {
  it("only speaks up from two weeks on", () => {
    expect(streakText(1)).toBeNull();
    expect(streakText(4)).toBe("4 weeks in a row with a merged pull request");
  });
});
