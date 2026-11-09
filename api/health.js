import { providerChain } from "./_lib/devagents/llm.js";
import { loadStates } from "./_lib/devagents/router.js";
import { daRedis, daStoreAvailable } from "./_lib/devagents/store.js";
import { redis, storeAvailable } from "./_lib/store.js";

const TIMEOUT_MS = 2000;
// The CDN keeps each answer this long, so monitors and repeat visits can't
// add database traffic.
const CACHE_SECONDS = 30;

function withTimeout(promise) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("timed out")), TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// "ok", "error", or "not_set_up" for one database.
async function checkStore(available, run) {
  if (!available) return "not_set_up";
  try {
    await withTimeout(run(["PING"]));
    return "ok";
  } catch {
    return "error";
  }
}

// How many shared AI providers are set up, and how many aren't resting after
// a rate limit or errors. Never includes keys, models or provider names.
async function checkProviders(now) {
  const names = providerChain(null).map(({ name }) => name);
  const states = names.length ? await loadStates(names) : {};
  const ready = names.filter((name) => !(states[name]?.cooldownUntil > now)).length;
  return { providers: names.length, ready };
}

// GET /api/health: whether the site's parts are working, for uptime monitors.
// "ok" answers 200; anything else answers 503, so a plain HTTP check notices.
export async function GET() {
  const now = Date.now();
  const enabled = process.env.DEVAGENTS_ENABLED === "true";
  const [store, devAgentsStore, ai] = await Promise.all([
    checkStore(storeAvailable(), redis),
    enabled ? checkStore(daStoreAvailable(), daRedis) : "not_set_up",
    enabled ? checkProviders(now) : { providers: 0, ready: 0 },
  ]);

  const problems = [
    store === "error" && "store",
    enabled && devAgentsStore === "error" && "devAgentsStore",
    enabled && ai.ready === 0 && "aiProviders",
  ].filter(Boolean);

  const body = {
    status: problems.length ? "degraded" : "ok",
    problems,
    store,
    devAgents: enabled
      ? { enabled: true, store: devAgentsStore, providers: ai.providers, ready: ai.ready }
      : { enabled: false },
  };

  return new Response(JSON.stringify(body), {
    status: problems.length ? 503 : 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=0, s-maxage=${CACHE_SECONDS}`,
    },
  });
}
