// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HelpPage from "../../src/devagents/HelpPage.jsx";

const details = {
  issue: {
    number: 24,
    title: "Respect reduced motion",
    body: "Please respect the setting. <img src=x onerror=alert(1)>",
    bodyTruncated: true,
    labels: ["good first issue", "accessibility"],
    author: "octocat",
    createdAt: "2026-11-01T10:00:00Z",
    updatedAt: "2026-11-05T10:00:00Z",
    state: "open",
    comments: 3,
    url: "https://github.com/a/b/issues/24",
  },
  repo: { stars: 1234, language: "JavaScript", archived: false, contributingUrl: "https://github.com/a/b/blob/main/CONTRIBUTING.md" },
  setupHint: { heading: "Getting started", text: "npm install" },
};
const shown = (date) =>
  new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(date));

function stub(response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => {
      if (String(url).startsWith("/api/issue")) return response();
      return Response.json({ error: "unavailable" }, { status: 503 });
    }),
  );
}

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const page = (signedIn = false) =>
  render(<HelpPage issue={{ repo: "a/b", issue: 24 }} signedIn={signedIn} onBack={() => {}} />);

describe("issue details on the help page", () => {
  it("shows the issue to signed-out visitors: title, body, labels, author and dates", async () => {
    stub(() => Response.json(details));
    page(false);
    await screen.findByRole("heading", { level: 1, name: "Respect reduced motion" });
    expect(screen.getByText(/Please respect the setting/)).toBeTruthy();
    expect(screen.getByText("good first issue")).toBeTruthy();
    expect(screen.getByText("accessibility")).toBeTruthy();
    expect(screen.getByRole("link", { name: "octocat" }).getAttribute("href")).toBe("https://github.com/octocat");
    expect(screen.getByText(new RegExp(`Opened on ${shown(details.issue.createdAt)}`))).toBeTruthy();
    expect(screen.getByText(new RegExp(`updated ${shown(details.issue.updatedAt)}`))).toBeTruthy();
  });

  it("asks the server, not GitHub directly, for the details", async () => {
    stub(() => Response.json(details));
    page(false);
    await screen.findByText(/Please respect the setting/);
    const [url] = fetch.mock.calls.find(([u]) => String(u).startsWith("/api/issue"));
    expect(url).toBe("/api/issue?repo=a%2Fb&issue=24");
    expect(fetch.mock.calls.some(([u]) => String(u).includes("api.github.com"))).toBe(false);
  });

  it("links to the rest of a long description", async () => {
    stub(() => Response.json(details));
    page(false);
    expect((await screen.findByRole("link", { name: /read the rest on github/i })).getAttribute("href")).toBe(
      "https://github.com/a/b/issues/24",
    );
  });

  it("shows the project's stars, language, contributing guide and setup hint", async () => {
    stub(() => Response.json(details));
    page(false);
    await screen.findByText(/1,234 stars|1.234 stars|1234 stars/);
    expect(screen.getByText("JavaScript")).toBeTruthy();
    expect(screen.getByRole("link", { name: /^Contributing guide/ }).getAttribute("href")).toBe(details.repo.contributingUrl);
    expect(screen.getByText("npm install")).toBeTruthy();
    expect(screen.getByText(/getting started/i)).toBeTruthy();
  });

  it("keeps the sign-in prompt for AI help only", async () => {
    stub(() => Response.json(details));
    page(false);
    await screen.findByText(/Please respect the setting/);
    expect(screen.getByText(/to get AI help with this issue/i)).toBeTruthy();
  });

  it("shows the details above the six steps when signed in", async () => {
    stub(() => Response.json(details));
    page(true);
    await screen.findByText(/Please respect the setting/);
    expect(screen.getByRole("heading", { level: 2, name: "Understand" })).toBeTruthy();
  });

  it("renders text from GitHub as plain text", async () => {
    stub(() => Response.json(details));
    const { container } = page(false);
    await screen.findByText(/Please respect the setting/);
    expect(container.querySelector("img")).toBeNull();
  });

  it("says when the issue can't be found", async () => {
    stub(() => Response.json({ error: "not_found" }, { status: 404 }));
    page(false);
    await screen.findByText(/couldn't find this issue on GitHub/i);
  });

  it("says when details can't load, and still offers the GitHub link", async () => {
    stub(() => Response.json({ error: "unavailable" }, { status: 503 }));
    page(false);
    await screen.findByText(/couldn't load this issue's details/i);
    expect(screen.getAllByRole("link", { name: /view issue/i }).length).toBeGreaterThan(0);
  });

  it("copes with an odd response", async () => {
    stub(() => Response.json({ surprise: true }));
    page(false);
    await screen.findByText(/couldn't load this issue's details/i);
  });

  it("copes with missing project details and setup hint", async () => {
    stub(() => Response.json({ ...details, repo: null, setupHint: null }));
    page(false);
    await screen.findByText(/Please respect the setting/);
    expect(screen.queryByText(/stars/)).toBeNull();
  });
});
