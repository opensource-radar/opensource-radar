// Rules that need no LLM: quick to run, the same every time, and easy to test.

const AI_WORDS = /\b(ai|a\.i\.|llms?|chatgpt|copilot|gpt|gemini|generative)\b|machine[- ]generated/i;
const AI_BANNED = /\b(do not|don'?t|does not|doesn'?t|will not|won'?t|not|never|no)\b[^.!?\n]*\b(accept|allow|allowed|permit|permitted|welcome|submit|use|using|ai|llms?|chatgpt|copilot|gpt|generated|written)\b|\b(ban|bans|banned|prohibit|prohibited|forbid|forbidden|reject|rejected|disallow|disallowed)\b/i;
const AI_ALLOWED = /\b(welcome|allowed|permitted|accepted|accept|may use|can use|fine|ok|okay)\b/i;

// Reads a project's written policy on AI contributions. When a project says
// both, the cautious answer wins.
export function aiPolicy(texts) {
  let allowed = false;
  for (const text of texts) {
    if (!text) continue;
    for (const sentence of text.split(/[.!?\n]+/)) {
      if (!AI_WORDS.test(sentence)) continue;
      if (AI_BANNED.test(sentence)) return "banned";
      if (AI_ALLOWED.test(sentence)) allowed = true;
    }
  }
  return allowed ? "allowed" : "unknown";
}

const RULES = [
  { id: "cla", pattern: /\bCLA\b|contributor license agreement/i, label: "Sign the contributor license agreement (CLA)" },
  { id: "dco", pattern: /\bDCO\b|signed-off-by|sign[- ]off/i, label: "Add a sign-off line to your commits" },
  { id: "tests", pattern: /\b(add|write|include|run|update)\b[^.\n]*\btests?\b|\btests?\b[^.\n]*\b(must|should|required)\b/i, label: "Add or run tests for your change" },
  { id: "changelog", pattern: /change ?log/i, label: "Add a note to the changelog" },
  { id: "commit_format", pattern: /conventional commits?|commit messages?\b/i, label: "Follow the project's commit message style" },
  { id: "issue_first", pattern: /\b(open|create|discuss|comment)\b[^.\n]*\bissue\b[^.\n]*\b(first|before)\b|\bbefore\b[^.\n]*\b(open|create|discuss)\b[^.\n]*\bissue\b/i, label: "Talk about the change in an issue before starting" },
];

export function repoRules(text) {
  if (!text) return [];
  return RULES.filter((rule) => rule.pattern.test(text)).map(({ id, label }) => ({ id, label }));
}

const DAY_MS = 24 * 60 * 60 * 1000;
const CLAIM_WITHIN_DAYS = 30;
const QUIET_AFTER_DAYS = 180;
const MAINTAINER_ROLES = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
const CLAIM = /\b(i'?d like to|i would like to|i want to|can i|may i|could i|i'?ll|i will|i am|i'?m|let me)\b[^.?!\n]*\b(work|working|take|taking|pick|picking|handle|handling|fix|fixing)\b|\bassign\b[^.?!\n]*\bme\b/i;
const RELEASED = /\b(up for grabs|still available|anyone can|open to anyone|free to take|no one is working)\b/i;
const MENTION = /@([\w-]+)/g;

const isMaintainer = (comment) => MAINTAINER_ROLES.has(comment.author_association);
const ageDays = (date, now) => (now - new Date(date).getTime()) / DAY_MS;

// True if a maintainer's later comment makes an earlier claim no longer count.
function claimReleased(claim, later) {
  const claimer = claim.user?.login?.toLowerCase();
  return later.filter(isMaintainer).some((comment) => {
    const body = comment.body ?? "";
    if (RELEASED.test(body)) return true;
    const mentioned = [...body.matchAll(MENTION)].map((match) => match[1].toLowerCase());
    return mentioned.length > 0 && !mentioned.includes(claimer);
  });
}

// Works out whether it's safe for a beginner to start on this issue.
export function claimStatus({ issue, comments, linkedPulls, now }) {
  if (issue.state === "closed") {
    return { verdict: "closed", reasons: ["This issue is closed."] };
  }

  const reasons = [];
  if (issue.assignees?.length > 0) reasons.push("Someone is assigned to this issue.");

  const openPull = linkedPulls.find((pull) => pull.state === "open");
  if (openPull) reasons.push(`Pull request #${openPull.number} is already open for this issue.`);

  comments.forEach((comment, index) => {
    if (reasons.length > 0 || isMaintainer(comment) || !comment.created_at) return;
    if (ageDays(comment.created_at, now) > CLAIM_WITHIN_DAYS) return;
    if (!CLAIM.test(comment.body ?? "")) return;
    if (claimReleased(comment, comments.slice(index + 1))) return;
    reasons.push(`Someone asked to work on this ${Math.floor(ageDays(comment.created_at, now))} days ago.`);
  });

  if (reasons.length > 0) return { verdict: "taken", reasons };

  const maintainerActive = comments.some(
    (comment) =>
      isMaintainer(comment) &&
      comment.created_at &&
      ageDays(comment.created_at, now) < QUIET_AFTER_DAYS,
  );
  if (
    !maintainerActive &&
    issue.updated_at &&
    ageDays(issue.updated_at, now) > QUIET_AFTER_DAYS
  ) {
    return {
      verdict: "quiet",
      reasons: ["Nothing has happened on this issue for over 6 months, so a maintainer may not reply."],
    };
  }

  return { verdict: "clear", reasons: ["Not taken yet."] };
}
