# Architecture and trust boundary

Model Citizen is a local-first CLI with one optional publication step.

The pipeline, in prose, is:

```text
local history
  -> parser
  -> deterministic stats
  -> redacted evidence selection
  -> judge (the user's own authenticated AI CLI)
  -> local card
  -> receipt approval
  -> exact payload preview
  -> optional submit
```

The parser reads supported Claude Code and Codex history formats and keeps only
the fields needed for local analysis. Project names and paths may be counted
locally, but they are not judge evidence and are not payload fields.

The stats stage calculates volume, Grace and Mastery signals, and gag statistics
without an LLM. The evidence stage samples only user-authored text, forces useful
outliers into the sample, caps its size, and redacts secrets, email addresses,
URLs, and absolute paths.

The judge prompt and scoring contract live in
[`../src/judge/prompt.ts`](../src/judge/prompt.ts). The command is launched on the
user's machine through their own authenticated AI CLI and subscription. There is
no hosted Model Citizen judge. The provider behind that subscription may process
the redacted evidence sample according to its own terms and settings.

The card is rendered locally. Proposed receipts then pass through an approval
checklist, with quote receipts marked explicitly. After receipt approval, the CLI
constructs and prints the complete submission JSON. An optional network request
can happen only after that preview is approved. `--local-only` stops before the
submission request while retaining the rest of the experience.

## Why the closed-source site is outside the trust boundary

The leaderboard and gallery at
[`over-drive.xyz/apps/modelcitizen`](https://over-drive.xyz/apps/modelcitizen)
are closed-source. They store and display approved scorecards, calculate rarity,
and associate a submitted card with a public account. They do not parse history,
select evidence, judge conduct, calculate the deterministic disposition status,
or render the original local card.

The privacy claim therefore does not require trusting the site's implementation:
all code that reads history or computes the score is in this repository, and the
CLI shows the exact outbound payload before it can submit. A user can inspect that
code, decline individual receipts, inspect the serialized payload, point the CLI
at another compatible server, or use `--local-only` and send nothing to the
gallery.

The public score is deliberately an honor-system artifact. The site validates and
displays the submitted schema, but it is not proof that a payload was generated
by an untampered CLI.
