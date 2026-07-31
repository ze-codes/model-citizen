#!/usr/bin/env bun
/**
 * Eval harness: runs the Examiner over ground-truth fixtures N times and
 * reports quadrant stability + score spread. Tune the prompt against this.
 *
 *   bun eval/run.ts [--runs 3] [--model sonnet] [--fixture name]
 */
import { parseArgs } from "node:util";
import { quadrantOf } from "../src/archetypes.ts";
import { runJudge } from "../src/judge/index.ts";
import { StatsBuilder } from "../src/stats.ts";
import { FIXTURES, fixturePrompts } from "./fixtures.ts";

const { values: flags } = parseArgs({
  options: {
    runs: { type: "string", default: "3" },
    model: { type: "string", default: "sonnet" },
    fixture: { type: "string" },
  },
});
const RUNS = Number(flags.runs);

const fixtures = FIXTURES.filter((f) => !flags.fixture || f.name === flags.fixture);
let failures = 0;

const results = await Promise.all(
  fixtures.map(async (f) => {
    const prompts = fixturePrompts(f);
    const builder = new StatsBuilder();
    for (const p of prompts) builder.add(p);
    const { stats, outliers } = builder.build(f.side);

    const runs: { grace: number; mastery: number; archetype: string; retried: boolean; disposition: string }[] = [];
    const errors: string[] = [];
    for (let i = 0; i < RUNS; i++) {
      try {
        const { verdict, retried } = await runJudge(prompts, stats, outliers, f.side, { model: flags.model });
        runs.push({ grace: verdict.grace, mastery: verdict.mastery, archetype: verdict.archetype, retried, disposition: verdict.disposition });
      } catch (e) {
        errors.push((e as Error).message.slice(0, 200));
      }
    }
    return { f, stats, runs, errors };
  }),
);

for (const { f, runs, errors } of results) {
  const quadrants = runs.map((r) => quadrantOf(r.grace, r.mastery));
  const stable = quadrants.every((q) => q === f.expectedQuadrant);
  const ok = stable && errors.length === 0 && runs.length === RUNS;
  if (!ok) failures++;
  const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const spread = (xs: number[]) => (xs.length ? Math.max(...xs) - Math.min(...xs) : 0);
  const g = runs.map((r) => r.grace);
  const m = runs.map((r) => r.mastery);
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${f.name.padEnd(22)} expected ${f.expectedQuadrant}  got [${quadrants.join(", ")}]` +
      `  grace ${mean(g)}±${spread(g)}  mastery ${mean(m)}±${spread(m)}` +
      `  archetypes [${[...new Set(runs.map((r) => r.archetype))].join(", ")}]` +
      (runs.some((r) => r.retried) ? "  (retries)" : ""),
  );
  if (runs[0]) console.log(`      e.g. ${runs[0].disposition}`);
  for (const e of errors) console.log(`      error: ${e}`);
}
console.log(failures === 0 ? "\nAll fixtures stable." : `\n${failures} fixture(s) unstable.`);
process.exit(failures === 0 ? 0 : 1);
