import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callAction, enableDevAgents, fakeWorld } from "./helpers.js";

const github = () => ({
  "/repos/a/b": { default_branch: "main" },
  "/repos/a/b/branches/main": { commit: { sha: "abc" } },
  "/repos/a/b/issues/1": { title: "Add docstrings", body: "b", updated_at: "2026-11-01T00:00:00Z" },
  "/repos/a/b/git/trees/abc": { tree: [{ type: "blob", path: "src/app.py" }] },
});
const draft = { path: "src/app.py", kind: "docstring", text: "Adds two numbers." };
const hintAt = (level) => callAction("hint", { repo: "a/b", issue: 1, level });

beforeEach(enableDevAgents);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("hint", () => {
  it("hints 1 and 2 may use the smaller Groq model, but the last hint keeps the main one", async () => {
    vi.stubEnv("DEVAGENTS_GROQ_LIGHT_MODEL", "small-model");
    vi.stubEnv("DEVAGENTS_GROQ_MODEL", "");
    const world = fakeWorld({ github: github(), llm: [{ hint: "Look here" }] });
    await hintAt(1);
    expect(JSON.parse(world.llmCalls()[0].init.body).model).toBe("small-model");

    vi.stubEnv("DEVAGENTS_GROQ_MODEL", "groq-model");
    const last = fakeWorld({ github: github(), llm: [{ hint: "Try this", draft }] });
    await hintAt(3);
    expect(last.llmCalls().map((call) => JSON.parse(call.init.body).model)).not.toContain("small-model");
  });

  it.each([[1], [2]])("level %i never returns a draft, even if the LLM sends one", async (level) => {
    fakeWorld({ github: github(), llm: [{ hint: "Look here", draft }] });
    const { body } = await hintAt(level);
    expect(body.data).toEqual({ hint: "Look here" });
  });

  it("level 3 can return a draft", async () => {
    fakeWorld({ github: github(), llm: [{ hint: "Try this", draft }] });
    expect((await hintAt(3)).body.data.draft).toEqual(draft);
  });

  it("removes the draft when aiPolicy is banned", async () => {
    const repo = github();
    repo["/repos/a/b/contents/CONTRIBUTING.md"] = "We do not accept AI-generated contributions.";
    fakeWorld({ github: repo, llm: [{ hint: "Try this", draft }] });
    const { body } = await hintAt(3);
    expect(body.data.draft).toBeUndefined();
    expect(body.data.hint).toBe("Try this");
  });

  it("removes a draft over 1,500 characters", async () => {
    fakeWorld({ github: github(), llm: [{ hint: "h", draft: { ...draft, text: "x".repeat(1501) } }] });
    expect((await hintAt(3)).body.data.draft).toBeUndefined();
  });

  it("removes a draft whose path isn't in the tree", async () => {
    fakeWorld({ github: github(), llm: [{ hint: "h", draft: { ...draft, path: "made/up.py" } }] });
    expect((await hintAt(3)).body.data.draft).toBeUndefined();
  });

  it("removes a draft that isn't a docstring or comment", async () => {
    fakeWorld({ github: github(), llm: [{ hint: "h", draft: { ...draft, kind: "code" } }] });
    expect((await hintAt(3)).body.data.draft).toBeUndefined();
  });

  it.each([[0], [4], ["1"], [null]])("rejects level %j with invalid_request", async (level) => {
    fakeWorld({ github: github() });
    expect((await hintAt(level)).status).toBe(400);
  });

  it("keeps the hint if GitHub fails after the AI has answered", async () => {
    const repo = github();
    repo["/repos/a/b/git/trees/abc"] = new Response("{}", { status: 500 });
    fakeWorld({ github: repo, llm: [{ hint: "Keep me", draft }] });
    const { status, body } = await hintAt(3);
    expect(status).toBe(200);
    expect(body.data.hint).toBe("Keep me");
    expect(body.data.draft).toBeUndefined();
  });

  it("tells the model not to write the fix", async () => {
    const world = fakeWorld({ github: github(), llm: [{ hint: "h" }] });
    await hintAt(1);
    const { messages } = JSON.parse(world.llmCalls()[0].init.body);
    expect(messages[0].content).toMatch(/never write the fix/i);
  });

  it("a repeat is served from cache", async () => {
    const world = fakeWorld({ github: github(), llm: [{ hint: "h" }] });
    await hintAt(1);
    await hintAt(1);
    expect(world.llmCalls()).toHaveLength(1);
  });
});
