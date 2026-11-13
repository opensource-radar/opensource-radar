// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MaintainersPage from "../../src/components/MaintainersPage.jsx";
import { parseRepo } from "../../src/lib/badge.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const score = { level: "high", replyHours: 30, replyRate: 0.9, outsideMerged: 8, outsideClosed: 10, hasCi: true, hasContributing: true };

function stubFriendliness(body, status = 200) {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(body, { status })));
}

const check = (value) => {
  fireEvent.change(screen.getByLabelText("Your repository"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
};

describe("parseRepo", () => {
  it.each([
    ["octo/cat", "octo/cat"],
    ["  octo/cat  ", "octo/cat"],
    ["https://github.com/octo/cat", "octo/cat"],
    ["github.com/octo/cat.git", "octo/cat"],
    ["https://github.com/octo/cat/issues/3", "octo/cat"],
    ["not a repo", null],
    ["octo", null],
  ])("%s", (input, repo) => {
    expect(parseRepo(input)).toBe(repo);
  });
});

describe("For maintainers page", () => {
  it("checks a project and offers the README badge", async () => {
    stubFriendliness({ friendliness: { "octo/cat": score } });
    render(<MaintainersPage onBack={() => {}} />);
    check("https://github.com/octo/cat");

    await screen.findByRole("heading", { name: "octo/cat: Very beginner-friendly" });
    expect(fetch.mock.calls[0][0]).toBe("/api/friendliness?names=octo%2Fcat");
    expect(screen.getByText("8 of the last 10 pull requests from outside contributors were merged")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Good first issues on OpenSource Radar" }).getAttribute("src")).toBe(
      "https://opensource-radar.com/api/badge?repo=octo%2Fcat",
    );
    expect(screen.getByText(/\[!\[Good first issues on OpenSource Radar\]/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy Markdown" })).toBeTruthy();
  });

  it("explains input it can't read, without asking the server", () => {
    stubFriendliness({});
    render(<MaintainersPage onBack={() => {}} />);
    check("hello world");
    expect(screen.getByRole("alert").textContent).toMatch(/owner\/repo/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("says when the repository doesn't exist", async () => {
    stubFriendliness({ friendliness: { "octo/nope": null } });
    render(<MaintainersPage onBack={() => {}} />);
    check("octo/nope");
    expect((await screen.findByRole("alert")).textContent).toMatch(/couldn't find/);
  });

  it("says when checks are briefly limited", async () => {
    stubFriendliness({ friendliness: {}, error: "rate_limited" }, 429);
    render(<MaintainersPage onBack={() => {}} />);
    check("octo/cat");
    expect((await screen.findByRole("alert")).textContent).toMatch(/Too many checks/);
  });

  it("shows the questions maintainers ask", () => {
    render(<MaintainersPage onBack={() => {}} />);
    expect(screen.getByRole("heading", { name: "How does my project appear on OpenSource Radar?" })).toBeTruthy();
  });
});
