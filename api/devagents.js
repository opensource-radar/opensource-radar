import { loadSession } from "./_lib/auth.js";
import { actions } from "./_lib/devagents/actions/index.js";
import { DevAgentsError } from "./_lib/devagents/errors.js";
import { devAgentsEnabledFor } from "./_lib/devagents/flags.js";
import { chargeIssue, chargeLlmCall } from "./_lib/devagents/limits.js";
import { askJson } from "./_lib/devagents/llm.js";
import { scrubSecrets } from "./_lib/devagents/scrub.js";
import { parseTarget } from "./_lib/devagents/target.js";
import { getConfig, json } from "./_lib/session.js";

const DEADLINE_MS = 25000;
const MAX_BODY_BYTES = 20 * 1024;

function buildContext(session, userKey) {
  const login = session.user.login;
  const ctx = {
    token: session.accessToken,
    login,
    userKey,
    deadline: Date.now() + DEADLINE_MS,
    ownKeyFailed: false,
    async askJson(options) {
      if (!userKey) await chargeLlmCall(login);
      const result = await askJson({ ...options, userKey, deadline: ctx.deadline });
      if (result.ownKeyFailed) {
        // The answer came from shared capacity, so it counts like any other.
        ctx.ownKeyFailed = true;
        await chargeLlmCall(login);
      }
      return result;
    },
  };
  return ctx;
}

async function readPayload(request) {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    throw new DevAgentsError("too_large", 413);
  }
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new DevAgentsError("invalid_request", 400);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new DevAgentsError("invalid_request", 400);
  }
  return payload;
}

// POST /api/devagents?action=<name>
// Answers { data }, or { error: code } with one of: disabled, sign_in,
// invalid_request, too_large, limit, not_found, unavailable.
export async function POST(request) {
  const config = getConfig();
  if (process.env.DEVAGENTS_ENABLED !== "true" || !config.configured) {
    return json({ error: "disabled" }, [], 503);
  }

  let cookies = [];
  try {
    const loaded = await loadSession(request, config);
    cookies = loaded.cookies;
    const { session } = loaded;
    if (!session) throw new DevAgentsError("sign_in", 401);
    if (!devAgentsEnabledFor(session.user.login)) {
      throw new DevAgentsError("disabled", 503);
    }

    const payload = await readPayload(request);
    const name = new URL(request.url).searchParams.get("action");
    const action = Object.hasOwn(actions, name) ? actions[name] : null;
    if (!action) throw new DevAgentsError("invalid_request", 400);

    const userKey = request.headers.get("x-user-llm-key") || null;
    if (action.llm) {
      const { repo, issue } = parseTarget(payload);
      if (!userKey) await chargeIssue(session.user.login, repo, issue);
    }

    const ctx = buildContext(session, userKey);
    const data = await action.handler(ctx, payload);
    return json(
      { data, ...(ctx.ownKeyFailed && { ownKeyFailed: true }) },
      cookies,
    );
  } catch (error) {
    if (error instanceof DevAgentsError) {
      return json({ error: error.code }, cookies, error.status);
    }
    console.error("DevAgents error:", scrubSecrets(error?.name ?? "unknown"));
    return json({ error: "unavailable" }, cookies, 503);
  }
}
