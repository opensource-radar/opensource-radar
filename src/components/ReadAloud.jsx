import { useEffect, useId, useRef, useState } from "react";
import { SPEEDS, canSpeak, languageName, speak, stopSpeaking } from "../lib/speech";
import "./ReadAloud.css";

// "Read aloud" for a block of text. Shows nothing where the browser can't speak.
function ReadAloud({ text, label = "Read aloud" }) {
  const speedId = useId();
  const [speaking, setSpeaking] = useState(false);
  const [rate, setRate] = useState(1);
  const [missingVoice, setMissingVoice] = useState(null);
  // The sentence being read, so a speed change carries on from there.
  const sentence = useRef(0);

  // Leaving the page (or this block) stops the voice. Asking for the voices
  // early makes Chrome load them before the first click.
  useEffect(() => {
    if (canSpeak()) globalThis.speechSynthesis.getVoices?.();
    return () => stopSpeaking();
  }, []);

  if (!canSpeak() || !String(text ?? "").trim()) return null;

  const start = (speed, from) => {
    const result = speak(text, {
      rate: speed,
      from,
      onChunk: (index) => {
        sentence.current = index;
      },
      onEnd: () => setSpeaking(false),
    });
    setSpeaking(result.ok);
    setMissingVoice(result.ok && !result.hasVoice ? languageName(result.lang) : null);
  };

  const toggle = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    sentence.current = 0;
    start(rate, 0);
  };

  const changeSpeed = (event) => {
    const speed = Number(event.target.value);
    setRate(speed);
    // The browser can't change speed mid-sentence, so it starts that sentence again.
    if (speaking) start(speed, sentence.current);
  };

  return (
    <span className="read-aloud">
      <button type="button" className="devagents-link-button" aria-pressed={speaking} onClick={toggle}>
        {speaking ? "Stop reading" : `🔊 ${label}`}
      </button>
      <label className="sr-only" htmlFor={speedId}>
        Reading speed
      </label>
      <select id={speedId} value={rate} onChange={changeSpeed}>
        {SPEEDS.map((speed) => (
          <option key={speed.value} value={speed.value}>
            {speed.label}
          </option>
        ))}
      </select>
      {missingVoice && (
        <span className="read-aloud-note" role="status">
          This device has no {missingVoice} voice, so it may not read this. You can add one in your
          system&rsquo;s language or speech settings.
        </span>
      )}
    </span>
  );
}

export default ReadAloud;
