// Plain explanations of open-source words, shown when someone hovers or taps
// them (src/components/Glossary.jsx).
export const GLOSSARY = [
  { key: "pull request", match: /pull requests?\b/i, text: "A request to the project to add your changes. Maintainers review it, then merge it or ask for changes." },
  { key: "fork", match: /\bfork(?:s|ed)?\b/i, text: "Your own copy of someone else's repository on GitHub. You make changes there, then suggest them to the original." },
  { key: "clone", match: /\bclone\b/i, text: "To download a repository to your computer, so you can work on it locally." },
  { key: "branch", match: /\bbranch(?:es)?\b/i, text: "A separate line of work in a repository. Each change gets its own branch, so it can be reviewed on its own." },
  { key: "commit", match: /\bcommits?\b/i, text: "A saved snapshot of your changes, with a short message saying what changed." },
  { key: "push", match: /\bpush\b/i, text: "To upload your commits from your computer to GitHub." },
  { key: "merge", match: /\bmerged?\b/i, text: "To add the changes from a pull request into the project's main code. Maintainers do this once they're happy with it." },
  { key: "repository", match: /\brepositor(?:y|ies)\b/i, text: "A project's folder of code and its full history, hosted on GitHub." },
  { key: "maintainer", match: /\bmaintainers?\b/i, text: "Someone who looks after a project: they review pull requests and decide what gets merged." },
  { key: "contributing guide", match: /\bcontributing guide\b/i, text: "A file (often CONTRIBUTING.md) explaining how to set up the project and how the maintainers like contributions." },
  { key: "tests", match: /\btests\b/i, text: "Code that checks the project still works. Run them before you open a pull request." },
  { key: "review", match: /\breview\b/i, text: "When maintainers read your pull request and comment or ask for changes before merging it." },
];

// Splits text into plain strings and glossary words. Only the first use of
// each word is marked, across everything that shares the same `seen` set.
export function splitGlossary(text, seen = new Set()) {
  const parts = [];
  let rest = String(text);
  for (;;) {
    let best = null;
    for (const entry of GLOSSARY) {
      if (seen.has(entry.key)) continue;
      const found = entry.match.exec(rest);
      if (found && (!best || found.index < best.found.index)) best = { entry, found };
    }
    if (!best) break;
    const { entry, found } = best;
    if (found.index > 0) parts.push(rest.slice(0, found.index));
    parts.push({ word: found[0], entry });
    seen.add(entry.key);
    rest = rest.slice(found.index + found[0].length);
  }
  if (rest) parts.push(rest);
  return parts;
}

// Splits several blocks of one page at once, so each word is only marked the
// first time it appears anywhere on the page. Returns one list of parts per
// block. It keeps no state between calls, so rendering twice is safe.
export function splitGlossaryBlocks(texts) {
  const seen = new Set();
  return texts.map((text) => splitGlossary(text, seen));
}
