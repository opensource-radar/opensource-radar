// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import IssueCheck from "../../src/components/IssueCheck.jsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const submit = (value) => {
  fireEvent.change(screen.getByLabelText("Issue link"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Check issue" }));
};

describe("IssueCheck", () => {
  it("checks a pasted issue and shows tips for what's missing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      Response.json({ issue: { number: 12, title: "Fix it", url: "https://github.com/a/b/issues/12", state: "open", labels: ["good first issue"], assigned: false, body: "fix it" } }),
    ));
    render(<IssueCheck />);
    submit("https://github.com/a/b/issues/12");
    await screen.findByText("4 of 7 checks pass.");
    expect(fetch.mock.calls[0][0]).toBe("/api/issue?repo=a%2Fb&issue=12");
    expect(screen.getByRole("link", { name: "#12 Fix it" })).toBeTruthy();
    expect(screen.getByText(/Name the file or link the lines/)).toBeTruthy();
  });

  it("explains a bad link or a missing issue", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "not_found" }, { status: 404 })));
    render(<IssueCheck />);
    submit("not a link");
    expect(screen.getByRole("alert").textContent).toMatch(/Paste an issue link/);
    expect(fetch).not.toHaveBeenCalled();
    submit("a/b#4");
    expect((await screen.findByText(/couldn't find that issue/)).getAttribute("role")).toBe("alert");
  });
});
