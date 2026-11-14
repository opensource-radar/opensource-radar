// "just now", "5 minutes ago", "3 hours ago", or a date, for when a check ran.
export function checkedAgo(iso, now = Date.now()) {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  const minutes = Math.max(0, Math.round((now - time) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(time).toLocaleDateString();
}
