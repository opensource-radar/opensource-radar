// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../../src/components/ProfilePage.jsx";
import ProfileSettings from "../../src/components/ProfileSettings.jsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.head.querySelectorAll('meta[name="robots"]').forEach((meta) => meta.remove());
});

const profile = {
  login: "sam", name: "Sam Rivera", avatarUrl: "https://avatars.example/sam", totalMerged: 2, indexable: false,
  pullRequests: [
    { title: "Fix docs", url: "https://github.com/a/b/pull/6", number: 6, repo: "a/b", mergedAt: "2026-11-08T09:00:00Z", madeWithRadar: true },
    { title: "Add test", url: "https://github.com/c/d/pull/2", number: 2, repo: "c/d", mergedAt: "2026-10-01T09:00:00Z", madeWithRadar: false },
  ],
};

describe("ProfilePage", () => {
  it("shows the person's merged pull requests, and hides the page from search engines by default", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ profile })));
    render(<ProfilePage login="sam" onBack={() => {}} />);
    await screen.findByRole("heading", { name: "Sam Rivera" });
    expect(screen.getByRole("link", { name: "Fix docs" }).getAttribute("href")).toBe("https://github.com/a/b/pull/6");
    // One "Made with Radar" pull request: counted in the stats and marked in the list.
    expect(document.querySelector(".profile-stats").textContent).toContain("1 made with Radar");
    expect(document.querySelectorAll(".pr-radar")).toHaveLength(1);
    expect(document.head.querySelector('meta[name="robots"]')?.content).toBe("noindex");
  });

  it("lets search engines list it when its owner chose that", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ profile: { ...profile, indexable: true } })));
    render(<ProfilePage login="sam" onBack={() => {}} />);
    await screen.findByRole("heading", { name: "Sam Rivera" });
    // While loading, the page stays hidden from search engines; it's only
    // allowed once the profile says so.
    await waitFor(() => expect(document.head.querySelector('meta[name="robots"]')).toBeNull());
  });

  it("says when a profile isn't public", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "not_public" }, { status: 404 })));
    render(<ProfilePage login="sam" onBack={() => {}} />);
    await screen.findByText("This profile isn't public.");
  });
});

describe("ProfileSettings", () => {
  it("is off until turned on, then shows the link and the search option", async () => {
    const calls = [];
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      calls.push({ url, body: init?.body });
      if (init?.method === "POST") return Response.json({ login: "sam", ...JSON.parse(init.body) });
      return Response.json({ login: "sam", enabled: false, indexable: false });
    }));
    render(<ProfileSettings login="sam" />);
    const toggle = await screen.findByLabelText("Show my merged pull requests on a public page");
    expect(toggle.checked).toBe(false);
    expect(screen.queryByLabelText("Let search engines list it")).toBeNull();

    fireEvent.click(toggle);
    await screen.findByLabelText("Let search engines list it");
    expect(JSON.parse(calls.at(-1).body)).toEqual({ enabled: true, indexable: false });
    expect(screen.getByRole("link", { name: "opensource-radar.com/u/sam" }).getAttribute("href")).toBe("/u/sam");
  });

  it("stays hidden when saving isn't available", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "unavailable" }, { status: 503 })));
    const { container } = render(<ProfileSettings login="sam" />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });
});
