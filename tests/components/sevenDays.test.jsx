// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import SevenDays from "../../src/components/SevenDays.jsx";
import { ALL_TASKS, readDone, writeDone } from "../../src/lib/sevenDays.js";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("Your first pull request in 7 days", () => {
  it("shows seven days with progress, and remembers ticks", () => {
    const { unmount } = render(<SevenDays />);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(7);
    expect(screen.getByText(`0 of ${ALL_TASKS.length} done`)).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Make a GitHub account, if you don't have one"));
    expect(screen.getByText(`1 of ${ALL_TASKS.length} done`)).toBeTruthy();

    unmount();
    render(<SevenDays />);
    expect(screen.getByLabelText("Make a GitHub account, if you don't have one").checked).toBe(true);
  });

  it("marks a day done when all its tasks are ticked", () => {
    render(<SevenDays />);
    for (const name of ["Comment on the issue, saying what you plan to do", "Wait to be assigned before you start"]) {
      fireEvent.click(screen.getByLabelText(name));
    }
    expect(screen.getByRole("heading", { name: "Day 4: Ask to work on it" }).closest("li").className).toBe("is-done");
  });

  it("links to search and to the practice repository", () => {
    render(<SevenDays />);
    expect(screen.getByRole("link", { name: "Search good first issues" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: /Open the practice repository/ }).getAttribute("target")).toBe("_blank");
  });

  it("ignores broken or unknown saved data, and blocked storage", () => {
    localStorage.setItem("radar:seven-days", JSON.stringify(["0.0", "99.9", 5]));
    expect([...readDone()]).toEqual(["0.0"]);
    localStorage.setItem("radar:seven-days", "{not json");
    expect(readDone().size).toBe(0);
    const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() {} };
    expect(readDone(blocked).size).toBe(0);
    expect(() => writeDone(new Set(["0.0"]), blocked)).not.toThrow();
  });
});
