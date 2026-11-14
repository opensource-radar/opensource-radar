// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AfterPr from "../../src/devagents/sections/AfterPr.jsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Write a thank-you", () => {
  it("drafts a note to copy, and links to the pull request to post it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: { merged: true, mergedBy: "m", note: "Thanks for merging this!" } })));
    render(<AfterPr issue={{ repo: "a/b", issue: 1 }} language="" shared={{}} />);
    fireEvent.change(screen.getByLabelText(/pull request number or link/i), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Write a thank-you" }));
    await screen.findByText("Thanks for merging this!");
    expect(fetch.mock.calls[0][0]).toContain("thank-you");
    expect(screen.getByRole("link", { name: /Open your pull request/ }).getAttribute("href")).toBe("https://github.com/a/b/pull/9");
  });

  it("says to come back after the merge", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: { merged: false } })));
    render(<AfterPr issue={{ repo: "a/b", issue: 1 }} language="" shared={{}} />);
    fireEvent.change(screen.getByLabelText(/pull request number or link/i), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Write a thank-you" }));
    await screen.findByText(/isn’t merged yet/);
  });
});
