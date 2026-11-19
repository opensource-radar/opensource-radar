// Keyboard shortcuts for the issue list. The keys only act when nobody is
// typing, so they never get in the way of the search box or a form.

export const SHORTCUTS = [
  { key: "/", action: "search", label: "Jump to the search box" },
  { key: "j", action: "next", label: "Next issue" },
  { key: "k", action: "previous", label: "Previous issue" },
  { key: "s", action: "save", label: "Save or unsave the current issue" },
  { key: "o", action: "open", label: "Open the current issue on GitHub" },
  { key: "?", action: "help", label: "Show these shortcuts" },
];

const BY_KEY = Object.fromEntries(SHORTCUTS.map((shortcut) => [shortcut.key, shortcut.action]));

// True when the key press is going into something the person is typing in.
export function isTyping(target) {
  if (!target || typeof target !== "object") return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = (target.getAttribute?.("type") || "text").toLowerCase();
  return !["button", "checkbox", "radio", "submit", "reset"].includes(type);
}

// The action for a key press, or null if it isn't a shortcut here.
export function shortcutFor(event) {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return null;
  if (isTyping(event.target)) return null;
  return BY_KEY[event.key] ?? null;
}

// Which card to move to: the next or previous one from `current`, or the
// first (or last) one when nothing is chosen yet. Stays at the ends.
export function nextIndex(current, count, action) {
  if (count === 0) return -1;
  if (current < 0 || current >= count) return action === "previous" ? count - 1 : 0;
  const step = action === "previous" ? -1 : 1;
  return Math.min(count - 1, Math.max(0, current + step));
}
