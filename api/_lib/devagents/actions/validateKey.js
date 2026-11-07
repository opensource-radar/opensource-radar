import { DevAgentsError } from "../errors.js";

const MODELS_URL = "https://api.groq.com/openai/v1/models";
const TIMEOUT_MS = 8000;

// Checks a user's Groq key. The key is only passed along to Groq: it's never
// stored or logged.
export async function validateKey(ctx) {
  if (!ctx.userKey) throw new DevAgentsError("invalid_request", 400);
  // Without a model set, an own key can't be used, so "valid" would mislead.
  if (!process.env.DEVAGENTS_GROQ_MODEL) throw new DevAgentsError("unavailable", 503);

  let response;
  try {
    response = await fetch(MODELS_URL, {
      headers: { Authorization: `Bearer ${ctx.userKey}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new DevAgentsError("unavailable", 503);
  }
  if (response.ok) return { valid: true };
  if (response.status === 401 || response.status === 403) return { valid: false };
  throw new DevAgentsError("unavailable", 503);
}
