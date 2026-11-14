import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callAction, enableDevAgents, fakeWorld } from "./helpers.js";

const github = (file = "def add(a, b):\n    return a + b\n") => ({
  "/repos/a/b": { default_branch: "main" },
  "/repos/a/b/branches/main": { commit: { sha: "abc" } },
  "/repos/a/b/contents/src/app.py": file,
});
const answer = { summary: "Adds numbers.", parts: [{ name: "add", what: "Adds two numbers." }, { name: 3, what: "bad" }] };
const explainFile = (path = "src/app.py", issue = 1) => callAction("explain-file", { repo: "a/b", issue, path });

beforeEach(enableDevAgents);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("explain-file", () => {
  it("explains a file with the smaller model, and keeps only well formed parts", async () => {
    vi.stubEnv("DEVAGENTS_GROQ_LIGHT_MODEL", "small-model");
    const world = fakeWorld({ github: github(), llm: [answer] });
    const { status, body } = await explainFile();
    expect(status).toBe(200);
    expect(body.data).toEqual({ summary: "Adds numbers.", parts: [{ name: "add", what: "Adds two numbers." }], partial: false });
    const request = JSON.parse(world.llmCalls()[0].init.body);
    expect(request.model).toBe("small-model");
    expect(JSON.stringify(request.messages)).toContain("return a + b");
  });

  it("reuses the answer for the same file and commit, from any issue", async () => {
    const world = fakeWorld({ github: github(), llm: [answer] });
    await explainFile("src/app.py", 1);
    const again = await explainFile("src/app.py", 2);
    expect(again.body.data.summary).toBe("Adds numbers.");
    expect(world.llmCalls()).toHaveLength(1);
  });

  it("only sends the start of a long file, and says so", async () => {
    const world = fakeWorld({ github: github("x".repeat(9000)), llm: [answer] });
    expect((await explainFile()).body.data.partial).toBe(true);
    expect(world.llmCalls()[0].init.body.length).toBeLessThan(6000);
  });

  it.each([["../secret"], ["/etc/passwd"], ["a//b"], [""], [42]])("rejects the path %j", async (path) => {
    const world = fakeWorld({ github: github(), llm: [answer] });
    expect((await explainFile(path)).status).toBe(400);
    expect(world.llmCalls()).toHaveLength(0);
  });

  it("says when the file doesn't exist, without asking the model", async () => {
    const world = fakeWorld({ github: github(), llm: [answer] });
    const { status, body } = await explainFile("src/missing.py");
    expect(status).toBe(404);
    expect(body.error).toBe("not_found");
    expect(world.llmCalls()).toHaveLength(0);
  });
});
