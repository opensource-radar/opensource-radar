import { useAction } from "./useAction";

// "Explain this file" under one entry in Files to read. The answer is plain
// text only, like everything else the model writes.
function ExplainFile({ repo, issue, path }) {
  const { data, loading, run, failure } = useAction(
    "explain-file",
    { repo, issue, path },
    `explain-file:${repo}#${issue}:${path}`,
    { notFoundMessage: "We couldn't read that file. It may have moved since." },
  );

  if (!data) {
    return (
      <div className="devagents-explain-file">
        <button type="button" className="text-button" disabled={loading} onClick={() => run()}
          aria-label={`Explain ${path}`}>
          {loading ? "Reading the file…" : "Explain this file"}
        </button>
        {failure}
      </div>
    );
  }

  return (
    <div className="devagents-explain-file" aria-live="polite">
      <p>{data.summary}</p>
      {data.parts?.length > 0 && (
        <ul>
          {data.parts.map((part) => (
            <li key={part.name}>
              <code>{part.name}</code>: {part.what}
            </li>
          ))}
        </ul>
      )}
      {data.partial && <p className="devagents-note">This is a long file, so only its start was read.</p>}
    </div>
  );
}

export default ExplainFile;
