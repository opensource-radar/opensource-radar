import { useState } from "react";
import { replyLine } from "../lib/friendliness";
import { isPlainClick } from "../lib/links";
import { previewText } from "../lib/preview";
import { ESTIMATES, estimateTime } from "../lib/timeEstimate";
import ContributingGuide from "./ContributingGuide";
import Icon from "./Icon";
import ReportIssue from "./ReportIssue";
import "./ProjectAbout.css";

const dateFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const GITHUB_LOGIN = /^[A-Za-z0-9-]{1,39}$/;

// "#123 opened by octocat on 2 Nov 2026", or as much of it as is known.
function OpenedLine({ number, author, createdAt }) {
  const created = createdAt ? new Date(createdAt) : null;
  const hasDate = created && !Number.isNaN(created.getTime());
  const hasAuthor = typeof author === "string" && GITHUB_LOGIN.test(author);
  if (!number && !hasAuthor && !hasDate) return null;

  return (
    <p className="issue-card-opened">
      {number ? `#${number}` : ""}
      {(hasAuthor || hasDate) && (number ? " opened" : "Opened")}
      {hasAuthor && (
        <>
          {" by "}
          <a href={`https://github.com/${author}`} target="_blank" rel="noopener noreferrer">
            {author}
          </a>
        </>
      )}
      {hasDate && ` on ${dateFormat.format(created)}`}
    </p>
  );
}

const starFormat = new Intl.NumberFormat(undefined, { notation: "compact" });

function IssueCard({
  title,
  description,
  label,
  language,
  repo,
  url,
  comments,
  updatedAt,
  saved,
  onToggleSave,
  project,
  actions,
  number,
  author,
  createdAt,
  onReport,
  following,
  onToggleFollow,
  workingOn,
  onToggleWorking,
}) {
  const [guideOpen, setGuideOpen] = useState(false);
  const preview = previewText(description);
  const estimate = ESTIMATES[estimateTime({ title, labels: label, body: description })];
  const details = [
    typeof comments === "number" &&
      (comments === 1 ? "1 comment" : `${comments} comments`),
    updatedAt && `updated ${dateFormat.format(new Date(updatedAt))}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="issue-card">
      <div className="issue-card-header">
        <div className="issue-card-labels">
          <span className="issue-label">{label}</span>
          <span
            className="issue-estimate"
            title={`${estimate.detail}. A rough guess from the issue's labels and text.`}
          >
            <span className="sr-only">Estimated time: </span>
            {estimate.label}
          </span>
          {project?.archived ? (
            <span className="project-warning project-warning-archived">
              Archived project
            </span>
          ) : (
            project?.quiet && (
              <span className="project-warning">Quiet for 6+ months</span>
            )
          )}
        </div>
        <div className="issue-card-meta">
          {language && <span className="issue-language">{language}</span>}
          {onToggleSave && (
            <button
              type="button"
              className={`icon-button issue-save${saved ? " issue-save-active" : ""}`}
              aria-pressed={saved}
              aria-label={saved ? `Remove "${title}" from saved` : `Save "${title}"`}
              title={saved ? "Remove from saved" : "Save issue"}
              onClick={onToggleSave}
            >
              <Icon name={saved ? "bookmarkFilled" : "bookmark"} />
            </button>
          )}
        </div>
      </div>

      <h2>{title}</h2>
      <OpenedLine number={number} author={author} createdAt={createdAt} />
      {project?.about && (
        <p className="issue-card-about">
          <span className="sr-only">About the project: </span>
          {project.about}
          {project.aboutByAi && <span className="issue-card-about-ai"> · AI summary</span>}
        </p>
      )}

      <p className="issue-description">{preview}</p>
      {replyLine(project?.friendliness) && (
        <p className="issue-card-health">
          <Icon name="clock" />
          {replyLine(project.friendliness)}
        </p>
      )}

      <div className="issue-card-footer">
        <span className="issue-card-details">
          {repo}
          {typeof project?.stars === "number" && (
            <span
              className="issue-stars"
              aria-label={`${project.stars.toLocaleString()} stars`}
            >
              <Icon name="star" />
              {starFormat.format(project.stars)}
            </span>
          )}
          {details && ` · ${details}`}
        </span>
        <span className="issue-card-links">
          {actions}
          {project?.contributingUrl && (
            <a
              href={project.contributingUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => {
                // A plain tap reads it here, with Save this issue to hand.
                if (!isPlainClick(event)) return;
                event.preventDefault();
                setGuideOpen(true);
              }}
            >
              Contributing guide
            </a>
          )}
          {onToggleWorking && (
            <button
              type="button"
              className={`text-button issue-working${workingOn ? " is-working" : ""}`}
              aria-pressed={Boolean(workingOn)}
              title={workingOn ? "Radar will check in after a few days. Tap to stop tracking." : "Radar checks in after a few days"}
              onClick={onToggleWorking}
            >
              {workingOn ? "Working on it ✓" : "I’m working on this"}
            </button>
          )}
          {onToggleFollow && (
            <button
              type="button"
              className={`text-button issue-follow${following ? " is-following" : ""}`}
              aria-pressed={Boolean(following)}
              aria-label={following ? `Stop following ${repo}` : `Follow ${repo}`}
              onClick={onToggleFollow}
            >
              {following ? "Following" : "Follow project"}
            </button>
          )}
          <a href={url} target="_blank" rel="noopener noreferrer">
            View issue ↗
          </a>
          {onReport && <ReportIssue title={title} onReport={onReport} />}
        </span>
      </div>
      {guideOpen && (
        <ContributingGuide
          url={project.contributingUrl}
          repo={repo}
          issueTitle={title}
          number={number}
          saved={saved}
          onToggleSave={onToggleSave}
          onClose={() => setGuideOpen(false)}
        />
      )}
    </article>
  );
}

export default IssueCard;
