import { describe, expect, it } from "vitest";
import { LANGUAGE_PAGES, liveIntro } from "../../src/lib/seoPages.js";

const python = LANGUAGE_PAGES.find((page) => page.language === "Python");

describe("liveIntro", () => {
  it("puts the live count in a language page's intro", () => {
    expect(liveIntro(python, 12345)).toBe("12,345 open Python issues for beginners that nobody has taken yet, right now.");
    expect(liveIntro(python, 1)).toBe("1 open Python issue for beginners that nobody has taken yet, right now.");
  });

  it("keeps the usual intro until there's a count", () => {
    expect(liveIntro(python, null)).toBe(python.intro);
    expect(liveIntro(python, 0)).toBe(python.intro);
  });
});
