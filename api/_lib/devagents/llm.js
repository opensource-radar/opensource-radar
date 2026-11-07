import { DevAgentsError } from "./errors.js";

const ATTEMPT_MS = 12000;
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
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const data = await response.json();
    return parseJson(data.choices[0].message.content);
  } finally {
    clearTimeout(timer);
  }
}

// Tries each provider once, moving down the chain on any failure. Moving on is
// the retry. Throws `unavailable` when none of them gives a valid answer.
export async function askJson({ system, user, validate, userKey, deadline }) {
  let ownKeyFailed = false;

  for (const provider of providerChain(userKey)) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    try {
      const raw = await attempt(
        provider,
        { system, user },
        Math.min(ATTEMPT_MS, remaining),
      );
      return { value: validate(raw), model: provider.model, ownKeyFailed };
    } catch {
      // Details may contain keys, so only the provider's name is ever kept.
      if (provider.name === "own") ownKeyFailed = true;
    }
  }

  throw new DevAgentsError("unavailable", 503);
}
