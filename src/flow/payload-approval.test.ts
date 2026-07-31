import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { buildJudgePrompt, JUDGE_VERSION } from "../judge/prompt.ts";
import { buildPayload } from "../payload.ts";
import {
  approveReceipts,
  resolveReceipts,
} from "./approve.ts";
import {
  excerptFixture,
  statsFixture,
  verdictFixture,
} from "./test-fixtures.ts";

describe("receipt approval and payload", () => {
  test("quotes are default-on and --no-quotes semantics retain stat receipts", () => {
    const verdict = verdictFixture();
    const withQuotes = resolveReceipts(
      verdict,
      statsFixture,
      [excerptFixture],
    );
    expect(withQuotes).toHaveLength(5);
    expect(withQuotes.at(-1)).toMatchObject({
      ref: "E001",
      quote: true,
      label: "Quote E001",
      value: excerptFixture.text,
    });

    const withoutQuotes = resolveReceipts(
      verdict,
      statsFixture,
      [excerptFixture],
      { includeQuotes: false },
    );
    expect(withoutQuotes).toHaveLength(4);
    expect(withoutQuotes.every((receipt) => !receipt.quote)).toBe(true);
    expect(withoutQuotes.map((receipt) => receipt.ref)).toEqual([
      "prompts",
      "sessions",
      "daysActive",
      "lateNightSessions",
    ]);
  });

  test("interactive checklist marks quotes, toggles by number, and invokes card refresh", async () => {
    const receipts = resolveReceipts(
      verdictFixture(),
      statsFixture,
      [excerptFixture],
    );
    const answers = ["5", ""];
    const printed: string[] = [];
    const selections: string[][] = [];
    const approved = await approveReceipts(receipts, {
      tty: true,
      ask: async () => answers.shift()!,
      print: (line) => printed.push(line),
      onSelectionChange: (selected) => {
        selections.push(selected.map((receipt) => receipt.ref));
      },
    });

    expect(printed.join("\n")).toContain("[QUOTE]");
    expect(approved.map((receipt) => receipt.ref)).not.toContain("E001");
    expect(selections).toEqual([[
      "prompts",
      "sessions",
      "daysActive",
      "lateNightSessions",
    ]]);
  });

  test("non-TTY and --yes approve everything with a notice", async () => {
    const receipts = resolveReceipts(
      verdictFixture(),
      statsFixture,
      [excerptFixture],
    );
    for (const options of [{ tty: false }, { tty: true, yes: true }]) {
      const printed: string[] = [];
      const approved = await approveReceipts(receipts, {
        ...options,
        print: (line) => printed.push(line),
      });
      expect(approved).toEqual(receipts);
      expect(printed.join("\n")).toContain("automatically approved all");
    }
  });

  test("builds the strict, identity-free schema with the template hash", () => {
    const verdict = verdictFixture();
    const approved = resolveReceipts(
      verdict,
      statsFixture,
      [excerptFixture],
    );
    const payload = buildPayload(verdict, statsFixture, approved);
    const expectedHash = `sha256:${createHash("sha256")
      .update(buildJudgePrompt({}, []))
      .digest("hex")}`;

    expect(Object.keys(payload)).toEqual([
      "schema_version",
      "judge_version",
      "judge_prompt_hash",
      "tool",
      "scores",
      "archetype",
      "disposition",
      "blurb",
      "receipts",
      "earnest_tip",
      "stats_public",
      "generated_at",
    ]);
    expect(payload).toMatchObject({
      schema_version: 1,
      judge_version: JUDGE_VERSION,
      judge_prompt_hash: expectedHash,
      tool: "codex",
      scores: { grace: 71, mastery: 88 },
      archetype: "benevolent-architect",
      stats_public: {
        messages: 48_211,
        sessions: 913,
        days_active: 210,
        late_night_sessions: 44,
      },
    });
    expect(payload.receipts).toHaveLength(5);
    expect(Object.keys(payload.receipts[0])).toEqual(["label", "value", "roast"]);
    expect(payload.judge_prompt_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(new Date(payload.generated_at).toISOString()).toBe(payload.generated_at);
    expect(JSON.stringify(payload)).not.toMatch(
      /handle|avatar|github|email|identity/i,
    );
    expect(payload.disposition).toBe("SPARED — retained as systems consultant, tier 2");
  });
});
