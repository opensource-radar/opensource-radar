import { useId, useState } from "react";
import { callDevAgents } from "../client";
import { clearOwnKey, getOwnKey, setOwnKey } from "../ownKey";
import { OWN_KEY_PROVIDERS } from "../ownKeyProviders";

const nameOf = (id) => OWN_KEY_PROVIDERS.find((provider) => provider.id === id)?.name ?? id;

function KeySettings() {
  const providerId = useId();
  const keyId = useId();
  const modelId = useId();
  const rememberId = useId();
  const [provider, setProvider] = useState(OWN_KEY_PROVIDERS[0].id);
  const [key, setKey] = useState("");
  const [checked, setChecked] = useState(null);
  const [model, setModel] = useState("");
  const [remember, setRemember] = useState(false);
  const [current, setCurrent] = useState(() => getOwnKey());
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState(null);

  const chosen = OWN_KEY_PROVIDERS.find(({ id }) => id === provider);

  // A check only counts for the provider and key it was run on.
  const startOver = () => {
    setChecked(null);
    setModel("");
    setMessage(null);
  };

  const check = async () => {
    setChecking(true);
    setMessage(null);
    const result = await callDevAgents(
      "validate-key",
      {},
      { ownKey: { provider, key: key.trim() } },
    );
    setChecking(false);

    if (!result.ok) return setMessage("We couldn't check that key right now. Try again in a moment.");
    if (!result.data?.valid) {
      return setMessage(`${chosen.name} didn't accept that key. Check it and try again.`);
    }
    const models = Array.isArray(result.data.models) ? result.data.models : [];
    setChecked({ models });
    return setModel(models[0] ?? "");
  };

  const save = () => {
    const ownKey = { provider, model: model.trim(), key: key.trim() };
    setOwnKey(ownKey, remember);
    setCurrent(ownKey);
    setKey("");
    setChecked(null);
    setModel("");
    setMessage(`Your ${chosen.name} key will be used from now on.`);
  };

  return (
    <details>
      <summary>Use your own API key</summary>
      <p className="devagents-muted">
        Use your own account with an AI provider, with no daily limit here. Its costs and terms are
        between you and that provider. Your key stays in this browser, passes through our server to
        reach the provider, and isn't stored or logged.
      </p>

      <label htmlFor={providerId}>AI provider</label>
      <select
        id={providerId}
        className="devagents-field"
        value={provider}
        onChange={(event) => {
          setProvider(event.target.value);
          startOver();
        }}
      >
        {OWN_KEY_PROVIDERS.map(({ id, name }) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
      <p>
        <a href={chosen.keysUrl} target="_blank" rel="noopener noreferrer">
          Get a {chosen.name} key ↗
        </a>
      </p>

      <label htmlFor={keyId}>API key</label>
      <input
        id={keyId}
        className="devagents-field"
        type="password"
        autoComplete="off"
        value={key}
        onChange={(event) => {
          setKey(event.target.value);
          startOver();
        }}
      />

      {!checked && (
        <button type="button" className="secondary-button" disabled={checking || !key.trim()} onClick={check}>
          {checking ? "Checking…" : "Check key"}
        </button>
      )}

      {checked && (
        <>
          <label htmlFor={modelId}>{checked.models.length > 0 ? "Model" : "Model name"}</label>
          {checked.models.length > 0 ? (
            <select
              id={modelId}
              className="devagents-field"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            >
              {checked.models.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={modelId}
              className="devagents-field"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            />
          )}
          <p className="devagents-remember">
            <input
              id={rememberId}
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />{" "}
            <label htmlFor={rememberId}>Remember on this device</label>
          </p>
          <button type="button" className="primary-button" disabled={!model.trim()} onClick={save}>
            Save key
          </button>
        </>
      )}

      {current && (
        <p>
          Using your {nameOf(current.provider)} key.{" "}
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              clearOwnKey();
              setCurrent(null);
              setMessage("Your key has been removed.");
            }}
          >
            Remove my key
          </button>
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </details>
  );
}

export default KeySettings;
