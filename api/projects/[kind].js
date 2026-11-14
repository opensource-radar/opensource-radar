import { GET as badge } from "../_lib/routes/badge.js";
import { GET as friendliness } from "../_lib/routes/friendliness.js";
import { GET as labelHealth } from "../_lib/routes/label-health.js";
import { GET as repos } from "../_lib/routes/repos.js";

// /api/repos, /api/friendliness, /api/badge and /api/label-health share one
// function, to stay within the Hobby plan's limit of 12 functions per
// deployment. vercel.json keeps their public addresses.
const ROUTES = { repos, friendliness, badge, "label-health": labelHealth };

export function kindOf(request) {
  const url = new URL(request.url);
  const last = url.pathname.split("/").filter(Boolean).at(-1) || "";
  return Object.hasOwn(ROUTES, last) ? last : url.searchParams.get("kind") || "";
}

export function GET(request) {
  const handler = ROUTES[kindOf(request)];
  return handler ? handler(request) : new Response("Not found", { status: 404 });
}
