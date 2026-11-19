// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import IssueCard from "../../src/components/IssueCard.jsx";
import WorkingReminder from "../../src/components/WorkingReminder.jsx";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const entry = {
  repo: "a / b",
  number: 7,
  title: "Fix the button",
  url: "https://github.com/a/b/issues/7",
  startedAt: "2026-11-10T00:00:00.000Z",
  checkedAt: "2026-11-10T00:00:00.000Z",
};

describe("WorkingReminder", () => {
  it("asks how it's going, with the three choices", () => {
    vi.useFakeTimers({ now: new Date("2026-11-14T00:00:00Z") });
    const handlers = { onStillOn: vi.fn(), onLetGo: vi.fn(), onOpenHelp: vi.fn() };
    render(<WorkingReminder entry={entry} {...handlers} />);
    expect(screen.getByRole("heading", { name: "Still working on this?" })).toBeTruthy();
    expect(screen.getByText(/4 days ago/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ask the maintainer ↗" }).getAttribute("href")).toBe(entry.url);
    fireEvent.click(screen.getByRole("button", { name: "Still on it" }));
    expect(handlers.onStillOn).toHaveBeenCalledWith(entry);
    fireEvent.click(screen.getByRole("button", { name: "Let it go" }));
    expect(handlers.onLetGo).toHaveBeenCalledWith(entry);
    fireEvent.click(screen.getByRole("link", { name: "Fix the button" }));
    expect(handlers.onOpenHelp).toHaveBeenCalledWith(entry);
  });
});

describe("I'm working on this, on the card", () => {
  it("toggles and shows when the issue is being worked on", () => {
    const onToggleWorking = vi.fn();
    const props = { title: "Fix", repo: "a / b", url: entry.url, number: 7, label: "good first issue", description: "" };
    const { rerender } = render(<IssueCard {...props} workingOn={false} onToggleWorking={onToggleWorking} />);
    const button = screen.getByRole("button", { name: "I’m working on this" });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(button);
    expect(onToggleWorking).toHaveBeenCalled();
    rerender(<IssueCard {...props} workingOn onToggleWorking={onToggleWorking} />);
    expect(screen.getByRole("button", { name: "Working on it ✓" }).getAttribute("aria-pressed")).toBe("true");
  });
});
