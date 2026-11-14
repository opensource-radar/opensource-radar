import { useEffect } from "react";
import { checkedAgo } from "./checkedAt";
import { useAction } from "./useAction";

// A fresh "is it still free?" check right before someone starts changing
// code. Unlike the Understand step, it never shows a saved answer.
function StillFree({ issue }) {
  const { repo, issue: number } = issue;
  const { data, loading, run, status, failure } = useAction("issue-check", { repo, issue: number });

  useEffect(() => {
    if (status === "idle" && !data) run();
  }, [status, data, run]);

  if (!data) {
    return (
      <div className="devagents-stillfree">
        {loading && <p className="devagents-muted">Checking the issue is still free…</p>}
        {failure}
      </div>
    );
  }

  const free = data.verdict === "clear";
  return (
    <div className="devagents-stillfree" aria-live="polite">
      <p className={`devagents-status is-${data.verdict}`}>
        {free ? "Still free" : "Check before you start"}
        <span className="devagents-muted"> · checked {checkedAgo(data.checkedAt) ?? "just now"}</span>
      </p>
      {!free && (
        <ul>
          {data.reasons?.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      {data.notes?.map((note) => (
        <p key={note} className="devagents-note">
          {note}
        </p>
      ))}
      <button type="button" className="text-button" disabled={loading} onClick={() => run()}>
        {loading ? "Checking…" : "Check again"}
      </button>
    </div>
  );
}

export default StillFree;
