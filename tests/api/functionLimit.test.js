import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { GET as authGet, POST as authPost, actionOf } from "../../api/auth/[action].js";
import { GET as projectsGet, kindOf } from "../../api/projects/[kind].js";

// Every file under api/ outside folders starting with "_" is one Vercel
// Function, and the Hobby plan refuses to deploy more than 12.
function functionFiles(dir = "api") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith("_") || entry.name.startsWith(".")) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return functionFiles(full);
    return /\.(js|mjs|ts)$/.test(entry.name) ? [full] : [];
  });
}

describe("Vercel function limit", () => {
  it("stays within the Hobby plan's 12 functions", () => {
    expect(functionFiles().length).toBeLessThanOrEqual(12);
  });
});

describe("shared functions", () => {
  it("find the action from the address, however Vercel passes it", () => {
    expect(actionOf(new Request("http://x/auth/login"))).toBe("login");
    expect(actionOf(new Request("http://x/api/auth/callback?code=1"))).toBe("callback");
    expect(kindOf(new Request("http://x/api/badge?repo=a%2Fb"))).toBe("badge");
    expect(kindOf(new Request("http://x/api/projects/repos?names=a/b"))).toBe("repos");
    expect(kindOf(new Request("http://x/api/projects/%5Bkind%5D?kind=friendliness"))).toBe("friendliness");
  });

  it("answer 404 for anything they don't handle", async () => {
    expect((await authGet(new Request("http://x/auth/nope"))).status).toBe(404);
    expect((await authPost(new Request("http://x/auth/login", { method: "POST" }))).status).toBe(404);
    expect((await projectsGet(new Request("http://x/api/projects/nope"))).status).toBe(404);
  });

  it("reach the real handlers", async () => {
    vi.stubEnv("GITHUB_READ_TOKEN", "");
    vi.stubEnv("KV_REST_API_URL", "");
    const badge = await projectsGet(new Request("http://x/api/badge?repo=a%2Fb"));
    expect(badge.headers.get("Content-Type")).toContain("image/svg+xml");
    const repos = await projectsGet(new Request("http://x/api/repos?names=not%20valid"));
    expect(repos.status).toBe(400);
    vi.unstubAllEnvs();
  });
});
