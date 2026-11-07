import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callAction, enableDevAgents, fakeWorld } from "./helpers.js";

const base = {
  "/repos/a/b": { default_branch: "main", archived: false },
  "/repos/a/b/branches/main": { commit: { sha: "abc" } },
  "/repos/a/b/issues/1": { number: 1, state: "open", assignees: [], updated_at: new Date().toISOString() },
  "/repos/a/b/issues/1/comments": [],
  "/repos/a/b/issues/1/timeline": [],
};
const target = { repo: "a/b", issue: 1 };

beforeEach(enableDevAgents);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("issue-check", () => {
  it("still answers when the repo has no contributing file", async () => {
    const world = fakeWorld({ github: base });
    const { status, body } = await callAction("issue-check", target);
    expect(status).toBe(200);
    expect(body.data).toMatchObject({ verdict: "clear", aiPolicy: "unknown", rules: [], archived: false });
    expect(body.data.claimComment).toMatch(/work on this/i);
    expect(world.llmCalls()).toHaveLength(0);
  });

  it("reads the policy and rules", async () => {
    fakeWorld({
      github: {
        ...base,
        "/repos/a/b/contents/CONTRIBUTING.md": "We do not accept AI-generated contributions. Sign the CLA.",
      },
    });
    const { body } = await callAction("issue-check", target);
    expect(body.data.aiPolicy).toBe("banned");
    expect(body.data.rules.map((rule) => rule.id)).toContain("cla");
  });

  it("marks an archived repo", async () => {
    fakeWorld({ github: { ...base, "/repos/a/b": { default_branch: "main", archived: true } } });
    expect((await callAction("issue-check", target)).body.data.archived).toBe(true);
  });

  it("works with an empty repo", async () => {
    const github = { ...base };
    delete github["/repos/a/b/branches/main"];
    fakeWorld({ github });
    expect((await callAction("issue-check", target)).status).toBe(200);
  });

  it("returns not_found for a deleted issue", async () => {
    const github = { ...base };
    delete github["/repos/a/b/issues/1"];
    fakeWorld({ github });
    const { status, body } = await callAction("issue-check", target);
    expect(status).toBe(404);
    expect(body).toEqual({ error: "not_found" });
  });

  it("works when the store is down", async () => {
    fakeWorld({ github: base, redisDown: true });
    expect((await callAction("issue-check", target)).status).toBe(200);
  });

  it("rejects a bad target", async () => {
    fakeWorld({ github: base });
    expect((await callAction("issue-check", { repo: "x", issue: 1 })).status).toBe(400);
  });
});
