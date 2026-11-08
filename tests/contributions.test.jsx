// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ContributionsDialog from "../src/components/ContributionsDialog.jsx";

const NOTE = "This PR was prepared with AI assistance from DevAgents; the changes were made and reviewed by me.";
const pr = (id, extra) => ({
  id,
  number: id,
  title: `PR ${id}`,
  html_url: `https://github.com/a/b/pull/${id}`,
  repository_url: "https://api.github.com/repos/a/b",
  updated_at: "2026-11-01T00:00:00Z",
  state: "open",
  body: "",
  pull_request: { merged_at: null },
  ...extra,
});
const radarMerged = pr(1, { title: "Radar merged", state: "closed", body: NOTE, pull_request: { merged_at: "2026-11-02T00:00:00Z" } });
const radarOpen = pr(2, { title: "Radar open", body: NOTE });
const otherMerged = pr(3, { title: "Other merged", state: "closed", pull_request: { merged_at: "2026-10-01T00:00:00Z" } });

function stub(items) {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ total_count: items.length, items })));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("My contributions", () => {
  it("marks PRs made with Radar, and shows their merge rate", async () => {
    stub([radarMerged, radarOpen, otherMerged]);
    render(<ContributionsDialog login="me" onClose={() => {}} />);
    await screen.findByText("Radar merged");
    expect(screen.getAllByText("Made with Radar")).toHaveLength(2);
    expect(screen.getByText(/2 made with Radar, 1 merged \(50%\)/)).toBeTruthy();
  });

  it("can show only the PRs made with Radar", async () => {
    stub([radarMerged, radarOpen, otherMerged]);
    render(<ContributionsDialog login="me" onClose={() => {}} />);
    await screen.findByText("Other merged");
    fireEvent.click(screen.getByLabelText(/only show prs made with radar/i));
    expect(screen.queryByText("Other merged")).toBeNull();
    expect(screen.getByText("Radar merged")).toBeTruthy();
  });

  it("has no Radar summary when none were made with Radar", async () => {
    stub([otherMerged]);
    render(<ContributionsDialog login="me" onClose={() => {}} />);
    await screen.findByText("Other merged");
    expect(screen.queryByText(/made with Radar/i)).toBeNull();
    expect(screen.queryByLabelText(/only show prs made with radar/i)).toBeNull();
  });

  it("offers Share only on merged PRs", async () => {
    stub([radarMerged, radarOpen, otherMerged]);
    render(<ContributionsDialog login="me" onClose={() => {}} />);
    await screen.findByText("Radar merged");
    expect(screen.getAllByRole("button", { name: /^share/i })).toHaveLength(2);
    const openItem = screen.getByText("Radar open").closest("li");
    expect(within(openItem).queryByRole("button", { name: /^share/i })).toBeNull();
  });

  it("opens a share card with download and post options", async () => {
    stub([radarMerged]);
    render(<ContributionsDialog login="me" onClose={() => {}} />);
    await screen.findByText("Radar merged");
    fireEvent.click(screen.getByRole("button", { name: /share "radar merged"/i }));
    expect(screen.getByText("My first open-source pull request was merged")).toBeTruthy();
    expect(screen.getByRole("link", { name: /post on x/i }).getAttribute("href")).toContain("x.com/intent/post");
    expect(screen.getByRole("link", { name: /share on linkedin/i }).getAttribute("href")).toContain("linkedin.com");
    expect(screen.getByRole("button", { name: /copy text/i }).className).toContain("secondary-button");
  });

  it("only says 'first' when the whole history has one merge", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ total_count: 40, items: [radarMerged] })));
    render(<ContributionsDialog login="me" onClose={() => {}} />);
    await screen.findByText("Radar merged");
    fireEvent.click(screen.getByRole("button", { name: /share "radar merged"/i }));
    expect(screen.getByText("My open-source pull request was merged")).toBeTruthy();
  });

  it("works where the browser has no dialog support", async () => {
    stub([]);
    render(<ContributionsDialog login="me" onClose={() => {}} />);
    await screen.findByText(/haven.t opened a pull request yet/i);
  });
});
