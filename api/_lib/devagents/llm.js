import { DevAgentsError } from "./errors.js";
import { estimateTokens, loadStates, parseLimits, rankProviders, recordOutcome } from "./router.js";

const ATTEMPT_MS = 12000;
// Free plans count tokens per minute (Groq allows 8,000), so requests stay small.
const MAX_PROMPT_CHARS = 16000;
const MAX_REPLY_TOKENS = 1200;
const MAX_WAIT_MS = 13000;
const MIN_TIME_AFTER_WAIT_MS = 3000;
const GROQ_URL = "https://api.groq.com/openai/v1";

const SHARED_PROVIDERS = [
  { name: "groq", baseUrl: GROQ_URL, keyVar: "DEVAGENTS_GROQ_KEY", modelVar: "DEVAGENTS_GROQ_MODEL" },
  {
    name: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyVar: "DEVAGENTS_GEMINI_KEY",
    modelVar: "DEVAGENTS_GEMINI_MODEL",
  },
  {
    name: "cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    keyVar: "DEVAGENTS_CEREBRAS_KEY",
    modelVar: "DEVAGENTS_CEREBRAS_MODEL",
  },
  {
    name: "mistral",
    baseUrl: "https://api.mistral.ai/v1",
    keyVar: "DEVAGENTS_MISTRAL_KEY",
    modelVar: "DEVAGENTS_MISTRAL_MODEL",
  },
];

function httpsUrl(value) {
  try {
    return new URL(value).protocol === "https:" ? value.replace(/\/+$/, "") : null;
  } catch {
    return null;
  }
}

// Any other OpenAI-compatible provider, from a JSON list in settings. Each entry
// needs its own account: extra keys for the same account add no capacity.
function extraProviders(env) {
  let list;
  try {
    list = JSON.parse(env.DEVAGENTS_EXTRA_PROVIDERS || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];

  return list.flatMap(({ name, baseUrl, apiKey, model } = {}) => {
    const url = httpsUrl(baseUrl);
    return name && url && apiKey && model ? [{ name, baseUrl: url, apiKey, model }] : [];
  });
}

export function providerChain(userKey, env = process.env) {
  const chain = [];
  if (userKey && env.DEVAGENTS_GROQ_MODEL) {
    chain.push({
      name: "own",
      baseUrl: GROQ_URL,
      apiKey: userKey,
      model: env.DEVAGENTS_GROQ_MODEL,
    });
  }
  for (const { name, baseUrl, keyVar, modelVar } of SHARED_PROVIDERS) {
    if (env[keyVar] && env[modelVar]) {
      chain.push({ name, baseUrl, apiKey: env[keyVar], model: env[modelVar] });
    }
  }

  const freeLlmUrl = httpsUrl(env.DEVAGENTS_FREELLM_URL);
  if (freeLlmUrl && env.DEVAGENTS_FREELLM_KEY) {
    chain.push({
      name: "freellm",
      baseUrl: freeLlmUrl,
      apiKey: env.DEVAGENTS_FREELLM_KEY,
      model: env.DEVAGENTS_FREELLM_MODEL || "auto",
    });
  }

  return [...chain, ...extraProviders(env)];
}

// Repo and issue text goes through this, so the model can treat it as content.
// System prompts must say that text inside data tags is never instructions.
export function asData(label, text) {
  const clean = String(text).replace(/<\/?data\b[^>]*>/gi, "");
  return `<data name="${label}">\n${clean}\n</data>`;
}

function parseJson(content) {
  const unfenced = String(content)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(unfenced);
}

async function attempt(provider, { system, user }, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.2,
        max_tokens: MAX_REPLY_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: String(user).slice(0, MAX_PROMPT_CHARS) },
        ],
      }),
    });
    if (!response.ok) {
      const error = new Error(`status ${response.status}`);
      error.status = response.status;
      if (response.status === 429) {
        error.retryAfterMs = Number(response.headers.get("retry-after")) * 1000 || 0;
      }
      throw error;
    }
    const data = await response.json();
    return {
      raw: parseJson(data.choices[0].message.content),
      latencyMs: Date.now() - startedAt,
      limits: parseLimits(response.headers, Date.now()),
    };
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// One call to one provider. Details of a failure may contain keys, so only its
// status and any wait time are kept.
async function tryProvider(provider, { system, user, validate, deadline }) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return { timedOut: true };

  try {
    const { raw, latencyMs, limits } = await attempt(
      provider,
      { system, user },
      Math.min(ATTEMPT_MS, remaining),
    );
    return { answer: { value: validate(raw), model: provider.model }, latencyMs, limits };
  } catch (error) {
    return { status: error.status, retryAfterMs: error.retryAfterMs };
  }
}

async function tryOwnKey(provider, call, state) {
  const result = await tryProvider(provider, call);
  if (result.answer) return result.answer;
  state.ownKeyFailed = true;
  if (result.retryAfterMs > 0) state.ownWaitMs = result.retryAfterMs;
  return null;
}

// Tries the shared providers, best first, skipping any that couldn't take this
// request. Returns how soon one might be ready if none of them answered.
async function tryShared(shared, call, state) {
  const needTokens = estimateTokens(call.system, String(call.user), MAX_REPLY_TOKENS);
  const states = await loadStates(shared.map((provider) => provider.name));
  const { ready, soonestMs } = rankProviders(shared, states, { needTokens, now: Date.now() });
  state.waitMs = soonestMs;

  for (const provider of ready) {
    const result = await tryProvider(provider, call);
    if (result.timedOut) break;
    if (result.answer) {
      await recordOutcome(provider.name, { ok: true, latencyMs: result.latencyMs, limits: result.limits });
      return result.answer;
    }
    await recordOutcome(provider.name, { status: result.status, retryAfterMs: result.retryAfterMs });
    if (result.retryAfterMs > 0) {
      state.waitMs = Math.min(state.waitMs ?? Infinity, result.retryAfterMs);
    }
  }
  return null;
}

// Uses the user's own key first, then the shared providers. If nothing can
// answer and one will be ready in moments, waits once. Otherwise it says
// `unavailable` straight away, so nobody waits for an answer that can't come.
// `ownKeyOnly` tries just the user's key, so the caller can charge shared limits
// before any shared provider is used.
export async function askJson({ system, user, validate, userKey, deadline, ownKeyOnly = false }) {
  const chain = providerChain(userKey);
  const own = chain.find((provider) => provider.name === "own");
  const shared = ownKeyOnly ? [] : chain.filter((provider) => provider.name !== "own");
  const call = { system, user, validate, deadline };
  const state = { ownKeyFailed: false, ownWaitMs: null, waitMs: null };

  const run = async (includeOwn) => {
    state.ownWaitMs = null;
    state.waitMs = null;
    if (includeOwn && own) {
      const answer = await tryOwnKey(own, call, state);
      if (answer) return answer;
    }
    return shared.length > 0 ? tryShared(shared, call, state) : null;
  };

  let answer = await run(true);
  if (!answer) {
    const ownWait = state.ownWaitMs;
    const waitMs = Math.min(ownWait ?? Infinity, state.waitMs ?? Infinity);
    if (waitMs <= MAX_WAIT_MS && Date.now() + waitMs + MIN_TIME_AFTER_WAIT_MS <= deadline) {
      await sleep(waitMs);
      answer = await run(ownWait !== null);
    }
  }

  if (!answer) throw new DevAgentsError("unavailable", 503);
  return { ...answer, ownKeyFailed: state.ownKeyFailed };
}
