// DevAgents' own Upstash Redis database. It is separate from Radar's, so
// DevAgents' cache and limits can never affect saved issues.
const TIMEOUT_MS = 2000;

export function daStoreAvailable() {
  return Boolean(process.env.DEVAGENTS_REDIS_URL && process.env.DEVAGENTS_REDIS_TOKEN);
}

// Runs one Redis command, e.g. daRedis(["GET", "key"]). Throws on failure.
export async function daRedis(command) {
  if (!daStoreAvailable()) throw new Error("DevAgents store isn't set up");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(process.env.DEVAGENTS_REDIS_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.DEVAGENTS_REDIS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.error) {
      throw new Error("DevAgents store request failed");
    }
    return data.result;
  } finally {
    clearTimeout(timer);
  }
}
