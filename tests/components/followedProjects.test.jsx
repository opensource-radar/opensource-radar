// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FollowedProjects from "../../src/components/FollowedProjects";

const item = (id, title, created) => ({
  id,
  number: id,
  title,
  body: "",
  labels: [{ name: "good first issue" }],
  repository_url: "https://api.github.com/repos/a/b",
  html_url: `https://github.com/a/b/issues/${id}`,
  created_at: created,
  updated_at: created,
  comments: 0,
  user: { login: "octocat" },
});

const props = (extra = {}) => ({
  repos: ["a/b"],
  lastVisit: "2026-11-10T00:00:00.000Z",
  signedIn: false,
  ready: true,
  onUnfollow: vi.fn(),
  onSeen: vi.fn(),
  onOpenHelp: vi.fn(),
  ...extra,
});

describe("FollowedProjects", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("lists recent issues and marks the ones opened since the last visit", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ items: [item(2, "Newer issue", "2026-11-15T00:00:00Z"), item(1, "Older issue", "2026-11-01T00:00:00Z")] }),
    })));
    const p = props();
    render(<FollowedProjects {...p} />);
    expect(await screen.findByText("Newer issue")).toBeTruthy();
    expect(screen.getByText("1 new since your last visit")).toBeTruthy();
    expect(screen.getAllByText("New")).toHaveLength(1);
    expect(screen.getByText("Newer issue").getAttribute("href")).toBe("/help/a/b/2");
    await waitFor(() => expect(p.onSeen).toHaveBeenCalledTimes(1));
  });

  it("waits until the account check is done before searching", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<FollowedProjects {...props({ ready: false })} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Checking your projects…")).toBeTruthy();
  });

  it("says so when there's nothing new, and when GitHub can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ items: [] }) })));
    render(<FollowedProjects {...props()} />);
    expect(await screen.findByText(/No new beginner issues/)).toBeTruthy();
    cleanup();
    sessionStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    render(<FollowedProjects {...props()} />);
    expect(await screen.findByText(/Couldn.t check your projects/)).toBeTruthy();
  });

  it("reuses a recent answer instead of searching again", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ items: [item(3, "Cached issue", "2026-11-15T00:00:00Z")] }) }));
    vi.stubGlobal("fetch", fetchMock);
    render(<FollowedProjects {...props()} />);
    await screen.findByText("Cached issue");
    cleanup();
    render(<FollowedProjects {...props()} />);
    expect(screen.getByText("Cached issue")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("opens the help page in place and unfollows from the chip", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ items: [item(4, "Help me", "2026-11-15T00:00:00Z")] }) })));
    const p = props();
    render(<FollowedProjects {...p} />);
    fireEvent.click(await screen.findByText("Help me"));
    expect(p.onOpenHelp).toHaveBeenCalledWith(expect.objectContaining({ number: 4, repo: "a / b" }));
    fireEvent.click(screen.getByRole("button", { name: "Stop following a/b" }));
    expect(p.onUnfollow).toHaveBeenCalledWith("a/b");
  });
});
