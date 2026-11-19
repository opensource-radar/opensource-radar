import { helpPath } from "../devagents/links";
import { isPlainClick } from "../lib/links";
import { daysSince } from "../lib/workingOn";
import Icon from "./Icon";

const dayWord = (days) => (days === 1 ? "1 day" : `${days} days`);

// "Still on it?": a gentle check-in for an issue someone started days ago.
function WorkingReminder({ entry, onStillOn, onLetGo, onOpenHelp }) {
  const days = daysSince(entry.startedAt);
  const repo = entry.repo.replace(" / ", "/");
  const help = helpPath(repo, entry.number);

  return (
    <section className="working-reminder" aria-labelledby="working-reminder-heading">
      <h2 id="working-reminder-heading">
        <Icon name="clock" />
        Still working on this?
      </h2>
      <p className="working-reminder-issue">
        You started{" "}
        <a
          href={help}
          onClick={(event) => {
            if (!isPlainClick(event)) return;
            event.preventDefault();
            onOpenHelp(entry);
          }}
        >
          {entry.title}
        </a>{" "}
        in {entry.repo} {dayWord(days)} ago.
      </p>
      <p className="working-reminder-tip">
        Stuck is normal. Asking the maintainer a short, specific question on the issue usually gets you moving,
        and letting an issue go is fine too, so someone else can pick it up.
      </p>
      <div className="working-reminder-actions">
        <button type="button" className="secondary-button" onClick={() => onStillOn(entry)}>
          Still on it
        </button>
        <a className="secondary-button" href={entry.url} target="_blank" rel="noopener noreferrer">
          Ask the maintainer ↗
        </a>
        <button type="button" className="text-button" onClick={() => onLetGo(entry)}>
          Let it go
        </button>
      </div>
    </section>
  );
}

export default WorkingReminder;
