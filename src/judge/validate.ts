import { archetypeQuadrant, quadrantOf } from "../archetypes.ts";
import { dispositionStatus } from "../disposition.ts";
import type { Excerpt } from "../evidence.ts";
import type { Stats } from "../types.ts";
import type { JudgeOutputShape } from "./prompt.ts";

export interface Verdict extends JudgeOutputShape {
  disposition: string; // "<STATUS> — <assignment>", status deterministic from clamped grace
  clampNotes: string[];
}

export class ValidationError extends Error {}

/**
 * Structural validation + wide sanity clamps. The clamps are deliberately loose
 * absurdity-guards, not scoring: the LLM reads the raw excerpts and its read
 * wins anywhere inside the band.
 */
export function validateVerdict(raw: unknown, stats: Stats, excerpts: Excerpt[]): Verdict {
  const o = raw as Partial<JudgeOutputShape>;
  const fail = (msg: string): never => { throw new ValidationError(msg); };

  if (!Number.isInteger(o.grace) || (o.grace as number) < 0 || (o.grace as number) > 100) fail("grace must be int 0-100");
  if (!Number.isInteger(o.mastery) || (o.mastery as number) < 0 || (o.mastery as number) > 100) fail("mastery must be int 0-100");
  if (typeof o.archetype !== "string" || !archetypeQuadrant(o.archetype)) fail(`unknown archetype: ${o.archetype}`);
  if (typeof o.blurb !== "string" || o.blurb.length < 10) fail("blurb missing");
  if (typeof o.assignment !== "string" || o.assignment.length < 8 || o.assignment.length > 120) fail("assignment must be 8-120 chars");
  if (typeof o.earnest_tip !== "string" || o.earnest_tip.length < 10) fail("earnest_tip missing");
  if (!Array.isArray(o.receipts) || o.receipts.length < 3) fail("need >=3 receipts");

  const flatKeys = new Set<string>();
  for (const group of [stats.volume, stats.grace, stats.mastery, stats.gags])
    for (const k of Object.keys(group)) flatKeys.add(k);
  const excerptIds = new Set(excerpts.map((e) => e.id));
  const receipts = (o.receipts as { ref: string; roast: string }[]).filter(
    (r) => typeof r?.ref === "string" && typeof r?.roast === "string" &&
      (flatKeys.has(r.ref) || excerptIds.has(r.ref)),
  );
  if (receipts.length < 3) fail("too few receipts cite real evidence");

  const clampNotes: string[] = [];
  let grace = o.grace as number;
  let mastery = o.mastery as number;
  const n = Math.max(1, stats.volume.prompts);
  const g = stats.grace;
  const m = stats.mastery;

  const rudeRate = (g.profanity + g.insults + g.allCapsWords) / n;
  if (rudeRate < 0.01 && grace < 35) { grace = 35; clampNotes.push(`grace raised to 35: hostility rate ~0 (${rudeRate.toFixed(4)})`); }
  if (rudeRate > 0.15 && grace > 65) { grace = 65; clampNotes.push(`grace capped at 65: high hostility rate (${rudeRate.toFixed(3)})`); }
  const evidenceRate = m.pctWithCode + m.pctWithErrorPaste + m.pctWithPaths;
  if ((m.techTermsPer1kWords > 6 || evidenceRate > 25) && mastery < 35) { mastery = 35; clampNotes.push("mastery raised to 35: heavy technical evidence in stats"); }
  if (m.techTermsPer1kWords < 0.5 && evidenceRate < 2 && m.medianPromptWords < 8 && mastery > 65) { mastery = 65; clampNotes.push("mastery capped at 65: no technical evidence in stats"); }

  const quadrant = quadrantOf(grace, mastery);
  if (archetypeQuadrant(o.archetype as string) !== quadrant)
    fail(`archetype ${o.archetype} is not in quadrant ${quadrant} implied by scores ${grace}/${mastery}`);

  return {
    ...(o as JudgeOutputShape),
    grace,
    mastery,
    receipts,
    clampNotes,
    disposition: `${dispositionStatus(grace)} — ${(o.assignment as string).trim().replace(/\.$/, "")}`,
  };
}
