// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App.jsx";

const GUEST_KEY = "opensource-radar-saved-_signed-out";
const item = (id) => ({
  id,
  number: id,
  title: `Issue ${id}`,
  body: "Details",
  labels: [{ name: "good first issue" }],
  user: { login: "author" },
  created_at: "2026-11-01T00:00:00Z",
  repository_url: "https://api.github.com/repos/a/b",
  html_url: `https://github.com/a/b/issues/${id}`,
  updated_at: "2026-11-02T00:00:00Z",
  comments: 0,
});
const saved = (id, savedAt = id) => ({
  id,
  title: `Issue ${id}`,
  description: "Details",
  labels: ["good first issue"],
  label: "good first issue",
  language: "",
  repo: "a / b",
  url: `https://github.com/a/b/issues/${id}`,
  updatedAt: "2026-11-02T00:00:00Z",
  savedAt,
});
const USER = { login: "me", name: "Me", avatarUrl: "https://x.test/a.png" };

let remote;
let putCalls;
function stubSite({ user = null, savedSync = true, putFails = false } = {}) {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })));
  window.scrollTo = () => {};
  // Real browsers have this; the test browser doesn't.
  Element.prototype.scrollIntoView = () => {};
  putCalls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init = {}) => {
      const text = String(url);
      if (text.startsWith("/api/me")) {
        return Response.json({ signInAvailable: true, user, savedSync, devAgents: false });
      }
      if (text.startsWith("/api/saved")) {
        if (init.method === "PUT") {
          putCalls.push(JSON.parse(init.body).items);
          if (putFails) return new Response("{}", { status: 500 });
          remote = JSON.parse(init.body).items;
          return Response.json({ items: remote });
        }
        return Response.json({ items: remote });
      }
      if (text.startsWith("/api/repos")) return Response.json({ repos: {} });
      if (text.startsWith("/auth/logout")) return new Response(null, { status: 204 });
      return Response.json({ total_count: 2, items: [item(1), item(2)] });
    }),
  );
}
const guestSaves = () => JSON.parse(localStorage.getItem(GUEST_KEY) ?? "[]");
const openMenu = async () => {
  fireEvent.click(await screen.findByRole("button", { name: /open menu/i }));
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  remote = [];
  window.history.pushState(null, "", "/");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("saving while signed out", () => {
  it("shows a Save button on every card, and saves to this browser", async () => {
    stubSite();
    render(<App />);
    const first = await screen.findByRole("button", { name: 'Save "Issue 1"' }, { timeout: 3000 });
    expect(screen.getByRole("button", { name: 'Save "Issue 2"' })).toBeTruthy();
    fireEvent.click(first);
    fireEvent.click(screen.getByRole("button", { name: 'Save "Issue 2"' }));
    expect(guestSaves().map((issue) => issue.id).sort()).toEqual([1, 2]);
    expect(screen.getByRole("button", { name: 'Remove "Issue 1" from saved' })).toBeTruthy();
  });

  it("shows Saved issues with a count in the menu and footer", async () => {
    localStorage.setItem(GUEST_KEY, JSON.stringify([saved(1), saved(2)]));
    stubSite();
    render(<App />);
    await openMenu();
    const entry = await screen.findByRole("menuitem", { name: /saved issues/i });
    expect(within(entry).getByText("2")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Saved issues" }).length).toBeGreaterThan(0);
  });

  it("keeps saves after a reload, and lists them with a sign-in prompt", async () => {
    stubSite();
    const { unmount } = render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: 'Save "Issue 1"' }, { timeout: 3000 }));
    fireEvent.click(screen.getByRole("button", { name: 'Save "Issue 2"' }));
    unmount();
    render(<App />);
    await openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: /saved issues/i }));
    await screen.findByRole("heading", { name: "Saved issues" });
    expect(screen.getByRole("heading", { name: "Issue 1" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Issue 2" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /sign in to sync across devices/i }).getAttribute("href")).toBe("/auth/login");
  });

  it("keeps both saves when two happen before the page updates", async () => {
    stubSite();
    render(<App />);
    const first = await screen.findByRole("button", { name: 'Save "Issue 1"' }, { timeout: 3000 });
    const second = screen.getByRole("button", { name: 'Save "Issue 2"' });
    act(() => {
      first.click();
      second.click();
    });
    expect(guestSaves().map((issue) => issue.id).sort()).toEqual([1, 2]);
  });

  it("can remove a save while signed out", async () => {
    localStorage.setItem(GUEST_KEY, JSON.stringify([saved(1)]));
    stubSite();
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: 'Remove "Issue 1" from saved' }, { timeout: 3000 }));
    expect(guestSaves()).toEqual([]);
  });

  it("works when the browser blocks storage", async () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    stubSite();
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: 'Save "Issue 1"' }, { timeout: 3000 }));
    expect(screen.getByRole("button", { name: 'Remove "Issue 1" from saved' })).toBeTruthy();
    spy.mockRestore();
  });
});

describe("signing in with saves from this browser", () => {
  it("merges them into the account without duplicates, then clears the browser copy", async () => {
    localStorage.setItem(GUEST_KEY, JSON.stringify([saved(1, 10), saved(2, 20)]));
    remote = [saved(2, 5), saved(3, 30)];
    stubSite({ user: USER });
    render(<App />);
    await waitFor(() => expect(putCalls.length).toBe(1));
    expect(putCalls[0].map((issue) => issue.id).sort()).toEqual([1, 2, 3]);
    await waitFor(() => expect(localStorage.getItem(GUEST_KEY)).toBeNull());
    await openMenu();
    const entry = await screen.findByRole("menuitem", { name: /saved issues/i });
    expect(within(entry).getByText("3")).toBeTruthy();
  });

  it("keeps the browser copy if syncing fails", async () => {
    localStorage.setItem(GUEST_KEY, JSON.stringify([saved(1)]));
    remote = [saved(3)];
    stubSite({ user: USER, putFails: true });
    render(<App />);
    await waitFor(() => expect(putCalls.length).toBe(1));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(guestSaves().map((issue) => issue.id)).toEqual([1]);
  });

  it("merges them into this browser's account list when sync isn't set up", async () => {
    localStorage.setItem(GUEST_KEY, JSON.stringify([saved(1)]));
    localStorage.setItem("opensource-radar-saved-me", JSON.stringify([saved(1), saved(4)]));
    stubSite({ user: USER, savedSync: false });
    render(<App />);
    await waitFor(() => expect(localStorage.getItem(GUEST_KEY)).toBeNull());
    const account = JSON.parse(localStorage.getItem("opensource-radar-saved-me"));
    expect(account.map((issue) => issue.id).sort()).toEqual([1, 4]);
  });

  it("doesn't change anything for people with no browser saves", async () => {
    remote = [saved(3)];
    stubSite({ user: USER });
    render(<App />);
    await openMenu();
    await screen.findByRole("menuitem", { name: /saved issues/i });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(putCalls).toEqual([]);
  });
});
