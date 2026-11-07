import { DevAgentsError } from "../errors.js";
import { ownKeyAddress } from "../llm.js";

const TIMEOUT_MS = 8000;
const MAX_MODELS = 200;
const NOT_FOR_CHAT = /whisper|orpheus|guard|embed|tts|moderation|transcribe|imagen?\b|audio|ocr|rerank|dall-e|sora/i;

function chatModels(body) {
  if (!Array.isArray(body?.data)) return [];
  return body.data
    .map((model) => (typeof model?.id === "string" ? model.id.replace(/^models\//, "") : ""))
    .filter((id) => id && !NOT_FOR_CHAT.test(id))
    .sort()
    .slice(0, MAX_MODELS);
}

// Checks a user's key with the provider they chose, and lists the models it can
// use. The key is only passed along to that provider: it's never stored or logged.
export async function validateKey(ctx) {
  if (!ctx.userKey) throw new DevAgentsError("invalid_request", 400);

  let response;
  try {
    response = await fetch(`${ownKeyAddress(ctx.userKey.provider)}/models`, {
      headers: { Authorization: `Bearer ${ctx.userKey.key}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new DevAgentsError("unavailable", 503);
  }

  // Some providers answer 400 for a key they don't recognise.
  if ([400, 401, 403].includes(response.status)) return { valid: false, models: [] };
  if (!response.ok) throw new DevAgentsError("unavailable", 503);

  const body = await response.json().catch(() => null);
  return { valid: true, models: chatModels(body) };
}
