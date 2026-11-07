import { useId, useState } from "react";
import Helpful from "../Helpful";
import { useAction } from "../useAction";

function Check({ issue, shared, onShare }) {
  const { repo, issue: number } = issue;
  const fieldId = useId();
  const [change, setChange] = useState("");
  const { data, loading, run, failure } = useAction(
    "check-change",
    { repo, issue: number },
    null,
    { notFoundMessage: "We couldn't find that change yet. Check the branch name, and that you've saved your edit on GitHub." },
  );
  const facts = data?.facts;

  const submit = () => {
    onShare?.({ change: change.trim() });
    run({
      change: change.trim(),
      expectedFiles: shared?.explain?.filesToRead?.map((file) => file.path) ?? [],
    });
  };

  return (
    <div>
      <label htmlFor={fieldId}>Your branch name or link</label>
      <input
        id={fieldId}
        className="devagents-field"
        value={change}
        placeholder="patch-1"
        onChange={(event) => setChange(event.target.value)}
      />
      <button type="button" disabled={loading || !change.trim()} onClick={submit}>
        {loading ? "Checking…" : "Check my change"}
      </button>

      {facts && (
        <>
          <p>
            {facts.filesChanged} {facts.filesChanged === 1 ? "file" : "files"} changed: +
            {facts.additions} / -{facts.deletions}
          </p>
          {facts.touchesUnrelatedFiles && (
            <p>This changes files outside the ones suggested. Check that each one is needed.</p>
          )}
          {facts.summarised && (
            <p className="devagents-note">
              This change is large, so we only looked at the file names.
            </p>
          )}
          {data.findings?.length > 0 && (
            <ul>
              {data.findings.map((finding) => (
                <li key={`${finding.path}:${finding.note}`}>
                  <code>{finding.path}</code>: {finding.note}
                </li>
              ))}
            </ul>
          )}
          {data.rules?.length > 0 && (
            <>
              <p>Before you submit, this project asks you to:</p>
              <ul>
                {data.rules.map((rule) => (
                  <li key={rule.id}>{rule.label}</li>
                ))}
              </ul>
            </>
          )}
          <p className="devagents-muted">
            This check can miss things. Run the project's tests if you can.
          </p>
          <Helpful action="check-change" />
        </>
      )}
      {failure}
    </div>
  );
}

export default Check;
