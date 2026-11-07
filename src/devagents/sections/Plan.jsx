import CopyButton from "../CopyButton";
import Helpful from "../Helpful";
import { useAction } from "../useAction";

const BUTTONS = { 1: "Give me a hint", 2: "Show the next hint", 3: "Show the last hint" };

function HintLevel({ issue, level, children }) {
  const { repo, issue: number } = issue;
  const { data, loading, run, failure } = useAction(
    "hint",
    { repo, issue: number, level },
    `hint:${repo}#${number}:${level}`,
  );

  return (
    <>
      {data ? (
        <p className="devagents-text">{data.hint}</p>
      ) : (
        <button type="button" className="secondary-button" disabled={loading} onClick={() => run()}>
          {loading ? "Thinking…" : BUTTONS[level]}
        </button>
      )}
      {data?.draft && (
        <div>
          <p>
            A draft {data.draft.kind} for <code>{data.draft.path}</code>. Read it and change it so
            it's right before you use it.
          </p>
          <pre className="devagents-text">{data.draft.text}</pre>
          <CopyButton text={data.draft.text} label="Copy draft" />
        </div>
      )}
      {failure}
      {data && level === 1 && <Helpful action="hint" />}
      {data && children}
    </>
  );
}

// Each hint appears only after the one before it, so people try things first.
function Plan({ issue }) {
  return (
    <div>
      <HintLevel issue={issue} level={1}>
        <HintLevel issue={issue} level={2}>
          <HintLevel issue={issue} level={3} />
        </HintLevel>
      </HintLevel>
    </div>
  );
}

export default Plan;
