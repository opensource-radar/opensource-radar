import { vi } from "vitest";
import { POST } from "../../api/devagents.js";
import { seal } from "../../api/_lib/session.js";

const SESSION_SECRET = "test-session-secret-0123456789abcdef0123456789abcdef";
export const REDIS_URL = "https://fake-da-redis.test";

function fakeRedis(db, command) {
  const [name, key, ...args] = command;
  switch (name) {
    case "GET":
      return db.get(key) ?? null;
    case "SET":
      db.set(key, args[0]);
      return "OK";
    case "INCR": {
      const next = (Number(db.get(key)) || 0) + 1;
      db.set(key, String(next));
      return next;
    }
    case "EXPIRE":
      return 1;
    case "SADD": {
      const set = db.get(key) ?? new Set();
      db.set(key, set);
      if (set.has(args[0])) return 0;
      set.add(args[0]);
      return 1;
    }
    case "SREM":
      db.get(key)?.delete(args[0]);
      return 1;
    case "SCARD":
      return db.get(key)?.size ?? 0;
    default:
      throw new Error(`fake redis: unknown ${name}`);
  }
}

// A fake outside world. `github` maps "/repos/a/b/…" (without the query) to a
// JSON value, or a Response/function. `llm` is a queue of model answers.
export function fakeWorld({ github = {}, llm = [], redisDown = false } = {}) {
  const world = { db: new Map(), github, llm: [...llm], redisDown, calls: [] };

  const handler = async (rawUrl, init = {}) => {
    const url = new URL(rawUrl);
    world.calls.push({ url: String(rawUrl), init, method: init.method ?? "GET" });

    if (String(rawUrl) === REDIS_URL) {
      if (world.redisDown) throw new Error("redis down");
      return Response.json({ result: fakeRedis(world.db, JSON.parse(init.body)) });
    }

    if (url.host === "api.github.com") {
      const route = world.github[url.pathname];
      if (route === undefined) return new Response("{}", { status: 404 });
      const value = typeof route === "function" ? route(url, init) : route;
      if (value instanceof Response) return value;
      return typeof value === "string"
        ? new Response(value)
        : Response.json(value);
    }

    if (url.pathname.endsWith("/chat/completions")) {
      if (world.llm.length === 0) return new Response("{}", { status: 503 });
      const next = world.llm.shift();
      if (next instanceof Response) return next;
      const content = typeof next === "string" ? next : JSON.stringify(next);
      return Response.json({ choices: [{ message: { content } }] });
    }

    return new Response("{}", { status: 404 });
  };

  vi.stubGlobal("fetch", vi.fn(handler));
  world.llmCalls = () =>
    world.calls.filter((call) => call.url.endsWith("/chat/completions"));
  world.githubCalls = () =>
    world.calls.filter((call) => new URL(call.url).host === "api.github.com");
  return world;
}

export function enableDevAgents() {
  vi.stubEnv("GITHUB_CLIENT_ID", "id");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "secret");
  vi.stubEnv("SESSION_SECRET", SESSION_SECRET);
  vi.stubEnv("DEVAGENTS_ENABLED", "true");
  vi.stubEnv("DEVAGENTS_ALLOWED_LOGINS", "");
  vi.stubEnv("DEVAGENTS_REDIS_URL", REDIS_URL);
  vi.stubEnv("DEVAGENTS_REDIS_TOKEN", "t");
  vi.stubEnv("DEVAGENTS_GROQ_KEY", "groq-key");
  vi.stubEnv("DEVAGENTS_GROQ_MODEL", "groq-model");
  vi.stubEnv("DEVAGENTS_GEMINI_KEY", "");
  vi.stubEnv("DEVAGENTS_CEREBRAS_KEY", "");
  vi.stubEnv("DEVAGENTS_MISTRAL_KEY", "");
}

export async function sessionCookie(login = "octocat") {
  const session = {
    accessToken: "user-token",
    refreshToken: null,
    accessExpiresAt: null,
    refreshExpiresAt: null,
    user: { login, name: login, avatarUrl: "" },
  };
  return `osr_session=${await seal(session, SESSION_SECRET)}`;
}

// Posts to the gateway. Returns { status, body, headers }.
export async function callAction(action, payload = {}, options = {}) {
  const { signedIn = true, headers = {}, rawBody, login } = options;
  const response = await POST(
    new Request(`http://localhost/api/devagents?action=${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(signedIn && { cookie: await sessionCookie(login) }),
        ...headers,
      },
      body: rawBody ?? JSON.stringify(payload),
    }),
  );
  return {
    status: response.status,
    body: await response.json(),
    headers: response.headers,
  };
}
