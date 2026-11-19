import { issueKey } from "./hiddenIssues";

// Issues someone said they're working on, kept in this browser. After a few
// days Radar asks how it's going, so a stalled first contribution gets a
// nudge instead of being quietly forgotten.
const STORAGE_KEY = "opensource-radar-working-on";
export const MAX_WORKING = 10;
export const REMIND_AFTER_DAYS = 3;
const DAY = 86400000;
const GITHUB_ISSUE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+$/;

const validDate = (value) => typeof value === "string" && !Number.isNaN(Date.parse(value));

function cleanEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const key = issueKey(entry);
  if (!key || typeof entry.title !== "string" || !GITHUB_ISSUE.test(entry.url ?? "")) return null;
  if (!validDate(entry.startedAt)) return null;
  return {
    repo: entry.repo,
    number: entry.number,
    title: entry.title.slice(0, 300),
    url: entry.url,
    startedAt: entry.startedAt,
    checkedAt: validDate(entry.checkedAt) ? entry.checkedAt : entry.startedAt,
  };
}

export function cleanWorking(list) {
  if (!Array.isArray(list)) return [];
  const kept = [];
  for (const entry of list) {
    const clean = cleanEntry(entry);
    if (!clean || kept.some((other) => issueKey(other) === issueKey(clean))) continue;
    kept.push(clean);
    if (kept.length === MAX_WORKING) break;
  }
  return kept;
}

export function readWorking(storage = globalThis.localStorage) {
  try {
    return cleanWorking(JSON.parse(storage.getItem(STORAGE_KEY)));
  } catch {
    return [];
  }
}

export function writeWorking(list, storage = globalThis.localStorage) {
  const clean = cleanWorking(list);
  try {
    if (clean.length > 0) storage.setItem(STORAGE_KEY, JSON.stringify(clean));
    else storage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: the list lasts until the page is closed.
  }
  return clean;
}

export const isWorkingOn = (list, issue) => list.some((entry) => issueKey(entry) === issueKey(issue));

// Starts or stops tracking an issue. Newest first.
export function toggleWorking(list, issue, now = new Date()) {
  if (isWorkingOn(list, issue)) return list.filter((entry) => issueKey(entry) !== issueKey(issue));
  const entry = cleanEntry({ ...issue, startedAt: now.toISOString() });
  return entry ? [entry, ...list].slice(0, MAX_WORKING) : list;
}

// "Still on it": ask again in a few days.
export const snooze = (list, issue, now = new Date()) =>
  list.map((entry) => (issueKey(entry) === issueKey(issue) ? { ...entry, checkedAt: now.toISOString() } : entry));

export const stopWorking = (list, issue) => list.filter((entry) => issueKey(entry) !== issueKey(issue));

export const daysSince = (date, now = new Date()) => Math.floor((now.getTime() - Date.parse(date)) / DAY);

// The issue to ask about now: the one waiting longest since it was last checked.
export function dueReminder(list, now = new Date()) {
  const due = list.filter((entry) => daysSince(entry.checkedAt, now) >= REMIND_AFTER_DAYS);
  due.sort((a, b) => Date.parse(a.checkedAt) - Date.parse(b.checkedAt));
  return due[0] ?? null;
}
