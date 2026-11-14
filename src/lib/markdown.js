// A small, safe Markdown reader for contributing guides. It turns text into
// plain data (blocks and inline pieces) that React renders as elements, so
// nothing in a guide can add HTML or scripts to the page.

// Where a guide's relative links point: the same folder on GitHub.
export function resolveLink(href, base) {
  const value = String(href ?? "").trim();
  if (!value || value.startsWith("#")) return null;
  try {
    const url = new URL(value, base);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

// **bold**, `code` and [links](url) inside a line. Images become their alt text.
export function parseInline(text, base) {
  const pieces = [];
  const pattern = /!\[([^\]]*)\]\([^)]*\)|\[([^\]]+)\]\(([^)\s]+)[^)]*\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|<(https:\/\/[^>\s]+)>/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) pieces.push({ type: "text", text: text.slice(last, match.index) });
    const [, alt, label, href, code, bold, boldAlt, bare] = match;
    if (alt !== undefined) {
      if (alt) pieces.push({ type: "text", text: alt });
    } else if (label !== undefined) {
      const url = resolveLink(href, base);
      pieces.push(url ? { type: "link", text: label, href: url } : { type: "text", text: label });
    } else if (code !== undefined) pieces.push({ type: "code", text: code });
    else if (bare !== undefined) pieces.push({ type: "link", text: bare, href: bare });
    else pieces.push({ type: "bold", text: bold ?? boldAlt });
    last = match.index + match[0].length;
  }
  if (last < text.length) pieces.push({ type: "text", text: text.slice(last) });
  return pieces;
}

const HTML_TAG = /<\/?[a-z][^>]*>/gi;

// Blocks: headings, paragraphs, lists, code and quotes.
export function parseMarkdown(markdown, base) {
  const lines = String(markdown ?? "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  const blocks = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", inline: parseInline(paragraph.join(" "), base) });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].replace(HTML_TAG, "");
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence) {
      flushParagraph();
      flushList();
      const code = [];
      for (i += 1; i < lines.length && !lines[i].trim().startsWith(fence[1]); i += 1) code.push(lines[i]);
      blocks.push({ type: "code", text: code.join("\n") });
      continue;
    }
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
    const item = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (!line.trim() || /^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: Math.min(heading[1].length + 2, 6), inline: parseInline(heading[2], base) });
    } else if (item) {
      flushParagraph();
      const ordered = /\d/.test(item[1]);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { type: "list", ordered, items: [] };
      }
      list.items.push(parseInline(item[2].replace(/^\[[ xX]\]\s*/, ""), base));
    } else if (quote) {
      flushParagraph();
      flushList();
      blocks.push({ type: "quote", inline: parseInline(quote[1].replace(/^#{1,6}\s+/, ""), base) });
    } else if (list && /^\s{2,}\S/.test(line)) {
      // A wrapped list item.
      list.items[list.items.length - 1].push({ type: "text", text: ` ${line.trim()}` });
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

// The guide's file on GitHub, and the address of its raw text.
export function rawGuideUrl(url) {
  const match = String(url ?? "").match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/blob\/(.+)$/);
  return match ? `https://raw.githubusercontent.com/${match[1]}/${match[2]}/${match[3]}` : null;
}
