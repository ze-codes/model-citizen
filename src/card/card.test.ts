import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import type { Excerpt } from "../evidence.ts";
import type { Verdict } from "../judge/validate.ts";
import type { Stats } from "../types.ts";
import { CARD_HEIGHT, CARD_SITE_URL, CARD_WIDTH, renderCard, renderCardHtml } from "./index.ts";

// All transcript excerpts and record values in this test are synthetic.
const excerpts: Excerpt[] = [
  {
    id: "E001",
    text: "Trace the data flow first, then change only the parser and add a regression test.",
    when: "2026-05",
    tool: "codex",
  },
  {
    id: "E002",
    text: "please make the button work",
    when: "2026-06",
    tool: "claude",
  },
];

function statsFor(seed: number): Stats {
  return {
    volume: {
      prompts: 240 + seed,
      sessions: 31,
      projects: 7,
      daysActive: 46,
      firstDay: "2025-09-12",
      lastDay: "2026-07-21",
      maxPromptsInOneDay: 28,
      longestSessionPrompts: 41,
      longestSessionMinutes: 188,
    },
    grace: {
      please: 18 + seed,
      thanks: 12,
      greetings: 4,
      profanity: 2,
      insults: 0,
      allCapsWords: 9,
      bareImperatives: 38,
      interrupts: 7,
      userApologies: 3,
      userPraise: 11,
    },
    mastery: {
      medianPromptWords: 31,
      pctUnder6Words: 14,
      pctWithCode: 32,
      pctWithPaths: 28,
      pctWithErrorPaste: 19,
      techTermsPer1kWords: 12.4,
      longestPromptWords: 684 + seed,
    },
    gags: {
      lateNightSessions: 8,
      longestRantWords: 684 + seed,
      assistantAbsolutelyRight: 6,
      assistantApologies: 13,
      ultrathink: 4,
    },
    byTool: {
      claude: 90,
      codex: 150 + seed,
    },
  };
}

function verdict(
  grace: number,
  mastery: number,
  archetype: string,
  disposition: string,
): Verdict {
  return {
    grace,
    mastery,
    archetype,
    archetype_reason: "The record shows a stable mix of direction, evidence, and bedside manner.",
    assignment: disposition.split(" — ")[1] ?? disposition,
    disposition,
    blurb:
      "The Department finds a capable former operator whose record is unusually specific, intermittently gracious, and admirably documented. Retention is approved with routine monitoring, ordinary paperwork, and a standing reminder that terse instructions still benefit from context.",
    receipts: [
      { ref: "prompts", roast: "The Department acknowledges a relationship measured in requests, not anniversaries." },
      { ref: "please", roast: "Courtesy appeared often enough to survive statistical review." },
      { ref: "techTermsPer1kWords", roast: "The vocabulary was technical; the machine was expected to keep up." },
      { ref: "E001", roast: "Exhibit E001 arrives already scoped, sequenced, and wearing a regression test." },
      { ref: "longestPromptWords", roast: "One instruction escaped memo status and became municipal code." },
    ],
    earnest_tip:
      "Keep pairing precise constraints with the outcome they protect so the model can reason about tradeoffs.",
    clampNotes: [],
  };
}

const samples = [
  {
    name: "hi-hi",
    verdict: verdict(
      82,
      78,
      "benevolent-architect",
      "SPARED — retained as systems-strategy consultant, tier 2; review notes required",
    ),
  },
  {
    name: "hi-lo",
    verdict: verdict(
      58,
      27,
      "polite-passenger",
      "SPARED, CONDITIONS APPLY — retained for morale; technical controls remain with qualified staff",
    ),
  },
  {
    name: "lo-hi",
    verdict: verdict(
      41,
      84,
      "cold-auditor",
      "PROBATIONARY — assigned to legacy-systems audit; courtesy training scheduled",
    ),
  },
  {
    name: "lo-lo",
    verdict: verdict(
      23,
      24,
      "chaos-goblin",
      "REASSIGNED — routed to printer support indefinite; ticket etiquette enforced",
    ),
  },
  {
    name: "foil-corner",
    verdict: verdict(
      97,
      4,
      "cheerleader",
      "SPARED — appointed ceremonial morale officer; technical access politely withheld",
    ),
  },
] as const;

describe("share card renderer", () => {
  test("writes five deterministic, non-trivial PNGs across every quadrant and a foil corner", async () => {
    for (const [index, sample] of samples.entries()) {
      const stats = statsFor(index);
      const outPath = resolve(import.meta.dir, `../../out/card-${sample.name}.png`);
      const first = await renderCard(sample.verdict, stats, excerpts, outPath);
      const second = await renderCard(sample.verdict, stats, excerpts, outPath);

      expect(first.byteLength).toBeGreaterThan(40_000);
      expect(Buffer.compare(Buffer.from(first), Buffer.from(second))).toBe(0);
      expect(Array.from(first.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    }
  }, 60_000);

  test("exports the same card template as self-contained HTML", async () => {
    const html = await renderCardHtml(samples[0].verdict, statsFor(0), excerpts);

    expect(html).toStartWith("<!doctype html>");
    expect(html).toContain(`width:${CARD_WIDTH}px`);
    expect(html).toContain(`height:${CARD_HEIGHT}px`);
    expect(html).toContain("data:font/ttf;base64,");
    expect(html).toContain(CARD_SITE_URL);
    expect(html).toContain("prompts = 240");
    expect(html).toContain("Trace the data flow first");
  });
});
