// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import App from "../../src/App.jsx";

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })));
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    const text = String(url);
    if (text.startsWith("/api/me")) return Response.json({ signInAvailable: false, user: null });
    if (text.startsWith("/api/")) return Response.json({});
    return Response.json({ total_count: 4321, items: [] });
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("language page", () => {
  it("shows the live number of matching issues", async () => {
    window.history.replaceState(null, "", "/good-first-issues/python");
    render(<App />);
    await screen.findByText("4,321 open Python issues for beginners that nobody has taken yet, right now.");
  });
});
