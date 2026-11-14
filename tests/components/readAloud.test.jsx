// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReadAloud from "../../src/components/ReadAloud.jsx";
import { chunksOf, detectLanguage, pickVoice, speakableText } from "../../src/lib/speech.js";

let spoken;
let voices;
function fakeSpeech() {
  spoken = [];
  voices = [{ name: "English", lang: "en-US", localService: true }];
  const synth = {
    speak: vi.fn((u) => spoken.push(u)),
    cancel: vi.fn(),
    getVoices: vi.fn(() => voices),
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

describe("detectLanguage", () => {
  it.each([
    ["버그: count_hangul() 이 '힣' 을 한글로 세지 않는다", "ko-KR"],
    ["इस बटन का रंग ठीक करें", "hi-IN"],
    ["修复搜索框的样式问题", "zh-CN"],
    ["検索ボックスを修正する", "ja-JP"],
    ["Исправить опечатку в README", "ru-RU"],
    ["இந்த பிழையை சரிசெய்", "ta-IN"],
  ])("recognises %j", (text, lang) => {
    expect(detectLanguage(text)).toBe(lang);
  });

  it("leaves English, and mostly-English text with a few other letters, to the usual voice", () => {
    expect(detectLanguage("Fix the typo in the README")).toBeNull();
    expect(detectLanguage("Add a Korean translation (한글) for the settings page and its help text")).toBeNull();
  });
});

describe("pickVoice", () => {
  const list = [
    { lang: "en-US", localService: true },
    { lang: "ko_KR", localService: false },
    { lang: "hi-IN", localService: false },
    { lang: "hi-IN", localService: true },
  ];
  it("prefers an exact, on-device voice, then any voice for the language", () => {
    expect(pickVoice(list, "hi-IN")).toBe(list[3]);
    expect(pickVoice(list, "ko-KR")).toBe(list[1]);
    expect(pickVoice(list, "en-GB")).toBe(list[0]);
    expect(pickVoice(list, "ja-JP")).toBeNull();
  });
});

describe("chunksOf", () => {
  it("splits into sentences of a readable size, in any script", () => {
    expect(chunksOf("One. Two! Three?")).toEqual(["One. Two! Three?"]);
    const long = `${"word ".repeat(60)}. ${"next ".repeat(60)}.`;
    expect(chunksOf(long).every((chunk) => chunk.length <= 210)).toBe(true);
    expect(chunksOf("पहला वाक्य। दूसरा वाक्य।").join(" ")).toContain("दूसरा");
  });
});

describe("ReadAloud", () => {
  beforeEach(fakeSpeech);

  it("reads the text at the chosen speed, and can be stopped", () => {
    render(<ReadAloud text="Fix the **typo** in the README." />);
    fireEvent.change(screen.getByLabelText("Reading speed"), { target: { value: "1.4" } });
    fireEvent.click(screen.getByRole("button", { name: "🔊 Read aloud" }));
    expect(spoken).toHaveLength(1);
    expect(spoken[0].rate).toBe(1.4);
    expect(spoken[0].text).toBe("Fix the typo in the README.");

    fireEvent.click(screen.getByRole("button", { name: "Stop reading" }));
    expect(speechSynthesis.cancel).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "🔊 Read aloud" })).toBeTruthy();
  });

  it("changes speed while reading, carrying on from the current sentence", () => {
    const text = `${"First part of the issue. ".repeat(8)}${"Second part of it. ".repeat(8)}`;
    render(<ReadAloud text={text} />);
    fireEvent.click(screen.getByRole("button", { name: "🔊 Read aloud" }));
    const firstRun = spoken.length;
    expect(firstRun).toBeGreaterThan(1);
    act(() => spoken[1].onstart());
    // Callbacks from the reading that's replaced mustn't stop the new one.
    const old = spoken.slice();
    fireEvent.change(screen.getByLabelText("Reading speed"), { target: { value: "0.75" } });
    const restarted = spoken.slice(firstRun);
    expect(restarted[0].text).toBe(old[1].text);
    expect(restarted.every((u) => u.rate === 0.75)).toBe(true);
    act(() => old.at(-1).onend());
    expect(screen.getByRole("button", { name: "Stop reading" })).toBeTruthy();
  });

  it("reads other languages with a matching voice", () => {
    voices.push({ name: "Yuna", lang: "ko-KR", localService: true });
    render(<ReadAloud text="한글 음절 '힣' 을 세지 않는다" />);
    fireEvent.click(screen.getByRole("button", { name: "🔊 Read aloud" }));
    expect(spoken[0].lang).toBe("ko-KR");
    expect(spoken[0].voice.name).toBe("Yuna");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("says when the device has no voice for the language", () => {
    render(<ReadAloud text="इस बटन का रंग ठीक करें" />);
    fireEvent.click(screen.getByRole("button", { name: "🔊 Read aloud" }));
    expect(spoken[0].lang).toBe("hi-IN");
    expect(screen.getByRole("status").textContent).toMatch(/no Hindi voice/);
  });

  it("goes back to Read aloud when the voice finishes", async () => {
    render(<ReadAloud text="Hello" />);
    fireEvent.click(screen.getByRole("button", { name: "🔊 Read aloud" }));
    act(() => spoken[0].onend());
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
