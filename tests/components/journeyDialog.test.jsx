// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import JourneyDialog from "../../src/components/JourneyDialog.jsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const saved = [
  { id: 1, number: 5, repo: "a / b", title: "Fix the docs", url: "https://github.com/a/b/issues/5" },
  { id: 2, number: 9, repo: "c / d", title: "Add a test", url: "https://github.com/c/d/issues/9" },
  { id: 3, number: 2, repo: "e / f", title: "Gone issue", url: "https://github.com/e/f/issues/2" },
];

describe("My journey", () => {
  it("shows each saved issue's stage and the user's pull request", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      journey: {
        "a/b#5": { stage: "merged", issueClosed: true, pullRequest: { url: "https://github.com/a/b/pull/6", number: 6, state: "MERGED" } },
        "c/d#9": { stage: "claimed", issueClosed: false, pullRequest: null },
        "e/f#2": null,
      },
    })));
    render(<JourneyDialog savedIssues={saved} onClose={() => {}} />);

    await screen.findByText("1 of your saved issues is merged. 🎉");
    expect(fetch.mock.calls[0][0]).toBe(`/api/journey?issues=${encodeURIComponent("a/b#5,c/d#9,e/f#2")}`);
    expect(screen.getByRole("list", { name: "Stage: Merged" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Stage: Claimed" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Your pull request #6/ }).getAttribute("href")).toBe("https://github.com/a/b/pull/6");
    expect(screen.getByText(/Couldn’t find this issue/)).toBeTruthy();
  });

  it("explains what to do with no saved issues, without asking GitHub", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<JourneyDialog savedIssues={[]} onClose={() => {}} />);
    expect(screen.getByText(/Save an issue you'd like to work on/)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("says when GitHub can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 502 })));
    render(<JourneyDialog savedIssues={saved} onClose={() => {}} />);
    await screen.findByText(/Couldn’t check your saved issues/);
  });
});
