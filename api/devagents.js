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

function buildContext(session, userKey, target) {
  const login = session.user.login;
  const ctx = {
    token: session.accessToken,
    login,
    userKey,
    deadline: Date.now() + DEADLINE_MS,
    ownKeyFailed: false,
    async askJson(options) {
      const call = { deadline: ctx.deadline, ...options };

      // Any text can be sent as a key, so shared capacity is only used after
      // the shared limits have been charged, whatever the request claims.
      if (userKey && !ctx.ownKeyFailed) {
        try {
          return await askJson({ ...call, userKey, ownKeyOnly: true });
        } catch (error) {
          if (error.code !== "unavailable") throw error;
          ctx.ownKeyFailed = true;
          if (target) await chargeIssue(login, target.repo, target.issue);
        }
      }

      await chargeLlmCall(login);
      return askJson(call);
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
    const target = action.llm ? parseTarget(payload) : null;
    if (target && !userKey) {
      await chargeIssue(session.user.login, target.repo, target.issue);
    }

    const ctx = buildContext(session, userKey, target);
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
