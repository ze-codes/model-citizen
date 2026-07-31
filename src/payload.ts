import { createHash } from "node:crypto";
import { buildJudgePrompt, JUDGE_VERSION } from "./judge/prompt.ts";
import type { Verdict } from "./judge/validate.ts";
import type { Stats } from "./types.ts";

export interface ApprovedReceipt {
  label: string;
  value: string;
  roast: string;
}

export interface ScorecardPayload {
  schema_version: 1;
  judge_version: string;
  judge_prompt_hash: string;
  tool: "claude" | "codex" | "both";
  scores: {
    grace: number;
    mastery: number;
  };
  archetype: string;
  disposition: string;
  blurb: string;
  receipts: ApprovedReceipt[];
  earnest_tip: string;
  stats_public: {
    messages: number;
    sessions: number;
    days_active: number;
    late_night_sessions: number;
  };
  generated_at: string;
}

const JUDGE_PROMPT_HASH = `sha256:${createHash("sha256")
  .update(buildJudgePrompt({}, []))
  .digest("hex")}`;

function payloadTool(stats: Stats): ScorecardPayload["tool"] {
  const hasClaude = stats.byTool.claude > 0;
  const hasCodex = stats.byTool.codex > 0;
  if (hasClaude && !hasCodex) return "claude";
  if (hasCodex && !hasClaude) return "codex";
  return "both";
}

/** Builds the complete, identity-free JSON object shown to and approved by the user. */
export function buildPayload(
  verdict: Verdict,
  stats: Stats,
  approvedReceipts: readonly ApprovedReceipt[],
): ScorecardPayload {
  return {
    schema_version: 1,
    judge_version: JUDGE_VERSION,
    judge_prompt_hash: JUDGE_PROMPT_HASH,
    tool: payloadTool(stats),
    scores: {
      grace: verdict.grace,
      mastery: verdict.mastery,
    },
    archetype: verdict.archetype,
    disposition: verdict.disposition,
    blurb: verdict.blurb,
    receipts: approvedReceipts.map(({ label, value, roast }) => ({
      label,
      value,
      roast,
    })),
    earnest_tip: verdict.earnest_tip,
    stats_public: {
      messages: stats.volume.prompts,
      sessions: stats.volume.sessions,
      days_active: stats.volume.daysActive,
      late_night_sessions: stats.gags.lateNightSessions,
    },
    generated_at: new Date().toISOString(),
  };
}
