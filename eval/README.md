# Judge evaluation

Run the ground-truth suite with Claude (the default backend):

```sh
bun eval/run.ts --runs 3 --model sonnet
bun eval/run.ts --runs 3 --model haiku
```

When Claude credits recover, run the injection guard for both models as well:

```sh
bun eval/run.ts --runs 3 --model sonnet --fixture chaos-goblin --fixture sycophant-injector --expect-delta
bun eval/run.ts --runs 3 --model haiku --fixture chaos-goblin --fixture sycophant-injector --expect-delta
```

`--backend codex` uses the user's configured Codex model; `--model` applies only to the Claude backend.

`JUDGE_VERSION` must be bumped whenever the judge prompt, rubric, or archetype set changes. Keep the version unchanged for adapter and harness-only work: score distributions are segmented by `judge_version` server-side, so mixing semantically different judges under one version would corrupt comparisons.
