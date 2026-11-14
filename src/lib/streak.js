// Gentle streaks: how many weeks in a row someone got a pull request merged.
// The current week doesn't break a streak before it's over, and there are
// no reminders or "you lost your streak" messages anywhere.

const DAY = 24 * 60 * 60 * 1000;
// Weeks start on Monday (UTC). 1 Jan 1970 was a Thursday, hence the + 3.
const weekOf = (time) => Math.floor((Math.floor(time / DAY) + 3) / 7);

export function weekStreak(mergedDates, now = Date.now()) {
  const weeks = new Set(
    mergedDates.map((date) => Date.parse(date)).filter((time) => !Number.isNaN(time)).map(weekOf),
  );
  let week = weekOf(now);
  if (!weeks.has(week)) week -= 1;
  let streak = 0;
  while (weeks.has(week)) {
    streak += 1;
    week -= 1;
  }
  return streak;
}

// Only worth a line from two weeks on.
export const streakText = (weeks) =>
  weeks >= 2 ? `${weeks} weeks in a row with a merged pull request` : null;
