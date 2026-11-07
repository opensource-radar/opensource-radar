import { githubHeaders } from "../github.js";
import { DevAgentsError } from "./errors.js";

// DevAgents' only way to reach GitHub, and it can only read: every request
// here is a GET, and nothing in DevAgents writes to GitHub.
const API = "https://api.github.com";
const TIMEOUT_MS = 8000;
const MAX_PATHS = 2000;
const MAX_FILE_CHARS = 40000;
const NOISE = /(^|\/)(node_modules|dist|build|vendor|\.git)\/|(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|Cargo\.lock|go\.sum)$/;

const encodePath = (path) => path.split("/").map(encodeURIComponent).join("/");
const encodeRef = (ref) => encodePath(ref).replaceAll("%3A", ":");

async function get(token, path, { accept } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers = githubHeaders(token);
    if (accept) headers.Accept = accept;
    const response = await fetch(`${API}${path}`, {
      method: "GET",
      signal: controller.signal,
      headers,
    });
    if (response.status === 404) throw new DevAgentsError("not_found", 404);
    if (!response.ok) throw new DevAgentsError("unavailable", 503);
    return accept ? await response.text() : await response.json();
  } catch (error) {
    if (error instanceof DevAgentsError) throw error;
    throw new DevAgentsError("unavailable", 503);
  } finally {
    clearTimeout(timer);
  }
}

const orNull = (promise) =>
  promise.catch((error) => {
    if (error.code === "not_found") return null;
    throw error;
  });

export const gh = {
  async readRepo(token, repo) {
    const data = await get(token, `/repos/${repo}`);
    const branch = await orNull(
      get(token, `/repos/${repo}/branches/${encodePath(data.default_branch)}`),
    );
    return {
      defaultBranch: data.default_branch,
      archived: Boolean(data.archived),
      sha: branch?.commit?.sha ?? null,
    };
  },

  async readIssue(token, repo, n) {
    const issue = await get(token, `/repos/${repo}/issues/${n}`);
    if (issue.pull_request) throw new DevAgentsError("not_found", 404);
    return issue;
  },

  async readTree(token, repo, sha) {
    const data = await get(token, `/repos/${repo}/git/trees/${sha}?recursive=1`);
    const all = (data.tree ?? [])
      .filter((item) => item.type === "blob" && !NOISE.test(item.path))
      .map((item) => item.path);
    return {
      paths: all.slice(0, MAX_PATHS),
      truncated: Boolean(data.truncated) || all.length > MAX_PATHS,
    };
  },

  // Returns null when the file doesn't exist, since many files are optional.
  async readFile(token, repo, path, ref) {
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    const text = await orNull(
      get(token, `/repos/${repo}/contents/${encodePath(path)}${query}`, {
        accept: "application/vnd.github.raw",
      }),
    );
    return text === null ? null : text.slice(0, MAX_FILE_CHARS);
  },

  readComments(token, repo, n) {
    return get(token, `/repos/${repo}/issues/${n}/comments?per_page=100`);
  },

  async readLinkedPulls(token, repo, n) {
    const events = await get(token, `/repos/${repo}/issues/${n}/timeline?per_page=100`);
    return events
      .filter(
        (event) =>
          event.event === "cross-referenced" && event.source?.issue?.pull_request,
      )
      .map(({ source }) => ({ number: source.issue.number, state: source.issue.state }));
  },

  readCompare(token, repo, base, head) {
    return get(token, `/repos/${repo}/compare/${encodeRef(base)}...${encodeRef(head)}`);
  },

  async readCheckRuns(token, repo, sha) {
    const data = await get(token, `/repos/${repo}/commits/${sha}/check-runs?per_page=50`);
    return data.check_runs ?? [];
  },

  readPull(token, repo, n) {
    return get(token, `/repos/${repo}/pulls/${n}`);
  },

  readReviewComments(token, repo, n) {
    return get(token, `/repos/${repo}/pulls/${n}/comments?per_page=50`);
  },
};
