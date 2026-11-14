// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import IssueCard from "../../src/components/IssueCard.jsx";
import { issueKey, readHidden, useHiddenIssues } from "../../src/lib/hiddenIssues.js";

const issue = { title: "Fix the docs", repo: "Owner / Repo", number: 12 };
let posts;

beforeEach(() => {
  localStorage.clear();
  posts = [];
  vi.stubGlobal("fetch", vi.fn(async (url, init) => {
    if (init?.method === "POST") {
      posts.push(JSON.parse(init.body));
      return Response.json({ ok: true, hidden: false });
    }
    return Response.json({ hidden: ["other/repo#5"] });
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Report on an issue card", () => {
  it("offers the reasons and passes the chosen one on", () => {
    const onReport = vi.fn();
    render(<IssueCard {...issue} label="good first issue" url="https://github.com/owner/repo/issues/12" onReport={onReport} />);
    fireEvent.click(screen.getByText("Report"));
    fireEvent.click(screen.getByRole("button", { name: "Broken or misleading" }));
    expect(onReport).toHaveBeenCalledWith("broken");
  });

  it("isn't there when the card can't be reported", () => {
    render(<IssueCard {...issue} label="good first issue" url="https://github.com/owner/repo/issues/12" />);
    expect(screen.queryByText("Report")).toBeNull();
  });
});

describe("useHiddenIssues", () => {
  it("hides a reported issue here at once, sends the report, and can undo", async () => {
    const { result } = renderHook(() => useHiddenIssues());
    await waitFor(() => expect(result.current.isHidden({ repo: "other / repo", number: 5 })).toBe(true));

    act(() => result.current.report(issue, "spam"));
    expect(result.current.isHidden(issue)).toBe(true);
    expect(readHidden()).toEqual(["owner/repo#12"]);
    expect(posts).toEqual([{ issue: "owner/repo#12", reason: "spam" }]);
    expect(result.current.lastHidden.title).toBe("Fix the docs");

    act(() => result.current.undo());
    expect(result.current.isHidden(issue)).toBe(false);
    expect(readHidden()).toEqual([]);
  });

  it("can't report an issue without a number", () => {
    expect(issueKey({ repo: "a / b" })).toBeNull();
  });
});
