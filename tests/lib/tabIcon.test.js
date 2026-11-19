// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blipAlpha, drawFrame, startTabIcon } from "../../src/lib/tabIcon.js";

const FRAMES = ["data:image/png;base64,AAA", "data:image/png;base64,BBB", "data:image/png;base64,CCC"];

function setup({ userAgent = "Mozilla/5.0 Chrome/140", reduce = false, visible = true } = {}) {
  document.head.replaceChildren();
  const icon = document.createElement("link");
  icon.setAttribute("rel", "icon");
  icon.setAttribute("type", "image/svg+xml");
  icon.setAttribute("href", "/favicon.svg");
  document.head.append(icon);
  let visibility = visible ? "visible" : "hidden";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  const motion = { matches: reduce, listeners: [], addEventListener: (_, fn) => motion.listeners.push(fn), removeEventListener: vi.fn() };
  const win = {
    navigator: { userAgent },
    matchMedia: () => motion,
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (id) => clearInterval(id),
  };
  const link = document.querySelector('link[rel="icon"]');
  const setVisible = (value) => {
    visibility = value ? "visible" : "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
  };
  return { win, link, motion, setVisible };
}

describe("tab icon", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.head.replaceChildren();
  });

  it("turns the icon frame by frame while the tab is in front", () => {
    const { win, link } = setup();
    const stop = startTabIcon({ win, frames: () => FRAMES });
    expect(link.getAttribute("href")).toBe(FRAMES[0]);
    expect(link.getAttribute("type")).toBe("image/png");
    vi.advanceTimersByTime(4000 / FRAMES.length);
    expect(link.getAttribute("href")).toBe(FRAMES[1]);
    vi.advanceTimersByTime((4000 / FRAMES.length) * 2);
    expect(link.getAttribute("href")).toBe(FRAMES[0]);
    stop();
  });

  it("puts the normal icon back and stops when the tab goes to the background", () => {
    const { win, link, setVisible } = setup();
    const stop = startTabIcon({ win, frames: () => FRAMES });
    setVisible(false);
    expect(link.getAttribute("href")).toBe("/favicon.svg");
    expect(link.getAttribute("type")).toBe("image/svg+xml");
    vi.advanceTimersByTime(5000);
    expect(link.getAttribute("href")).toBe("/favicon.svg");
    setVisible(true);
    // It picks up again where it left off.
    expect(FRAMES).toContain(link.getAttribute("href"));
    expect(link.getAttribute("type")).toBe("image/png");
    stop();
  });

  it("keeps the icon still for people who prefer reduced motion", () => {
    const { win, link } = setup({ reduce: true });
    const frames = vi.fn(() => FRAMES);
    startTabIcon({ win, frames });
    vi.advanceTimersByTime(5000);
    expect(link.getAttribute("href")).toBe("/favicon.svg");
    expect(frames).not.toHaveBeenCalled();
  });

  it("leaves Firefox alone, since it turns the SVG icon itself", () => {
    const { win, link } = setup({ userAgent: "Mozilla/5.0 Gecko/20100101 Firefox/140.0" });
    const frames = vi.fn(() => FRAMES);
    startTabIcon({ win, frames });
    expect(link.getAttribute("href")).toBe("/favicon.svg");
    expect(frames).not.toHaveBeenCalled();
  });

  it("keeps the normal icon where frames can't be drawn", () => {
    const { win, link } = setup();
    startTabIcon({ win, frames: () => null });
    vi.advanceTimersByTime(5000);
    expect(link.getAttribute("href")).toBe("/favicon.svg");
    expect(link.getAttribute("type")).toBe("image/svg+xml");
  });

  it("restores the normal icon when stopped", () => {
    const { win, link } = setup();
    const stop = startTabIcon({ win, frames: () => FRAMES });
    stop();
    expect(link.getAttribute("href")).toBe("/favicon.svg");
    vi.advanceTimersByTime(5000);
    expect(link.getAttribute("href")).toBe("/favicon.svg");
  });

  it("does nothing on a page without an icon", () => {
    document.head.replaceChildren();
    expect(() => startTabIcon({ win: { navigator: {} }, frames: () => FRAMES })()).not.toThrow();
  });
});

describe("drawFrame", () => {
  it("turns only the sweep, around the centre", () => {
    const calls = [];
    const ctx = new Proxy({}, {
      get: (_, name) => (...args) => calls.push([name, ...args]),
      set: () => true,
    });
    drawFrame(ctx, Math.PI / 2, (d) => d);
    const rotate = calls.findIndex(([name]) => name === "rotate");
    expect(calls[rotate]).toEqual(["rotate", Math.PI / 2]);
    // The sweep is drawn between save and restore, so the rings and the dot stay still.
    const save = calls.findIndex(([name]) => name === "save");
    const restore = calls.findIndex(([name]) => name === "restore");
    expect(save).toBeLessThan(rotate);
    expect(restore).toBeGreaterThan(rotate);
    const sweep = calls.slice(save, restore).filter(([name]) => name === "fill" || name === "stroke");
    expect(sweep.map(([, path]) => path)).toEqual([
      "M16 16 L16 1.5 A14.5 14.5 0 0 1 26.25 5.75 Z",
      "M16 16 L26.25 5.75",
    ]);
  });
});

describe("blipAlpha", () => {
  it("is brightest right after the sweep passes, then fades and rests", () => {
    expect(blipAlpha(0)).toBe(1);
    expect(blipAlpha(108)).toBeCloseTo(0.6);
    expect(blipAlpha(216)).toBeCloseTo(0.2);
    expect(blipAlpha(300)).toBe(0.2);
  });

  it("handles angles past a full turn or below zero", () => {
    expect(blipAlpha(360)).toBe(1);
    expect(blipAlpha(-144)).toBeCloseTo(0.2);
  });
});
