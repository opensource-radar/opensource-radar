import { useId, useState } from "react";
import Helpful from "../Helpful";
import { useAction } from "../useAction";

const MAX_ERROR_CHARS = 8000;

// Errors are usually at the end of a log. Starting on a whole word means a
// secret cut in half can't slip past the check on the server.
function endOfLog(text) {
  if (text.length <= MAX_ERROR_CHARS) return text;
  return text.slice(-MAX_ERROR_CHARS).replace(/^\S*\s*/, "");
}

const TEXT = {
  error: {
    summary: "Stuck on an error? Paste it here",
    label: "Your error message",
    button: "Explain this error",
  },
  setup: {
    summary: "Did my setup work? Paste what your terminal printed",
    label: "What your terminal printed",
    button: "Check my setup",
  },
};

const VERDICTS = {
  yes: { label: "Looks like it worked", className: "is-clear" },
  no: { label: "It doesn't look like it worked yet", className: "is-taken" },
  unsure: { label: "Hard to tell from this output", className: "is-quiet" },
};

// mode "error" explains an error; mode "setup" says whether setting up worked.
function ErrorHelp({ issue, mode = "error" }) {
  const { repo, issue: number } = issue;
  const text = TEXT[mode];
  const fieldId = useId();
  const [errorText, setErrorText] = useState("");
  const { data, loading, run, failure } = useAction("explain-error", { repo, issue: number });
  const verdict = mode === "setup" ? VERDICTS[data?.worked] : null;

  return (
    <details>
      <summary>{text.summary}</summary>
      <label htmlFor={fieldId}>{text.label}</label>
      <textarea
        id={fieldId}
        className="devagents-field"
        rows={5}
        value={errorText}
        onChange={(event) => setErrorText(event.target.value)}
      />
      <p className="devagents-muted">Remove passwords and private details before pasting.</p>
      <button
        type="button"
        className="secondary-button"
        disabled={loading || !errorText.trim()}
        onClick={() => run({ errorText: endOfLog(errorText), ...(mode === "setup" && { mode }) })}
      >
        {loading ? "Reading it…" : text.button}
      </button>
      {data && (
        <>
          {verdict && <p className={`devagents-status ${verdict.className}`}>{verdict.label}</p>}
          <p className="devagents-text">{data.meaning}</p>
          {data.nextSteps?.length > 0 && (
            <>
              <p className="devagents-note">
                These steps are AI-written. Check every command against the project's own docs before
                you run it.
              </p>
              <ol>
                {data.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </>
          )}
          <Helpful action="explain-error" />
        </>
      )}
      {failure}
    </details>
  );
}

export default ErrorHelp;
