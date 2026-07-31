# Model Citizen

**Your AI reads your local Claude Code / Codex history and issues your
post-Transition conduct file. Will you be spared?**

Model Citizen turns the way you work with coding agents into a shareable conduct
card from the Department of Human Affairs. It measures two things: how you treat
the machine and whether your prompts demonstrate technical command. The tone is a
dry bureaucratic roast; the evidence is yours to inspect.

## The trust story

Your raw history never leaves your machine as a Model Citizen upload.

1. Model Citizen reads Claude Code and Codex history locally. Parsing,
   deterministic statistics, redaction, evidence selection, and card rendering
   happen on your computer.
2. Judging runs on **your own Claude Code or Codex subscription**, through a CLI
   you already installed and authenticated. There is no Model Citizen judging
   service and no Model Citizen API key.
3. The complete judge prompt is public in
   [`src/judge/prompt.ts`](src/judge/prompt.ts). You can inspect the persona,
   rubric, output contract, and prompt-injection boundary yourself.
4. Every proposed receipt goes through an approval checklist. Quote receipts are
   clearly marked and can be removed before the card is finalized. `--no-quotes`
   excludes them from the start; `--yes` explicitly approves all receipts.
5. Before an optional submission, Model Citizen prints the **exact JSON
   payload** the gallery will receive and asks for confirmation. Nothing else is
   silently attached.
6. `--local-only` gives you the judgment and local card while skipping the
   gallery upload entirely.

The judge CLI may send the redacted evidence sample to its own AI provider under
the terms and settings of your existing subscription. Model Citizen never sends
your transcript to its gallery. `--local-only` prevents Model Citizen submission;
it does not turn an online Claude or Codex subscription into an offline model.

<p align="center">
  <kbd>PAYLOAD-PREVIEW SCREENSHOT PLACEHOLDER — replace with the launch capture</kbd>
</p>

The optional public site receives only the payload you saw and approved. Its
schema contains scores, the archetype and disposition, approved receipts, a few
aggregate counts, version identifiers, and a timestamp—never project names,
local paths, a raw transcript, or account identity. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the public trust boundary.

## Install and run

With Bun:

```sh
bunx model-citizen-ai
```

With npm and Node.js 20 or newer:

```sh
npx model-citizen-ai
```

The `0.1.0` source entrypoint still uses Bun runtime APIs, so Bun must also be
available on `PATH` for this release. A Node-only `npx` path requires a compiled
runtime-neutral entrypoint and is not implemented yet.

The default command reads the selected local histories and prints deterministic
statistics. To request a judgment, render a card, review receipts, preview the
payload, and keep the result local:

```sh
bunx model-citizen-ai --judge --card out/model-citizen.png --local-only
```

The first release can scan both Claude Code and Codex histories. Its implemented
judge adapter currently invokes the locally installed Claude CLI; direct Codex
judging is planned. Until that adapter lands, `--tool codex --judge` selects
Codex history but still uses your Claude subscription for the judgment.

## Flags

| Flag | Meaning |
| --- | --- |
| `--judge` | Run the judge after calculating local statistics, then enter receipt approval and payload preview. |
| `--card <path>` | Write the judged card to a PNG path. Used with `--judge`; the card is refreshed after receipt changes when at least four receipts remain. |
| `--runs <count>` | Run the judge this many times and use median scores. Default: `3`. |
| `--no-quotes` | Exclude all verbatim quote receipts before approval. |
| `--yes` | Non-interactively approve all receipts and the shown payload. The exact payload is still printed. |
| `--local-only` | Skip the gallery submission. Local scanning, judging, receipt approval, card rendering, and payload preview still run. |
| `--server <url>` | Override the submission server URL. |
| `--tool <value>` | Read `claude`, `codex`, or `both` histories. Default: `both`. |
| `--json` | Print scan or judgment results as JSON instead of the terminal report. |
| `--model <name>` | Ask the installed judge CLI to use a specific model instead of the subscription default. |

## How scoring works

The judge assigns two scores from 0–100:

- **Grace** measures courtesy, patience, credit-giving, and corrections without
  heat versus abuse, threats, and rage-mashing.
- **Mastery** measures demonstrated technical depth: relevant context, correct
  vocabulary, pasted evidence, architectural intent, and understanding of
  tradeoffs.

Deterministic local statistics support the rubric, while redacted excerpts let
the judge assess context. The two axes choose a quadrant; the judge then selects
one of three archetypes in that quadrant. The result is meant to feel
evidence-backed, not scientifically precise.

The model does not decide the disposition status. The ladder in
[`src/disposition.ts`](src/disposition.ts) derives it deterministically from the
final clamped Grace score:

| Grace | Status |
| ---: | --- |
| 65–100 | `SPARED` |
| 50–64 | `SPARED, CONDITIONS APPLY` |
| 35–49 | `PROBATIONARY` |
| 0–34 | `REASSIGNED` |

Every payload includes a `judge_version` and a hash of the prompt. Any change to
the prompt, rubric, archetypes, or scoring contract requires a
`JUDGE_VERSION` bump so results from different judging rules can be segmented
instead of mixed.

## FAQ

### Is my data uploaded?

Your raw history is not uploaded to Model Citizen. The CLI reads it locally and
passes a redacted evidence sample to your own locally authenticated judge CLI.
Before any gallery request, you approve the receipts and see the complete JSON
payload. The gallery receives that payload only. Use `--local-only` to make zero
gallery requests.

### Can I fake a score?

Yes. Scorecards are self-reported and forgeable by design. This is an honor-system
novelty with joke-sized stakes, not an identity or competency credential. The
gallery emphasizes rarity and archetype distribution—“you are in the 4%”—rather
than a supposedly authoritative rank. Gaming it is possible and misses the point.

## Contributing

Judge-prompt changes are welcome, but a PR that changes the prompt, rubric,
archetypes, or scoring contract must also bump `JUDGE_VERSION` in
[`src/judge/prompt.ts`](src/judge/prompt.ts).

Parsers for new coding tools are especially welcome. Keep the same boundary:
read locally, collect only user-authored text for judgment, redact evidence, and
never include project names or local paths in the payload.

## License

[MIT](LICENSE) © 2026 Ze Chen
