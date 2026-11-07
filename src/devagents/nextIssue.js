import { DEFAULT_FILTERS, stateToUrl } from "../search";

// A small step up from "good first issue", in the same language.
export function nextIssueUrl(language) {
  const query = stateToUrl(
    { ...DEFAULT_FILTERS, language: language || "", labels: ["help-wanted"] },
    "",
    1,
  );
  return `/${query}`;
}
