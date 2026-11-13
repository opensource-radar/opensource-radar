// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import GlossaryText from "../../src/components/Glossary.jsx";
import GuidePage from "../../src/components/GuidePage.jsx";
import { splitGlossary } from "../../src/lib/glossary.js";

afterEach(cleanup);

describe("splitGlossary", () => {
  it("marks the first use of each word only", () => {
    const parts = splitGlossary("Fork the repository, then fork again and open a pull request.");
    const words = parts.filter((part) => typeof part !== "string").map((part) => part.word);
    expect(words).toEqual(["Fork", "repository", "pull request"]);
    expect(parts.map((part) => (typeof part === "string" ? part : part.word)).join("")).toBe(
      "Fork the repository, then fork again and open a pull request.",
    );
  });

  it("shares what's been marked across blocks", () => {
    const seen = new Set();
    splitGlossary("Push your branch.", seen);
    expect(splitGlossary("Push it to the branch.", seen)).toEqual(["Push it to the branch."]);
  });

  it("doesn't mark parts of other words", () => {
    expect(splitGlossary("The pushover saw a pushy brancher.")).toEqual(["The pushover saw a pushy brancher."]);
  });
});

describe("GlossaryText", () => {
  it("explains a word on tap, and describes it for screen readers", () => {
    render(<p><GlossaryText text="Open a pull request." /></p>);
    const term = screen.getByRole("button", { name: "pull request" });
    expect(term.getAttribute("aria-expanded")).toBe("false");
    const tip = document.getElementById(term.getAttribute("aria-describedby"));
    expect(tip.textContent).toMatch(/request to the project/);
    fireEvent.click(term);
    expect(term.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(term, { key: "Escape" });
    expect(term.getAttribute("aria-expanded")).toBe("false");
  });

  it("marks each word once across the whole guide page, even when React renders twice", () => {
    // StrictMode renders every component twice in development, as the site does.
    render(
      <StrictMode>
        <GuidePage onBack={() => {}} />
      </StrictMode>,
    );
    expect(screen.getAllByRole("button", { name: /^pull requests?$/i })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^fork$/i })).toHaveLength(1);
  });
});
