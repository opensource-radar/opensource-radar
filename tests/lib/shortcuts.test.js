import { describe, expect, it } from "vitest";
import { SHORTCUTS, isTyping, nextIndex, shortcutFor } from "../../src/lib/shortcuts.js";

const el = (tagName, attrs = {}, extra = {}) => ({
  tagName,
  getAttribute: (name) => attrs[name] ?? null,
  ...extra,
});
const key = (k, extra = {}) => ({ key: k, target: el("BODY"), ...extra });

describe("shortcutFor", () => {
  it("maps each listed key to its action", () => {
    for (const shortcut of SHORTCUTS) expect(shortcutFor(key(shortcut.key))).toBe(shortcut.action);
  });

  it("ignores other keys", () => {
    expect(shortcutFor(key("x"))).toBeNull();
    expect(shortcutFor(key("Enter"))).toBeNull();
  });

  it("ignores key presses with Ctrl, Cmd or Alt, so browser shortcuts still work", () => {
    expect(shortcutFor(key("s", { metaKey: true }))).toBeNull();
    expect(shortcutFor(key("j", { ctrlKey: true }))).toBeNull();
    expect(shortcutFor(key("k", { altKey: true }))).toBeNull();
  });

  it("does nothing while someone is typing", () => {
    expect(shortcutFor(key("s", { target: el("INPUT", { type: "search" }) }))).toBeNull();
    expect(shortcutFor(key("/", { target: el("TEXTAREA") }))).toBeNull();
    expect(shortcutFor(key("j", { target: el("DIV", {}, { isContentEditable: true }) }))).toBeNull();
  });

  it("does nothing when another handler already used the key", () => {
    expect(shortcutFor(key("j", { defaultPrevented: true }))).toBeNull();
  });
});

describe("isTyping", () => {
  it("counts text fields and selects, not buttons or checkboxes", () => {
    expect(isTyping(el("INPUT"))).toBe(true);
    expect(isTyping(el("SELECT"))).toBe(true);
    expect(isTyping(el("INPUT", { type: "checkbox" }))).toBe(false);
    expect(isTyping(el("BUTTON"))).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});

describe("nextIndex", () => {
  it("starts at the first card going down, the last going up", () => {
    expect(nextIndex(-1, 5, "next")).toBe(0);
    expect(nextIndex(-1, 5, "previous")).toBe(4);
  });

  it("moves one card and stops at the ends", () => {
    expect(nextIndex(2, 5, "next")).toBe(3);
    expect(nextIndex(2, 5, "previous")).toBe(1);
    expect(nextIndex(4, 5, "next")).toBe(4);
    expect(nextIndex(0, 5, "previous")).toBe(0);
  });

  it("has nowhere to go without cards", () => {
    expect(nextIndex(-1, 0, "next")).toBe(-1);
  });
});
