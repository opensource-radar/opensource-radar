// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import IssueCard from "../src/components/IssueCard.jsx";
import { toIssue } from "../src/search.js";

afterEach(cleanup);

const apiItem = {
  id: 9,
  number: 123,
  title: "Fix the button",
  body: "Details",
  labels: [{ name: "good first issue" }],
  user: { login: "octocat" },
  created_at: "2026-11-02T10:00:00Z",
  repository_url: "https://api.github.com/repos/a/b",
  html_url: "https://github.com/a/b/issues/123",
  updated_at: "2026-11-05T10:00:00Z",
  comments: 2,
};

const renderCard = (issue) => render(<IssueCard {...issue} />);
// Cards show dates in the visitor's own format, like "2 Nov 2026" or "Nov 2, 2026".
const shown = (date) =>
  new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(date));

describe("IssueCard details", () => {
  it("shows the number, author and created date from GitHub's data", () => {
    renderCard(toIssue(apiItem, "Python"));
    const line = screen.getByText(/#123/);
    expect(line.textContent).toBe(`#123 opened by octocat on ${shown("2026-11-02T10:00:00Z")}`);
  });

  it("links the author to their GitHub profile", () => {
    renderCard(toIssue(apiItem, "Python"));
    expect(screen.getByRole("link", { name: "octocat" }).getAttribute("href")).toBe("https://github.com/octocat");
  });

  it("still shows everything it showed before", () => {
    renderCard(toIssue(apiItem, "Python"));
    expect(screen.getByRole("heading", { name: "Fix the button" })).toBeTruthy();
    expect(screen.getByText("good first issue")).toBeTruthy();
    expect(screen.getByText("Python")).toBeTruthy();
    expect(screen.getByText(/2 comments/)).toBeTruthy();
    expect(screen.getByText(new RegExp(`updated ${shown("2026-11-05T10:00:00Z")}`))).toBeTruthy();
  });

  it("leaves the line out for older saved issues that don't have these details", () => {
    const old = toIssue(apiItem, "Python");
    delete old.number;
    delete old.author;
    delete old.createdAt;
    renderCard(old);
    expect(screen.queryByText(/opened by/)).toBeNull();
  });

  it("shows what it has when only some details are known", () => {
    renderCard({ ...toIssue(apiItem, ""), author: "", createdAt: "" });
    expect(screen.getByText("#123").textContent).toBe("#123");
  });
});
