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

function ErrorHelp({ issue }) {
  const { repo, issue: number } = issue;
  const fieldId = useId();
  const [errorText, setErrorText] = useState("");
  const { data, loading, run, failure } = useAction("explain-error", { repo, issue: number });

  return (
    <details>
      <summary>Stuck on an error? Paste it here</summary>
      <label htmlFor={fieldId}>Your error message</label>
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
        disabled={loading || !errorText.trim()}
        onClick={() => run({ errorText: endOfLog(errorText) })}
      >
        {loading ? "Reading it…" : "Explain this error"}
      </button>
      {data && (
        <>
          <p className="devagents-text">{data.meaning}</p>
          <p className="devagents-note">
            These steps are AI-written. Check every command against the project's own docs before
            you run it.
          </p>
          <ol>
            {data.nextSteps?.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <Helpful action="explain-error" />
        </>
      )}
      {failure}
    </details>
  );
}

export default ErrorHelp;
