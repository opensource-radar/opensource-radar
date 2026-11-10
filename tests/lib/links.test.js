
import { describe, expect, it } from "vitest";
import { isPlainClick } from "../../src/lib/links.js";

describe("isPlainClick", () => {
  it("returns true for a normal left click", () => {
    expect(isPlainClick({ button: 0 })).toBe(true);
  });

  it("returns false for a middle click", () => {
    expect(isPlainClick({ button: 1 })).toBe(false);
  });

  it.each(["ctrlKey", "metaKey", "shiftKey", "altKey"])(
    "returns false when %s is pressed",
    (key) => {
      expect(isPlainClick({ button: 0, [key]: true })).toBe(false);
    },
  );
});
