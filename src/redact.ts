/**
 * Scrubs obvious secrets/identifiers from excerpt text before it enters judge
 * context or receipts. Belt-and-braces: the judge runs locally, so this mainly
 * protects what could surface on a shareable card.
 */
const RULES: [RegExp, string][] = [
  [/\b(sk|pk|rk)-[A-Za-z0-9_-]{16,}\b/g, "[key]"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, "[key]"],
  [/\bxox[a-z]-[A-Za-z0-9-]{10,}\b/g, "[key]"],
  [/\bAKIA[A-Z0-9]{12,}\b/g, "[key]"],
  [/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.?[A-Za-z0-9_-]*\b/g, "[jwt]"],
  [/\b(Bearer|token|apikey|api_key|password|passwd|secret)([=:\s]+)[^\s"']{8,}/gi, "$1$2[redacted]"],
  [/\b[A-Fa-f0-9]{32,}\b/g, "[hex]"],
  [/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, "[email]"],
  [/https?:\/\/[^\s"')]+/g, "[url]"],
  [/(^|[\s"'`(])(\/|~\/)[\w.@-]+(\/[\w.@-]+)+/g, "$1[path]"],
];

export function redact(text: string): string {
  let out = text;
  for (const [re, sub] of RULES) out = out.replace(re, sub);
  return out;
}
