import { loadSession } from "./_lib/auth.js";
import { githubHeaders } from "./_lib/github.js";
import { getConfig, json } from "./_lib/session.js";

const MAX_ISSUES = 20;
// "owner/repo#123"
const KEY_PATTERN = /^([\w.-]+)\/([\w.-]+)#(\d{1,9})$/;

// Where someone is with an issue they saved: "saved", "claimed" (assigned or
// commented), "pr" (opened a pull request that mentions it) or "merged".
export function journeyStage(issue, login) {
  if (!issue) return null;
  const me = login.toLowerCase();
  const isMine = (user) => user?.login?.toLowerCase() === me;

  const pullRequests = (issue.timelineItems?.nodes ?? [])
    .map((event) => event?.source ?? event?.subject)
    .filter((pr) => pr && pr.url && isMine(pr.author));
  const merged = pullRequests.find((pr) => pr.merged);
  const open = pullRequests.find((pr) => pr.state === "OPEN");
  const latest = merged ?? open ?? pullRequests.at(-1) ?? null;

  let stage = "saved";
  if (merged) stage = "merged";
  else if (pullRequests.length > 0) stage = "pr";
  else if (
    (issue.assignees?.nodes ?? []).some(isMine) ||
    (issue.comments?.nodes ?? []).some((comment) => isMine(comment?.author))
  ) {
    stage = "claimed";
  }

  return {
    stage,
    issueClosed: issue.state === "CLOSED",
    pullRequest: latest
      ? { url: latest.url, number: latest.number, state: latest.merged ? "MERGED" : latest.state }
      : null,
  };
}

const PR_FIELDS = "... on PullRequest { url number state merged author { login } }";

export function buildQuery(keys) {
  const variables = {};
  const params = [];
  const fields = keys.map(([owner, name, number], index) => {
    variables[`o${index}`] = owner;
    variables[`n${index}`] = name;
    variables[`i${index}`] = number;
    params.push(`$o${index}: String!, $n${index}: String!, $i${index}: Int!`);
    return `r${index}: repository(owner: $o${index}, name: $n${index}) {
      issue(number: $i${index}) {
        state
        assignees(first: 10) { nodes { login } }
        comments(first: 100) { nodes { author { login } } }
        timelineItems(itemTypes: [CROSS_REFERENCED_EVENT, CONNECTED_EVENT], last: 25) {
          nodes {
            ... on CrossReferencedEvent { source { ${PR_FIELDS} } }
            ... on ConnectedEvent { subject { ${PR_FIELDS} } }
          }
        }
      }
    }`;
  });
  return { query: `query(${params.join(", ")}) { ${fields.join("\n")} }`, variables };
}

// GET /api/journey?issues=owner/repo#1,owner/repo#2
// For the signed-in user's saved issues: have they claimed each one, opened a
// pull request for it, or had it merged? Uses their own GitHub token.
export async function GET(request) {
  const config = getConfig();
  if (!config.configured) return json({ error: "unavailable" }, [], 503);
  const { session, cookies } = await loadSession(request, config);
  if (!session) return json({ error: "signed_out" }, cookies, 401);

  const raw = (new URL(request.url).searchParams.get("issues") || "").split(",").filter(Boolean);
  const keys = [...new Set(raw)];
  const parsed = keys.map((key) => key.match(KEY_PATTERN));
  if (keys.length === 0 || keys.length > MAX_ISSUES || parsed.some((match) => !match)) {
    return json({ error: "invalid_issues" }, cookies, 400);
  }

  const { query, variables } = buildQuery(parsed.map(([, owner, name, number]) => [owner, name, Number(number)]));
  let data;
  try {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { ...githubHeaders(session.accessToken), "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) return json({ error: "github_error" }, cookies, 502);
    // A missing issue or repository comes back as null, plus an entry in `errors`.
    data = (await response.json()).data ?? {};
  } catch {
    return json({ error: "github_error" }, cookies, 502);
  }

  const journey = Object.fromEntries(
    keys.map((key, index) => [key, journeyStage(data[`r${index}`]?.issue ?? null, session.user.login)]),
  );
  return json({ journey }, cookies);
}
