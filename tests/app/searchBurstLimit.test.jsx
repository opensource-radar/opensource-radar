// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App.jsx";

const item = {
  id: 1, number: 1, title: "Fix the docs", body: "", labels: [{ name: "good first issue" }],
  user: { login: "a" }, created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-02T00:00:00Z", comments: 0,
  repository_url: "https://api.github.com/repos/a/b", html_url: "https://github.com/a/b/issues/1",
};
const forbidden = () => Response.json({ message: "You have exceeded a secondary rate limit." }, { status: 403 });
let calls;

function stubSite({ user, anonymous }) {
  calls = [];
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })));
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    const text = String(url);
    calls.push(text);
    if (text.startsWith("/api/me")) return Response.json({ signInAvailable: true, user, savedSync: false });
    if (text.startsWith("/api/github")) return forbidden();
    if (text.startsWith("https://api.github.com/search")) return anonymous();
    if (text.startsWith("/api/")) return Response.json({});
    return Response.json({});
  }));
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
});

describe("GitHub's burst limit on searches", () => {
  it("tries once more without the account, so results still show", async () => {
    stubSite({ user: { login: "me", name: "Me", avatarUrl: "" }, anonymous: () => Response.json({ total_count: 1, items: [item] }) });
    render(<App />);
    await screen.findByRole("heading", { name: "Fix the docs" });
    expect(calls.some((url) => url.startsWith("/api/github?path=%2Fsearch"))).toBe(true);
    expect(calls.some((url) => url.startsWith("https://api.github.com/search"))).toBe(true);
  });

  it("waits and retries by itself instead of stopping with an error", async () => {
    stubSite({ user: null, anonymous: forbidden });
    // A different search from the test above, whose answer the app has cached.
    window.history.replaceState(null, "", "/?labels=good-first-issue&available=1&lang=Go");
    render(<App />);
    await screen.findByText("GitHub needs a short break.", {}, { timeout: 3000 });
    expect(screen.queryByText(/didn't allow this search/)).toBeNull();
  });
});
