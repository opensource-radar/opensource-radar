// Runs after `vite build`. Gives each page its own HTML file with its own title,
// description, canonical link and text, so search engines can read it without
// running the app, and writes the sitemap from the same list of pages.
import fs from "node:fs";
import path from "node:path";
import {
  ABOUT,
  ALL_PAGES,
  CONTENT_UPDATED,
  FAQ,
  GUIDE,
  GUIDE_PATH,
  MAINTAINERS,
  HOME,
  LANGUAGE_PAGES,
  SITE_URL,
} from "../src/lib/seoPages.js";

export const escapeHtml = (text) =>
  String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const pageUrl = (page) => `${SITE_URL}${page.path}`;

const NO_SCRIPT = `<noscript><p>OpenSource Radar helps beginners find good first issues on GitHub. It needs JavaScript to search. <a href="/about">Read about OpenSource Radar</a> or see the <a href="https://github.com/opensource-radar/opensource-radar">project on GitHub</a>.</p></noscript>`;

const faqHtml = (items) =>
  items
    .map(
      ({ question, answer }) =>
        `<div class="search-help-item"><h3>${escapeHtml(question)}</h3><p>${escapeHtml(answer)}</p></div>`,
    )
    .join("");

const browseHtml = (current) => `<section class="search-help-section">
  <h2>Browse good first issues by language</h2>
  <ul class="search-help-links">${LANGUAGE_PAGES.filter((page) => page !== current)
    .map((page) => `<li><a href="${page.path}">${escapeHtml(page.language)}</a></li>`)
    .join("")}</ul>
</section>`;

const commonHelp = (current) => `<section class="search-help-section">
  <h2>Questions beginners ask</h2>
  <div class="search-help-grid">${faqHtml(FAQ)}</div>
  <p class="search-help-more">New to this? Read <a href="${GUIDE_PATH}">how to make your first open-source contribution</a>.</p>
</section>
${browseHtml(current)}`;

const languageHelp = (page) => `<section class="search-help-section">
  <h2>Getting started with ${escapeHtml(page.language)}</h2>
  <p>${escapeHtml(page.summary)}</p>
  <p>Commands many ${escapeHtml(page.language)} projects use. Check each project's contributing guide first, because it may do things differently.</p>
  <ul class="search-help-commands">${page.commands
    .map(([label, command]) => `<li><span>${escapeHtml(label)}</span> <code>${escapeHtml(command)}</code></li>`)
    .join("")}</ul>
</section>`;

const LOGO = `<svg class="site-logo" viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" stroke-width="2"></circle><circle cx="16" cy="16" r="8.5" fill="none" stroke="currentColor" stroke-width="2" opacity=".55"></circle><path d="M16 16 L16 1.5 A14.5 14.5 0 0 1 26.25 5.75 Z" fill="currentColor" opacity=".35"></path><path d="M16 16 L26.25 5.75" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path><circle cx="16" cy="16" r="2.4" fill="currentColor"></circle></svg>`;

// The spacer matches the height of the app's menu button, so nothing jumps.
const shell = (content) =>
  `<main class="app"><nav class="navbar"><a class="navbar-brand" href="/">${LOGO}OpenSource Radar</a><span style="height:32px" aria-hidden="true"></span></nav>${content}</main>`;

const icon = (d) =>
  `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="${d}"></path></svg>`;
const SEARCH_ICON = "M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z";
const FILTER_ICON = "M.75 3h14.5a.75.75 0 0 1 0 1.5H.75a.75.75 0 0 1 0-1.5ZM3 7.75A.75.75 0 0 1 3.75 7h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 3 7.75Zm3 4a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z";

// Stands in for the search bar until the app loads, so that on a slow connection
// visitors can see search is coming. It matches SearchBar's layout, is switched
// off because nothing can handle it yet, and is hidden when JavaScript is off.
const searchPlaceholder = (filtersCount) => `<div class="searchbar first-paint-search" aria-hidden="true">
    <div class="searchbar-row">
      <div class="searchbar-field">${icon(SEARCH_ICON)}<input type="search" placeholder="Search issues on GitHub" disabled tabindex="-1" /></div>
      <span class="filters-button">${icon(FILTER_ICON)}Filters<span class="filters-count">${filtersCount}</span></span>
    </div>
  </div>`;

const RESULTS_PLACEHOLDER = `<section class="issues-section first-paint-search"><p class="empty-state">Loading issues…</p></section>`;

const heroHtml = (heading, description, filtersCount) => `<section class="hero">
  <p class="eyebrow">YOUR OPEN-SOURCE JOURNEY STARTS HERE</p>
  <h1>${escapeHtml(heading)}</h1>
  <p class="description">${escapeHtml(description)}</p>
  ${searchPlaceholder(filtersCount)}
  ${NO_SCRIPT}
</section>
${RESULTS_PLACEHOLDER}`;

export function pageBody(page) {
  if (page === ABOUT) {
    return shell(`<article class="aboutpage"><header class="aboutpage-intro">
  <p class="eyebrow">ABOUT US</p>
  <h1>${escapeHtml(ABOUT.heading)}</h1>
  <p class="aboutpage-lead">${escapeHtml(ABOUT.lead)}</p>
</header></article>`);
  }
  if (page === GUIDE) {
    return shell(`<article class="aboutpage"><header class="aboutpage-intro">
  <p class="eyebrow">BEGINNER'S GUIDE</p>
  <h1>${escapeHtml(GUIDE.heading)}</h1>
  <p class="aboutpage-lead">${escapeHtml(GUIDE.lead)}</p>
</header>
<section class="aboutpage-section"><h2>The seven steps</h2><ol class="aboutpage-steps">${GUIDE.steps
      .map(
        ({ name, detail }) =>
          `<li><div><strong>${escapeHtml(name)}</strong> <span>${escapeHtml(detail)}</span></div></li>`,
      )
      .join("")}</ol></section>
<section class="aboutpage-section"><h2>If you get stuck</h2><div class="search-help-grid">${faqHtml(GUIDE.tips)}</div></section>
${browseHtml(null)}</article>`);
  }
  if (page === MAINTAINERS) {
    return shell(`<article class="aboutpage"><header class="aboutpage-intro">
  <p class="eyebrow">FOR MAINTAINERS</p>
  <h1>${escapeHtml(MAINTAINERS.heading)}</h1>
  <p class="aboutpage-lead">${escapeHtml(MAINTAINERS.lead)}</p>
</header>
<section class="aboutpage-section"><h2>Questions maintainers ask</h2><div class="search-help-grid">${faqHtml(MAINTAINERS.tips)}</div></section></article>`);
  }
  if (page === HOME) {
    return shell(`${heroHtml("Find your first open-source issue.", "Search open issues across all of GitHub.", 2)}
<section class="search-help">${commonHelp(null)}</section>`);
  }
  return shell(`${heroHtml(page.heading, page.intro, 3)}
<section class="search-help">${languageHelp(page)}${commonHelp(page)}</section>`);
}

function replaceOrThrow(html, pattern, replacement, what) {
  if (!pattern.test(html)) throw new Error(`prerender: could not find ${what} in index.html`);
  return html.replace(pattern, () => replacement);
}

// Fills the built index.html in for one page.
export function renderPage(template, page) {
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const url = escapeHtml(pageUrl(page));
  let html = template;
  html = replaceOrThrow(html, /<title>[^<]*<\/title>/, `<title>${title}</title>`, "the title");
  html = replaceOrThrow(
    html,
    /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
    `<meta name="description" content="${description}" />`,
    "the description",
  );
  html = replaceOrThrow(
    html,
    /<link rel="canonical" href="[^"]*"\s*\/>/,
    `<link rel="canonical" href="${url}" />`,
    "the canonical link",
  );
  html = replaceOrThrow(
    html,
    /<meta property="og:url" content="[^"]*"\s*\/>/,
    `<meta property="og:url" content="${url}" />`,
    "og:url",
  );
  // The home page keeps its own, shorter share text.
  if (page !== HOME) {
    html = replaceOrThrow(
      html,
      /<meta property="og:title" content="[^"]*"\s*\/>/,
      `<meta property="og:title" content="${title}" />`,
      "og:title",
    );
    html = replaceOrThrow(
      html,
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/,
      `<meta property="og:description" content="${description}" />`,
      "og:description",
    );
  }
  return replaceOrThrow(
    html,
    /<!-- prerender:start -->[\s\S]*<!-- prerender:end -->/,
    pageBody(page),
    "the prerender markers",
  );
}

export const sitemapXml = () => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${ALL_PAGES.map(
  (page) => `  <url>
    <loc>${pageUrl(page)}</loc>
    <lastmod>${CONTENT_UPDATED}</lastmod>
  </url>`,
).join("\n")}
</urlset>
`;

export function prerender(outDir) {
  const template = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
  for (const page of ALL_PAGES) {
    const file =
      page.path === "/" ? "index.html" : path.join(page.path.slice(1), "index.html");
    const target = path.join(outDir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, renderPage(template, page));
  }
  fs.writeFileSync(path.join(outDir, "sitemap.xml"), sitemapXml());
}
