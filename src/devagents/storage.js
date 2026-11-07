// Keeps panel answers for this tab, so a refresh doesn't lose them. Storage
// can be blocked or full, so nothing here ever throws.
const PREFIX = "devagents:";

export function readPanelState(key) {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writePanelState(key, value) {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // This answer just won't survive a refresh.
  }
}
