// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App.jsx";

const issueItem = {
  id: 1,
  number: 7,
  title: "A real issue",
  body: "Details",
  html_url: "https://github.com/a/b/issues/7",
  repository_url: "https://api.github.com/repos/a/b",
  comments: 0,
  updated_at: "2026-11-01T00:00:00Z",
  labels: [{ name: "good first issue" }],
  user: { login: "x" },
};
const USER = { login: "octocat", name: "Octocat", avatarUrl: "https://avatars.githubusercontent.com/u/1" };

const BACKEND = {
  500: async () => new Response("", { status: 500 }),
  hang: (_url, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new Error("aborted")));
    }),
  "network error": async () => {
    throw new TypeError("Failed to fetch");
  },
  "non-JSON": async () => new Response("<html>gateway error</html>"),
  "wrong shape": async () => Response.json({ surprise: [1, 2, 3] }),
  429: async () => Response.json({ error: "limit" }, { status: 429 }),
  503: async () => Response.json({ error: "unavailable" }, { status: 503 }),
};

function stubSite(devAgents, backend = BACKEND[503]) {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })));
  window.scrollTo = () => {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init) => {
      const text = String(url);
      if (text.startsWith("/api/devagents")) return backend(text, init);
      if (text.startsWith("/api/me")) {
        return Response.json({ signInAvailable: true, user: USER, devAgents });
      }
      if (text.startsWith("/api/repos")) return Response.json({ repos: {} });
      if (text.startsWith("/api/saved")) return Response.json({ issues: [] });
      return Response.json({ total_count: 1, items: [issueItem] });
    }),
  );
}

const devAgentsCalls = () =>
  fetch.mock.calls.filter(([url]) => String(url).startsWith("/api/devagents"));

beforeEach(() => {
  sessionStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  // Runs the browser's 30-second limit quickly, so a hung backend can be tested.
  const realSetTimeout = globalThis.setTimeout;
  vi.spyOn(globalThis, "setTimeout").mockImplementation((fn, ms, ...rest) =>
    realSetTimeout(fn, ms === 30000 ? 20 : ms, ...rest),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("failure drill", () => {
  it.each(Object.keys(BACKEND))(
    "with the backend giving %s, the issue card stays and the panel still helps",
    async (mode) => {
      stubSite(true, BACKEND[mode]);
      render(<App />);
      fireEvent.click(await screen.findByRole("link", { name: /get help/i }, { timeout: 3000 }));
      fireEvent.click(await screen.findByRole("button", { name: "Explain this issue" }, { timeout: 3000 }));

      await waitFor(
        () => {
          const help =
            mode === "429"
              ? screen.getAllByText(/today's free limit/i)
              : screen.getAllByRole("link", { name: /read the issue/i });
          expect(help.length).toBeGreaterThan(0);
        },
        { timeout: 3000 },
      );
      expect(screen.getByRole("heading", { level: 1, name: "A real issue" })).toBeTruthy();
      expect(screen.getByRole("heading", { level: 2, name: "Understand" })).toBeTruthy();
      window.history.pushState(null, "", "/");
    },
  );

  it("with the switch off, no DevAgents request is sent and nothing shows", async () => {
    stubSite(false);
    render(<App />);
    await screen.findByText("A real issue", {}, { timeout: 3000 });
    expect(screen.queryByRole("link", { name: /get help/i })).toBeNull();
    expect(devAgentsCalls()).toHaveLength(0);
  });

  it("opening the page sends no DevAgents request, even with the switch on", async () => {
    stubSite(true);
    render(<App />);
    await screen.findByRole("link", { name: /get help/i }, { timeout: 3000 });
    expect(devAgentsCalls()).toHaveLength(0);
  });
});
