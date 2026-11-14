import { useEffect, useState } from "react";
import "./LabelHealth.css";

const SHOWN = 5;
const GROUPS = [
  {
    key: "idleAssigned",
    title: "Assigned, but quiet",
    tip: "Ask the person if they're still working on it; if not, unassign it so someone else can.",
    days: (days) => `assigned ${days} days ago`,
  },
  {
    key: "waiting",
    title: "Waiting for a maintainer's first reply",
    tip: "A short reply (even “yes, this is still wanted”) keeps beginners from giving up.",
    days: (days) => `opened ${days} days ago`,
  },
  {
    key: "stale",
    title: "No activity for 3+ months",
    tip: "Check it's still needed. Close it, or add a comment saying what's left to do.",
    days: (days) => `quiet for ${days} days`,
  },
];

// On the For maintainers page: the project's good first issues that need attention.
function LabelHealth({ repo }) {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/label-health?repo=${encodeURIComponent(repo)}`, { headers: { Accept: "application/json" } })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (cancelled) return;
        const valid = data && typeof data.total === "number" && GROUPS.every((group) => Array.isArray(data[group.key]));
        setState(response.ok && valid ? { status: "ready", data } : { status: "error" });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [repo]);

  if (state.status === "loading") return <p className="devagents-muted">Checking your good first issues…</p>;
  if (state.status === "error") return <p className="devagents-muted">Couldn&rsquo;t check your good first issues right now.</p>;

  const { data } = state;
  const needing = GROUPS.reduce((sum, group) => sum + data[group.key].length, 0);
  return (
    <section className="label-health" aria-label="Your good first issues">
      <h3>Your good first issues</h3>
      {data.total === 0 ? (
        <p>
          You have no open issues labelled “good first issue”. Label a few small, clear tasks so beginners can find
          them.
        </p>
      ) : needing === 0 ? (
        <p>All {data.total} look healthy. 🎉</p>
      ) : (
        <p>
          {needing} of {data.total} could use some attention
          {data.checked < data.total ? ` (checked the ${data.checked} least recently updated)` : ""}.
        </p>
      )}
      {GROUPS.filter((group) => data[group.key].length > 0).map((group) => {
        const items = data[group.key];
        return (
          <div key={group.key} className="label-health-group">
            <h4>
              {group.title} ({items.length})
            </h4>
            <p className="devagents-muted">{group.tip}</p>
            <ul>
              {items.slice(0, SHOWN).map((issue) => (
                <li key={issue.number}>
                  <a href={issue.url} target="_blank" rel="noopener noreferrer">
                    #{issue.number} {issue.title}
                  </a>{" "}
                  <span className="devagents-muted">· {group.days(issue.days)}</span>
                </li>
              ))}
            </ul>
            {items.length > SHOWN && <p className="devagents-muted">and {items.length - SHOWN} more</p>}
          </div>
        );
      })}
    </section>
  );
}

export default LabelHealth;
