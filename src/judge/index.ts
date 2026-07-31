import { buildEvidence, flattenStats } from "../evidence.ts";
import type { Outlier, Prompt, SideCounts, Stats } from "../types.ts";
import {
  extractJson,
  selectBackend,
  type JudgeBackendPreference,
  type JudgeCallOpts,
} from "./adapter.ts";
import { buildJudgePrompt } from "./prompt.ts";
import { validateVerdict, ValidationError, type Verdict } from "./validate.ts";

export interface JudgeResult {
  verdict: Verdict;
  excerpts: ReturnType<typeof buildEvidence>;
  retried: boolean;
}

export interface RunJudgeOpts extends JudgeCallOpts {
  backend?: JudgeBackendPreference;
}

export async function runJudge(
  prompts: Prompt[],
  stats: Stats,
  outliers: Outlier[],
  side: SideCounts,
  opts: RunJudgeOpts = {},
): Promise<JudgeResult> {
  const excerpts = buildEvidence(prompts, outliers);
  const flat = flattenStats(stats);
  const basePrompt = buildJudgePrompt(flat, excerpts);
  const backend = selectBackend(opts.backend);

  let lastErr = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = attempt === 0
      ? basePrompt
      : `${basePrompt}\n\nYour previous reply was rejected: ${lastErr}. Return only the corrected JSON object.`;
    try {
      const reply = await backend.call(prompt, opts);
      const verdict = validateVerdict(extractJson(reply), stats, excerpts);
      return { verdict, excerpts, retried: attempt > 0 };
    } catch (e) {
      if (e instanceof ValidationError || e instanceof SyntaxError || (e as Error).message.includes("JSON")) {
        lastErr = (e as Error).message;
        continue;
      }
      throw e;
    }
  }
  throw new Error(`judge failed after retry: ${lastErr}`);
}
