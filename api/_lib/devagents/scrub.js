// Removes anything that looks like a secret, from logs and from text users paste.
// Pasted logs go to third-party LLM providers, so this errs on the side of removing.
const KNOWN_TOKENS = [
  /\bgsk_[\w-]+/g,
  /\bgh[pousr]_[\w-]+/g,
  /\bgithub_pat_[\w-]+/g,
  /\bAIza[\w-]+/g,
  /\bsk-[A-Za-z0-9_-]{10,}/g,
  /\bnpm_[A-Za-z0-9]{6,}/g,
  /\bglpat-[\w-]+/g,
  /\bxox[abprs]-[\w-]+/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{12,}/g,
  /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g,
];
// Authorization: Bearer x, Authorization: token x, Authorization: Basic x.
const AUTH_HEADER = /\b(Bearer|Basic)(\s+)[\w.~+/=-]+|(\bAuthorization\s*[:=]\s*token\s+)[\w.~+/=-]+/gi;
// https://user:password@host
const URL_PASSWORD = /(\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)[^\s/@]+(@)/gi;
// password=x, DB_PASSWORD: x, api_key = x, _authToken=x. It needs a separator
// and a value, so "unexpected token at line 3" stays as it is.
const NAMED_SECRET = /(\b[\w-]*(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?key|auth[_-]?token|token)\s*[=:]\s*)["']?[^\s"',;]+["']?/gi;

export function scrubSecrets(text) {
  let clean = String(text)
    .replace(AUTH_HEADER, (match, scheme, space, tokenPrefix) =>
      tokenPrefix ? `${tokenPrefix}[removed]` : `${scheme}${space}[removed]`,
    )
    .replace(URL_PASSWORD, "$1[removed]$2");
  for (const pattern of KNOWN_TOKENS) {
    clean = clean.replace(pattern, "[removed]");
  }
  return clean.replace(NAMED_SECRET, "$1[removed]");
}
