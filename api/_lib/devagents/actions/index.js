import { explainChecks, explainReview } from "./afterPr.js";
import { checkChange } from "./checkChange.js";
import { explain } from "./explain.js";
import { explainError } from "./explainError.js";
import { event, feedback } from "./feedback.js";
import { hint } from "./hint.js";
import { issueCheck } from "./issueCheck.js";
import { prText } from "./prText.js";
import { validateKey } from "./validateKey.js";

// Every DevAgents action. `llm: true` means it can call an LLM, so it needs
// { repo, issue } and counts towards the daily limits.
export const actions = {
  "issue-check": { llm: false, handler: issueCheck },
  explain: { llm: true, handler: explain },
  hint: { llm: true, handler: hint },
  "explain-error": { llm: true, handler: explainError },
  "validate-key": { llm: false, handler: validateKey },
  "check-change": { llm: true, handler: checkChange },
  "pr-text": { llm: true, handler: prText },
  "explain-checks": { llm: true, handler: explainChecks },
  "explain-review": { llm: true, handler: explainReview },
  feedback: { llm: false, handler: feedback },
  event: { llm: false, handler: event },
};
