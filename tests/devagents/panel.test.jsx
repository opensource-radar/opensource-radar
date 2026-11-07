// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App.jsx";
import DevAgentsEntry from "../../src/devagents/DevAgentsEntry.jsx";
import Panel from "../../src/devagents/Panel.jsx";
import { readPanelState, writePanelState } from "../../src/devagents/storage.js";
import { useAction } from "../../src/devagents/useAction.js";

const issue = { repo: "a/b", issue: 7, title: "Fix the thing" };

function Boom() {
  throw new Error("boom");
}

function Fetcher({ onRun }) {
  const action = useAction("explain", { repo: "a/b", issue: 7 }, "test-key");
  onRun?.(action);
  return (
    <div>
      <button type="button" onClick={() => action.run()}>Load</button>
      {action.data && <p>{action.data.text}</p>}
      {action.failure}
    </div>
  );
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    sessionStorage.clear();
  } catch {
    // Some tests replace it.
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("storage", () => {
  it("round-trips a value", () => {
    writePanelState("k", { a: 1 });
    expect(readPanelState("k")).toEqual({ a: 1 });
  });

  it("works when sessionStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => writePanelState("k", 1)).not.toThrow();
    expect(readPanelState("k")).toBeNull();
  });

  it("treats corrupted data as empty", () => {
    sessionStorage.setItem("devagents:k", "{bad");
    expect(readPanelState("k")).toBeNull();
  });
});

describe("Panel", () => {
  it("shows the issue and the six steps", () => {
    render(<Panel issue={issue} signedIn onClose={() => {}} />);
    expect(screen.getByText("Fix the thing")).toBeTruthy();
    for (const step of ["Understand", "Plan", "Change", "Check", "Submit", "After"]) {
      expect(screen.getByRole("heading", { name: step })).toBeTruthy();
    }
  });

  it("a thrown section shows its fallback and keeps the rest", () => {
    const sections = [
      { id: "one", title: "One", Component: Boom },
      { id: "two", title: "Two", Component: () => <p>still here</p> },
    ];
    render(<Panel issue={issue} signedIn sections={sections} onClose={() => {}} />);
    expect(screen.getByText("still here")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("asks signed-out visitors to sign in", () => {
    render(<Panel issue={issue} signedIn={false} onClose={() => {}} />);
    expect(screen.getByRole("link", { name: /sign in/i }).getAttribute("href")).toBe("/auth/login");
  });

  it("closes from its button", () => {
    const onClose = vi.fn();
    render(<Panel issue={issue} signedIn onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("useAction", () => {
  const reply = (body, status = 200) => Response.json(body, { status });

  it("sign_in shows 'Sign in again' and keeps existing content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(reply({ data: { text: "first answer" } }))
        .mockResolvedValueOnce(reply({ error: "sign_in" }, 401)),
    );
    render(<Fetcher />);
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    await screen.findByText("first answer");
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    await screen.findByRole("link", { name: "Sign in again" });
    expect(screen.getByText("first answer")).toBeTruthy();
  });

  it("other failures show manual steps with a Try again button", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ error: "unavailable" }, 503)));
    render(<Fetcher />);
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    await screen.findByRole("button", { name: "Try again" });
    expect(screen.getByRole("link", { name: /read the issue/i }).getAttribute("href")).toBe(
      "https://github.com/a/b/issues/7",
    );
  });

  it("a repeated click while loading sends one request", async () => {
    let finish;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise((resolve) => { finish = resolve; })),
    );
    render(<Fetcher />);
    const button = screen.getByRole("button", { name: "Load" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => finish(reply({ data: { text: "done" } })));
    await screen.findByText("done");
  });

  it("restores an earlier answer after a refresh", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ data: { text: "kept" } })));
    const { unmount } = render(<Fetcher />);
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    await screen.findByText("kept");
    unmount();
    render(<Fetcher />);
    expect(screen.getByText("kept")).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("Failure", () => {
  const failWith = async (error, status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply2({ error }, status)));
    render(<Fetcher />);
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
  };
  const reply2 = (body, status) => Response.json(body, { status });

  it("too_large explains itself and doesn't offer a pointless retry", async () => {
    await failWith("too_large", 413);
    await screen.findByText(/too long/i);
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("invalid_request explains itself and doesn't offer a pointless retry", async () => {
    await failWith("invalid_request", 400);
    await screen.findByText(/couldn't read that/i);
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});

describe("DevAgentsEntry", () => {
  it("doesn't load the panel until it's opened", async () => {
    const loadPanel = vi.fn(async () => ({ default: () => <p>panel loaded</p> }));
    render(<DevAgentsEntry issue={issue} signedIn loadPanel={loadPanel} />);
    expect(loadPanel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /get help/i }));
    await screen.findByText("panel loaded");
  });

  it("a failed load offers Try again and doesn't blank the page", async () => {
    const loadPanel = vi
      .fn()
      .mockRejectedValueOnce(new Error("chunk failed"))
      .mockResolvedValueOnce({ default: () => <p>panel loaded</p> });
    render(
      <div>
        <p>site</p>
        <DevAgentsEntry issue={issue} signedIn loadPanel={loadPanel} />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: /get help/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    await screen.findByText("panel loaded");
    expect(screen.getByText("site")).toBeTruthy();
  });
});

describe("App", () => {
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

  function stubSite(me) {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })),
    );
    window.scrollTo = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (String(url).startsWith("/api/me")) return Response.json(me);
        return Response.json({ total_count: 1, items: [issueItem] });
      }),
    );
  }

  const renderAndSearch = async () => {
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
  };

  it("doesn't show the entry when DevAgents is off", async () => {
    stubSite({ signInAvailable: true, user: null, devAgents: false });
    await renderAndSearch();
    await screen.findByText("A real issue", {}, { timeout: 3000 });
    expect(screen.queryByRole("button", { name: /get help/i })).toBeNull();
  });

  it("doesn't show the entry when /api/me fails", async () => {
    stubSite({});
    fetch.mockImplementation(async (url) =>
      String(url).startsWith("/api/me")
        ? new Response("oops", { status: 500 })
        : Response.json({ total_count: 1, items: [issueItem] }),
    );
    await renderAndSearch();
    await screen.findByText("A real issue", {}, { timeout: 3000 });
    expect(screen.queryByRole("button", { name: /get help/i })).toBeNull();
  });

  it("shows the entry on each card when DevAgents is on", async () => {
    stubSite({ signInAvailable: true, user: null, devAgents: true });
    await renderAndSearch();
    await screen.findByRole("button", { name: /get help/i }, { timeout: 3000 });
  });
});
