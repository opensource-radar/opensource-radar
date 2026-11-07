import { useId, useState } from "react";
import { callDevAgents } from "../client";
import { clearOwnKey, getOwnKey, setOwnKey } from "../ownKey";

const MESSAGES = {
  saved: "Your key works, and will be used from now on.",
  invalid: "Groq didn't accept that key. Check it and try again.",
  failed: "We couldn't check that key right now. Try again in a moment.",
  removed: "Your key has been removed.",
};

function KeySettings() {
  const keyId = useId();
  const rememberId = useId();
  const [key, setKey] = useState("");
  const [remember, setRemember] = useState(false);
  const [hasKey, setHasKey] = useState(() => Boolean(getOwnKey()));
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState(null);

  const save = async () => {
    setChecking(true);
    const result = await callDevAgents("validate-key", {}, { ownKey: key.trim() });
    setChecking(false);

    if (!result.ok) return setMessage("failed");
    if (!result.data?.valid) return setMessage("invalid");
    setOwnKey(key.trim(), remember);
    setKey("");
    setHasKey(true);
    return setMessage("saved");
  };

  return (
    <details>
      <summary>Use your own Groq key</summary>
      <p className="devagents-muted">
        This removes the daily limit. Your key stays in this browser, and it's only passed along to
        Groq when you use it.
      </p>
      <label htmlFor={keyId}>Groq API key</label>
      <input
        id={keyId}
        className="devagents-field"
        type="password"
        autoComplete="off"
        value={key}
        onChange={(event) => setKey(event.target.value)}
      />
      <p>
        <input
          id={rememberId}
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
        />{" "}
        <label htmlFor={rememberId}>Remember on this device</label>
      </p>
      <button type="button" disabled={checking || !key.trim()} onClick={save}>
        {checking ? "Checking…" : "Save key"}
      </button>{" "}
      {hasKey && (
        <button
          type="button"
          onClick={() => {
            clearOwnKey();
            setHasKey(false);
            setMessage("removed");
          }}
        >
          Remove my key
        </button>
      )}
      {message && <p role="status">{MESSAGES[message]}</p>}
    </details>
  );
}

export default KeySettings;
