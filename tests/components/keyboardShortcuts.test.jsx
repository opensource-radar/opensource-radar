// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import KeyboardShortcuts from "../../src/components/KeyboardShortcuts";
import { useKeyboardShortcuts } from "../../src/lib/useKeyboardShortcuts";

function Page({ enabled = true, onShowHelp = () => {}, onSave = () => {} }) {
  useKeyboardShortcuts({ enabled, onShowHelp });
  return (
    <>
      <input id="issue-search" aria-label="Search issues on GitHub" />
      <div className="issues-list">
        {["One", "Two", "Three"].map((title) => (
          <article key={title} className="issue-card" aria-label={title}>
            <button type="button" className="issue-save" onClick={() => onSave(title)}>
              Save {title}
            </button>
            <span className="issue-card-links">
              <a href={`https://github.com/o/r/issues/${title}`}>View issue</a>
            </span>
          </article>
        ))}
      </div>
    </>
  );
}

const press = (key, target = document.body) => fireEvent.keyDown(target, { key });

describe("keyboard shortcuts", () => {
  afterEach(cleanup);

  it("moves between issues with j and k", () => {
    render(<Page />);
    press("j");
    expect(document.activeElement).toBe(screen.getByLabelText("One"));
    press("j");
    expect(document.activeElement).toBe(screen.getByLabelText("Two"));
    press("k");
    expect(document.activeElement).toBe(screen.getByLabelText("One"));
  });

  it("saves the current issue with s", () => {
    const onSave = vi.fn();
    render(<Page onSave={onSave} />);
    press("s");
    expect(onSave).not.toHaveBeenCalled(); // no issue chosen yet
    press("j");
    press("j");
    press("s", document.activeElement);
    expect(onSave).toHaveBeenCalledWith("Two");
  });

  it("opens the current issue on GitHub with o", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<Page />);
    press("j");
    press("o", document.activeElement);
    expect(open).toHaveBeenCalledWith("https://github.com/o/r/issues/One", "_blank", "noopener,noreferrer");
    open.mockRestore();
  });

  it("jumps to the search box with /, and leaves keys alone while typing there", () => {
    const onSave = vi.fn();
    render(<Page onSave={onSave} />);
    press("/");
    const input = screen.getByLabelText("Search issues on GitHub");
    expect(document.activeElement).toBe(input);
    press("j", input);
    press("s", input);
    expect(document.activeElement).toBe(input);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("asks to show the list with ?", () => {
    const onShowHelp = vi.fn();
    render(<Page onShowHelp={onShowHelp} />);
    press("?");
    expect(onShowHelp).toHaveBeenCalled();
  });

  it("does nothing when turned off", () => {
    const onShowHelp = vi.fn();
    render(<Page enabled={false} onShowHelp={onShowHelp} />);
    press("?");
    press("j");
    expect(onShowHelp).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);
  });

  it("lists every shortcut in the dialog", () => {
    render(<KeyboardShortcuts onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Keyboard shortcuts" })).toBeTruthy();
    for (const label of ["Jump to the search box", "Next issue", "Previous issue", "Show these shortcuts"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });
});
