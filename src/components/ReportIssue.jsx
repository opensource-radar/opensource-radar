import { useRef } from "react";
import { FLAG_REASONS } from "../lib/hiddenIssues";
import "./ReportIssue.css";

// A small "Report" menu on an issue card.
function ReportIssue({ title, onReport }) {
  const detailsRef = useRef(null);
  return (
    <details className="issue-report" ref={detailsRef}>
      <summary aria-label={`Report "${title}"`}>Report</summary>
      <div className="issue-report-menu" role="group" aria-label="Why are you reporting it?">
        <p>Why? It&rsquo;ll be hidden for you.</p>
        {FLAG_REASONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className="text-button"
            onClick={() => {
              detailsRef.current?.removeAttribute("open");
              onReport(value);
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </details>
  );
}

export default ReportIssue;
