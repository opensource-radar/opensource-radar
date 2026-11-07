import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseChangeRef } from "../../api/_lib/devagents/actions/checkChange.js";
import { callAction, enableDevAgents, fakeWorld } from "./helpers.js";

const COMPARE = "/repos/a/b/compare/main...octocat:patch-1";
const files = [{ filename: "src/app.py", additions: 2, deletions: 1, patch: "+new" }];
const github = (extra = {}) => ({
  "/repos/a/b": { default_branch: "main" },
  "/repos/a/b/branches/main": { commit: { sha: "abc" } },
  [COMPARE]: { files },
  ...extra,
});
const check = (extra = {}) =>
  callAction("check-change", { repo: "a/b", issue: 1, change: "patch-1", ...extra });

beforeEach(enableDevAgents);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("parseChangeRef", () => {
  it("reads branch names and links", () => {
    expect(parseChangeRef("patch-1", "me")).toEqual({ headOwner: "me", branch: "patch-1" });
    expect(parseChangeRef(" other:fix/a ", "me")).toEqual({ headOwner: "other", branch: "fix/a" });
    expect(parseChangeRef("https://github.com/me/repo/tree/fix/a", "x")).toEqual({ headOwner: "me", branch: "fix/a" });
    expect(parseChangeRef("https://github.com/up/repo/compare/main...me:fix/a", "x")).toEqual({ headOwner: "me", branch: "fix/a" });
    expect(parseChangeRef("https://github.com/up/repo/compare/main...fix/a", "x")).toEqual({ headOwner: "up", branch: "fix/a" });
  });

  it.each([[""], ["a b"], ["../x"], ["https://evil.test/me/repo/tree/x"], ["https://github.com/me/repo/pull/1"], [null]])(
    "returns null for %j",
    (text) => {
      expect(parseChangeRef(text, "me")).toBeNull();
    },
  );
});

describe("check-change", () => {
  it("gives facts and findings", async () => {
    fakeWorld({ github: github(), llm: [{ findings: [{ path: "src/app.py", note: "Check the name" }] }] });
    const { body } = await check();
    expect(body.data.facts).toEqual({ filesChanged: 1, additions: 2, deletions: 1, touchesUnrelatedFiles: false, summarised: false });
    expect(body.data.findings).toEqual([{ path: "src/app.py", note: "Check the name" }]);
  });

  it("a missing branch returns not_found", async () => {
    const repo = github();
    delete repo[COMPARE];
    fakeWorld({ github: repo });
    expect((await check()).body).toEqual({ error: "not_found" });
  });

  it("a bad reference returns invalid_request", async () => {
    fakeWorld({ github: github() });
    expect((await check({ change: "a b" })).status).toBe(400);
  });

  it("no result contains approval wording", async () => {
    fakeWorld({
      github: github(),
      llm: [{ findings: [
        { path: "src/app.py", note: "This looks good!" },
        { path: "src/app.py", note: "LGTM" },
        { path: "src/app.py", note: "Ready to merge" },
        { path: "src/app.py", note: "Rename this variable" },
      ] }],
    });
    expect((await check()).body.data.findings.map((f) => f.note)).toEqual(["Rename this variable"]);
  });

  it("drops a finding about a file that wasn't changed", async () => {
    fakeWorld({ github: github(), llm: [{ findings: [{ path: "made/up.py", note: "x" }] }] });
    expect((await check()).body.data.findings).toEqual([]);
  });

  it("a diff over 40 KB is summarised from file names, and says so", async () => {
    const big = [{ filename: "big.py", additions: 1, deletions: 0, patch: "x".repeat(41000) }];
    const world = fakeWorld({ github: github({ [COMPARE]: { files: big } }), llm: [{ findings: [] }] });
    const { body } = await check();
    expect(body.data.facts.summarised).toBe(true);
    const { messages } = JSON.parse(world.llmCalls()[0].init.body);
    expect(messages[1].content).toContain("big.py");
    expect(messages[1].content).not.toContain("xxxxxxxx");
  });

  it("a diff too big for free plans is also summarised", async () => {
    const big = [{ filename: "big.py", additions: 1, deletions: 0, patch: "x".repeat(13000) }];
    fakeWorld({ github: github({ [COMPARE]: { files: big } }), llm: [{ findings: [] }] });
    expect((await check()).body.data.facts.summarised).toBe(true);
  });

  it("notices files outside the ones to read", async () => {
    fakeWorld({ github: github(), llm: [{ findings: [] }] });
    const { body } = await check({ expectedFiles: ["other.py"] });
    expect(body.data.facts.touchesUnrelatedFiles).toBe(true);
  });

  it("an empty change needs no LLM", async () => {
    const world = fakeWorld({ github: github({ [COMPARE]: { files: [] } }) });
    const { body } = await check();
    expect(body.data.facts.filesChanged).toBe(0);
    expect(world.llmCalls()).toHaveLength(0);
  });

  it("uses no LLM on repos that ban AI", async () => {
    const world = fakeWorld({
      github: github({ "/repos/a/b/contents/CONTRIBUTING.md": "We do not accept AI-generated contributions." }),
    });
    const { body } = await check();
    expect(body.data.findings).toEqual([]);
    expect(world.llmCalls()).toHaveLength(0);
  });
});

describe("pr-text", () => {
  const prGithub = (extra = {}) =>
    github({
      "/repos/a/b/issues/12": { title: "Bug", body: "b", number: 12 },
      "/repos/a/b/commits": [{ commit: { message: "fix: earlier change\n\nmore" } }],
      ...extra,
    });
  const write = () => callAction("pr-text", { repo: "a/b", issue: 12, change: "patch-1" });

  it("the body contains 'Fixes #12' and the note, even if the LLM omits them", async () => {
    fakeWorld({ github: prGithub(), llm: [{ title: "fix: the bug", body: "What changed" }] });
    const { body } = await write();
    expect(body.data).toMatchObject({ title: "fix: the bug", baseBranch: "main", headOwner: "octocat", branch: "patch-1" });
    expect(body.data.body).toContain("Fixes #12");
    expect(body.data.body).toContain("What changed");
    expect(body.data.body).toContain("prepared with AI assistance from DevAgents");
  });

  it("doesn't repeat Fixes when the LLM included it", async () => {
    fakeWorld({ github: prGithub(), llm: [{ title: "t", body: "Fixes #12\nMore" }] });
    expect((await write()).body.data.body.match(/Fixes #12/g)).toHaveLength(1);
  });

  it("gives the model the repo's template and recent commit style", async () => {
    const world = fakeWorld({
      github: prGithub({ "/repos/a/b/contents/.github/PULL_REQUEST_TEMPLATE.md": "## Why this change" }),
      llm: [{ title: "t", body: "b" }],
    });
    await write();
    const { content } = JSON.parse(world.llmCalls()[0].init.body).messages[1];
    expect(content).toContain("## Why this change");
    expect(content).toContain("fix: earlier change");
  });

  it("a missing title makes the answer invalid", async () => {
    fakeWorld({ github: prGithub(), llm: [{ body: "b" }] });
    expect((await write()).body).toEqual({ error: "unavailable" });
  });

  it("writes nothing on repos that ban AI", async () => {
    const world = fakeWorld({
      github: prGithub({ "/repos/a/b/contents/CONTRIBUTING.md": "We do not accept AI-generated contributions." }),
    });
    const { body } = await write();
    expect(world.llmCalls()).toHaveLength(0);
    expect(body.data.title).toBe("");
    expect(body.data.body).toBe("Fixes #12");
  });
});
