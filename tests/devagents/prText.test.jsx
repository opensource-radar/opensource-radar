// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Check from "../../src/devagents/sections/Check.jsx";
import Submit from "../../src/devagents/sections/Submit.jsx";

const issue = { repo: "a/b", issue: 7, title: "T" };
const reply = (data) => vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data })));
const prData = (body) => ({ title: "fix: x", body, baseBranch: "main", headOwner: "me", branch: "p" });

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const writeIt = async () => {
  render(<Submit issue={issue} shared={{ change: "p" }} />);
  fireEvent.click(screen.getByRole("button", { name: "Write the PR text" }));
  return screen.findByRole("link", { name: /open the pull request page/i });
};

describe("Submit", () => {
  it("opens GitHub's own page, filled in", async () => {
    reply(prData("Fixes #7"));
    const link = await writeIt();
    const url = new URL(link.href);
    expect(url.host).toBe("github.com");
    expect(url.pathname).toBe("/a/b/compare/main...me:p");
    expect(url.searchParams.get("body")).toBe("Fixes #7");
    expect(screen.getByText(/until you click/i)).toBeTruthy();
  });

  it("shows Copy buttons when the body doesn't fit in the link", async () => {
    reply(prData("x".repeat(9000)));
    await writeIt();
    expect(screen.getByText(/too long to fill in/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy description" })).toBeTruthy();
  });

  it("says to write it yourself when the project bans AI", async () => {
    reply({ ...prData("Fixes #7"), title: "" });
    await writeIt();
    expect(screen.getByText(/write the title and description yourself/i)).toBeTruthy();
  });
});

describe("Check", () => {
  const data = {
    facts: { filesChanged: 2, additions: 3, deletions: 1, touchesUnrelatedFiles: true, summarised: true },
    findings: [{ path: "x.py", note: "<b>Rename</b> this" }],
    rules: [{ id: "cla", label: "Sign the CLA" }],
  };

  it("shows what it found, as text, and says it can miss things", async () => {
    reply(data);
    const onShare = vi.fn();
    const { container } = render(<Check issue={issue} shared={{}} onShare={onShare} />);
    fireEvent.change(screen.getByLabelText(/your branch name or link/i), { target: { value: "p" } });
    fireEvent.click(screen.getByRole("button", { name: "Check my change" }));
    await screen.findByText(/Rename/);
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByText(/can miss things/i)).toBeTruthy();
    expect(screen.getByText(/files outside/i)).toBeTruthy();
    expect(screen.getByText("Sign the CLA")).toBeTruthy();
    expect(onShare).toHaveBeenCalledWith({ change: "p" });
  });

  it("explains when the change can't be found", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "not_found" }, { status: 404 })));
    render(<Check issue={issue} shared={{}} onShare={() => {}} />);
    fireEvent.change(screen.getByLabelText(/your branch name or link/i), { target: { value: "p" } });
    fireEvent.click(screen.getByRole("button", { name: "Check my change" }));
    await screen.findByText(/couldn't find that change yet/i);
  });
});
