import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as projects } from "../../api/projects/[kind].js";
import { labelHealth } from "../../api/_lib/routes/label-health.js";

const NOW = Date.parse("2026-11-14T00:00:00Z");
const ago = (days) => new Date(NOW - days * 86400000).toISOString();
const issue = (number, { created = 10, updated = 10, assignees = [], assignedDaysAgo, maintainerComment = false, author = "NONE" } = {}) => ({
  number,
  title: `Issue ${number}`,
  url: `https://github.com/a/b/issues/${number}`,
  createdAt: ago(created),
  updatedAt: ago(updated),
  authorAssociation: author,
  assignees: { nodes: assignees.map((login) => ({ login })) },
  comments: { nodes: maintainerComment ? [{ authorAssociation: "MEMBER" }] : [{ authorAssociation: "NONE" }] },
  timelineItems: { nodes: assignedDaysAgo === undefined ? [] : [{ createdAt: ago(assignedDaysAgo) }] },
});

describe("labelHealth", () => {
  it("sorts issues into the ones that need attention", () => {
    const result = labelHealth(
      [
        issue(1, { updated: 120, created: 200 }),
        issue(2, { created: 20, updated: 20 }),
        issue(3, { assignees: ["sam"], updated: 40, assignedDaysAgo: 45 }),
        issue(4, { created: 20, updated: 2, maintainerComment: true }),
        issue(5, { created: 3, updated: 3 }),
        issue(6, { created: 20, updated: 20, author: "OWNER" }),
      ],
      NOW,
    );
    expect(result.stale.map((i) => i.number)).toEqual([1]);
    expect(result.stale[0].days).toBe(120);
    expect(result.waiting.map((i) => i.number)).toEqual([2]);
    expect(result.idleAssigned).toEqual([{ number: 3, title: "Issue 3", url: "https://github.com/a/b/issues/3", days: 45 }]);
  });
});

describe("GET /api/label-health", () => {
  let graphql;
  beforeEach(() => {
    graphql = [];
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("GITHUB_CLIENT_ID", "");
    vi.stubEnv("GITHUB_READ_TOKEN", "server-token");
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      graphql.push(JSON.parse(init.body));
      return Response.json({ data: { repository: { issues: { totalCount: 2, nodes: [issue(1, { updated: 100, created: 100 }), issue(2)] } } } });
    }));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("answers through the shared project function at its public address", async () => {
    const response = await projects(new Request("http://x/api/label-health?repo=a%2Fb"));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toMatchObject({ repo: "a/b", total: 2, checked: 2 });
    expect(data.stale.map((i) => i.number)).toEqual([1]);
    expect(graphql[0].variables).toMatchObject({ owner: "a", name: "b" });
    expect(graphql[0].variables.labels).toContain("good first issue");
  });

  it("rejects bad names and says when the repository doesn't exist", async () => {
    expect((await projects(new Request("http://x/api/label-health?repo=nope"))).status).toBe(400);
    fetch.mockImplementationOnce(async () => Response.json({ data: { repository: null } }));
    expect((await projects(new Request("http://x/api/label-health?repo=a%2Fmissing"))).status).toBe(404);
  });
});
