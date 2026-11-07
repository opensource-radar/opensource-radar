import { DevAgentsError } from "../errors.js";
import { daRedis } from "../store.js";

const FEEDBACK_ACTIONS = new Set([
  "explain",
  "hint",
  "explain-error",
  "check-change",
  "pr-text",
  "explain-checks",
  "explain-review",
]);
const REASONS = new Set(["wrong_file", "confusing", "other"]);
const EVENTS = new Set(["explain", "editor_opened", "pr_page_opened"]);
const COUNTER_SECONDS = 90 * 24 * 60 * 60;

const today = () => new Date().toISOString().slice(0, 10);

// Plain daily counts: no usernames, issue text or anything anyone typed.
async function count(names) {
  try {
    for (const name of names) {
      const key = `da:count:${name}:${today()}`;
      await daRedis(["INCR", key]);
      await daRedis(["EXPIRE", key, COUNTER_SECONDS]);
    }
    return { saved: true };
  } catch {
    return { saved: false };
  }
}

export function feedback(_ctx, { action, helpful, reason }) {
  if (
    !FEEDBACK_ACTIONS.has(action) ||
    typeof helpful !== "boolean" ||
    (reason !== undefined && !REASONS.has(reason))
  ) {
    throw new DevAgentsError("invalid_request", 400);
  }
  const names = [`feedback:${action}:${helpful ? "up" : "down"}`];
  if (reason) names.push(`feedback:${action}:${reason}`);
  return count(names);
}

export function event(_ctx, { name }) {
  if (!EVENTS.has(name)) throw new DevAgentsError("invalid_request", 400);
  return count([name]);
}
