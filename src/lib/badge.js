// The "good first issues" README badge for maintainers (api/badge.js).
// No imports, so both the site and the server can use it.
const SITE = "https://opensource-radar.com";

// Where the badge sends people: Radar, showing that project's open,
// unassigned good first issues.
export const badgeLink = (repo) =>
  `${SITE}/?labels=good-first-issue&available=1&project=${encodeURIComponent(repo)}`;

export const badgeImage = (repo) => `${SITE}/api/badge?repo=${encodeURIComponent(repo)}`;

// Markdown a maintainer pastes into their README.
export const badgeMarkdown = (repo) =>
  `[![Good first issues on OpenSource Radar](${badgeImage(repo)})](${badgeLink(repo)})`;

const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;

// Accepts "owner/repo" or a GitHub link to the repository.
export function parseRepo(input) {
  const text = String(input).trim().replace(/\.git$/, "").replace(/\/+$/, "");
  const fromUrl = text.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)/i);
  const repo = fromUrl ? `${fromUrl[1]}/${fromUrl[2]}` : text;
  return REPO_PATTERN.test(repo) ? repo : null;
}
