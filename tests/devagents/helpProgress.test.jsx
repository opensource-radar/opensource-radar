// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HelpPage from "../../src/devagents/HelpPage.jsx";
import { readLocalProgress, writeLocalProgress } from "../../src/devagents/progress.js";

const issue = { repo: "a/b", issue: 7, title: "Fix the thing" };
const Empty = () => null;
const sections = ["Understand", "Plan", "Change", "Check"].map((title) => ({ id: title.toLowerCase(), title, intro: "", Component: Empty }));
const stepButton = (name) => screen.getByRole("button", { name: new RegExp(name) });
const activeStep = () => document.querySelector('[aria-current="step"]').textContent;
let remote;
let puts;

beforeEach(() => {
  localStorage.clear();
  remote = null;
  puts = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(async (url, init) => {
    const target = String(url);
    if (target.startsWith("/api/saved?progress=") && init?.method === "PUT") {
      puts.push(JSON.parse(init.body));
      return Response.json({ progress: null });
    }
    if (target.startsWith("/api/saved?progress=")) return Response.json({ progress: remote });
    return Response.json({});
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("help page progress", () => {
  it("remembers the step reached, here and on the server", () => {
    render(<HelpPage issue={issue} signedIn onBack={() => {}} sections={sections} />);
    fireEvent.click(stepButton("Change"));
    expect(readLocalProgress("a/b#7")).toMatchObject({ step: 2, visited: [0, 2] });
    expect(puts).toEqual([{ issue: "a/b#7", step: 2, visited: [0, 2] }]);
  });

  it("carries on from where it stopped, and can start over", () => {
    writeLocalProgress("a/b#7", { step: 3, visited: [0, 1, 2, 3], at: Date.now() });
    render(<HelpPage issue={issue} signedIn onBack={() => {}} sections={sections} />);
    expect(activeStep()).toContain("Check");
    expect(screen.getByRole("status").textContent).toContain("Carrying on from Check");
    fireEvent.click(screen.getByRole("button", { name: "Start from the beginning" }));
    expect(activeStep()).toContain("Understand");
    expect(screen.queryByText(/Carrying on/)).toBeNull();
  });

  it("uses a newer position saved on another device", async () => {
    writeLocalProgress("a/b#7", { step: 1, visited: [0, 1], at: 1000 });
    remote = { step: 2, visited: [0, 1, 2], at: 2000 };
    render(<HelpPage issue={issue} signedIn onBack={() => {}} sections={sections} />);
    await waitFor(() => expect(activeStep()).toContain("Change"));
  });

  it("ignores an older one", async () => {
    writeLocalProgress("a/b#7", { step: 2, visited: [0, 2], at: 2000 });
    remote = { step: 1, visited: [0, 1], at: 1000 };
    render(<HelpPage issue={issue} signedIn onBack={() => {}} sections={sections} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(activeStep()).toContain("Change");
  });
});
