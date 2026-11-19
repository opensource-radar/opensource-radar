// Shared, side-effect-free helpers for the extension. It's a plain script
// (content scripts can't be modules), so it puts its helpers on
// globalThis.RadarExtension for content.js, background.js and the tests.
(() => {
  const SITE = "https://opensource-radar.com";
  const NAME = /^[\w.-]+$/;
  // GitHub pages under owner/repo that aren't repositories' issues.
  const NOT_OWNERS = new Set(["orgs", "settings", "marketplace", "notifications", "topics", "sponsors", "features"]);

  const LEVEL_LABELS = {
    high: "Very beginner-friendly",
    medium: "Fairly beginner-friendly",
    low: "Less active with newcomers",
  };

  // "/owner/repo/issues/123" (with anything after it) → { repo, number }, else null.
  function parseIssuePath(pathname) {
    const [owner, name, kind, number] = String(pathname || "").split("/").filter(Boolean);
    if (kind !== "issues" || !/^\d{1,9}$/.test(number ?? "")) return null;
    if (!NAME.test(owner ?? "") || !NAME.test(name ?? "") || NOT_OWNERS.has(owner)) return null;
    return { repo: `${owner}/${name}`, number: Number(number) };
  }

  const helpUrl = (repo, number) => `${SITE}/help/${repo}/${number}`;

  function replyTime(hours) {
    if (typeof hours !== "number" || hours < 0) return null;
    if (hours < 24) return "within a day";
    const days = Math.round(hours / 24);
    if (days < 14) return `in about ${days} ${days === 1 ? "day" : "days"}`;
    return `in about ${Math.round(days / 7)} weeks`;
  }

  // The project's friendliness in words, the same as on the site.
  function friendlinessSummary(friendliness) {
    if (!friendliness) return null;
    const facts = [];
    const reply = replyTime(friendliness.replyHours);
    if (reply) facts.push(`Maintainers usually reply ${reply}`);
    if (friendliness.outsideClosed >= 3) {
      facts.push(
        `${friendliness.outsideMerged} of the last ${friendliness.outsideClosed} pull requests from outside contributors were merged`,
      );
    }
    facts.push(friendliness.hasContributing ? "Has a contributing guide" : "No contributing guide");
    facts.push(friendliness.hasCi ? "Uses automatic checks (GitHub Actions)" : "No automatic checks found");
    return { level: friendliness.level ?? null, label: LEVEL_LABELS[friendliness.level] ?? "Not enough activity to rate", facts };
  }

  // Whether someone can start on the issue now.
  function stillFree({ state, assigned, openPullRequests }) {
    if (state === "closed") return { status: "closed", text: "This issue is closed." };
    const reasons = [];
    if (assigned) reasons.push("Someone is assigned to it.");
    if (openPullRequests > 0) {
      reasons.push(
        openPullRequests === 1
          ? "A pull request is already open for it."
          : `${openPullRequests} pull requests are already open for it.`,
      );
    }
    if (reasons.length > 0) return { status: "taken", text: `Someone may already be working on this. ${reasons.join(" ")}` };
    return { status: "free", text: "Still free: nobody is assigned and no pull request is open." };
  }

  // Open pull requests that mention the issue, from GitHub's timeline events.
  function countOpenPullRequests(events) {
    if (!Array.isArray(events)) return 0;
    const seen = new Set();
    for (const event of events) {
      const source = event?.source?.issue;
      if (event?.event !== "cross-referenced" || !source?.pull_request || source.state !== "open") continue;
      seen.add(source.html_url ?? source.id);
    }
    return seen.size;
  }

  globalThis.RadarExtension = {
    SITE,
    parseIssuePath,
    helpUrl,
    friendlinessSummary,
    stillFree,
    countOpenPullRequests,
    replyTime,
  };
})();
