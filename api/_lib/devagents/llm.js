import { DevAgentsError } from "./errors.js";

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
  return chain;
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
      if (response.status === 429) {
        error.retryAfterMs = Number(response.headers.get("retry-after")) * 1000 || 0;
      }
      throw error;
    }
    const data = await response.json();
    return parseJson(data.choices[0].message.content);
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Goes down the chain once. Moving on is the retry. Details of a failure may
// contain keys, so only the provider's name and any wait time are kept.
async function tryChain(chain, { system, user, validate, deadline }, state) {
  for (const provider of chain) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    try {
      const raw = await attempt(provider, { system, user }, Math.min(ATTEMPT_MS, remaining));
      return { value: validate(raw), model: provider.model };
    } catch (error) {
      if (provider.name === "own") state.ownKeyFailed = true;
      if (error.retryAfterMs > 0) {
        state.waitMs = Math.min(state.waitMs ?? Infinity, error.retryAfterMs);
      }
    }
  }
  return null;
}

// Tries each provider. If they all failed and one only asked for a short wait,
// waits once and tries again. Throws `unavailable` when there's still no valid
// answer. `ownKeyOnly` tries just the user's key, so the caller can charge
// shared limits before any shared provider is used.
export async function askJson({ system, user, validate, userKey, deadline, ownKeyOnly = false }) {
  const chain = providerChain(userKey).filter(
    (provider) => !ownKeyOnly || provider.name === "own",
  );
  const call = { system, user, validate, deadline };
  const state = { ownKeyFailed: false, waitMs: null };

  let answer = await tryChain(chain, call, state);
  if (
    !answer &&
    state.waitMs !== null &&
    state.waitMs <= MAX_WAIT_MS &&
    Date.now() + state.waitMs + MIN_TIME_AFTER_WAIT_MS <= deadline
  ) {
    await sleep(state.waitMs);
    answer = await tryChain(chain, call, state);
  }

  if (!answer) throw new DevAgentsError("unavailable", 503);
  return { ...answer, ownKeyFailed: state.ownKeyFailed };
}
