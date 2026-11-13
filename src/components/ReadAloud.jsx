import { useEffect, useId, useState } from "react";
import { SPEEDS, canSpeak, speak, stopSpeaking } from "../lib/speech";
import "./ReadAloud.css";

// "Read aloud" for a block of text. Shows nothing where the browser can't speak.
function ReadAloud({ text, label = "Read aloud" }) {
  const speedId = useId();
  const [speaking, setSpeaking] = useState(false);
  const [rate, setRate] = useState(1);

  // Leaving the page (or this block) stops the voice.
  useEffect(() => () => stopSpeaking(), []);

  if (!canSpeak() || !String(text ?? "").trim()) return null;

  const toggle = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(speak(text, { rate, onEnd: () => setSpeaking(false) }));
  };

  return (
    <span className="read-aloud">
      <button type="button" className="devagents-link-button" aria-pressed={speaking} onClick={toggle}>
        {speaking ? "Stop reading" : `🔊 ${label}`}
      </button>
      <label className="sr-only" htmlFor={speedId}>
        Reading speed
      </label>
      <select id={speedId} value={rate} onChange={(event) => setRate(Number(event.target.value))}>
        {SPEEDS.map((speed) => (
          <option key={speed.value} value={speed.value}>
            {speed.label}
          </option>
        ))}
      </select>
    </span>
  );
}

export default ReadAloud;
