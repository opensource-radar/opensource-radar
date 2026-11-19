// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GitLabResults from "../../src/components/GitLabResults.jsx";

const issue = {
  id: -5,
  source: "gitlab",
  title: "Add a --json flag",
  description: "Details",
  label: "quick win",
  language: "Go",
  repo: "gitlab-org / cli",
  url: "https://gitlab.com/gitlab-org/cli/-/issues/1005",
  comments: 1,
  number: 1005,
  author: "jane.doe",
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-10T00:00:00Z",
};

describe("GitLabResults", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("asks for the language and words, and shows GitLab issue cards", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ issues: [issue] }) }));
    vi.stubGlobal("fetch", fetchMock);
    const onToggleSave = vi.fn();
    render(<GitLabResults language="Go" text="json" savedIds={new Set()} onToggleSave={onToggleSave} />);
    expect(screen.getByText("Searching GitLab…")).toBeTruthy();
    expect(await screen.findByText("Add a --json flag")).toBeTruthy();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/gitlab?language=Go&q=json");
    expect(screen.getByText("GitLab")).toBeTruthy();
    expect(screen.getByRole("link", { name: "jane.doe" }).getAttribute("href")).toBe("https://gitlab.com/jane.doe");
    fireEvent.click(screen.getByRole("button", { name: 'Save "Add a --json flag"' }));
    expect(onToggleSave).toHaveBeenCalledWith(issue);
  });

  it("says when nothing matches, and when GitLab can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ issues: [] }) })));
    render(<GitLabResults language="Rust" text="" savedIds={new Set()} onToggleSave={() => {}} />);
    expect(await screen.findByText(/No GitLab issues match in Rust/)).toBeTruthy();
    cleanup();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    render(<GitLabResults language="" text="" savedIds={new Set()} onToggleSave={() => {}} />);
    expect(await screen.findByText(/Couldn.t reach GitLab/)).toBeTruthy();
  });
});
