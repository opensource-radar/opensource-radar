// A rough guess at how long an issue takes, from its labels and text. No AI:
// just a few signals, so it's clearly shown as an estimate.
const QUICK = /\b(typo|typos|docs?|documentation|readme|spelling|grammar|translat\w*|broken link|wording)\b/i;
const MEDIUM = /\b(tests?|refactor\w*|renam\w*|lint\w*|styl\w*|css|ui|ux|accessibility|a11y|type hints?)\b/i;
const BIG = /\b(feature|implement\w*|integration|migrat\w*|redesign|rewrite|performance|new (?:page|endpoint|command|option)|support for)\b/i;
const FILE_PATH = /\b[\w./-]+\.(?:js|jsx|ts|tsx|py|go|rs|java|kt|swift|rb|php|cs|cpp|c|h|md|css|scss|html|vue|svelte|yml|yaml|json)\b/gi;

export const ESTIMATES = {
  quick: { label: "~30 min", detail: "Looks like a small fix" },
  medium: { label: "~2 hours", detail: "Looks like a few hours of work" },
  long: { label: "A weekend", detail: "Looks like a bigger piece of work" },
};

export function estimateTime({ title = "", labels = "", body = "" }) {
  const heading = `${title} ${labels}`;
  const text = String(body);
  let score = 0;

  if (QUICK.test(heading)) score -= 2;
  else if (BIG.test(heading)) score += 2;
  else if (MEDIUM.test(heading)) score += 0;
  else if (QUICK.test(text)) score -= 1;
  else if (BIG.test(text)) score += 1;

  // Issue templates make many issues long, so length only nudges the guess.
  if (text.length < 300) score -= 1;
  if (text.length > 4000) score += 1;
  if ((text.match(/```/g)?.length ?? 0) >= 4) score += 1;
  if ((text.match(/^\s*[-*] \[[ x]\]/gim)?.length ?? 0) >= 3) score += 1;

  const files = new Set(text.match(FILE_PATH) ?? []);
  if (files.size >= 4) score += 1;

  // Only call it quick when something says it's a small kind of task;
  // a short bug report can still take a while.
  // Bodies often mention docs or the README in passing, so only the title and
  // labels count here.
  const smallTask = QUICK.test(heading);
  if (score <= -1 && smallTask) return "quick";
  return score >= 2 ? "long" : "medium";
}
