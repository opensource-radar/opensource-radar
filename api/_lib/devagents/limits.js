import { DevAgentsError } from "./errors.js";
import { daRedis } from "./store.js";

const ISSUES_PER_DAY = 5;
const LLM_CALLS_PER_DAY = 40;
const COUNTER_SECONDS = 2 * 24 * 60 * 60;

const today = () => new Date().toISOString().slice(0, 10);

// Limits protect shared free quotas, so if they can't be checked, the answer
// is "not now" rather than letting the call through.
async function guarded(work) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof DevAgentsError) throw error;
    throw new DevAgentsError("unavailable", 503);
  }
}

const issuesKey = (login) => `da:issues:${login.toLowerCase()}:${today()}`;
const issueMember = (repo, issue) => `${repo.toLowerCase()}#${issue}`;
const llmKey = (login) => `da:llm:${login.toLowerCase()}:${today()}`;

// Counts distinct issues. Working on an issue again doesn't charge again.
// Returns true if this call used up a new place, so it can be refunded.
export function chargeIssue(login, repo, issue) {
  return guarded(async () => {
    const key = issuesKey(login);
    const member = issueMember(repo, issue);
    const added = await daRedis(["SADD", key, member]);
    if (added !== 1) return false;

    await daRedis(["EXPIRE", key, COUNTER_SECONDS]);
    if ((await daRedis(["SCARD", key])) > ISSUES_PER_DAY) {
      await daRedis(["SREM", key, member]);
      throw new DevAgentsError("limit", 429);
    }
    return true;
  });
}

export function chargeLlmCall(login) {
  return guarded(async () => {
    const key = llmKey(login);
    const count = await daRedis(["INCR", key]);
    if (count === 1) await daRedis(["EXPIRE", key, COUNTER_SECONDS]);
    if (count > LLM_CALLS_PER_DAY) throw new DevAgentsError("limit", 429);
  });
}

// People aren't charged when no answer came back. A failed refund only means a
// slightly lower limit today, so it never turns into an error.
export async function refundIssue(login, repo, issue) {
  try {
    await daRedis(["SREM", issuesKey(login), issueMember(repo, issue)]);
  } catch {
    // Nothing more to do.
  }
}

export async function refundLlmCall(login) {
  try {
    await daRedis(["DECR", llmKey(login)]);
  } catch {
    // Nothing more to do.
  }
}

// Returns the cached value, or produces and stores it. A store failure only
// means a cache miss. Failures from `produce` are never cached, and neither is
// a value that `shouldStore` turns down.
export async function cached(key, ttlSeconds, produce, shouldStore = () => true) {
  try {
    const stored = await daRedis(["GET", key]);
    if (stored) return JSON.parse(stored);
  } catch {
    // Treated as a miss.
  }

  const value = await produce();
  if (!shouldStore(value)) return value;

  try {
    await daRedis(["SET", key, JSON.stringify(value), "EX", ttlSeconds]);
  } catch {
    // Not cached this time.
  }
  return value;
}
