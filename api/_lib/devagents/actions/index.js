import { explainChecks, explainReview, thankYou } from "./afterPr.js";
import { checkChange } from "./checkChange.js";
import { explain } from "./explain.js";
import { explainError } from "./explainError.js";
import { explainFile } from "./explainFile.js";
import { event, feedback } from "./feedback.js";
import { hint } from "./hint.js";
import { issueCheck } from "./issueCheck.js";
import { prText } from "./prText.js";
import { testCommand } from "./testCommand.js";
import { validateKey } from "./validateKey.js";

// Every DevAgents action. `llm: true` means it can call an LLM, so it needs
// { repo, issue } and counts towards the daily limits.
export const actions = {
  "issue-check": { llm: false, handler: issueCheck },
  "test-command": { llm: false, handler: testCommand },
  explain: { llm: true, handler: explain },
  hint: { llm: true, handler: hint },
  "explain-file": { llm: true, handler: explainFile },
  "explain-error": { llm: true, handler: explainError },
  "validate-key": { llm: false, handler: validateKey },
  "check-change": { llm: true, handler: checkChange },
  "pr-text": { llm: true, handler: prText },
  "explain-checks": { llm: true, handler: explainChecks },
  "explain-review": { llm: true, handler: explainReview },
  "thank-you": { llm: true, handler: thankYou },
  feedback: { llm: false, handler: feedback },
  event: { llm: false, handler: event },
};
