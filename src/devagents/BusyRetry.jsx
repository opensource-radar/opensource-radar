import { useEffect, useRef, useState } from "react";

const secondsLeft = (until) => Math.max(0, Math.ceil((until - Date.now()) / 1000));

// Shown when the AI helper is busy: it tries once more by itself after a short
// wait. Screen readers hear the message once, not every second.
function BusyRetry({ until, onRetry, onCancel }) {
  const [left, setLeft] = useState(() => secondsLeft(until));
  // Read once, so the announced sentence never changes while it counts down.
  const [total] = useState(() => secondsLeft(until));
  const retry = useRef(onRetry);

  useEffect(() => {
    retry.current = onRetry;
  }, [onRetry]);

  useEffect(() => {
    const timer = setInterval(() => {
      const seconds = secondsLeft(until);
      setLeft(seconds);
      if (seconds === 0) {
        clearInterval(timer);
        retry.current();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);

  return (
    <div className="devagents-note">
      <p role="status">
        The AI helper is busy, so it will try again in {total} seconds.
      </p>
      <p aria-hidden="true">Trying again in {left}s…</p>
      <button type="button" className="devagents-link-button" onClick={onCancel}>
        Don't wait
      </button>
    </div>
  );
}

export default BusyRetry;
