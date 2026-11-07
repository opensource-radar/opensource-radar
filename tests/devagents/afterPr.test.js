import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callAction, enableDevAgents, fakeWorld } from "./helpers.js";

const run = (extra) => ({ id: 5, name: "tests", status: "completed", conclusion: "success", output: {}, ...extra });
const github = (runs, extra = {}) => ({
  "/repos/a/b/pulls/9": { number: 9, head: { sha: "headsha" } },
  "/repos/a/b/commits/headsha/check-runs": { check_runs: runs },
  ...extra,
});
const checks = () => callAction("explain-checks", { repo: "a/b", issue: 1, pr: 9 });
const review = () => callAction("explain-review", { repo: "a/b", issue: 1, pr: 9 });

beforeEach(enableDevAgents);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("explain-checks", () => {
  it("no failing runs means passing, and makes no LLM call", async () => {
    const world = fakeWorld({ github: github([run()]) });
    expect((await checks()).body.data).toEqual({ status: "passing", failing: [] });
    expect(world.llmCalls()).toHaveLength(0);
  });

  it("runs still in progress means pending, and makes no LLM call", async () => {
    const world = fakeWorld({ github: github([run({ status: "in_progress", conclusion: null })]) });
    expect((await checks()).body.data.status).toBe("pending");
    expect(world.llmCalls()).toHaveLength(0);
  });

  it("explains a failing run", async () => {
    const failed = run({ conclusion: "failure", output: { title: "1 failed", summary: "test_x failed" } });
    const world = fakeWorld({
      github: github([failed], { "/repos/a/b/check-runs/5/annotations": [{ path: "x.py", message: "boom here" }] }),
      llm: [{ failing: [{ name: "tests", why: "A test failed", nextStep: "Fix test_x" }] }],
    });
    const { body } = await checks();
    expect(body.data).toEqual({
      status: "failing",
      failing: [{ name: "tests", why: "A test failed", nextStep: "Fix test_x" }],
    });
    const { content } = JSON.parse(world.llmCalls()[0].init.body).messages[1];
    expect(content).toContain("test_x failed");
    expect(content).toContain("boom here");
  });

  it("a failing run with no summary still gets an entry and a next step", async () => {
    fakeWorld({ github: github([run({ conclusion: "failure" })]), llm: [{ failing: [] }] });
    const { failing } = (await checks()).body.data;
    expect(failing).toHaveLength(1);
    expect(failing[0].name).toBe("tests");
    expect(failing[0].nextStep).toBeTruthy();
  });

  it("failing runs are listed even when no LLM is available", async () => {
    fakeWorld({ github: github([run({ conclusion: "failure" })]) });
    const { status, body } = await checks();
    expect(status).toBe(200);
    expect(body.data.failing[0].why).toBeTruthy();
  });

  it("a PR number that doesn't exist returns not_found", async () => {
    fakeWorld();
    expect((await checks()).body).toEqual({ error: "not_found" });
  });

  it.each([[0], ["9"], [null]])("rejects pr %j", async (pr) => {
    fakeWorld();
    expect((await callAction("explain-checks", { repo: "a/b", issue: 1, pr })).status).toBe(400);
  });
});

describe("explain-review", () => {
  const empty = { "/repos/a/b/pulls/9/comments": [], "/repos/a/b/issues/9/comments": [] };

  it("no review comments returns an empty list and makes no LLM call", async () => {
    const world = fakeWorld({ github: github([], empty) });
    expect((await review()).body.data).toEqual({ comments: [] });
    expect(world.llmCalls()).toHaveLength(0);
  });

  it("explains comments from people, ignoring bots and the author", async () => {
    const world = fakeWorld({
      github: github([], {
        "/repos/a/b/pulls/9/comments": [{ body: "Please rename this", user: { login: "boss", type: "User" } }],
        "/repos/a/b/issues/9/comments": [
          { body: "CI report", user: { login: "ci[bot]", type: "Bot" } },
          { body: "My own note", user: { login: "octocat", type: "User" } },
        ],
      }),
      llm: [{ comments: [{ meaning: "They want a new name", nextStep: "Rename it" }] }],
    });
    const { body } = await review();
    expect(body.data.comments).toEqual([{ meaning: "They want a new name", nextStep: "Rename it" }]);
    const { content } = JSON.parse(world.llmCalls()[0].init.body).messages[1];
    expect(content).toContain("Please rename this");
    expect(content).not.toContain("CI report");
    expect(content).not.toContain("My own note");
  });
});
