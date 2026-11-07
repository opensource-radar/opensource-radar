import { callDevAgents } from "../client";
import { codespacesUrl, editorUrl } from "../links";
import ErrorHelp from "./ErrorHelp";

// DevAgents never changes code. These links open GitHub's own tools, which
// handle the fork and commit from the user's own account.
function Change({ issue, shared }) {
  const { repo } = issue;
  const explain = shared?.explain;

  return (
    <div>
      <p>
        If GitHub asks, tap "Fork this repository" to make your own
        copy, then edit the file and propose your change.
      </p>
      {explain?.filesToRead?.length > 0 ? (
        <ul className="devagents-files">
          {explain.filesToRead.map((file) => (
            <li key={file.path}>
              <a
                href={editorUrl(repo, explain.branch, file.path)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => callDevAgents("event", { name: "editor_opened" })}
              >
                Edit {file.path} in the browser ↗
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="devagents-muted">Explain this issue first to get direct links to its files.</p>
      )}
      <p>
        <a href={codespacesUrl(repo)} target="_blank" rel="noopener noreferrer">
          Open in Codespaces ↗
        </a>{" "}
        <span className="devagents-muted">
          A full setup in your browser, for running tests or editing several files. It uses your
          own GitHub allowance.
        </span>
      </p>
      <ErrorHelp issue={issue} />
    </div>
  );
}

export default Change;
