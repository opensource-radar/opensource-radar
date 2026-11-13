import { GET as callback } from "../_lib/routes/auth-callback.js";
import { GET as login } from "../_lib/routes/auth-login.js";
import { POST as logout } from "../_lib/routes/auth-logout.js";

// /auth/login, /auth/callback and /auth/logout share one function, to stay
// within the Hobby plan's limit of 12 functions per deployment.
const ROUTES = {
  GET: { login, callback },
  POST: { logout },
};

// The action is the last part of the address (/auth/login or
// /api/auth/login), or the "action" value Vercel adds for [action].
export function actionOf(request) {
  const url = new URL(request.url);
  return url.pathname.split("/").filter(Boolean).at(-1) || url.searchParams.get("action") || "";
}

function handle(method) {
  return (request) => {
    const handler = ROUTES[method][actionOf(request)];
    return handler ? handler(request) : new Response("Not found", { status: 404 });
  };
}

export const GET = handle("GET");
export const POST = handle("POST");
