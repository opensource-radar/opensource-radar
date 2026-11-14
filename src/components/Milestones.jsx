import { milestones } from "../lib/milestones";
import "./Milestones.css";

// Badges for merged pull requests, and the next one, gently.
function Milestones({ totalMerged, pullRequests }) {
  const { earned, next } = milestones({ totalMerged, pullRequests });
  if (earned.length === 0) return null;
  return (
    <div className="milestones">
      <ul aria-label="Milestones">
        {earned.map(({ id, label, icon }) => (
          <li key={id}>
            <span aria-hidden="true">{icon}</span> {label}
          </li>
        ))}
      </ul>
      {next && (
        <p className="milestones-next">
          Next: {next.label.toLowerCase()} ({next.toGo} to go)
        </p>
      )}
    </div>
  );
}

export default Milestones;
