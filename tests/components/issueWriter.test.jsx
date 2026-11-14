// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import IssueWriter from "../../src/components/IssueWriter.jsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const write = (idea) => {
  fireEvent.change(screen.getByLabelText("Your idea"), { target: { value: idea } });
  fireEvent.click(screen.getByRole("button", { name: "Write the issue" }));
};

describe("IssueWriter", () => {
  it("shows the draft as plain text, with the text checks", async () => {
    const body =
      "## What's wrong\\nThe search box keeps its text after pressing Escape, which is confusing when you want to start a new search quickly.\\n## Where to look\\n`src/components/SearchBar.jsx`\\n## Expected\\nEscape clears the box.";
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ title: "Clear search on Escape", body: JSON.parse(`"${body}"`) })));
    const { container } = render(<IssueWriter />);
    write("Search should clear on Escape");
    await screen.findByRole("heading", { name: "Clear search on Escape" });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ idea: "Search should clear on Escape" });
    expect(container.querySelector("pre").textContent).toContain("## Expected");
    expect(container.querySelectorAll(".issuecheck-list .is-passed")).toHaveLength(4);
  });

  it("says why it couldn't write one", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "rate_limited" }, { status: 429 })));
    render(<IssueWriter />);
    write("Search should clear on Escape");
    expect((await screen.findByRole("alert")).textContent).toMatch(/Too many drafts/);
  });
});
