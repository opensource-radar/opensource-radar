import { useId, useState } from "react";
import CopyButton from "../CopyButton";
import { prUrl } from "../links";
import { useAction } from "../useAction";

function Submit({ issue, shared }) {
  const { repo, issue: number } = issue;
  const fieldId = useId();
  const [typed, setTyped] = useState(null);
  const change = typed ?? shared?.change ?? "";
  const { data, loading, run, failure } = useAction(
    "pr-text",
    { repo, issue: number },
    null,
    { notFoundMessage: "We couldn't find that change yet. Check the branch name, and that you've saved your edit on GitHub." },
  );

  const link = data
    ? prUrl(repo, data.baseBranch, data.headOwner, data.branch, {
        title: data.title,
        body: data.body,
      })
    : null;

  return (
    <div>
      <label htmlFor={fieldId}>Your branch name or link</label>
      <input
        id={fieldId}
        className="devagents-field"
        value={change}
        onChange={(event) => setTyped(event.target.value)}
      />
      <button
        type="button"
        disabled={loading || !change.trim()}
        onClick={() => run({ change: change.trim() })}
      >
        {loading ? "Writing…" : "Write the PR text"}
      </button>

      {data && (
        <>
          {data.title ? (
            <p>
              <strong>{data.title}</strong> <CopyButton text={data.title} label="Copy title" />
            </p>
          ) : (
            <p role="status">
              This project doesn't accept AI-written contributions, so write the title and
              description yourself.
            </p>
          )}
          <p className="devagents-text">{data.body}</p>
          {!link.bodyIncluded && (
            <p>
              This description is too long to fill in automatically.{" "}
              <CopyButton text={data.body} label="Copy description" />
            </p>
          )}
          <p>
            <a href={link.url} target="_blank" rel="noopener noreferrer">
              Open the pull request page ↗
            </a>
          </p>
          <p className="devagents-muted">
            Nothing is sent until you click "Create pull request" on GitHub.
          </p>
        </>
      )}
      {failure}
    </div>
  );
}

export default Submit;
