import { DevAgentsError } from "./errors.js";

const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;

export function isRepoName(value) {
  return (
    typeof value === "string" &&
    REPO_PATTERN.test(value) &&
    !value.split("/").some((part) => part === "." || part === "..")
  );
}

export function isPositiveInt(value) {
  return Number.isSafeInteger(value) && value > 0;
}

// Reads { repo: "owner/name", issue: number } from a request body.
export function parseTarget(payload) {
  if (!isRepoName(payload?.repo) || !isPositiveInt(payload?.issue)) {
    throw new DevAgentsError("invalid_request", 400);
  }
  return { repo: payload.repo, issue: payload.issue };
}
