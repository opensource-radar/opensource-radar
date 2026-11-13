// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReadAloud from "../../src/components/ReadAloud.jsx";
import { speakableText } from "../../src/lib/speech.js";

let spoken;
function fakeSpeech() {
  spoken = [];
  const synth = {
    speak: vi.fn((u) => spoken.push(u)),
    cancel: vi.fn(),
  };
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(text) {
        this.text = text;
      }
    },
  );
  return synth;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("speakableText", () => {
  it("drops markdown, code and links so it reads naturally", () => {
    expect(speakableText("## Bug\nSee [the docs](https://x.y/z) and `npm test`.\n```js\nlet a\n```\nhttps://example.com"))
      .toBe("Bug See the docs and npm test. (code example) (link)");
  });
});

describe("ReadAloud", () => {
  beforeEach(fakeSpeech);

  it("reads the text at the chosen speed, and can be stopped", () => {
    render(<ReadAloud text="Fix the **typo** in the README." />);
    fireEvent.change(screen.getByLabelText("Reading speed"), { target: { value: "1.25" } });
    fireEvent.click(screen.getByRole("button", { name: "🔊 Read aloud" }));
    expect(spoken).toHaveLength(1);
    expect(spoken[0].rate).toBe(1.25);
    expect(spoken[0].text).toBe("Fix the typo in the README.");

    fireEvent.click(screen.getByRole("button", { name: "Stop reading" }));
    expect(speechSynthesis.cancel).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "🔊 Read aloud" })).toBeTruthy();
  });

  it("goes back to Read aloud when the voice finishes", async () => {
    render(<ReadAloud text="Hello" />);
    fireEvent.click(screen.getByRole("button", { name: "🔊 Read aloud" }));
    spoken[0].onend();
    expect(await screen.findByRole("button", { name: "🔊 Read aloud" })).toBeTruthy();
  });

  it("stops the voice when it leaves the page", () => {
    const { unmount } = render(<ReadAloud text="Hello" />);
    fireEvent.click(screen.getByRole("button", { name: "🔊 Read aloud" }));
    speechSynthesis.cancel.mockClear();
    unmount();
    expect(speechSynthesis.cancel).toHaveBeenCalled();
  });
});

describe("ReadAloud without speech", () => {
  it("shows nothing where the browser can't speak, or there's no text", () => {
    vi.stubGlobal("speechSynthesis", undefined);
    const { container } = render(<ReadAloud text="Hello" />);
    expect(container.textContent).toBe("");
    fakeSpeech();
    const again = render(<ReadAloud text="   " />);
    expect(again.container.textContent).toBe("");
  });
});
