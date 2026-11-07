// Every link DevAgents shows is built here, always pointing at GitHub, and
// never taken from LLM or repo text.
const GITHUB = "https://github.com";
const MAX_PR_URL_LENGTH = 6000;
const ISSUE_PATH = /^\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)\/?$/;

const encodePath = (path) => String(path).split("/").map(encodeURIComponent).join("/");

export function parseIssueUrl(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.protocol === "https:" && parsed.host === "github.com"
      ? ISSUE_PATH.exec(parsed.pathname)
      : null;
    return match ? { repo: `${match[1]}/${match[2]}`, issue: Number(match[3]) } : null;
  } catch {
    return null;
  }
}

export const repoUrl = (repo) => `${GITHUB}/${repo}`;
export const issueUrl = (repo, issue) => `${GITHUB}/${repo}/issues/${issue}`;
export const codespacesUrl = (repo) => `https://codespaces.new/${repo}`;

export const editorUrl = (repo, branch, path) =>
  `${GITHUB}/${repo}/edit/${encodePath(branch)}/${encodePath(path)}`;

export const fileUrl = (repo, branch, path, line) =>
  `${GITHUB}/${repo}/blob/${encodePath(branch)}/${encodePath(path)}${line ? `#L${line}` : ""}`;

// The filled-in PR page. GitHub can't take very long links, so a long body is
// left out and the page offers it to copy instead.
export function prUrl(repo, baseBranch, headOwner, headBranch, { title, body }) {
  const base = `${GITHUB}/${repo}/compare/${encodePath(baseBranch)}...${encodeURIComponent(headOwner)}:${encodePath(headBranch)}`;
  const build = (fields) => `${base}?${new URLSearchParams({ expand: "1", ...fields })}`;

  const full = build({ title, body });
  if (full.length <= MAX_PR_URL_LENGTH) return { url: full, bodyIncluded: true };
  return { url: build({ title }), bodyIncluded: false };
}
