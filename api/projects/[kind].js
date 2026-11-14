import { GET as badge } from "../_lib/routes/badge.js";
import { GET as flagsGet, POST as flagsPost } from "../_lib/routes/flags.js";
import { GET as friendliness } from "../_lib/routes/friendliness.js";
import { GET as repos } from "../_lib/routes/repos.js";

// /api/repos, /api/friendliness and /api/badge share one function, to stay
// within the Hobby plan's limit of 12 functions per deployment. vercel.json
// keeps their public addresses.
const ROUTES = { repos, friendliness, badge };

export function kindOf(request) {
  const url = new URL(request.url);
  const last = url.pathname.split("/").filter(Boolean).at(-1) || "";
  return Object.hasOwn(ROUTES, last) || last === "flags" ? last : url.searchParams.get("kind") || "";
}

// /api/flags, the reports from issue cards, shares the function too. It also
// takes POST, to add a report.
const FLAGS = "flags";

export function GET(request) {
  const kind = kindOf(request);
  if (kind === FLAGS) return flagsGet(request);
  const handler = ROUTES[kind];
  return handler ? handler(request) : new Response("Not found", { status: 404 });
}

export function POST(request) {
  return kindOf(request) === FLAGS ? flagsPost(request) : new Response("Not found", { status: 404 });
}
