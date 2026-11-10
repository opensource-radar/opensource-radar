// Vercel Web Analytics counts page views. Radar puts people's search text in
// the address, so only the page's path is sent, never the part after ? or #.
export function withoutSearchText(event) {
  try {
    const url = new URL(event.url);
    return { ...event, url: `${url.origin}${url.pathname}` };
  } catch {
    // An address that can't be read could still hold search text.
    return null;
  }
}
