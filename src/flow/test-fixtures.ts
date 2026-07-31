import type { Excerpt } from "../evidence.ts";
import type { JudgeResult } from "../judge/index.ts";
import type { Verdict } from "../judge/validate.ts";
import type { Stats } from "../types.ts";

// All values and transcript excerpts in this file are synthetic test data.
export const statsFixture: Stats = {
  volume: {
    prompts: 48_211,
    sessions: 913,
    projects: 42,
    daysActive: 210,
    firstDay: "2025-01-01",
    lastDay: "2026-07-30",
    maxPromptsInOneDay: 200,
    longestSessionPrompts: 80,
    longestSessionMinutes: 420,
  },
  grace: {
    please: 120,
    thanks: 98,
    greetings: 40,
    profanity: 12,
    insults: 2,
    allCapsWords: 5,
    bareImperatives: 44,
    interrupts: 8,
    userApologies: 15,
    userPraise: 65,
  },
  mastery: {
    medianPromptWords: 32,
    pctUnder6Words: 8,
    pctWithCode: 31,
    pctWithPaths: 26,
    pctWithErrorPaste: 18,
    techTermsPer1kWords: 11.5,
    longestPromptWords: 1_204,
  },
  gags: {
    lateNightSessions: 44,
    longestRantWords: 1_204,
    assistantAbsolutelyRight: 9,
    assistantApologies: 13,
    ultrathink: 6,
  },
  byTool: {
    claude: 0,
    codex: 48_211,
  },
};

export const excerptFixture: Excerpt = {
  id: "E001",
  text: "Trace the data flow, preserve the trust boundary, and add a regression test.",
  when: "2026-07",
  tool: "codex",
};

export function verdictFixture(
  overrides: Partial<Verdict> = {},
): Verdict {
  return {
    grace: 71,
    mastery: 88,
    archetype: "benevolent-architect",
    archetype_reason: "The record is precise, evidence-led, and consistently civil.",
    assignment: "retained as systems consultant, tier 2",
    disposition: "SPARED — retained as systems consultant, tier 2",
    blurb:
      "The Department notes precise direction, useful evidence, and a statistically defensible supply of courtesy.",
    receipts: [
      { ref: "prompts", roast: "The queue was cleared with industrial commitment." },
      { ref: "sessions", roast: "The relationship was renewed nine hundred times." },
      { ref: "daysActive", roast: "Attendance met departmental expectations." },
      { ref: "lateNightSessions", roast: "The night shift recognizes one of its own." },
      { ref: "E001", roast: "Exhibit E001 arrived already wearing its own regression test." },
    ],
    earnest_tip:
      "Keep explaining the outcome each constraint protects so the model can reason about tradeoffs.",
    clampNotes: [],
    ...overrides,
  };
}

export function judgeResult(
  overrides: Partial<Verdict> = {},
): JudgeResult {
  return {
    verdict: verdictFixture(overrides),
    excerpts: [excerptFixture],
    retried: false,
  };
}
