import { useEffect } from "react";
import { callDevAgents } from "../client";
import Helpful from "../Helpful";
import { fileUrl } from "../links";
import { useAction } from "../useAction";
import IssueCheck from "./IssueCheck";

const DIFFICULTY = { easy: "Easy", medium: "Medium", hard: "Hard" };

// LLM and repo text only ever appears as plain text in here, so it can't add
// anything to the page.
function Understand({ issue, onShare }) {
  const { repo, issue: number } = issue;
  const { data, loading, run, failure } = useAction(
    "explain",
    { repo, issue: number },
    `explain:${repo}#${number}`,
  );

  useEffect(() => {
    if (data) onShare?.({ explain: data });
  }, [data, onShare]);

  return (
    <div>
      <IssueCheck issue={issue} />

      {!data && (
        <button type="button" onClick={() => {
            callDevAgents("event", { name: "explain" });
            run();
          }} disabled={loading}>
          {loading ? "Reading the project…" : "Explain this issue"}
        </button>
      )}

      {data && (
        <>
          <p className="devagents-text">{data.summary}</p>
          {DIFFICULTY[data.difficulty] && (
            <p>
              <strong>Difficulty:</strong> {DIFFICULTY[data.difficulty]}
            </p>
          )}

          {data.partial && (
            <p className="devagents-note">
              We couldn't work out which files to read this time. Try again later for that part.
            </p>
          )}

          {data.filesToRead?.length > 0 && (
            <>
              <h4>Files to read</h4>
              <ul>
                {data.filesToRead.map((file) => (
                  <li key={file.path}>
                    <a
                      href={fileUrl(repo, data.branch, file.path, file.line)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {file.path}
                      {file.line ? `, line ${file.line}` : ""} ↗
                    </a>
                    {file.why && <> – {file.why}</>}
                  </li>
                ))}
              </ul>
            </>
          )}

          {data.setupSteps?.length > 0 && (
            <>
              <h4>How to run the project</h4>
              <ol>
                {data.setupSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </>
          )}

          {data.rules?.length > 0 && (
            <>
              <h4>Project rules</h4>
              <ul>
                {data.rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </>
          )}

          <Helpful action="explain" />
        </>
      )}

      {failure}
    </div>
  );
}

export default Understand;
