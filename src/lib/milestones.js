// Milestone badges, from merged pull requests. Counts come from what's loaded
// (the most recent 30), so a badge may show up late but never too early.

const MERGED = [
  { id: "merged-1", count: 1, label: "First merged pull request", icon: "🌱" },
  { id: "merged-5", count: 5, label: "5 merged pull requests", icon: "🌿" },
  { id: "merged-10", count: 10, label: "10 merged pull requests", icon: "🌳" },
  { id: "merged-25", count: 25, label: "25 merged pull requests", icon: "🏔️" },
];
const PROJECTS = [
  { id: "projects-3", count: 3, label: "3 different projects", icon: "🧭" },
  { id: "projects-10", count: 10, label: "10 different projects", icon: "🗺️" },
];

// `pullRequests`: merged ones, each { repo, madeWithRadar }. `totalMerged` can
// be higher than the list when GitHub knows about more.
export function milestones({ totalMerged, pullRequests }) {
  const merged = Math.max(totalMerged ?? 0, pullRequests.length);
  const projects = new Set(pullRequests.map((pr) => pr.repo.toLowerCase()).filter(Boolean)).size;

  const earned = [
    ...MERGED.filter((m) => merged >= m.count),
    ...PROJECTS.filter((m) => projects >= m.count),
    ...(pullRequests.some((pr) => pr.madeWithRadar)
      ? [{ id: "radar", label: "First pull request made with Radar", icon: "📡" }]
      : []),
  ].map(({ id, label, icon }) => ({ id, label, icon }));

  const nextMerged = MERGED.find((m) => merged < m.count);
  const next = nextMerged
    ? { label: nextMerged.label, toGo: nextMerged.count - merged }
    : null;
  return { earned, next };
}
