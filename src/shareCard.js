// The "my pull request was merged" share card, and the posts that go with it.
const SITE_URL = "https://opensource-radar.com/";
// DevAgents adds a note with these words to every PR description it writes.
const RADAR_NOTE = "AI assistance from DevAgents";

export const isRadarPullRequest = (pullRequest) =>
  typeof pullRequest?.body === "string" && pullRequest.body.includes(RADAR_NOTE);

export const shareHeadline = (first) =>
  first
    ? "My first open-source pull request was merged"
    : "My open-source pull request was merged";

export const shareText = ({ title, repo }, first) =>
  `${shareHeadline(first)}! "${title}" in ${repo}. I found the issue with OpenSource Radar.`;

export function xShareUrl(pullRequest, first) {
  const params = new URLSearchParams({ text: shareText(pullRequest, first), url: SITE_URL });
  return `https://x.com/intent/post?${params}`;
}

// LinkedIn only takes a link, so people add the image and text themselves.
export const linkedInShareUrl = () =>
  `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url: SITE_URL })}`;

// Splits text into lines that fit `maxWidth`, using `measure(text)` for widths.
// The last allowed line ends with "…" if the text doesn't fit.
export function wrapLines(measure, text, maxWidth, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const pieces = words.flatMap((word) => {
    if (measure(word) <= maxWidth) return [word];
    const parts = [];
    let part = "";
    for (const char of word) {
      if (part && measure(part + char) > maxWidth) {
        parts.push(part);
        part = "";
      }
      part += char;
    }
    return part ? [...parts, part] : parts;
  });

  const lines = [];
  let line = "";
  for (const piece of pieces) {
    const next = line ? `${line} ${piece}` : piece;
    if (measure(next) <= maxWidth) {
      line = next;
    } else {
      lines.push(line);
      line = piece;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;

  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last && measure(`${last}…`) > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return kept;
}

const WIDTH = 1200;
const HEIGHT = 630;
const PAD = 72;
const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
// GitHub Primer dark colours, matching the site's dark theme.
const COLORS = {
  bg: "#0d1117",
  border: "#3d444d",
  text: "#f0f6fc",
  soft: "#d1d7e0",
  muted: "#9198a1",
  green: "#3fb950",
  merged: "#8957e5",
};

// Draws the card onto a canvas. Returns false if the browser can't draw.
export function drawShareCard(canvas, { headline, title, repo, number, mergedAt, login }) {
  const ctx = canvas?.getContext?.("2d");
  if (!ctx) return false;

  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const measure = (text) => ctx.measureText(text).width;

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, WIDTH - 48, HEIGHT - 48);

  // The Radar mark and name.
  ctx.strokeStyle = COLORS.green;
  ctx.lineWidth = 4;
  for (const radius of [18, 10]) {
    ctx.beginPath();
    ctx.arc(PAD + 18, PAD + 18, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = COLORS.text;
  ctx.font = `600 28px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillText("OpenSource Radar", PAD + 52, PAD + 19);

  // The "Merged" label, in GitHub's merged colour.
  ctx.font = `600 24px ${FONT}`;
  const label = "Merged";
  const labelWidth = measure(label) + 44;
  ctx.fillStyle = COLORS.merged;
  ctx.beginPath();
  ctx.roundRect(WIDTH - PAD - labelWidth, PAD, labelWidth, 40, 20);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillText(label, WIDTH - PAD - labelWidth + 22, PAD + 21);

  ctx.textBaseline = "alphabetic";
  let y = 210;
  ctx.fillStyle = COLORS.text;
  ctx.font = `700 56px ${FONT}`;
  for (const line of wrapLines(measure, headline, WIDTH - PAD * 2, 2)) {
    ctx.fillText(line, PAD, y);
    y += 66;
  }

  y += 18;
  ctx.fillStyle = COLORS.soft;
  ctx.font = `500 34px ${FONT}`;
  for (const line of wrapLines(measure, `"${title}"`, WIDTH - PAD * 2, 2)) {
    ctx.fillText(line, PAD, y);
    y += 46;
  }

  ctx.fillStyle = COLORS.muted;
  ctx.font = `400 28px ${FONT}`;
  ctx.fillText(`${repo} #${number}`, PAD, y + 10);

  const date = mergedAt
    ? new Date(mergedAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    : "";
  ctx.font = `400 26px ${FONT}`;
  ctx.fillText(`by @${login}${date ? ` on ${date}` : ""}`, PAD, HEIGHT - PAD);
  ctx.fillStyle = COLORS.green;
  ctx.font = `600 26px ${FONT}`;
  const site = "opensource-radar.com";
  ctx.fillText(site, WIDTH - PAD - measure(site), HEIGHT - PAD);
  return true;
}
