// A user's own API key lives only in this browser, as { provider, model, key }.
// It's kept in memory unless they choose "Remember on this device". Storage can
// be blocked, so nothing here ever throws.
const STORAGE_KEY = "devagents:own-key";
// The id of the "Use your own API key" settings on the help page.
export const OWN_KEY_SETTINGS_ID = "devagents-own-key";
// The first version only supported Groq, and saved just the key.
const OLD_STORAGE_KEY = "devagents:groq-key";
let inMemory = null;

function readSaved() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed?.key && parsed?.provider ? parsed : null;
    }
    const old = localStorage.getItem(OLD_STORAGE_KEY);
    return old ? { provider: "groq", model: null, key: old } : null;
  } catch {
    return null;
  }
}

function removeSaved() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(OLD_STORAGE_KEY);
  } catch {
    // Nothing was saved.
  }
}

export function getOwnKey() {
  return inMemory ?? readSaved();
}

export function setOwnKey(ownKey, remember) {
  inMemory = ownKey;
  removeSaved();
  if (!remember) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ownKey));
  } catch {
    // It still works for as long as this page stays open.
  }
}

export function clearOwnKey() {
  inMemory = null;
  removeSaved();
}
