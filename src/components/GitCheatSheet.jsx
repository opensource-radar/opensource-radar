import CopyButton from "../devagents/CopyButton";
import { gitCommands } from "../lib/gitCommands";
import "./GitCheatSheet.css";

// "Prefer the command line?" on the help page's Change step: the exact Git
// commands for this issue, each with a copy button.
function GitCheatSheet({ repo, number, language, login }) {
  const steps = gitCommands({ repo, number, language, login });
  const all = steps.map((step) => step.command).join("\n");
  return (
    <details className="git-cheat-sheet">
      <summary>Prefer the command line? Git commands for this issue</summary>
      <p className="devagents-muted">
        First fork the project on GitHub (
        <a href={`https://github.com/${repo}/fork`} target="_blank" rel="noopener noreferrer">
          fork {repo} ↗
        </a>
        ){login ? "" : ", then replace YOUR-USERNAME with your GitHub username"}. Check the project's
        README for its exact setup.
      </p>
      <ol>
        {steps.map((step) => (
          <li key={step.label}>
            <span>{step.label}</span>
            <code>{step.command}</code>
            <CopyButton text={step.command} label="Copy" />
          </li>
        ))}
      </ol>
      <CopyButton text={all} label="Copy all" className="secondary-button" />
    </details>
  );
}

export default GitCheatSheet;
