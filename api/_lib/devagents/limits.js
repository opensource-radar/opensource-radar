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

// Counts distinct issues. Working on an issue again doesn't charge again.
export function chargeIssue(login, repo, issue) {
  return guarded(async () => {
    const key = `da:issues:${login.toLowerCase()}:${today()}`;
    const member = `${repo.toLowerCase()}#${issue}`;
    const added = await daRedis(["SADD", key, member]);
    if (added !== 1) return;

    await daRedis(["EXPIRE", key, COUNTER_SECONDS]);
    if ((await daRedis(["SCARD", key])) > ISSUES_PER_DAY) {
      await daRedis(["SREM", key, member]);
      throw new DevAgentsError("limit", 429);
    }
  });
}

export function chargeLlmCall(login) {
  return guarded(async () => {
    const key = `da:llm:${login.toLowerCase()}:${today()}`;
    const count = await daRedis(["INCR", key]);
    if (count === 1) await daRedis(["EXPIRE", key, COUNTER_SECONDS]);
    if (count > LLM_CALLS_PER_DAY) throw new DevAgentsError("limit", 429);
  });
}

// Returns the cached value, or produces and stores it. A store failure only
// means a cache miss. Failures from `produce` are never cached.
export async function cached(key, ttlSeconds, produce) {
  try {
    const stored = await daRedis(["GET", key]);
    if (stored) return JSON.parse(stored);
  } catch {
    // Treated as a miss.
  }

  const value = await produce();

  try {
    await daRedis(["SET", key, JSON.stringify(value), "EX", ttlSeconds]);
  } catch {
    // Not cached this time.
  }
  return value;
}
