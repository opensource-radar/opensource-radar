import { useEffect } from "react";
import CopyButton from "./CopyButton";
import { useAction } from "./useAction";

// "How do I run the tests?", worked out from the project's own files.
function TestCommand({ repo, issue }) {
  const { data, status, run } = useAction("test-command", { repo, issue }, `tests:${repo}`);

  useEffect(() => {
    if (status === "idle" && !data) run();
  }, [status, data, run]);

  // Extra help, so a failure just leaves it out.
  if (!data?.commands?.length) return null;
  return (
    <div className="devagents-testcommand">
      <h3>Run the tests on your computer</h3>
      <p className="devagents-muted">From the project&rsquo;s own files. Run it in the project folder before you submit.</p>
      <ul>
        {data.commands.map(({ command, source }) => (
          <li key={command}>
            <code>{command}</code> <CopyButton text={command} label="Copy" />
            <span className="devagents-muted"> from {source}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default TestCommand;
