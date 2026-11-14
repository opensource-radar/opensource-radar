// "Is this a good first issue?" A rule-based checklist for maintainers, from
// the public details /api/issue returns. No AI: every rule is a simple text check.

// Accepts an issue link or "owner/repo#123".
export function parseIssue(input) {
  const text = String(input).trim();
  const fromUrl = text.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d{1,9})(?:[/?#].*)?$/i);
  const short = text.match(/^([\w.-]+)\/([\w.-]+)#(\d{1,9})$/);
  const match = fromUrl ?? short;
  if (!match || [match[1], match[2]].some((part) => /^\.+$/.test(part))) return null;
  return { repo: `${match[1]}/${match[2]}`, number: Number(match[3]) };
}

const BEGINNER_LABEL = /good[\s-]?first|beginner|first[\s-]?timer|starter|easy|newcomer|low[\s-]?hanging/i;
const DONE_WORDS = /\b(expected|should|acceptance|done when|definition of done|goal|outcome|result)\b|- \[ \]/i;
// A path like src/app.js or a GitHub link to a file or line.
const FILE_MENTION = /github\.com\/[\w.-]+\/[\w.-]+\/(?:blob|tree)\/|(?:^|[\s`(])[\w.-]+(?:\/[\w.-]+)*\.[a-z]{1,6}(?::\d+)?(?=[\s`),.:]|$)/im;
const MIN_EXPLANATION = 120;
const MAX_LENGTH = 4000;

// Each check: id, label, passed (true/false), and a tip when it didn't pass.
export function checkIssue(issue) {
  const body = issue.body ?? "";
  const length = issue.bodyLength ?? body.length;
  return [
    {
      id: "open",
      label: "It's open",
      passed: issue.state !== "closed",
      tip: "Closed issues don't show up in good first issue searches.",
    },
    {
      id: "explains",
      label: "It explains what's wrong",
      passed: body.replace(/<!--[\s\S]*?-->/g, "").trim().length >= MIN_EXPLANATION,
      tip: "Add a few sentences on what happens now and why it matters. Newcomers can't ask the hallway.",
    },
    {
      id: "done",
      label: "It says what done looks like",
      passed: DONE_WORDS.test(body),
      tip: "Add an \"Expected\" line or a short checklist, so people know when they're finished.",
    },
    {
      id: "files",
      label: "It points to the files involved",
      passed: FILE_MENTION.test(body),
      tip: "Name the file or link the lines to change. It's the biggest help for a first-timer.",
    },
    {
      id: "label",
      label: "It has a beginner label",
      passed: (issue.labels ?? []).some((label) => BEGINNER_LABEL.test(label)),
      tip: "Add \"good first issue\" so beginner searches (and OpenSource Radar) can find it.",
    },
    {
      id: "unassigned",
      label: "Nobody is assigned",
      passed: issue.assigned !== true,
      tip: "Assigned issues look taken. Unassign it if the person has gone quiet.",
    },
    {
      id: "length",
      label: "It's short enough to read",
      passed: length <= MAX_LENGTH,
      tip: "Long issues put beginners off. Move background into a linked doc and keep the steps.",
    },
  ];
}
