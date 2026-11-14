import { useEffect, useState } from "react";

// Issues someone reported from a card. They're hidden in this browser straight
// away; the server hides an issue for everyone only after several reports.

const STORAGE_KEY = "opensource-radar-hidden-issues";
const MAX_HIDDEN = 300;

export const FLAG_REASONS = [
  { value: "done", label: "Already done" },
  { value: "spam", label: "Spam" },
  { value: "broken", label: "Broken or misleading" },
];

// "owner/repo#12", lowercase, or null when the issue has no number.
export const issueKey = (issue) =>
  issue?.number && issue.repo ? `${issue.repo.replace(" / ", "/")}#${issue.number}`.toLowerCase() : null;

export function readHidden() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(stored) ? stored.filter((key) => typeof key === "string") : [];
  } catch {
    return [];
  }
}

function writeHidden(keys) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Still hidden until the page reloads.
  }
  return keys;
}

export const hideIssue = (key) => writeHidden([key, ...readHidden().filter((k) => k !== key)].slice(0, MAX_HIDDEN));
export const unhideIssue = (key) => writeHidden(readHidden().filter((k) => k !== key));

// Sending the report is best effort: the issue is hidden here either way.
export function sendReport(key, reason) {
  return fetch("/api/flags", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issue: key, reason }),
  }).catch(() => null);
}

export async function fetchHiddenForEveryone() {
  try {
    const response = await fetch("/api/flags", { headers: { Accept: "application/json" } });
    const data = response.ok ? await response.json() : null;
    return Array.isArray(data?.hidden) ? data.hidden.filter((key) => typeof key === "string") : [];
  } catch {
    return [];
  }
}

// For the search results: which issues to leave out, reporting one, and
// undoing the last report (in this browser; the report itself stays sent).
export function useHiddenIssues() {
  const [mine, setMine] = useState(readHidden);
  const [everyone, setEveryone] = useState([]);
  const [lastHidden, setLastHidden] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchHiddenForEveryone().then((keys) => {
      if (!cancelled) setEveryone(keys);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const hidden = new Set([...mine, ...everyone]);
  return {
    isHidden: (issue) => hidden.has(issueKey(issue)),
    lastHidden,
    report(issue, reason) {
      const key = issueKey(issue);
      if (!key) return;
      setMine(hideIssue(key));
      setLastHidden({ key, title: issue.title });
      sendReport(key, reason);
    },
    undo() {
      if (!lastHidden) return;
      setMine(unhideIssue(lastHidden.key));
      setEveryone((keys) => keys.filter((key) => key !== lastHidden.key));
      setLastHidden(null);
    },
  };
}
