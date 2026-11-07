// Removes anything that looks like a secret, from logs and from text users paste.
const SECRET_PATTERNS = [
  /\bgsk_[\w-]+/g,
  /\bgh[pousr]_[\w-]+/g,
  /\bgithub_pat_[\w-]+/g,
  /\bAIza[\w-]+/g,
  /\bsk-[A-Za-z0-9_-]{10,}/g,
];

export function scrubSecrets(text) {
  let clean = String(text).replace(/\b(Bearer\s+)[\w.~+/=-]+/gi, "$1[removed]");
  for (const pattern of SECRET_PATTERNS) {
    clean = clean.replace(pattern, "[removed]");
  }
  return clean;
}
