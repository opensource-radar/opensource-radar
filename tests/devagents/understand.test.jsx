// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Understand from "../../src/devagents/sections/Understand.jsx";

const issue = { repo: "a/b", issue: 7, title: "T" };
const checkData = { verdict: "clear", reasons: ["Not taken yet."], aiPolicy: "unknown", rules: [], archived: false };
const explainData = {
  summary: "<img src=x onerror=alert(1)> [click](javascript:alert(1))",
  filesToRead: [{ path: "src/my file.py", why: "<b>why</b>", line: 3 }],
  setupSteps: ["<script>bad()</script>"],
  rules: ["Be kind"],
  difficulty: "easy",
  partial: false,
  branch: "main",
};

function stubBackend(explain) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) =>
      String(url).includes("issue-check")
        ? Response.json({ data: checkData })
        : Response.json({ data: explain }),
    ),
  );
}

beforeEach(() => {
  sessionStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Understand", () => {
  it("doesn't call the LLM until asked", async () => {
    stubBackend(explainData);
    render(<Understand issue={issue} onShare={() => {}} />);
    await screen.findByText("Not taken yet");
    expect(fetch.mock.calls.some(([url]) => String(url).includes("action=explain"))).toBe(false);
  });

  it("renders hostile LLM text as harmless text", async () => {
    stubBackend(explainData);
    const { container } = render(<Understand issue={issue} onShare={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Explain this issue" }));
    await screen.findByText(/onerror=alert/);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByText(/<script>bad\(\)<\/script>/)).toBeTruthy();
    for (const link of container.querySelectorAll("a")) {
      expect(new URL(link.href).protocol).toBe("https:");
    }
  });

  it("file links come from links.js, on github.com", async () => {
    stubBackend(explainData);
    render(<Understand issue={issue} onShare={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Explain this issue" }));
    const link = await screen.findByRole("link", { name: /src\/my file\.py/ });
    expect(link.getAttribute("href")).toBe("https://github.com/a/b/blob/main/src/my%20file.py#L3");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("shares the answer for later steps", async () => {
    stubBackend(explainData);
    const onShare = vi.fn();
    render(<Understand issue={issue} onShare={onShare} />);
    fireEvent.click(screen.getByRole("button", { name: "Explain this issue" }));
    await waitFor(() =>
      expect(onShare).toHaveBeenCalledWith({ explain: expect.objectContaining({ branch: "main" }) }),
    );
  });

  it("sends one request at a time, so token renewals can't collide", async () => {
    let finish;
    vi.stubGlobal(
      "fetch",
      vi.fn((url) =>
        String(url).includes("action=explain")
          ? new Promise((resolve) => { finish = resolve; })
          : Promise.resolve(
              Response.json({ data: String(url).includes("issue-check") ? checkData : { saved: true } }),
            ),
      ),
    );
    render(<Understand issue={issue} onShare={() => {}} />);
    await screen.findByText("Not taken yet");
    fireEvent.click(screen.getByRole("button", { name: "Explain this issue" }));
    await waitFor(() => expect(finish).toBeTruthy());
    const eventSent = () => fetch.mock.calls.some(([url]) => String(url).includes("action=event"));
    expect(eventSent()).toBe(false);
    finish(Response.json({ data: explainData }));
    await waitFor(() => expect(eventSent()).toBe(true));
  });

  it("says when an answer is partial", async () => {
    stubBackend({ ...explainData, partial: true, filesToRead: [] });
    render(<Understand issue={issue} onShare={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Explain this issue" }));
    await screen.findByText(/couldn't work out which files/i);
  });

  it("copes with a response missing its lists", async () => {
    stubBackend({ summary: "Only a summary" });
    render(<Understand issue={issue} onShare={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Explain this issue" }));
    await screen.findByText("Only a summary");
  });
});
