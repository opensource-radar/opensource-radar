import { getOwnKey } from "./ownKey";

// The only way the site talks to DevAgents. It never throws: every failure
// comes back as { ok: false, reason }, so a broken backend can't break a page.
const DEFAULT_TIMEOUT_MS = 30000;

export async function callDevAgents(
  action,
  payload,
  { timeoutMs = DEFAULT_TIMEOUT_MS, ownKey = getOwnKey() } = {},
) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`/api/devagents?action=${encodeURIComponent(action)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(ownKey && { "X-User-LLM-Key": ownKey }),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        reason: typeof body?.error === "string" ? body.error : "invalid_response",
      };
    }
    if (!body || typeof body !== "object" || !("data" in body)) {
      return { ok: false, reason: "invalid_response" };
    }
    return { ok: true, data: body.data, ownKeyFailed: body.ownKeyFailed === true };
  } catch {
    return { ok: false, reason: timedOut ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}
