import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown, rawGuideUrl, resolveLink } from "../../src/lib/markdown.js";

const BASE = "https://github.com/a/b/blob/main/CONTRIBUTING.md";

describe("rawGuideUrl", () => {
  it("turns a GitHub file link into its raw text address", () => {
    expect(rawGuideUrl(BASE)).toBe("https://raw.githubusercontent.com/a/b/main/CONTRIBUTING.md");
    expect(rawGuideUrl("https://github.com/a/.github/blob/main/docs/CONTRIBUTING.md")).toBe(
      "https://raw.githubusercontent.com/a/.github/main/docs/CONTRIBUTING.md",
    );
    expect(rawGuideUrl("https://evil.example/a/b/blob/main/x.md")).toBeNull();
  });
});

describe("links in a guide", () => {
  it("point relative links at the file on GitHub, and drop anything that isn't https", () => {
    expect(resolveLink("docs/setup.md", BASE)).toBe("https://github.com/a/b/blob/main/docs/setup.md");
    expect(resolveLink("javascript:alert(1)", BASE)).toBeNull();
    expect(resolveLink("data:text/html,x", BASE)).toBeNull();
    expect(resolveLink("#setup", BASE)).toBeNull();
    const pieces = parseInline("[click](javascript:alert(1))", BASE);
    expect(pieces.some((piece) => piece.type === "link")).toBe(false);
    expect(pieces[0]).toEqual({ type: "text", text: "click" });
  });
});

describe("parseMarkdown", () => {
  it("reads headings, lists, code, quotes and inline styles", () => {
    const blocks = parseMarkdown(
      "# Contributing\n\nThanks for **helping**! Run `npm test`.\n\n- Fork it\n- [x] Make a branch\n\n1. One\n2. Two\n\n```bash\nnpm install\n```\n\n> Be kind",
      BASE,
    );
    expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "list", "list", "code", "quote"]);
    expect(blocks[1].inline).toEqual([
      { type: "text", text: "Thanks for " },
      { type: "bold", text: "helping" },
      { type: "text", text: "! Run " },
      { type: "code", text: "npm test" },
      { type: "text", text: "." },
    ]);
    expect(blocks[2].items[1]).toEqual([{ type: "text", text: "Make a branch" }]);
    expect(blocks[3].ordered).toBe(true);
    expect(blocks[4].text).toBe("npm install");
  });

  it("doesn't show heading marks inside quotes", () => {
    expect(parseMarkdown("> ### Legal Notice", BASE)[0].inline).toEqual([{ type: "text", text: "Legal Notice" }]);
  });

  it("drops HTML tags and comments instead of showing or running them", () => {
    const blocks = parseMarkdown("<!-- hidden -->\n<script>alert(1)</script>\n<img src=x onerror=alert(1)>Hello", BASE);
    expect(JSON.stringify(blocks)).not.toMatch(/script|onerror|hidden/);
    expect(blocks[0].inline.map((p) => p.text).join("")).toContain("Hello");
  });
});
