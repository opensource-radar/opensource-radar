import { describe, expect, it } from "vitest";
import { aiPolicy, claimStatus, paymentClaim, repoRules } from "../../api/_lib/devagents/rules.js";

const now = new Date("2026-11-07T00:00:00Z").getTime();
const daysAgo = (days) => new Date(now - days * 86400000).toISOString();
const openIssue = (extra = {}) => ({ state: "open", assignees: [], updated_at: daysAgo(1), ...extra });
const status = (input) =>
  claimStatus({ issue: openIssue(), comments: [], linkedPulls: [], now, ...input });
const comment = (body, days = 1, author_association = "NONE", login = "someone") => ({
  body,
  created_at: daysAgo(days),
  author_association,
  user: { login },
});

describe("aiPolicy", () => {
  it.each([
    "We do not accept AI-generated contributions.",
    "No LLM-generated pull requests please",
    "Using ChatGPT or Copilot to write code is not allowed.",
    "AI generated PRs will be rejected.",
    "We ban AI contributions.",
    "Please don't submit AI-written code.",
  ])("banned: %s", (text) => {
    expect(aiPolicy([text])).toBe("banned");
  });

  it.each([
    "AI-assisted contributions are welcome if disclosed",
    "You may use Copilot.",
    "LLM tools are allowed.",
  ])("allowed: %s", (text) => {
    expect(aiPolicy([text])).toBe("allowed");
  });

  it.each(["Please run the tests", "We wait for email replies", ""])("unknown: %j", (text) => {
    expect(aiPolicy([text])).toBe("unknown");
  });

  it("chooses banned when both appear", () => {
    expect(aiPolicy(["AI tools are welcome for docs. We do not accept AI-generated code."])).toBe("banned");
  });

  it("ignores missing files", () => {
    expect(aiPolicy([null, "We do not accept AI-generated contributions."])).toBe("banned");
    expect(aiPolicy([])).toBe("unknown");
  });
});

describe("paymentClaim", () => {
  it.each(["[Escrowed $450 USDC] Fix it", "Bounty: fix the bug", "Reward paid automatically on merge", "$50 for this", "Send to your crypto wallet"])(
    "notices %j",
    (text) => {
      expect(paymentClaim(text)).toBe(true);
    },
  );

  it.each(["Fix the payment form", "Reward the user with a badge", "", null])("ignores %j", (text) => {
    expect(paymentClaim(text)).toBe(false);
  });
});

describe("repoRules", () => {
  const ids = (text) => repoRules(text).map((rule) => rule.id);

  it("finds each rule", () => {
    expect(ids("You must sign our Contributor License Agreement")).toContain("cla");
    expect(ids("Every commit needs a Signed-off-by line")).toContain("dco");
    expect(ids("Please add tests for your change")).toContain("tests");
    expect(ids("Update the changelog")).toContain("changelog");
    expect(ids("We follow Conventional Commits")).toContain("commit_format");
    expect(ids("Open an issue first before starting work")).toContain("issue_first");
  });

  it("returns nothing for empty text", () => {
    expect(repoRules("")).toEqual([]);
  });

  it("gives plain labels", () => {
    expect(repoRules("Sign the CLA")[0].label).toMatch(/agreement/i);
  });
});

describe("claimStatus", () => {
  it("says clear when nothing is happening", () => {
    expect(status({}).verdict).toBe("clear");
  });

  it("an assignee means taken", () => {
    expect(status({ issue: openIssue({ assignees: [{}] }) }).verdict).toBe("taken");
  });

  it("an open linked PR means taken; a closed one doesn't", () => {
    expect(status({ linkedPulls: [{ number: 2, state: "open" }] }).verdict).toBe("taken");
    expect(status({ linkedPulls: [{ number: 2, state: "closed" }] }).verdict).toBe("clear");
  });

  it("a recent claim comment means taken", () => {
    const comments = [comment("Hi, I would like to work on this", 5)];
    expect(status({ comments }).verdict).toBe("taken");
  });

  it.each(["can I take this?", "I'll work on this", "please assign this to me", "I'm working on this"])(
    "recognises the claim %j",
    (body) => {
      expect(status({ comments: [comment(body)] }).verdict).toBe("taken");
    },
  );

  it.each([
    [0, /asked to work on this today/],
    [1, /asked to work on this yesterday/],
    [5, /asked to work on this 5 days ago/],
  ])("says when a claim from %i days ago was made in plain words", (days, wording) => {
    const { reasons } = status({ comments: [comment("I would like to work on this", days)] });
    expect(reasons[0]).toMatch(wording);
  });

  it("an old claim doesn't count", () => {
    expect(status({ comments: [comment("I would like to work on this", 31)] }).verdict).toBe("clear");
  });

  it("a maintainer saying it's still open clears an earlier claim", () => {
    const comments = [
      comment("I would like to work on this", 5),
      comment("This is still available, anyone can pick it up", 2, "MEMBER", "boss"),
    ];
    expect(status({ comments }).verdict).toBe("clear");
  });

  it("a maintainer telling someone else to go ahead clears an earlier claim", () => {
    const comments = [
      comment("I would like to work on this", 5, "NONE", "first"),
      comment("@second go ahead", 2, "OWNER", "boss"),
    ];
    expect(status({ comments }).verdict).toBe("clear");
  });

  it("a maintainer telling the claimer to go ahead stays taken", () => {
    const comments = [
      comment("I would like to work on this", 5, "NONE", "first"),
      comment("@first go ahead", 2, "OWNER", "boss"),
    ];
    expect(status({ comments }).verdict).toBe("taken");
  });

  it("a stale issue is quiet", () => {
    expect(status({ issue: openIssue({ updated_at: daysAgo(200) }) }).verdict).toBe("quiet");
  });

  it("a recent maintainer comment isn't quiet", () => {
    const issue = openIssue({ updated_at: daysAgo(200) });
    expect(status({ issue, comments: [comment("still wanted", 20, "OWNER")] }).verdict).toBe("clear");
  });

  it("a closed issue is closed, whatever else is true", () => {
    expect(status({ issue: openIssue({ state: "closed", assignees: [{}] }) }).verdict).toBe("closed");
  });

  it("copes with missing fields", () => {
    expect(status({ issue: { state: "open" }, comments: [{}] }).verdict).toBeTruthy();
  });

  it("always gives a reason", () => {
    expect(status({}).reasons.length).toBeGreaterThan(0);
  });
});
