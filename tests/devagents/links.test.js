import { describe, expect, it } from "vitest";
import {
  codespacesUrl,
  editorUrl,
  fileUrl,
  issueUrl,
  parseIssueUrl,
  prUrl,
} from "../../src/devagents/links.js";

describe("links", () => {
  it("encodes each path segment", () => {
    expect(editorUrl("a/b", "main", "docs/my file#1.md")).toBe(
      "https://github.com/a/b/edit/main/docs/my%20file%231.md",
    );
    expect(editorUrl("a/b", "release/1.0", "x.md")).toBe(
      "https://github.com/a/b/edit/release/1.0/x.md",
    );
  });

  it("adds a line to file links", () => {
    expect(fileUrl("a/b", "main", "x.py", 12)).toBe(
      "https://github.com/a/b/blob/main/x.py#L12",
    );
    expect(fileUrl("a/b", "main", "x.py")).toBe("https://github.com/a/b/blob/main/x.py");
  });

  it("builds Codespaces and issue links", () => {
    expect(codespacesUrl("a/b")).toBe("https://codespaces.new/a/b");
    expect(issueUrl("a/b", 3)).toBe("https://github.com/a/b/issues/3");
  });

  it("reads only real issue links", () => {
    expect(parseIssueUrl("https://github.com/a/b/issues/12")).toEqual({ repo: "a/b", issue: 12 });
    expect(parseIssueUrl("https://github.com/a/b/pull/1")).toBeNull();
    expect(parseIssueUrl("https://evil.test/a/b/issues/1")).toBeNull();
    expect(parseIssueUrl("http://github.com/a/b/issues/1")).toBeNull();
    expect(parseIssueUrl("javascript:alert(1)")).toBeNull();
    expect(parseIssueUrl("not a url")).toBeNull();
    expect(parseIssueUrl(undefined)).toBeNull();
  });

  it("fills in the PR page when the link fits", () => {
    const { url, bodyIncluded } = prUrl("a/b", "main", "me", "fix/x", { title: "T 1", body: "B&2" });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://github.com/a/b/compare/main...me:fix/x");
    expect(parsed.searchParams.get("expand")).toBe("1");
    expect(parsed.searchParams.get("title")).toBe("T 1");
    expect(parsed.searchParams.get("body")).toBe("B&2");
    expect(bodyIncluded).toBe(true);
  });

  it("leaves out a body that would make the link too long", () => {
    const { url, bodyIncluded } = prUrl("a/b", "main", "me", "p", { title: "t", body: "x".repeat(9000) });
    expect(bodyIncluded).toBe(false);
    expect(url.length).toBeLessThan(6000);
    expect(new URL(url).searchParams.get("body")).toBeNull();
    expect(new URL(url).searchParams.get("title")).toBe("t");
  });
});
