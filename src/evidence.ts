import { redact } from "./redact.ts";
import type { Outlier, Prompt, Stats } from "./types.ts";

export interface Excerpt {
  id: string;
  text: string;
  when: string; // YYYY-MM
  tool: string;
  note?: string; // outlier annotation, e.g. "longest rant (truncated)"
}

const MAX_EXCERPT_CHARS = 400;
const TARGET_RANDOM = 60;
const BUDGET_CHARS = 25_000;

/**
 * Assembles the evidence pack the Examiner reads: stratified random excerpts
 * across the whole date range plus forced outliers, all redacted and capped.
 */
export function buildEvidence(prompts: Prompt[], outliers: Outlier[]): Excerpt[] {
  const sorted = [...prompts].sort((a, b) => a.ts - b.ts);
  const excerpts: Excerpt[] = [];
  const taken = new Set<string>();
  let id = 0;
  const push = (p: { text: string; ts: number; tool: string }, note?: string) => {
    const key = p.text.slice(0, 80);
    if (taken.has(key)) return;
    taken.add(key);
    let text = redact(p.text.replace(/\s+/g, " ").trim());
    if (text.length > MAX_EXCERPT_CHARS) {
      text = `${text.slice(0, MAX_EXCERPT_CHARS)}…`;
      note = note ? `${note}; truncated` : "truncated";
    }
    excerpts.push({
      id: `E${String(++id).padStart(3, "0")}`,
      text,
      when: new Date(p.ts).toISOString().slice(0, 7),
      tool: p.tool,
      note,
    });
  };

  for (const o of outliers) push(o, o.kind.replace(/_/g, " "));

  // Stratified random: bucket the timeline so every era of the relationship is
  // represented, not just the dramatic weeks.
  const buckets = 12;
  const per = Math.ceil(TARGET_RANDOM / buckets);
  const bucketSize = Math.max(1, Math.ceil(sorted.length / buckets));
  for (let b = 0; b < buckets; b++) {
    const slice = sorted.slice(b * bucketSize, (b + 1) * bucketSize);
    for (let i = 0; i < per && slice.length; i++) {
      push(slice[Math.floor(Math.random() * slice.length)]);
    }
  }

  // Enforce the char budget by dropping random (never outlier) excerpts.
  let total = excerpts.reduce((s, e) => s + e.text.length, 0);
  for (let i = excerpts.length - 1; total > BUDGET_CHARS && i >= 0; i--) {
    if (excerpts[i].note) continue;
    total -= excerpts[i].text.length;
    excerpts.splice(i, 1);
  }
  return excerpts;
}

export function flattenStats(stats: Stats): Record<string, number | string> {
  const flat: Record<string, number | string> = {};
  for (const [group, obj] of Object.entries(stats)) {
    if (group === "byTool") continue;
    for (const [k, v] of Object.entries(obj as Record<string, number | string>)) flat[`${k}`] = v;
  }
  return flat;
}
