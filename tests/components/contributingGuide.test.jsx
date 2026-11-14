// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import IssueCard from "../../src/components/IssueCard.jsx";

const project = { contributingUrl: "https://github.com/a/b/blob/main/CONTRIBUTING.md" };

function Card() {
  const [saved, setSaved] = useState(false);
  return (
    <IssueCard
      title="Fix the docs"
      number={12}
      label="good first issue"
      repo="a / b"
      url="https://github.com/a/b/issues/12"
      project={project}
      saved={saved}
      onToggleSave={() => setSaved((value) => !value)}
    />
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("# How to help\n\nRun `npm test` before you send a [pull request](docs/pr.md).\n\n<script>alert(1)</script>")));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("contributing guide from an issue card", () => {
  it("opens the guide on the site, with Save this issue", async () => {
    const { container } = render(<Card />);
    fireEvent.click(screen.getByRole("link", { name: "Contributing guide" }));
    await screen.findByRole("heading", { name: "How to help" });
    expect(fetch).toHaveBeenCalledWith("https://raw.githubusercontent.com/a/b/main/CONTRIBUTING.md");
    expect(screen.getByRole("link", { name: "pull request" }).getAttribute("href")).toBe("https://github.com/a/b/blob/main/docs/pr.md");
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText(/for #12 Fix the docs/)).toBeTruthy();

    const save = screen.getByRole("button", { name: "Save this issue" });
    fireEvent.click(save);
    expect(screen.getByRole("button", { name: "Saved" }).getAttribute("aria-pressed")).toBe("true");
    // The card's own bookmark shows it too.
    expect(screen.getByRole("button", { name: 'Remove "Fix the docs" from saved' })).toBeTruthy();
  });

  it("leaves Cmd/Ctrl-click to open GitHub in a new tab", () => {
    render(<Card />);
    fireEvent.click(screen.getByRole("link", { name: "Contributing guide" }), { metaKey: true });
    expect(screen.queryByText("Loading the guide…")).toBeNull();
  });

  it("offers GitHub when the guide can't load", async () => {
    fetch.mockImplementationOnce(async () => new Response("", { status: 404 }));
    render(<Card />);
    fireEvent.click(screen.getByRole("link", { name: "Contributing guide" }));
    await screen.findByText(/Couldn’t load the guide here/);
    expect(screen.getByRole("link", { name: /Read it on GitHub/ }).getAttribute("href")).toBe(project.contributingUrl);
  });
});
