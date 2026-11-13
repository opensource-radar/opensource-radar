import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, badgeSvg } from "../../api/badge.js";
import { badgeLink, badgeMarkdown } from "../../src/lib/badge.js";

let searches;
beforeEach(() => {
  searches = [];
  vi.stubEnv("KV_REST_API_URL", "");
  vi.stubEnv("GITHUB_READ_TOKEN", "server-token");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => {
      searches.push(decodeURIComponent(String(url)));
      return Response.json({ total_count: 12 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const get = (repo) => GET(new Request(`http://localhost/api/badge?repo=${encodeURIComponent(repo)}`));

describe("README badge", () => {
  it("shows how many open, unassigned good first issues a project has", async () => {
    const response = await get("a/b");
    expect(response.headers.get("Content-Type")).toContain("image/svg+xml");
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=21600");
    const svg = await response.text();
    expect(svg).toContain("12 open");
    expect(searches[0]).toContain('repo:a/b is:issue is:open label:"good first issue" no:assignee');
  });

  it("still draws a badge, cached briefly, when the count isn't known", async () => {
    vi.stubEnv("GITHUB_READ_TOKEN", "");
    const response = await get("a/b");
    expect(await response.text()).toContain("on Radar");
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=600");
  });

  it("doesn't ask GitHub about names that aren't repositories", async () => {
    await get("not a repo");
    expect(searches).toHaveLength(0);
  });

  it("formats big numbers and escapes text", () => {
    expect(badgeSvg(1500)).toContain("1.5k open");
    expect(badgeSvg(25000)).toContain("25k open");
    expect(badgeSvg(0)).toContain("0 open");
    expect(badgeSvg(3)).not.toMatch(/<script/);
  });

  it("links to Radar filtered to the project", () => {
    expect(badgeLink("a/b")).toBe("https://opensource-radar.com/?labels=good-first-issue&available=1&project=a%2Fb");
    expect(badgeMarkdown("a/b")).toBe(
      "[![Good first issues on OpenSource Radar](https://opensource-radar.com/api/badge?repo=a%2Fb)](https://opensource-radar.com/?labels=good-first-issue&available=1&project=a%2Fb)",
    );
  });
});
