// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LabelHealth from "../../src/components/LabelHealth.jsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const item = (n, days) => ({ number: n, title: `Issue ${n}`, url: `https://github.com/a/b/issues/${n}`, days });
const stub = (body, status = 200) => vi.stubGlobal("fetch", vi.fn(async () => Response.json(body, { status })));

describe("LabelHealth", () => {
  it("lists the issues that need attention, with what to do", async () => {
    stub({ repo: "a/b", total: 9, checked: 9, stale: [item(1, 120)], waiting: [item(2, 10)], idleAssigned: [item(3, 45)] });
    render(<LabelHealth repo="a/b" />);
    await screen.findByText("3 of 9 could use some attention.");
    expect(fetch.mock.calls[0][0]).toBe("/api/label-health?repo=a%2Fb");
    expect(screen.getByRole("heading", { name: "Assigned, but quiet (1)" })).toBeTruthy();
    expect(screen.getByText("· assigned 45 days ago")).toBeTruthy();
    expect(screen.getByRole("link", { name: "#1 Issue 1" }).getAttribute("href")).toBe("https://github.com/a/b/issues/1");
  });

  it("says when everything is healthy, or there are no good first issues", async () => {
    stub({ repo: "a/b", total: 4, checked: 4, stale: [], waiting: [], idleAssigned: [] });
    const { unmount } = render(<LabelHealth repo="a/b" />);
    await screen.findByText("All 4 look healthy. 🎉");
    unmount();
    stub({ repo: "a/b", total: 0, checked: 0, stale: [], waiting: [], idleAssigned: [] });
    render(<LabelHealth repo="a/b" />);
    await screen.findByText(/no open issues labelled/);
  });

  it("shows a short message instead of breaking on a bad answer", async () => {
    stub({ unexpected: true });
    render(<LabelHealth repo="a/b" />);
    await screen.findByText(/Couldn’t check your good first issues/);
  });
});
