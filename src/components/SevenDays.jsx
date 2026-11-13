import { useState } from "react";
import { SEVEN_DAYS, ALL_TASKS, readDone, taskId, writeDone } from "../lib/sevenDays";
import "./SevenDays.css";

// The 7-day checklist on the first-contribution guide page.
function SevenDays() {
  const [done, setDone] = useState(() => readDone());

  const toggle = (id) => {
    setDone((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeDone(next);
      return next;
    });
  };

  const finished = ALL_TASKS.filter((id) => done.has(id)).length;
  return (
    <section className="aboutpage-section seven-days" aria-labelledby="seven-days-title">
      <h2 id="seven-days-title">Your first pull request in 7 days</h2>
      <p>A small step each day. Tick things off as you go; your ticks stay in this browser.</p>
      <p className="seven-days-progress">
        <progress max={ALL_TASKS.length} value={finished} aria-label="Checklist progress" />
        <span>
          {finished} of {ALL_TASKS.length} done
        </span>
      </p>
      <ol className="seven-days-list">
        {SEVEN_DAYS.map((day, d) => {
          const dayDone = day.tasks.every((_, t) => done.has(taskId(d, t)));
          return (
            <li key={day.title} className={dayDone ? "is-done" : undefined}>
              <h3>
                Day {d + 1}: {day.title}
              </h3>
              <ul>
                {day.tasks.map((task, t) => {
                  const id = taskId(d, t);
                  return (
                    <li key={id}>
                      <label>
                        <input type="checkbox" checked={done.has(id)} onChange={() => toggle(id)} /> {task}
                      </label>
                    </li>
                  );
                })}
              </ul>
              {day.link && (
                <a
                  href={day.link.href}
                  {...(day.link.external && { target: "_blank", rel: "noopener noreferrer" })}
                >
                  {day.link.label}
                  {day.link.external && <span className="sr-only"> (opens in a new tab)</span>}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default SevenDays;
