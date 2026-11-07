// A user's own Groq key lives only in this browser. It's kept in memory unless
// they choose "Remember on this device". Storage can be blocked, so nothing
// here ever throws.
const STORAGE_KEY = "devagents:groq-key";
let inMemory = null;

export function getOwnKey() {
  if (inMemory) return inMemory;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setOwnKey(key, remember) {
  inMemory = key;
  try {
    if (remember) localStorage.setItem(STORAGE_KEY, key);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // It still works for as long as this page stays open.
  }
}

export function clearOwnKey() {
  inMemory = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing was saved.
  }
}
