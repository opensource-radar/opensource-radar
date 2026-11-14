import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callAction, enableDevAgents, fakeWorld } from "./helpers.js";

const github = (pull, extra = {}) => ({
  "/repos/a/b": { default_branch: "main" },
  "/repos/a/b/branches/main": { commit: { sha: "abc" } },
  "/repos/a/b/pulls/9": { number: 9, title: "Fix typo in docs", review_comments: 2, ...pull },
  ...extra,
});
const merged = { merged_at: "2026-11-10T00:00:00Z", merged_by: { login: "maintainer", type: "User" } };
const thanks = () => callAction("thank-you", { repo: "a/b", issue: 1, pr: 9 });

beforeEach(enableDevAgents);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("thank-you", () => {
  it("drafts a short note after a merge, with the smaller model", async () => {
    vi.stubEnv("DEVAGENTS_GROQ_LIGHT_MODEL", "small-model");
    const world = fakeWorld({ github: github(merged), llm: [{ note: "Thanks for the quick review!" }] });
    const { body } = await thanks();
    expect(body.data).toEqual({ merged: true, mergedBy: "maintainer", note: "Thanks for the quick review!" });
    const request = JSON.parse(world.llmCalls()[0].init.body);
    expect(request.model).toBe("small-model");
    expect(JSON.stringify(request.messages)).toContain("Fix typo in docs");
  });

  it("waits for the merge, without asking the AI", async () => {
    const world = fakeWorld({ github: github({ merged_at: null }) });
    expect((await thanks()).body.data).toEqual({ merged: false });
    expect(world.llmCalls()).toHaveLength(0);
  });

  it("writes nothing for a project that bans AI-written text", async () => {
    const world = fakeWorld({
      github: github(merged, { "/repos/a/b/contents/CONTRIBUTING.md": "We do not accept AI-generated contributions." }),
    });
    expect((await thanks()).body.data).toEqual({ merged: true, mergedBy: "maintainer", banned: true });
    expect(world.llmCalls()).toHaveLength(0);
  });
});
