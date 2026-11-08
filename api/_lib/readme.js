// Finds a short "how to set it up" passage in a README, as plain text. It never
// returns HTML or links, so nothing from the README can run on the site.

// The kinds of section to look for, best first.
const SETUP_SECTIONS = [
  /getting started/i,
  /install/i,
  /set ?up/i,
  /quick ?start/i,
  /local development|development setup|running locally|run locally|build(ing)? from source|how to run/i,
  /development/i,
  /usage/i,
];
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s*(```|~~~)/;
const MAX_CHARS = 600;

function cleanLine(line) {
  return line
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function shorten(text) {
  if (text.length <= MAX_CHARS) return text;
  const kept = [];
  let length = 0;
  for (const line of text.split("\n")) {
    if (length + line.length + 1 > MAX_CHARS - 2) break;
    kept.push(line);
    length += line.length + 1;
  }
  return `${kept.join("\n").trimEnd()}\n…`;
}

export function setupHint(markdown) {
  if (typeof markdown !== "string" || !markdown.trim()) return null;

  // Headings outside code blocks, with where each one starts.
  const lines = markdown.split(/\r?\n/);
  const headings = [];
  let inFence = false;
  lines.forEach((line, index) => {
    if (FENCE.test(line)) inFence = !inFence;
    const match = !inFence && HEADING.exec(line);
    if (match) headings.push({ index, level: match[1].length, title: cleanLine(match[2]) });
  });

  for (const pattern of SETUP_SECTIONS) {
    const position = headings.findIndex((heading) => pattern.test(heading.title));
    if (position === -1) continue;

    const start = headings[position];
    const end = headings.slice(position + 1).find((heading) => heading.level <= start.level);
    const body = lines
      .slice(start.index + 1, end ? end.index : lines.length)
      .filter((line) => !FENCE.test(line))
      .map((line) => {
        const heading = HEADING.exec(line);
        return cleanLine(heading ? heading[2] : line);
      })
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (body) return { heading: start.title, text: shorten(body) };
  }
  return null;
}
