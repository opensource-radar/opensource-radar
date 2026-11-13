import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, journeyStage } from "../../api/journey.js";
import { seal } from "../../api/_lib/session.js";

const SECRET = "test-session-secret-0123456789abcdef0123456789abcdef";
const pr = (number, { state = "OPEN", merged = false, author = "sam" } = {}) => ({
  url: `https://github.com/a/b/pull/${number}`, number, state, merged, author: { login: author },
});
const issue = ({ assignees = [], commenters = [], prs = [], state = "OPEN" } = {}) => ({
  state,
  assignees: { nodes: assignees.map((login) => ({ login })) },
  comments: { nodes: commenters.map((login) => ({ author: { login } })) },
  timelineItems: { nodes: prs.map((p, i) => (i % 2 ? { subject: p } : { source: p })) },
});

describe("journeyStage", () => {
  it.each([
    ["saved", issue()],
    ["claimed", issue({ assignees: ["Sam"] })],
    ["claimed", issue({ commenters: ["someone", "sam"] })],
    ["pr", issue({ commenters: ["sam"], prs: [pr(5)] })],
    ["merged", issue({ prs: [pr(5, { state: "CLOSED" }), pr(6, { state: "MERGED", merged: true })] })],
  ])("%s", (stage, data) => {
    expect(journeyStage(data, "sam").stage).toBe(stage);
  });

  it("ignores other people's pull requests and comments", () => {
    const result = journeyStage(issue({ commenters: ["alex"], prs: [pr(7, { author: "alex", merged: true })] }), "sam");
    expect(result).toEqual({ stage: "saved", issueClosed: false, pullRequest: null });
  });

  it("links the merged pull request first, then an open one", () => {
    expect(journeyStage(issue({ prs: [pr(5), pr(6, { merged: true, state: "MERGED" })] }), "sam").pullRequest).toEqual({
      url: "https://github.com/a/b/pull/6", number: 6, state: "MERGED",
    });
    expect(journeyStage(issue({ prs: [pr(5, { state: "CLOSED" }), pr(8)] }), "sam").pullRequest.number).toBe(8);
  });

  it("notes a closed issue, and returns null for a missing one", () => {
    expect(journeyStage(issue({ state: "CLOSED" }), "sam").issueClosed).toBe(true);
    expect(journeyStage(null, "sam")).toBeNull();
  });
});

describe("GET /api/journey", () => {
  let graphql;
  beforeEach(() => {
    graphql = [];
    vi.stubEnv("GITHUB_CLIENT_ID", "id");
    vi.stubEnv("GITHUB_CLIENT_SECRET", "secret");
    vi.stubEnv("SESSION_SECRET", SECRET);
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      graphql.push({ url: String(url), body: JSON.parse(init.body), auth: init.headers.Authorization });
      return Response.json({ data: { r0: { issue: issue({ assignees: ["sam"] }) }, r1: null } });
    }));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const call = async (issues, signedIn = true) => {
    const session = { accessToken: "user-token", refreshToken: null, accessExpiresAt: null, refreshExpiresAt: null, user: { login: "sam", name: "Sam", avatarUrl: "" } };
    const headers = signedIn ? { cookie: `osr_session=${await seal(session, SECRET)}` } : {};
    return GET(new Request(`http://localhost/api/journey?issues=${encodeURIComponent(issues)}`, { headers }));
  };

  it("needs sign-in", async () => {
    expect((await call("a/b#1", false)).status).toBe(401);
  });

  it("rejects bad or too many issues", async () => {
    expect((await call("not-an-issue")).status).toBe(400);
    expect((await call(Array.from({ length: 21 }, (_, i) => `a/b#${i + 1}`).join(","))).status).toBe(400);
  });

  it("checks every saved issue in one request with the user's own token", async () => {
    const response = await call("a/b#1,c/d#2");
    expect(response.status).toBe(200);
    expect((await response.json()).journey).toEqual({
      "a/b#1": { stage: "claimed", issueClosed: false, pullRequest: null },
      "c/d#2": null,
    });
    expect(graphql).toHaveLength(1);
    expect(graphql[0].auth).toBe("Bearer user-token");
    expect(graphql[0].body.variables).toMatchObject({ o0: "a", n0: "b", i0: 1, o1: "c", n1: "d", i1: 2 });
  });
});
