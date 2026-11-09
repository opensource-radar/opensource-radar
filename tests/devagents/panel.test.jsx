// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App.jsx";
import DevAgentsEntry from "../../src/devagents/DevAgentsEntry.jsx";
import DevAgentsRoute from "../../src/devagents/DevAgentsRoute.jsx";
import HelpPage from "../../src/devagents/HelpPage.jsx";
import { OWN_KEY_SETTINGS_ID, clearOwnKey, setOwnKey } from "../../src/devagents/ownKey.js";
import { readPanelState, writePanelState } from "../../src/devagents/storage.js";
import { BUSY_RETRY_SECONDS, useAction } from "../../src/devagents/useAction.js";

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

// A busy helper first counts down to one automatic retry; this skips the wait.
const skipWait = async () =>
  fireEvent.click(await screen.findByRole("button", { name: "Don't wait" }));

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

describe("HelpPage", () => {
  const stepButton = (name) => screen.getByRole("button", { name: new RegExp(`^\\d?\\s*${name}$`) });

  it("shows the issue, a link to it, and all six steps", () => {
    render(<HelpPage issue={issue} signedIn onBack={() => {}} />);
    expect(screen.getByRole("heading", { level: 1, name: "Fix the thing" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /view issue/i }).getAttribute("href")).toBe("https://github.com/a/b/issues/7");
    for (const step of ["Understand", "Plan", "Change", "Check", "Submit", "After"]) {
      expect(stepButton(step)).toBeTruthy();
    }
  });

  it("shows one step at a time, starting with Understand", () => {
    render(<HelpPage issue={issue} signedIn onBack={() => {}} />);
    expect(screen.getByRole("heading", { level: 2, name: "Understand" })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 2, name: "Plan" })).toBeNull();
    expect(stepButton("Understand").getAttribute("aria-current")).toBe("step");
  });

  it("moves between steps from the list and the next button, and focuses the step", () => {
    render(<HelpPage issue={issue} signedIn onBack={() => {}} />);
    fireEvent.click(stepButton("Check"));
    const heading = screen.getByRole("heading", { level: 2, name: "Check" });
    expect(document.activeElement).toBe(heading);
    expect(stepButton("Check").getAttribute("aria-current")).toBe("step");
    fireEvent.click(screen.getByRole("button", { name: "Next: Submit" }));
    expect(screen.getByRole("heading", { level: 2, name: "Submit" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous: Check" }));
    expect(screen.getByRole("heading", { level: 2, name: "Check" })).toBeTruthy();
  });

  it("has no previous on the first step, and no next on the last", () => {
    render(<HelpPage issue={issue} signedIn onBack={() => {}} />);
    expect(screen.queryByRole("button", { name: /^Previous/ })).toBeNull();
    fireEvent.click(stepButton("After"));
    expect(screen.queryByRole("button", { name: /^Next/ })).toBeNull();
  });

  it("keeps what's typed in a step when moving away and back", () => {
    render(<HelpPage issue={issue} signedIn onBack={() => {}} />);
    fireEvent.click(stepButton("Check"));
    fireEvent.change(screen.getAllByLabelText(/your branch name or link/i)[0], { target: { value: "patch-1" } });
    fireEvent.click(stepButton("Plan"));
    fireEvent.click(stepButton("Check"));
    expect(screen.getAllByLabelText(/your branch name or link/i)[0].value).toBe("patch-1");
  });

  it("says that text goes to outside AI services, before anything is sent", () => {
    render(<HelpPage issue={issue} signedIn sections={[]} onBack={() => {}} />);
    expect(screen.getByText(/outside AI services/i)).toBeTruthy();
    expect(screen.getByText(/don't paste private details/i)).toBeTruthy();
  });

  it("tells signed-out visitors about outside AI services too", () => {
    render(<HelpPage issue={issue} signedIn={false} onBack={() => {}} />);
    expect(screen.getByText(/outside AI services/i)).toBeTruthy();
  });

  it("a thrown step shows its fallback and keeps the rest of the page", () => {
    const sections = [
      { id: "one", title: "One", intro: "x", Component: Boom },
      { id: "two", title: "Two", intro: "y", Component: () => <p>still here</p> },
    ];
    render(<HelpPage issue={issue} signedIn sections={sections} onBack={() => {}} />);
    expect(screen.getByText("still here")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Fix the thing" })).toBeTruthy();
  });

  it("asks signed-out visitors to sign in", () => {
    render(<HelpPage issue={issue} signedIn={false} onBack={() => {}} />);
    expect(screen.getByRole("link", { name: /sign in/i }).getAttribute("href")).toBe("/auth/login");
  });

  it("goes back from its link", () => {
    const onBack = vi.fn();
    render(<HelpPage issue={issue} signedIn onBack={onBack} />);
    fireEvent.click(screen.getByRole("link", { name: /back to search/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it("uses the issue's real title when opened directly from a link", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: { verdict: "clear", reasons: [], rules: [], title: "From GitHub" } })));
    render(<HelpPage issue={{ repo: "a/b", issue: 7 }} signedIn onBack={() => {}} />);
    expect(screen.getByRole("heading", { level: 1, name: "a/b #7" })).toBeTruthy();
    await screen.findByRole("heading", { level: 1, name: "From GitHub" });
  });

  it("isn't listed by search engines, and cleans up after itself", () => {
    const { unmount } = render(<HelpPage issue={issue} signedIn onBack={() => {}} />);
    expect(document.head.querySelector('meta[name="robots"]').content).toBe("noindex");
    expect(document.title).toContain("Fix the thing");
    unmount();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
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
    await skipWait();
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

describe("busy retry", () => {
  const reply = (body, status = 200) => Response.json(body, { status });
  // Makes the countdown finish at once: the clock jumps past the wait and the
  // one-second tick runs every few milliseconds.
  const fastClock = () => {
    const realNow = Date.now.bind(Date);
    const realSetInterval = globalThis.setInterval;
    vi.spyOn(Date, "now").mockImplementation(() => realNow() + (BUSY_RETRY_SECONDS + 1) * 1000);
    vi.spyOn(globalThis, "setInterval").mockImplementation((fn, ms, ...rest) =>
      realSetInterval(fn, ms === 1000 ? 5 : ms, ...rest),
    );
  };

  it("announces the wait once and shows a countdown", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ error: "unavailable" }, 503)));
    render(<Fetcher />);
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    const status = await screen.findByRole("status");
    expect(status.textContent).toBe(
      `The AI helper is busy, so it will try again in ${BUSY_RETRY_SECONDS} seconds.`,
    );
    expect(screen.getByText(/Trying again in \d+s/).getAttribute("aria-hidden")).toBe("true");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries once by itself, and shows the answer if it comes back", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(reply({ error: "unavailable" }, 503))
        .mockResolvedValueOnce(reply({ data: { text: "second try" } })),
    );
    render(<Fetcher />);
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    await screen.findByRole("button", { name: "Don't wait" });
    fastClock();
    // The countdown's next tick may be up to a second away.
    await screen.findByText("second try", {}, { timeout: 3000 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("retries only once, then shows the busy message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ error: "unavailable" }, 503)));
    render(<Fetcher />);
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    await screen.findByRole("button", { name: "Don't wait" });
    fastClock();
    await screen.findByRole("button", { name: "Try again" }, { timeout: 3000 });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Don't wait" })).toBeNull();
  });

  it("\"Don't wait\" stops the retry and shows the busy message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ error: "unavailable" }, 503)));
    render(<Fetcher />);
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    await skipWait();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    fastClock();
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["limit", 429],
    ["disabled", 503],
    ["not_found", 404],
  ])("doesn't wait when the reason is %s", async (error, status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ error }, status)));
    render(<Fetcher />);
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Don't wait" })).toBeNull();
  });
});

describe("Failure", () => {
  const failWith = async (error, status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply2({ error }, status)));
    render(<Fetcher />);
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    if (status === 503 && error === "unavailable") await skipWait();
  };
  const reply2 = (body, status) => Response.json(body, { status });

  it("unavailable suggests waiting a minute, and still offers a retry", async () => {
    await failWith("unavailable", 503);
    await screen.findByText(/wait a minute/i);
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("unavailable offers the reader's own key, which opens the key settings", async () => {
    clearOwnKey();
    const settings = document.createElement("details");
    settings.id = OWN_KEY_SETTINGS_ID;
    settings.innerHTML = "<summary>Use your own API key</summary>";
    document.body.append(settings);
    try {
      await failWith("unavailable", 503);
      fireEvent.click(await screen.findByRole("button", { name: "use your own free API key" }));
      expect(settings.open).toBe(true);
      expect(document.activeElement).toBe(settings.querySelector("summary"));
    } finally {
      settings.remove();
    }
  });

  it("unavailable doesn't suggest an own key to someone already using one", async () => {
    setOwnKey({ provider: "groq", model: "m", key: "test-key" }, false);
    try {
      await failWith("unavailable", 503);
      await screen.findByText(/wait a minute/i);
      expect(screen.queryByRole("button", { name: "use your own free API key" })).toBeNull();
    } finally {
      clearOwnKey();
    }
  });

  it("disabled says the helper is switched off and still shows the manual steps", async () => {
    await failWith("disabled", 503);
    await screen.findByText(/switched off/i);
    expect(screen.queryByText(/busy/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.getByRole("link", { name: /read the issue/i })).toBeTruthy();
  });

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
  it("is a real link to the help page, so it can open in a new tab", () => {
    render(<DevAgentsEntry issue={issue} onOpen={() => {}} />);
    expect(screen.getByRole("link", { name: /get help/i }).getAttribute("href")).toBe("/help/a/b/7");
  });

  it("opens in place on a normal click", () => {
    const onOpen = vi.fn();
    render(<DevAgentsEntry issue={issue} onOpen={onOpen} />);
    const notPrevented = fireEvent.click(screen.getByRole("link", { name: /get help/i }), { button: 0 });
    expect(onOpen).toHaveBeenCalledWith(issue);
    expect(notPrevented).toBe(false);
  });

  it("leaves Ctrl or Cmd clicks to the browser", () => {
    const onOpen = vi.fn();
    render(<DevAgentsEntry issue={issue} onOpen={onOpen} />);
    const link = screen.getByRole("link", { name: /get help/i });
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link, { button: 0, metaKey: true });
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe("DevAgentsRoute", () => {
  const on = { checked: true, devAgents: true, signedIn: true };

  it("doesn't load the page's code until it's needed", async () => {
    const loadPage = vi.fn(async () => ({ default: () => <p>page loaded</p> }));
    render(<DevAgentsRoute issue={issue} account={on} loadPage={loadPage} onBack={() => {}} />);
    await screen.findByText("page loaded");
    expect(loadPage).toHaveBeenCalledTimes(1);
  });

  it("waits while the account is being checked", () => {
    const loadPage = vi.fn();
    render(<DevAgentsRoute issue={issue} account={{ checked: false }} loadPage={loadPage} onBack={() => {}} />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
    expect(loadPage).not.toHaveBeenCalled();
  });

  it("says so when the helper is off, with a way forward", () => {
    const loadPage = vi.fn();
    render(<DevAgentsRoute issue={issue} account={{ checked: true, devAgents: false }} loadPage={loadPage} onBack={() => {}} />);
    expect(screen.getByText(/isn't available right now/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /read the issue/i }).getAttribute("href")).toBe("https://github.com/a/b/issues/7");
    expect(screen.getByRole("link", { name: /back to search/i })).toBeTruthy();
    expect(loadPage).not.toHaveBeenCalled();
  });

  it("a failed load offers Try again and doesn't blank the page", async () => {
    const loadPage = vi
      .fn()
      .mockRejectedValueOnce(new Error("chunk failed"))
      .mockResolvedValueOnce({ default: () => <p>page loaded</p> });
    render(
      <div>
        <p>site</p>
        <DevAgentsRoute issue={issue} account={on} loadPage={loadPage} onBack={() => {}} />
      </div>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    await screen.findByText("page loaded");
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
    expect(screen.queryByRole("link", { name: /get help/i })).toBeNull();
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
    expect(screen.queryByRole("link", { name: /get help/i })).toBeNull();
  });

  it("shows the entry on each card when DevAgents is on", async () => {
    stubSite({ signInAvailable: true, user: null, devAgents: true });
    await renderAndSearch();
    await screen.findByRole("link", { name: /get help/i }, { timeout: 3000 });
  });

  it("opens the help page in place, and Back returns to the same results", async () => {
    stubSite({ signInAvailable: true, user: { login: "me", name: "Me", avatarUrl: "https://x.test/a.png" }, devAgents: true });
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: /get help/i }, { timeout: 3000 }));
    await screen.findByRole("heading", { level: 1, name: "A real issue" }, { timeout: 3000 });
    expect(window.location.pathname).toBe("/help/a/b/7");
    fireEvent.click(screen.getByRole("link", { name: /back to search/i }));
    await waitFor(() => expect(window.location.pathname).toBe("/"));
    await screen.findByRole("link", { name: /get help/i });
  });

  it("opens the help page directly from its address", async () => {
    window.history.pushState(null, "", "/help/a/b/7");
    stubSite({ signInAvailable: true, user: { login: "me", name: "Me", avatarUrl: "https://x.test/a.png" }, devAgents: true });
    render(<App />);
    await screen.findByRole("heading", { level: 2, name: "Understand" }, { timeout: 3000 });
    window.history.pushState(null, "", "/");
  });
});
