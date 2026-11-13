// Words for the beginner-friendliness signals the server sends with project
// details (api/_lib/friendliness.js).

export const LEVEL_LABELS = {
  high: "Very beginner-friendly",
  medium: "Fairly beginner-friendly",
  low: "Less active with newcomers",
};

// "within a day", "in about 3 days", "in about 2 weeks"
export function replyTime(hours) {
  if (typeof hours !== "number" || hours < 0) return null;
  if (hours < 24) return "within a day";
  const days = Math.round(hours / 24);
  if (days < 14) return `in about ${days} ${days === 1 ? "day" : "days"}`;
  const weeks = Math.round(days / 7);
  return `in about ${weeks} weeks`;
}

// The one line shown on issue cards, or null when there isn't enough data.
export function replyLine(friendliness) {
  const when = replyTime(friendliness?.replyHours);
  return when ? `Maintainers usually reply ${when}` : null;
}

// Short facts for the help page and the project page.
export function friendlinessFacts(friendliness) {
  if (!friendliness) return [];
  const facts = [];
  const reply = replyLine(friendliness);
  if (reply) facts.push(reply);
  if (friendliness.outsideClosed >= 3) {
    facts.push(
      `${friendliness.outsideMerged} of the last ${friendliness.outsideClosed} pull requests from outside contributors were merged`,
    );
  }
  facts.push(friendliness.hasContributing ? "Has a contributing guide" : "No contributing guide");
  facts.push(friendliness.hasCi ? "Uses automatic checks (GitHub Actions)" : "No automatic checks found");
  return facts;
}
