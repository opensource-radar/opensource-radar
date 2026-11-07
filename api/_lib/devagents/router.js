import { daRedis } from "./store.js";

// Decides which AI provider to use next. It learns from what each provider
// reports, moves away before a limit is hit, and shares what it learns between
// servers through the database. It never stores keys, prompts or user details.
const STATE_SECONDS = 24 * 60 * 60;
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 20000;
const REJECTED_KEY_COOLDOWN_MS = 10 * 60 * 1000;
const MAX_FAILURE_COOLDOWN_MS = 120000;
const CHARS_PER_TOKEN = 4;

const stateKey = (name) => `da:v1:provider:${name}`;

// If the database can't be reached, each server still remembers for itself.
const memory = new Map();

export function resetRouterMemory() {
  memory.clear();
}

export function estimateTokens(system, user, replyTokens) {
  return Math.ceil((system.length + user.length) / CHARS_PER_TOKEN) + replyTokens;
}

// Reads times like "250ms", "7.5s" or "2m30s".
function durationMs(value) {
  if (!value) return null;
  let total = 0;
  let found = false;
  for (const [, amount, unit] of value.matchAll(/([\d.]+)(ms|h|m|s)/g)) {
    found = true;
    total += Number(amount) * { ms: 1, s: 1000, m: 60000, h: 3600000 }[unit];
  }
  return found ? Math.round(total) : null;
}

// What a provider says it has left. Providers that don't say anything are
// judged on speed and reliability instead.
export function parseLimits(headers, now) {
  const limits = {};
  const number = (name) => {
    const value = headers.get(name);
    return value === null || !Number.isFinite(Number(value)) ? null : Number(value);
  };
  const tokens = number("x-ratelimit-remaining-tokens");
  const requests = number("x-ratelimit-remaining-requests");
  const tokensReset = durationMs(headers.get("x-ratelimit-reset-tokens"));
  const requestsReset = durationMs(headers.get("x-ratelimit-reset-requests"));

  if (tokens !== null) limits.remainingTokens = tokens;
  if (requests !== null) limits.remainingRequests = requests;
  if (tokensReset !== null) limits.tokensResetAt = now + tokensReset;
  if (requestsReset !== null) limits.requestsResetAt = now + requestsReset;
  return limits;
}

// When this provider can next take this request, or 0 if it can now.
function blockedForMs(state, needTokens, now) {
  const waits = [0];
  if (state.cooldownUntil > now) waits.push(state.cooldownUntil - now);
  if (state.tokensResetAt > now && state.remainingTokens < needTokens) {
    waits.push(state.tokensResetAt - now);
  }
  if (state.requestsResetAt > now && state.remainingRequests <= 1) {
    waits.push(state.requestsResetAt - now);
  }
  return Math.max(...waits);
}

function score(state, needTokens, now) {
  const limitKnown = state.tokensResetAt > now && Number.isFinite(state.remainingTokens);
  const room = limitKnown ? Math.min(1, state.remainingTokens / (needTokens * 10)) : 0.5;
  const speed = state.latencyMs ? 1 / (1 + state.latencyMs / 3000) : 0.5;
  const reliability = 1 / (1 + (state.failures ?? 0));
  return room * 0.5 + speed * 0.2 + reliability * 0.3;
}

// Orders the providers that can take this request, best first. A little
// randomness spreads load, so everyone doesn't rush to the same provider.
export function rankProviders(chain, states, { needTokens, now, random = Math.random }) {
  const ready = [];
  let soonestMs = null;

  for (const provider of chain) {
    const state = states[provider.name] ?? {};
    const blockedMs = blockedForMs(state, needTokens, now);
    if (blockedMs > 0) {
      soonestMs = soonestMs === null ? blockedMs : Math.min(soonestMs, blockedMs);
    } else {
      ready.push({ provider, weight: score(state, needTokens, now) * (0.5 + random() * 0.5) });
    }
  }

  ready.sort((a, b) => b.weight - a.weight);
  return { ready: ready.map((item) => item.provider), soonestMs };
}

// Updates what's known about a provider after a call.
export function nextState(previous, outcome, now) {
  if (outcome.ok) {
    return {
      ...previous,
      ...outcome.limits,
      cooldownUntil: undefined,
      failures: 0,
      latencyMs: previous.latencyMs
        ? Math.round(previous.latencyMs * 0.7 + outcome.latencyMs * 0.3)
        : outcome.latencyMs,
    };
  }
  if (outcome.status === 429) {
    return {
      ...previous,
      cooldownUntil: now + (outcome.retryAfterMs || DEFAULT_RATE_LIMIT_COOLDOWN_MS),
    };
  }
  if (outcome.status === 401 || outcome.status === 403) {
    return { ...previous, cooldownUntil: now + REJECTED_KEY_COOLDOWN_MS };
  }

  // One blip is forgiven. Repeated failures back off, up to a limit.
  const failures = (previous.failures ?? 0) + 1;
  return failures < 2
    ? { ...previous, failures }
    : {
        ...previous,
        failures,
        cooldownUntil: now + Math.min(5000 * 2 ** (failures - 2), MAX_FAILURE_COOLDOWN_MS),
      };
}

export async function loadStates(names) {
  const states = {};
  for (const name of names) states[name] = memory.get(name) ?? {};
  if (names.length === 0) return states;

  try {
    const stored = await daRedis(["MGET", ...names.map(stateKey)]);
    names.forEach((name, index) => {
      if (!stored?.[index]) return;
      states[name] = JSON.parse(stored[index]);
      memory.set(name, states[name]);
    });
  } catch {
    // This server's own memory is used instead.
  }
  return states;
}

export async function recordOutcome(name, outcome) {
  const state = nextState(memory.get(name) ?? {}, outcome, Date.now());
  memory.set(name, state);
  try {
    await daRedis(["SET", stateKey(name), JSON.stringify(state), "EX", STATE_SECONDS]);
  } catch {
    // Other servers will find out for themselves.
  }
}
