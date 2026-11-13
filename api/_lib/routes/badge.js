import { githubHeaders } from "../github.js";
import { redis, storeAvailable } from "../store.js";

const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;
const CACHE_SECONDS = 6 * 60 * 60;
const cacheKey = (repo) => `badge:v1:${repo.toLowerCase()}`;
// A badge that couldn't be counted is only kept briefly, so it recovers soon.
const UNKNOWN_CACHE_SECONDS = 10 * 60;

const formatCount = (count) =>
  count >= 1000 ? `${(count / 1000).toFixed(count >= 10000 ? 0 : 1).replace(/\.0$/, "")}k` : String(count);

const escapeXml = (text) =>
  String(text).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);

// Roughly how wide text is at 11px Verdana, like other README badges.
function charWidth(c) {
  if (/[ijl|]/.test(c)) return 3.1;
  if (/[.,: ]/.test(c)) return 3.9;
  if (/[frt]/.test(c)) return 4.4;
  if (/[s]/.test(c)) return 5.9;
  if (/[mw]/.test(c)) return 10.7;
  if (/[A-Z]/.test(c)) return 7.6;
  return 6.9;
}
const textWidth = (text) => Math.ceil([...text].reduce((width, c) => width + charWidth(c), 0));

// A flat README badge: "good first issues | 12 open".
export function badgeSvg(count) {
  const label = "good first issues";
  const value = count === null ? "on Radar" : `${formatCount(count)} open`;
  const color = count === null ? "#6e7681" : count > 0 ? "#2da44e" : "#6e7681";
  const left = textWidth(label) + 14;
  const right = textWidth(value) + 14;
  const width = left + right;
  // Unique ids, in case several badges are ever drawn on one page.
  const id = `radar-${count === null ? "x" : count}`;
  const title = count === null ? "Good first issues on OpenSource Radar" : `${value} good first issues on OpenSource Radar`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${escapeXml(title)}">
<title>${escapeXml(title)}</title>
<linearGradient id="${id}-s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="${id}-r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#${id}-r)"><rect width="${left}" height="20" fill="#24292f"/><rect x="${left}" width="${right}" height="20" fill="${color}"/><rect width="${width}" height="20" fill="url(#${id}-s)"/></g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="${left / 2}" y="14">${escapeXml(label)}</text>
<text x="${left + right / 2}" y="14">${escapeXml(value)}</text>
</g>
</svg>`;
}

// Open, unassigned good first issues in a repository, or null if unknown.
async function countIssues(repo) {
  if (storeAvailable()) {
    try {
      const cached = await redis(["GET", cacheKey(repo)]);
      if (cached !== null && cached !== undefined) return Number(cached);
    } catch {
      // Ask GitHub instead.
    }
  }

  const token = process.env.GITHUB_READ_TOKEN || "";
  if (!token) return null;
  const q = `repo:${repo} is:issue is:open label:"good first issue" no:assignee archived:false`;
  try {
    const response = await fetch(
      `https://api.github.com/search/issues?per_page=1&q=${encodeURIComponent(q)}`,
      { headers: githubHeaders(token) },
    );
    if (!response.ok) return null;
    const count = (await response.json()).total_count;
    if (typeof count !== "number") return null;
    if (storeAvailable()) {
      try {
        await redis(["SET", cacheKey(repo), String(count), "EX", CACHE_SECONDS]);
      } catch {
        // Not cached this time.
      }
    }
    return count;
  } catch {
    return null;
  }
}

// GET /api/badge?repo=owner/name: the README badge image.
export async function GET(request) {
  const repo = new URL(request.url).searchParams.get("repo") || "";
  const count = REPO_PATTERN.test(repo) ? await countIssues(repo) : null;

  return new Response(badgeSvg(count), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // GitHub's image proxy and the CDN keep it for a few hours.
      "Cache-Control":
        count === null
          ? `public, max-age=${UNKNOWN_CACHE_SECONDS}, s-maxage=${UNKNOWN_CACHE_SECONDS}`
          : `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=86400`,
    },
  });
}
