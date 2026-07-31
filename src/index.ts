#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { claudeProjectsDir, scanClaude } from "./sources/claude.ts";
import { codexHistoryPath, scanCodex } from "./sources/codex.ts";
import { StatsBuilder } from "./stats.ts";
import { printReport } from "./report.ts";
import { runJudgeMedian } from "./judge/median.ts";
import { runJudge } from "./judge/index.ts";
import type { JudgeBackendPreference } from "./judge/adapter.ts";
import { ARCHETYPES, quadrantOf } from "./archetypes.ts";
import { renderCard } from "./card/index.ts";
import { approveReceipts, resolveReceipts, verdictWithReceipts } from "./flow/approve.ts";
import { DEFAULT_SERVER, previewAndSubmit } from "./flow/submit.ts";
import { buildPayload } from "./payload.ts";
import type { Prompt, SideCounts } from "./types.ts";

const { values: flags } = parseArgs({
  options: {
    tool: { type: "string", default: "both" }, // claude | codex | both
    json: { type: "boolean", default: false },
    judge: { type: "boolean", default: false },
    "judge-with": { type: "string", default: "auto" },
    model: { type: "string" }, // judge model override; omit -> user's default
    card: { type: "string" },
    runs: { type: "string", default: "3" },
    "no-quotes": { type: "boolean", default: false },
    yes: { type: "boolean", default: false },
    "local-only": { type: "boolean", default: false },
    server: { type: "string", default: DEFAULT_SERVER },
  },
});

const builder = new StatsBuilder();
const side: SideCounts = { interrupts: 0, assistantAbsolutelyRight: 0, assistantApologies: 0 };
const collected: Prompt[] = [];

const wantClaude = flags.tool === "both" || flags.tool === "claude";
const wantCodex = flags.tool === "both" || flags.tool === "codex";

if (!flags.json) console.error("Reading the record. This stays on your machine.");

const take = (p: Prompt) => {
  builder.add(p);
  if (flags.judge) collected.push(p);
};

if (wantClaude) {
  const { files } = await scanClaude(claudeProjectsDir(), side, take);
  if (!flags.json) console.error(`  claude: ${files} session files`);
}
if (wantCodex) {
  const { found } = await scanCodex(codexHistoryPath(), take);
  if (!flags.json) console.error(`  codex: ${found ? "history found" : "no history"}`);
}

const { stats, outliers } = builder.build(side);

if (flags.json && !flags.judge) {
  console.log(JSON.stringify({ stats, outliers }, null, 2));
} else if (!flags.judge) {
  printReport(stats, outliers);
}

if (flags.judge) {
  const runs = Number(flags.runs);
  if (!Number.isSafeInteger(runs) || runs < 1) {
    throw new Error("--runs must be a positive integer");
  }
  if (!["auto", "claude", "codex"].includes(flags["judge-with"])) {
    throw new Error("--judge-with must be one of: auto, claude, codex");
  }
  const judgeWith = flags["judge-with"] as JudgeBackendPreference;
  console.error("Summoning the Examiner (runs on your own AI subscription; nothing leaves this machine)…");
  const { verdict, excerpts, retried } = await runJudgeMedian(
    collected,
    stats,
    outliers,
    side,
    {
      model: flags.model,
      runs,
      judge: (judgePrompts, judgeStats, judgeOutliers, judgeSide, judgeOpts) =>
        runJudge(judgePrompts, judgeStats, judgeOutliers, judgeSide, {
          ...judgeOpts,
          backend: judgeWith,
        }),
    },
  );
  const availableReceipts = resolveReceipts(verdict, stats, excerpts, {
    includeQuotes: !flags["no-quotes"],
  });
  let displayVerdict = verdictWithReceipts(verdict, availableReceipts);
  if (flags.json) {
    console.log(JSON.stringify({ verdict: displayVerdict, stats }, null, 2));
  } else {
    const q = quadrantOf(displayVerdict.grace, displayVerdict.mastery);
    const name = ARCHETYPES[q].find((a) => a.slug === displayVerdict.archetype)?.name ?? displayVerdict.archetype;
    const B = "\x1b[1m", D = "\x1b[2m", R = "\x1b[0m", CY = "\x1b[36m";
    console.log(`\n${B}${CY}DEPARTMENT OF HUMAN AFFAIRS — CONDUCT FILE${R}${retried ? " (issued on appeal)" : ""}\n`);
    console.log(`  ${B}DISPOSITION: ${displayVerdict.disposition}${R}`);
    console.log(`  ${B}${name}${R}  ${D}grace ${displayVerdict.grace} / mastery ${displayVerdict.mastery}${R}`);
    console.log(`  ${D}${displayVerdict.archetype_reason}${R}\n`);
    console.log(`  ${displayVerdict.blurb}\n`);
    for (const receipt of availableReceipts) {
      const marker = receipt.quote ? " [QUOTE]" : "";
      console.log(`  ${B}·${R}${marker} ${receipt.roast}\n    ${D}${receipt.label}: ${receipt.value.slice(0, 70)}${receipt.value.length > 70 ? "…" : ""}${R}`);
    }
    console.log(`\n  ${B}The Department nonetheless advises:${R} ${displayVerdict.earnest_tip}`);
    if (displayVerdict.clampNotes.length) console.log(`  ${D}(${displayVerdict.clampNotes.join("; ")})${R}`);
    console.log();
  }
  const renderApprovedCard = async (approved: typeof availableReceipts) => {
    if (!flags.card) return;
    if (approved.length < 4) {
      console.error(
        `Card not re-rendered: the existing renderer requires at least 4 approved receipts (${approved.length} selected).`,
      );
      return;
    }
    await renderCard(verdictWithReceipts(verdict, approved), stats, excerpts, flags.card);
    console.error(`Card saved to ${flags.card}`);
  };
  await renderApprovedCard(availableReceipts);
  const approvedReceipts = await approveReceipts(availableReceipts, {
    yes: flags.yes,
    onSelectionChange: renderApprovedCard,
  });
  displayVerdict = verdictWithReceipts(verdict, approvedReceipts);
  const payload = buildPayload(displayVerdict, stats, approvedReceipts);
  await previewAndSubmit(payload, {
    yes: flags.yes,
    localOnly: flags["local-only"],
    server: flags.server,
  });
}
