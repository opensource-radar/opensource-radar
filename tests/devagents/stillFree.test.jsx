// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StillFree from "../../src/devagents/StillFree.jsx";
import { checkedAgo } from "../../src/devagents/checkedAt.js";
import { writePanelState } from "../../src/devagents/storage.js";

const issue = { repo: "a/b", issue: 7 };
const answer = (data) => Response.json({ data: { checkedAt: new Date().toISOString(), ...data } });

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StillFree", () => {
  it("checks afresh even when an old answer was saved, and can check again", async () => {
    writePanelState("check:a/b#7", { verdict: "clear", reasons: [] });
    vi.stubGlobal("fetch", vi.fn(async () => answer({ verdict: "taken", reasons: ["Pull request #9 is already open for this issue."] })));
    render(<StillFree issue={issue} />);
    await screen.findByText("Check before you start");
    expect(screen.getByText("Pull request #9 is already open for this issue.")).toBeTruthy();
    expect(screen.getByText(/checked just now/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it("says it's still free, with any fresh comments to read", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => answer({ verdict: "clear", reasons: ["Not taken yet."], notes: ["Someone commented yesterday. Read it before you start."] })));
    render(<StillFree issue={issue} />);
    await screen.findByText("Still free");
    expect(screen.getByText(/Someone commented yesterday/)).toBeTruthy();
    expect(screen.queryByText("Not taken yet.")).toBeNull();
  });
});

describe("checkedAgo", () => {
  it("says how long ago, simply", () => {
    const now = Date.parse("2026-11-14T12:00:00Z");
    expect(checkedAgo("2026-11-14T11:59:40Z", now)).toBe("just now");
    expect(checkedAgo("2026-11-14T11:55:00Z", now)).toBe("5 minutes ago");
    expect(checkedAgo("2026-11-14T09:00:00Z", now)).toBe("3 hours ago");
    expect(checkedAgo("nonsense", now)).toBeNull();
  });
});
