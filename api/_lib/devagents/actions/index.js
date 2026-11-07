import { explain } from "./explain.js";
import { issueCheck } from "./issueCheck.js";

// Every DevAgents action. `llm: true` means it can call an LLM, so it needs
// { repo, issue } and counts towards the daily limits.
export const actions = {
  "issue-check": { llm: false, handler: issueCheck },
  explain: { llm: true, handler: explain },
};
