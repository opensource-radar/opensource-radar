import { afterEach, describe, expect, it, vi } from "vitest";
import { gh } from "../../api/_lib/devagents/github.js";
import { fakeWorld } from "./helpers.js";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const TOKEN = "user-token";

describe("github reader", () => {
  it("only ever sends GET, with the user's token", async () => {
    const world = fakeWorld({
      github: {
        "/repos/a/b": { default_branch: "main", archived: false },
        "/repos/a/b/branches/main": { commit: { sha: "abc" } },
        "/repos/a/b/issues/1": { number: 1, title: "t" },
        "/repos/a/b/git/trees/abc": { tree: [], truncated: false },
        "/repos/a/b/contents/x.md": "text",
        "/repos/a/b/issues/1/comments": [],
        "/repos/a/b/issues/1/timeline": [],
        "/repos/a/b/compare/main...me:p": { files: [] },
        "/repos/a/b/commits/abc/check-runs": { check_runs: [] },
        "/repos/a/b/pulls/1": { number: 1 },
        "/repos/a/b/pulls/1/comments": [],
      },
    });
    await gh.readRepo(TOKEN, "a/b");
    await gh.readIssue(TOKEN, "a/b", 1);
    await gh.readTree(TOKEN, "a/b", "abc");
    await gh.readFile(TOKEN, "a/b", "x.md", "abc");
    await gh.readComments(TOKEN, "a/b", 1);
    await gh.readLinkedPulls(TOKEN, "a/b", 1);
    await gh.readCompare(TOKEN, "a/b", "main", "me:p");
    await gh.readCheckRuns(TOKEN, "a/b", "abc");
    await gh.readPull(TOKEN, "a/b", 1);
    await gh.readReviewComments(TOKEN, "a/b", 1);
    expect(world.calls.length).toBeGreaterThanOrEqual(10);
    for (const call of world.calls) {
      expect(call.method).toBe("GET");
      expect(call.init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    }
  });

  it("readRepo gives the default branch and head", async () => {
    fakeWorld({
      github: {
        "/repos/a/b": { default_branch: "dev", archived: true },
        "/repos/a/b/branches/dev": { commit: { sha: "abc" } },
      },
    });
    expect(await gh.readRepo(TOKEN, "a/b")).toEqual({
      defaultBranch: "dev",
      archived: true,
      sha: "abc",
    });
  });

  it("readRepo reports an empty repo with a null head", async () => {
    fakeWorld({ github: { "/repos/a/b": { default_branch: "main" } } });
    expect((await gh.readRepo(TOKEN, "a/b")).sha).toBeNull();
  });

  it("a missing repo or issue throws not_found", async () => {
    fakeWorld();
    await expect(gh.readRepo(TOKEN, "a/b")).rejects.toMatchObject({ code: "not_found" });
    await expect(gh.readIssue(TOKEN, "a/b", 1)).rejects.toMatchObject({ code: "not_found" });
  });

  it("readIssue throws not_found when the number is a pull request", async () => {
    fakeWorld({ github: { "/repos/a/b/issues/1": { pull_request: {} } } });
    await expect(gh.readIssue(TOKEN, "a/b", 1)).rejects.toMatchObject({ code: "not_found" });
  });

  it("other GitHub failures throw unavailable", async () => {
    fakeWorld({ github: { "/repos/a/b": new Response("{}", { status: 403 }) } });
    await expect(gh.readRepo(TOKEN, "a/b")).rejects.toMatchObject({ code: "unavailable" });
  });

  it("a network failure throws unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    await expect(gh.readRepo(TOKEN, "a/b")).rejects.toMatchObject({ code: "unavailable" });
  });

  it("gives up after 8 s", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, { signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(new Error("aborted")));
          }),
      ),
    );
    const pending = gh.readRepo(TOKEN, "a/b").catch((e) => e);
    await vi.advanceTimersByTimeAsync(8000);
    expect((await pending).code).toBe("unavailable");
  });

  it("readTree reports truncated, skips noise and keeps at most 2,000 paths", async () => {
    const tree = [
      { type: "blob", path: "node_modules/x.js" },
      { type: "blob", path: "dist/x.js" },
      { type: "blob", path: "vendor/x.go" },
      { type: "blob", path: "package-lock.json" },
      { type: "tree", path: "src" },
      ...Array.from({ length: 2500 }, (_, i) => ({ type: "blob", path: `src/${i}.js` })),
    ];
    fakeWorld({ github: { "/repos/a/b/git/trees/abc": { tree, truncated: false } } });
    const result = await gh.readTree(TOKEN, "a/b", "abc");
    expect(result.paths).toHaveLength(2000);
    expect(result.truncated).toBe(true);
    expect(result.paths[0]).toBe("src/0.js");
  });

  it("readFile returns null when the file doesn't exist", async () => {
    fakeWorld();
    expect(await gh.readFile(TOKEN, "a/b", "NOPE.md", "abc")).toBeNull();
  });

  it("readFile keeps at most 40 KB and encodes the path", async () => {
    const world = fakeWorld({
      github: { "/repos/a/b/contents/docs/my%20file.md": "x".repeat(50000) },
    });
    const text = await gh.readFile(TOKEN, "a/b", "docs/my file.md", "abc");
    expect(text).toHaveLength(40000);
    expect(world.calls[0].url).toContain("ref=abc");
  });

  it("readLinkedPulls keeps only pull requests from the timeline", async () => {
    fakeWorld({
      github: {
        "/repos/a/b/issues/1/timeline": [
          { event: "labeled" },
          { event: "cross-referenced", source: { issue: { number: 2 } } },
          {
            event: "cross-referenced",
            source: { issue: { number: 3, state: "open", pull_request: {} } },
          },
        ],
      },
    });
    expect(await gh.readLinkedPulls(TOKEN, "a/b", 1)).toEqual([
      { number: 3, state: "open" },
    ]);
  });
});
