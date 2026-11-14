import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { GUIDE_PATH, LANGUAGE_PAGES, MAINTAINERS_PATH } from "../../src/lib/seoPages.js";

const html = fs.readFileSync(new URL("../../public/404.html", import.meta.url), "utf8");
const links = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]).filter((href) => href.startsWith("/") && !href.includes("."));

describe("404 page", () => {
  it("isn't listed by search engines", () => {
    expect(html).toContain('<meta name="robots" content="noindex" />');
  });

  it("only links to pages that exist", () => {
    const pages = new Set(["/", GUIDE_PATH, MAINTAINERS_PATH, ...LANGUAGE_PAGES.map((page) => page.path)]);
    expect(links.length).toBeGreaterThan(5);
    for (const link of links) expect(pages.has(link)).toBe(true);
  });

  it("searches with the site's usual beginner filters", () => {
    expect(html).toContain('<form action="/" method="get"');
    expect(html).toContain('name="q"');
    expect(html).toContain('name="labels" value="good-first-issue"');
    expect(html).toContain('name="available" value="1"');
  });
});
