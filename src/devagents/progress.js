// Where someone got to on an issue's help page. Kept in this browser straight
// away, and on the server for signed-in users so another device can carry on.

const STORAGE_KEY = "opensource-radar-help-progress";
const MAX_LOCAL = 50;

export const progressKey = (repo, issue) => `${repo}#${issue}`.toLowerCase();

function readAll() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  } catch {
    return {};
  }
}

const valid = (entry) => entry && Number.isInteger(entry.step) && entry.step >= 0 && Array.isArray(entry.visited);

export function readLocalProgress(key) {
  const entry = readAll()[key];
  return valid(entry) ? entry : null;
}

export function writeLocalProgress(key, entry) {
  const all = { ...readAll(), [key]: entry };
  const kept = Object.fromEntries(Object.entries(all).sort(([, a], [, b]) => (b?.at ?? 0) - (a?.at ?? 0)).slice(0, MAX_LOCAL));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
  } catch {
    // Only this visit remembers it.
  }
}

export async function fetchRemoteProgress(key) {
  try {
    const response = await fetch(`/api/saved?progress=${encodeURIComponent(key)}`, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const { progress } = await response.json();
    return valid(progress) ? progress : null;
  } catch {
    return null;
  }
}

export function sendRemoteProgress(key, { step, visited }) {
  return fetch("/api/saved?progress=1", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issue: key, step, visited }),
  }).catch(() => null);
}

// The newer of two saved positions.
export const newest = (a, b) => (!a ? b : !b ? a : (b.at ?? 0) > (a.at ?? 0) ? b : a);

// Saves the step someone moved to, here and (when signed in) on the server.
export function rememberStep(key, step, visited, signedIn) {
  const entry = { step, visited: [...visited], at: Date.now() };
  writeLocalProgress(key, entry);
  if (signedIn) sendRemoteProgress(key, entry);
}
