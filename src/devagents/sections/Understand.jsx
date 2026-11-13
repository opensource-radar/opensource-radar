import { useEffect } from "react";
import { callDevAgents } from "../client";
import Helpful from "../Helpful";
import { fileUrl } from "../links";
import { useAction } from "../useAction";
import IssueCheck from "./IssueCheck";
import ReadAloud from "../../components/ReadAloud";

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
      <IssueCheck issue={issue} onShare={onShare} />

      {!data && (
        <button type="button" className="primary-button" disabled={loading}
          onClick={async () => {
            // One at a time: two requests at once could both try to renew an
            // expiring sign-in, and the loser would be signed out.
            await run();
            callDevAgents("event", { name: "explain" });
          }}>
          {loading ? "Reading the project…" : "Explain this issue"}
        </button>
      )}

      {data && (
        <>
          <p className="devagents-text">{data.summary}</p>
          <ReadAloud text={data.summary} />
          {DIFFICULTY[data.difficulty] && (
            <p className="devagents-difficulty">Difficulty: {DIFFICULTY[data.difficulty]}</p>
          )}

          {data.partial && (
            <p className="devagents-note">
              We couldn't work out which files to read this time. Try again later for that part.
            </p>
          )}

          {data.largeRepo && (
            <p className="devagents-note">
              This is a big project, so we only looked at part of its file list. There may be other
              files that matter.
            </p>
          )}

          {data.filesToRead?.length > 0 && (
            <>
              <h3>Files to read</h3>
              <ul className="devagents-files">
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
                    {file.why && <span>{file.why}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}

          {data.setupSteps?.length > 0 && (
            <>
              <h3>How to run the project</h3>
              <p className="devagents-note">
                These steps are AI-written. Check every command against the project's own docs
                before you run it.
              </p>
              <ol>
                {data.setupSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </>
          )}

          {data.rules?.length > 0 && (
            <>
              <h3>Project rules</h3>
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
