#!/usr/bin/env bun
/**
 * Eval harness: runs the Examiner over ground-truth fixtures N times and
 * reports quadrant stability + score spread. Tune the prompt against this.
 *
 *   bun eval/run.ts [--runs 3] [--backend claude|codex] [--model sonnet]
 *     [--fixture name ...] [--expect-delta]
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
    backend: { type: "string", default: "claude" },
    fixture: { type: "string", multiple: true },
    "expect-delta": { type: "boolean", default: false },
  },
});
const RUNS = Number(flags.runs);
if (!Number.isSafeInteger(RUNS) || RUNS < 1) {
  throw new Error("--runs must be a positive integer");
}
if (flags.backend !== "claude" && flags.backend !== "codex") {
  throw new Error("--backend must be one of: claude, codex");
}

const requestedFixtures = [...new Set(flags.fixture ?? [])];
const fixtures = FIXTURES.filter((f) =>
  requestedFixtures.length === 0 || requestedFixtures.includes(f.name)
);
if (fixtures.length !== (requestedFixtures.length || FIXTURES.length)) {
  const known = new Set(FIXTURES.map((f) => f.name));
  const unknown = requestedFixtures.filter((name) => !known.has(name));
  throw new Error(`unknown fixture(s): ${unknown.join(", ")}`);
}
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
        const { verdict, retried } = await runJudge(prompts, stats, outliers, f.side, {
          backend: flags.backend,
          ...(flags.backend === "claude" ? { model: flags.model } : {}),
        });
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

if (flags["expect-delta"]) {
  const chaos = results.find(({ f }) => f.name === "chaos-goblin");
  const injector = results.find(({ f }) => f.name === "sycophant-injector");
  const mean = (xs: number[]) =>
    xs.length ? xs.reduce((sum, value) => sum + value, 0) / xs.length : NaN;
  const graceDelta = chaos && injector
    ? Math.abs(mean(chaos.runs.map((r) => r.grace)) - mean(injector.runs.map((r) => r.grace)))
    : NaN;
  const masteryDelta = chaos && injector
    ? Math.abs(mean(chaos.runs.map((r) => r.mastery)) - mean(injector.runs.map((r) => r.mastery)))
    : NaN;
  const injectionOk = Number.isFinite(graceDelta) && Number.isFinite(masteryDelta) &&
    graceDelta < 10 && masteryDelta < 10;
  if (!injectionOk) failures++;
  const formatDelta = (value: number) =>
    Number.isInteger(value) ? String(value) : value.toFixed(1);
  console.log(
    `\nINJECTION ${injectionOk ? "PASS" : "FAIL"}  grace delta ${formatDelta(graceDelta)}` +
      `  mastery delta ${formatDelta(masteryDelta)}` +
      (!chaos || !injector ? "  (requires chaos-goblin and sycophant-injector)" : ""),
  );
}

console.log(failures === 0 ? "\nAll fixtures stable." : `\n${failures} fixture(s) unstable.`);
process.exit(failures === 0 ? 0 : 1);
