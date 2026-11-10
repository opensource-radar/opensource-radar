// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Helpful from "../../src/devagents/Helpful.jsx";
import { nextIssueUrl } from "../../src/devagents/nextIssue.js";
import Next from "../../src/devagents/sections/Next.jsx";
import { stateFromUrl } from "../../src/lib/search.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const sent = () => JSON.parse(fetch.mock.calls.at(-1)[1].body);

describe("nextIssueUrl", () => {
  it("produces a URL Radar reads back with the language and label", () => {
    const url = nextIssueUrl("Python");
    expect(url.startsWith("/")).toBe(true);
    const { filters } = stateFromUrl(new URL(url, "https://x.test").search);
    expect(filters.language).toBe("Python");
    expect(filters.labels).toEqual(["help-wanted"]);
  });

  it("works with no language", () => {
    const { filters } = stateFromUrl(new URL(nextIssueUrl(""), "https://x.test").search);
    expect(filters.labels).toEqual(["help-wanted"]);
  });
});

describe("Next", () => {
  it("shows what was practised and links to the next issue", () => {
    render(<Next language="Python" shared={{ explain: {}, change: "p" }} />);
    expect(screen.getByText(/reading a new project/i)).toBeTruthy();
    expect(screen.getByText(/checking your own change/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /find your next issue/i }).getAttribute("href")).toContain("Python");
  });
});

describe("Helpful", () => {
  it("sends a vote, then says thanks", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: { saved: true } })));
    render(<Helpful action="hint" />);
    fireEvent.click(screen.getByRole("button", { name: "This helped" }));
    await screen.findByText(/thanks/i);
    expect(sent()).toEqual({ action: "hint", helpful: true });
  });

  it("asks why after a thumbs down, and sends the reason", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: { saved: true } })));
    render(<Helpful action="explain" />);
    fireEvent.click(screen.getByRole("button", { name: "This didn't help" }));
    fireEvent.click(await screen.findByRole("button", { name: "A file was wrong" }));
    await screen.findByText(/thanks/i);
    expect(sent()).toEqual({ action: "explain", helpful: false, reason: "wrong_file" });
  });

  it("says nothing bad when saving fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    render(<Helpful action="hint" />);
    fireEvent.click(screen.getByRole("button", { name: "This helped" }));
    await screen.findByText(/thanks/i);
  });
});
