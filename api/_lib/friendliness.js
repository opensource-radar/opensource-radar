// How beginner-friendly a project looks, from public GitHub data that comes
// with the project details (see fetchRepositories). Every number is a rough
// signal from a small recent sample, not a judgement of the project.

const MAINTAINERS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
const HOUR = 60 * 60 * 1000;
// An issue this old with no maintainer reply counts as unanswered. Newer ones
// may still get a reply, so they're left out.
const UNANSWERED_AFTER_DAYS = 14;
// Fewer answered issues than this isn't enough to show a reply time.
const MIN_REPLIES = 3;
const MIN_OUTSIDE_PRS = 3;

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

function replyStats(issues, now) {
  const replies = [];
  let unanswered = 0;
  for (const issue of issues) {
    // Maintainers don't need to answer their own issues.
    if (!issue || MAINTAINERS.has(issue.authorAssociation)) continue;
    const opened = Date.parse(issue.createdAt);
    if (Number.isNaN(opened)) continue;

    const reply = (issue.comments?.nodes ?? []).find((comment) =>
      MAINTAINERS.has(comment?.authorAssociation),
    );
    if (reply) {
      replies.push(Math.max(0, Date.parse(reply.createdAt) - opened) / HOUR);
    } else if (now - opened > UNANSWERED_AFTER_DAYS * 24 * HOUR) {
      unanswered += 1;
    }
  }
  return { replies, unanswered };
}

function outsidePrStats(pullRequests) {
  const outside = pullRequests.filter((pr) => pr && !MAINTAINERS.has(pr.authorAssociation));
  return { closed: outside.length, merged: outside.filter((pr) => pr.merged).length };
}

// Returns the signals and an overall level: "high", "medium", "low", or null
// when there isn't enough recent activity to say.
export function computeFriendliness(repo, now = Date.now()) {
  if (!repo) return null;

  const { replies, unanswered } = replyStats(repo.issues?.nodes ?? [], now);
  const outside = outsidePrStats(repo.pullRequests?.nodes ?? []);
  const hasCi = (repo.workflows?.entries?.length ?? 0) > 0;
  const hasContributing = Boolean(repo.contributingGuidelines?.url);

  const replyHours = replies.length >= MIN_REPLIES ? Math.round(median(replies)) : null;
  const answered = replies.length + unanswered;
  const replyRate = answered >= MIN_REPLIES ? replies.length / answered : null;
  const outsideMergeRate =
    outside.closed >= MIN_OUTSIDE_PRS ? outside.merged / outside.closed : null;

  let level = null;
  if (replyHours !== null || outsideMergeRate !== null) {
    let points = 0;
    if (hasContributing) points += 1;
    if (hasCi) points += 1;
    if (replyHours !== null) points += replyHours <= 72 ? 2 : replyHours <= 7 * 24 ? 1 : 0;
    if (replyRate !== null && replyRate >= 0.6) points += 1;
    if (outsideMergeRate !== null) points += outsideMergeRate >= 0.5 ? 2 : outsideMergeRate >= 0.25 ? 1 : 0;
    level = points >= 5 ? "high" : points >= 3 ? "medium" : "low";
    // A project that leaves most issues unanswered isn't "very" friendly,
    // however many pull requests it merges.
    if (level === "high" && replyRate !== null && replyRate < 0.3) level = "medium";
  }

  return {
    level,
    replyHours,
    replyRate: replyRate === null ? null : Math.round(replyRate * 100) / 100,
    outsideMerged: outside.merged,
    outsideClosed: outside.closed,
    hasCi,
    hasContributing,
  };
}

// GraphQL fields fetchRepositories adds for computeFriendliness.
export const FRIENDLINESS_FIELDS = `
      workflows: object(expression: "HEAD:.github/workflows") { ... on Tree { entries { name } } }
      issues(first: 40, orderBy: { field: CREATED_AT, direction: DESC }) {
        nodes { createdAt authorAssociation comments(first: 6) { nodes { createdAt authorAssociation } } }
      }
      pullRequests(last: 30, states: [MERGED, CLOSED]) { nodes { merged authorAssociation } }`;
