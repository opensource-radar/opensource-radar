// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App.jsx";
import { clearOwnKey, getOwnKey, setOwnKey } from "../../src/devagents/ownKey.js";

afterEach(() => {
  cleanup();
  clearOwnKey();
  vi.unstubAllGlobals();
});

describe("signing out", () => {
  it("clears a remembered AI key, so the next person can't use it", async () => {
    setOwnKey({ provider: "groq", model: "m", key: "secret" }, true);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })));
    window.scrollTo = () => {};
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      const text = String(url);
      if (text.startsWith("/api/me")) {
        return Response.json({ signInAvailable: true, devAgents: false, user: { login: "me", name: "Me", avatarUrl: "https://x.test/a.png" } });
      }
      if (text.startsWith("/api/saved")) return Response.json({ issues: [] });
      if (text.startsWith("/auth/logout")) return new Response(null, { status: 204 });
      return Response.json({ total_count: 0, items: [] });
    }));
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, assign() {}, reload() {}, pathname: "/", search: "" } });
    render(<App />);
    const menu = await screen.findByRole("button", { name: /menu|account/i }, { timeout: 3000 });
    fireEvent.click(menu);
    fireEvent.click(await screen.findByRole("menuitem", { name: /sign out/i }));
    await waitFor(() => expect(getOwnKey()).toBeNull());
  });
});
