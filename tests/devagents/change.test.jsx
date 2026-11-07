// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Change from "../../src/devagents/sections/Change.jsx";
import Plan from "../../src/devagents/sections/Plan.jsx";

const issue = { repo: "a/b", issue: 7, title: "T" };
const explain = { branch: "dev", filesToRead: [{ path: "src/a b.py", why: "x" }] };

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Change", () => {
  it("shows both links", () => {
    render(<Change issue={issue} shared={{ explain }} />);
    expect(screen.getByRole("link", { name: /edit src\/a b\.py in the browser/i }).getAttribute("href")).toBe(
      "https://github.com/a/b/edit/dev/src/a%20b.py",
    );
    expect(screen.getByRole("link", { name: /open in codespaces/i }).getAttribute("href")).toBe(
      "https://codespaces.new/a/b",
    );
    expect(screen.getByText(/your own GitHub allowance/i)).toBeTruthy();
  });

  it("tells people about GitHub's fork step", () => {
    render(<Change issue={issue} shared={{ explain }} />);
    expect(screen.getByText(/tap "Fork this repository"/i)).toBeTruthy();
  });

  it("still offers Codespaces before the issue is explained", () => {
    render(<Change issue={issue} shared={{}} />);
    expect(screen.getByRole("link", { name: /open in codespaces/i })).toBeTruthy();
    expect(screen.getByText(/explain this issue first/i)).toBeTruthy();
  });
});

describe("Plan", () => {
  const reply = (data) => Response.json({ data });

  it("shows hints one level at a time", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(reply({ hint: "First hint" }))
        .mockResolvedValueOnce(reply({ hint: "Second hint" })),
    );
    render(<Plan issue={issue} />);
    expect(screen.queryByRole("button", { name: "Show the next hint" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Give me a hint" }));
    await screen.findByText("First hint");
    expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Show the next hint" }));
    await screen.findByText("Second hint");
    expect(JSON.parse(fetch.mock.calls[1][1].body).level).toBe(2);
  });

  it("hides Copy draft without a draft", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ hint: "Only a hint" })));
    render(<Plan issue={issue} />);
    fireEvent.click(screen.getByRole("button", { name: "Give me a hint" }));
    await screen.findByText("Only a hint");
    expect(screen.queryByRole("button", { name: /copy draft/i })).toBeNull();
  });

  it("offers a draft at level 3", async () => {
    sessionStorage.setItem("devagents:hint:a/b#7:1", JSON.stringify({ hint: "one" }));
    sessionStorage.setItem("devagents:hint:a/b#7:2", JSON.stringify({ hint: "two" }));
    sessionStorage.setItem(
      "devagents:hint:a/b#7:3",
      JSON.stringify({ hint: "three", draft: { path: "x.py", kind: "docstring", text: "Adds." } }),
    );
    render(<Plan issue={issue} />);
    expect(screen.getByText("Adds.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /copy draft/i })).toBeTruthy();
  });
});
