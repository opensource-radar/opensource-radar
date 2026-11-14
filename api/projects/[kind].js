import { GET as badge } from "../_lib/routes/badge.js";
import { GET as flagsGet, POST as flagsPost } from "../_lib/routes/flags.js";
import { GET as friendliness } from "../_lib/routes/friendliness.js";
import { POST as issueDraft } from "../_lib/routes/issue-draft.js";
import { GET as labelHealth } from "../_lib/routes/label-health.js";
import { GET as repos } from "../_lib/routes/repos.js";

// /api/repos, /api/friendliness, /api/badge and /api/label-health share one
// function, to stay within the Hobby plan's limit of 12 functions per
// deployment. vercel.json keeps their public addresses.
const ROUTES = { repos, friendliness, badge, "label-health": labelHealth };

export function kindOf(request) {
  const url = new URL(request.url);
  const last = url.pathname.split("/").filter(Boolean).at(-1) || "";
  const known = Object.hasOwn(ROUTES, last) || Object.hasOwn(POST_ROUTES, last);
  return known ? last : url.searchParams.get("kind") || "";
}

// /api/flags, the reports from issue cards, shares the function too. It also
// takes POST, to add a report. /api/issue-draft only takes POST.
const FLAGS = "flags";
const POST_ROUTES = { [FLAGS]: flagsPost, "issue-draft": issueDraft };

export function GET(request) {
  const kind = kindOf(request);
  if (kind === FLAGS) return flagsGet(request);
  const handler = ROUTES[kind];
  return handler ? handler(request) : new Response("Not found", { status: 404 });
}

export function POST(request) {
  const handler = POST_ROUTES[kindOf(request)];
  return handler ? handler(request) : new Response("Not found", { status: 404 });
}
