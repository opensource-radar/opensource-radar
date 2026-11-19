import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../api/projects/[kind].js";
import {
  GITLAB_PROJECTS,
  MAX_ISSUES,
  fetchGitLabIssues,
  issuesUrl,
  mergeIssues,
  projectsFor,
  toRadarIssue,
} from "../../api/_lib/gitlab.js";

const glIssue = (id, updated, extra = {}) => ({
  id,
  iid: id + 1000,
  title: `Issue ${id}`,
  description: "Details",
  labels: ["quick win"],
  web_url: `https://gitlab.com/gitlab-org/cli/-/issues/${id + 1000}`,
  user_notes_count: 2,
  author: { username: "jane.doe" },
  created_at: "2026-11-01T00:00:00Z",
  updated_at: updated,
  ...extra,
});

describe("GitLab projects", () => {
  it("can narrow the list to one language, any case", () => {
    expect(projectsFor("").length).toBe(GITLAB_PROJECTS.length);
    expect(projectsFor("go").every((project) => project.language === "Go")).toBe(true);
    expect(projectsFor("COBOL")).toEqual([]);
  });

  it("asks for open, unassigned issues with one label, newest activity first", () => {
    const url = new URL(issuesUrl({ path: "gitlab-org/cli" }, "quick win", "  docs  "));
    expect(url.pathname).toBe("/api/v4/projects/gitlab-org%2Fcli/issues");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      state: "opened",
      labels: "quick win",
      assignee_id: "None",
      order_by: "updated_at",
      sort: "desc",
      search: "docs",
    });
  });
});

describe("toRadarIssue", () => {
  const project = { path: "gitlab-org/editor-extensions/gitlab-jetbrains-plugin", language: "Kotlin" };

  it("turns a GitLab issue into an issue card, with a negative id", () => {
    expect(toRadarIssue(glIssue(5, "2026-11-10T00:00:00Z"), project)).toMatchObject({
      id: -5,
      source: "gitlab",
      title: "Issue 5",
      label: "quick win",
      language: "Kotlin",
      repo: "editor-extensions / gitlab-jetbrains-plugin",
      project: project.path,
      number: 1005,
      comments: 2,
      author: "jane.doe",
    });
  });

  it("drops anything that isn't a GitLab issue link", () => {
    expect(toRadarIssue(glIssue(1, "x", { web_url: "https://evil.example/" }), project)).toBeNull();
    expect(toRadarIssue({ id: "nope" }, project)).toBeNull();
  });
});

describe("mergeIssues", () => {
  it("lists each issue once, newest activity first, up to the limit", () => {
    const a = { id: -1, updatedAt: "2026-11-01T00:00:00Z" };
    const b = { id: -2, updatedAt: "2026-11-05T00:00:00Z" };
    expect(mergeIssues([[a, b], [b, null]]).map((issue) => issue.id)).toEqual([-2, -1]);
    const many = Array.from({ length: 30 }, (_, i) => ({ id: -i - 1, updatedAt: "2026-11-01T00:00:00Z" }));
    expect(mergeIssues([many])).toHaveLength(MAX_ISSUES);
  });
});

describe("fetchGitLabIssues", () => {
  it("asks each matching project once per label, and sends the token only when set", async () => {
    const fetcher = vi.fn(async () => Response.json([]));
    await fetchGitLabIssues({ language: "Python", fetcher });
    const python = projectsFor("Python");
    expect(fetcher).toHaveBeenCalledTimes(python.reduce((sum, p) => sum + p.labels.length, 0));
    expect(fetcher.mock.calls[0][1].headers["PRIVATE-TOKEN"]).toBeUndefined();
    fetcher.mockClear();
    await fetchGitLabIssues({ language: "Python", token: "glpat-x", fetcher });
    expect(fetcher.mock.calls[0][1].headers["PRIVATE-TOKEN"]).toBe("glpat-x");
  });

  it("keeps what answered when some projects fail", async () => {
    let call = 0;
    const fetcher = vi.fn(async () => {
      call += 1;
      return call === 1 ? Response.json([glIssue(9, "2026-11-10T00:00:00Z")]) : new Response("", { status: 500 });
    });
    const issues = await fetchGitLabIssues({ language: "Python", fetcher });
    expect(issues.map((issue) => issue.id)).toEqual([-9]);
  });

  it("fails when GitLab doesn't answer at all", async () => {
    const fetcher = vi.fn(async () => new Response("", { status: 500 }));
    await expect(fetchGitLabIssues({ language: "Python", fetcher })).rejects.toThrow();
  });
});

describe("GET /api/gitlab", () => {
  const REDIS = "https://fake-redis.test";
  let db;

  beforeEach(() => {
    db = new Map();
    vi.stubEnv("KV_REST_API_URL", REDIS);
    vi.stubEnv("KV_REST_API_TOKEN", "t");
    vi.stubGlobal("fetch", vi.fn(async (url, init = {}) => {
      if (String(url) === REDIS) {
        const [command, key, value] = JSON.parse(init.body);
        if (command === "GET") return Response.json({ result: db.get(key) ?? null });
        if (command === "SET") db.set(key, value);
        return Response.json({ result: "OK" });
      }
      return Response.json([glIssue(3, "2026-11-12T00:00:00Z")]);
    }));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const ask = (query) => GET(new Request(`http://x/api/gitlab${query}`));

  it("answers with issues and caches them", async () => {
    const response = await ask("?language=Rust");
    expect(response.status).toBe(200);
    const { issues } = await response.json();
    expect(issues[0]).toMatchObject({ id: -3, source: "gitlab", language: "Rust" });
    expect([...db.keys()]).toEqual(["gitlab:v1:rust:"]);

    fetch.mockClear();
    await ask("?language=Rust");
    expect(fetch.mock.calls.every(([url]) => String(url) === REDIS)).toBe(true);
  });

  it("refuses an odd language value", async () => {
    expect((await ask("?language=%3Cscript%3E")).status).toBe(400);
  });
});
