import { languagePageFor } from "./seoPages";

// A branch name for an issue: "fix-issue-203".
export const branchFor = (number) => `fix-issue-${number}`;

// The command-line steps for working on one issue. `login` fills in the
// person's own fork when it's known.
export function gitCommands({ repo, number, language, login }) {
  const [, name] = repo.split("/");
  const owner = login || "YOUR-USERNAME";
  const branch = branchFor(number);
  const project = languagePageFor(language)?.commands ?? [];
  return [
    { label: "Copy your fork to your computer", command: `git clone https://github.com/${owner}/${name}.git` },
    { label: "Go into the project", command: `cd ${name}` },
    { label: "Get updates from the original project later", command: `git remote add upstream https://github.com/${repo}.git` },
    { label: "Make a branch for this issue", command: `git checkout -b ${branch}` },
    ...project.map(([label, command]) => ({ label, command })),
    { label: "Save your change", command: `git add -A\ngit commit -m "Fix #${number}"` },
    { label: "Send it to your fork", command: `git push -u origin ${branch}` },
  ];
}
