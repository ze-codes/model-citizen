import type { Outlier, Prompt, SideCounts, Stats } from "../types.ts";
import { dispositionStatus } from "../disposition.ts";
import {
  runJudge,
  type JudgeResult,
  type RunJudgeOpts,
} from "./index.ts";

export type JudgeRunner = typeof runJudge;

export interface JudgeMedianOptions extends RunJudgeOpts {
  runs?: number;
  /** Test seam: production callers use runJudge. */
  judge?: JudgeRunner;
  /** Called before each serial judge run (1-based). */
  onAttempt?: (attempt: number, total: number) => void;
}

export interface JudgeMedianResult extends JudgeResult {
  runs: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

/**
 * Runs the judge serially, then combines the independently validated/clamped scores.
 * Copy and evidence come from the run nearest the per-axis medians.
 */
export async function runJudgeMedian(
  prompts: Prompt[],
  stats: Stats,
  outliers: Outlier[],
  side: SideCounts,
  options: JudgeMedianOptions = {},
): Promise<JudgeMedianResult> {
  const runs = options.runs ?? 3;
  if (!Number.isSafeInteger(runs) || runs < 1) {
    throw new Error("runs must be a positive integer");
  }

  const judge = options.judge ?? runJudge;
  const judgeOptions: RunJudgeOpts = {
    model: options.model,
    timeoutMs: options.timeoutMs,
    backend: options.backend,
  };
  const results: JudgeResult[] = [];
  for (let index = 0; index < runs; index++) {
    // Deliberately serial: concurrent local judge processes compete for the same
    // subscription and make the trust UX much harder to reason about.
    options.onAttempt?.(index + 1, runs);
    results.push(await judge(prompts, stats, outliers, side, judgeOptions));
  }

  const grace = median(results.map((result) => result.verdict.grace));
  const mastery = median(results.map((result) => result.verdict.mastery));
  let base = results[0];
  let baseDistance = Number.POSITIVE_INFINITY;
  for (const result of results) {
    const graceDelta = result.verdict.grace - grace;
    const masteryDelta = result.verdict.mastery - mastery;
    const distance = graceDelta * graceDelta + masteryDelta * masteryDelta;
    if (distance < baseDistance) {
      base = result;
      baseDistance = distance;
    }
  }

  const assignment = base.verdict.assignment.trim().replace(/\.$/, "");
  return {
    ...base,
    runs,
    verdict: {
      ...base.verdict,
      grace,
      mastery,
      disposition: `${dispositionStatus(grace)} — ${assignment}`,
    },
  };
}
