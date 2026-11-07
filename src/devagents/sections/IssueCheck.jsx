import { useEffect } from "react";
import CopyButton from "../CopyButton";
import { issueUrl } from "../links";
import { useAction } from "../useAction";

const HEADLINES = {
  clear: "Not taken yet",
  taken: "Someone may already be working on this",
  quiet: "This issue has been quiet for a long time",
  closed: "This issue is closed",
};

function IssueCheck({ issue, onShare }) {
  const { repo, issue: number } = issue;
  const { data, loading, run, status, failure } = useAction(
    "issue-check",
    { repo, issue: number },
    `check:${repo}#${number}`,
  );

  useEffect(() => {
    if (status === "idle" && !data) run();
  }, [status, data, run]);

  useEffect(() => {
    if (data?.title) onShare?.({ issueTitle: data.title });
  }, [data, onShare]);

  return (
    <div>
      {loading && !data && <p className="devagents-muted">Checking this issue…</p>}
      {data && (
        <>
          <p className={`devagents-status is-${data.verdict}`}>
            {HEADLINES[data.verdict] ?? "Check this issue"}
          </p>
          {data.verdict !== "clear" && (
            <ul>
              {data.reasons?.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
          {data.paymentClaim && (
            <p className="devagents-callout" role="alert">
              This issue mentions payment. We can't verify payment promises, so check the project
              carefully, and never pay or share wallet details to take part.
            </p>
          )}
          {data.archived && <p className="devagents-callout">This project is archived, so it won't accept changes.</p>}
          {data.aiPolicy === "banned" && (
            <p className="devagents-callout" role="alert">
              This project doesn't accept AI-written contributions. We can explain things, but we
              won't draft any text. Write everything yourself.
            </p>
          )}
          {data.rules?.length > 0 && (
            <>
              <p>This project asks you to:</p>
              <ul>
                {data.rules.map((rule) => (
                  <li key={rule.id}>{rule.label}</li>
                ))}
              </ul>
            </>
          )}
          {data.verdict === "clear" && data.claimComment && (
            <p>
              Ask before you start:{" "}
              <CopyButton text={data.claimComment} label="Copy a friendly comment" />
              {" and "}
              <a href={issueUrl(repo, number)} target="_blank" rel="noopener noreferrer">
                post it on the issue ↗
              </a>
            </p>
          )}
        </>
      )}
      {failure}
    </div>
  );
}

export default IssueCheck;
