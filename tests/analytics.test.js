import { describe, expect, it } from "vitest";
import { withoutSearchText } from "../src/analytics.js";

describe("analytics privacy", () => {
  it("sends the page path without what people searched for", () => {
    const event = { type: "pageview", url: "https://opensource-radar.com/?q=my+private+search&labels=good-first-issue" };
    expect(withoutSearchText(event)).toEqual({ type: "pageview", url: "https://opensource-radar.com/" });
  });

  it("keeps help page paths, and drops anything after #", () => {
    const event = { type: "pageview", url: "https://opensource-radar.com/help/a/b/7#x" };
    expect(withoutSearchText(event).url).toBe("https://opensource-radar.com/help/a/b/7");
  });

  it("keeps the rest of the event", () => {
    const event = { type: "event", url: "https://opensource-radar.com/about?x=1", name: "n" };
    expect(withoutSearchText(event)).toEqual({ type: "event", url: "https://opensource-radar.com/about", name: "n" });
  });

  it("drops an event whose address can't be read, rather than sending it as is", () => {
    expect(withoutSearchText({ type: "pageview", url: "not a url?q=secret" })).toBeNull();
  });
});
