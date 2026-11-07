import { explain } from "./explain.js";
import { explainError } from "./explainError.js";
import { hint } from "./hint.js";
import { issueCheck } from "./issueCheck.js";
import { validateKey } from "./validateKey.js";

// Every DevAgents action. `llm: true` means it can call an LLM, so it needs
// { repo, issue } and counts towards the daily limits.
export const actions = {
  "issue-check": { llm: false, handler: issueCheck },
  explain: { llm: true, handler: explain },
  hint: { llm: true, handler: hint },
  "explain-error": { llm: true, handler: explainError },
  "validate-key": { llm: false, handler: validateKey },
};
