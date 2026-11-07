import { createHash } from "node:crypto";
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
const PER_PERSON_PER_DAY = 100;
const PERSON_SECONDS = 2 * 24 * 60 * 60;

const today = () => new Date().toISOString().slice(0, 10);

// Keeps one person from using up the database. It's stored as a hash, so the
// database doesn't hold usernames for this.
async function withinPersonLimit(login) {
  const person = createHash("sha256").update(login.toLowerCase()).digest("hex").slice(0, 16);
  const key = `da:rate:${person}:${today()}`;
  const used = await daRedis(["INCR", key]);
  if (used === 1) await daRedis(["EXPIRE", key, PERSON_SECONDS]);
  return used <= PER_PERSON_PER_DAY;
}

// Plain daily counts: no usernames, issue text or anything anyone typed.
async function count(login, names) {
  try {
    if (!(await withinPersonLimit(login))) return { saved: false };
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

export function feedback(ctx, { action, helpful, reason }) {
  if (
    !FEEDBACK_ACTIONS.has(action) ||
    typeof helpful !== "boolean" ||
    (reason !== undefined && !REASONS.has(reason))
  ) {
    throw new DevAgentsError("invalid_request", 400);
  }
  const names = [`feedback:${action}:${helpful ? "up" : "down"}`];
  if (reason) names.push(`feedback:${action}:${reason}`);
  return count(ctx.login, names);
}

export function event(ctx, { name }) {
  if (!EVENTS.has(name)) throw new DevAgentsError("invalid_request", 400);
  return count(ctx.login, [name]);
}
