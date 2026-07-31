import { describe, expect, test } from "bun:test";
import type { JudgeRunner } from "../judge/median.ts";
import { runJudgeMedian } from "../judge/median.ts";
import type { SideCounts } from "../types.ts";
import { judgeResult, statsFixture } from "./test-fixtures.ts";

const side: SideCounts = {
  interrupts: 0,
  assistantAbsolutelyRight: 0,
  assistantApologies: 0,
};

describe("median judge", () => {
  test("runs serially, takes per-axis medians, and uses nearest-run copy", async () => {
    const results = [
      judgeResult({
        grace: 20,
        mastery: 90,
        blurb: "First result has enough copy to pass structural expectations.",
        assignment: "assigned to first desk",
      }),
      judgeResult({
        grace: 65,
        mastery: 45,
        blurb: "Nearest result supplies the retained prose and all receipt evidence.",
        assignment: "retained at the median desk.",
        disposition: "REASSIGNED — stale status that must be recomposed",
      }),
      judgeResult({
        grace: 90,
        mastery: 50,
        blurb: "Third result has enough copy to pass structural expectations.",
        assignment: "assigned to third desk",
      }),
    ];
    let call = 0;
    let active = 0;
    let maximumActive = 0;
    const judge: JudgeRunner = async () => {
      active++;
      maximumActive = Math.max(maximumActive, active);
      await Promise.resolve();
      const result = results[call++];
      active--;
      return result;
    };

    const combined = await runJudgeMedian([], statsFixture, [], side, {
      runs: 3,
      judge,
    });

    expect(call).toBe(3);
    expect(maximumActive).toBe(1);
    expect(combined.verdict.grace).toBe(65);
    expect(combined.verdict.mastery).toBe(50);
    expect(combined.verdict.blurb).toBe(results[1].verdict.blurb);
    expect(combined.verdict.receipts).toEqual(results[1].verdict.receipts);
    expect(combined.excerpts).toEqual(results[1].excerpts);
    expect(combined.verdict.disposition).toBe(
      "SPARED — retained at the median desk",
    );
  });

  test("supports one run and rejects invalid run counts", async () => {
    const one = judgeResult({
      grace: 34,
      mastery: 77,
      assignment: "assigned to courtesy retraining",
    });
    const combined = await runJudgeMedian([], statsFixture, [], side, {
      runs: 1,
      judge: async () => one,
    });
    expect(combined.runs).toBe(1);
    expect(combined.verdict.grace).toBe(34);
    expect(combined.verdict.disposition).toStartWith("REASSIGNED —");

    await expect(
      runJudgeMedian([], statsFixture, [], side, {
        runs: 0,
        judge: async () => one,
      }),
    ).rejects.toThrow("positive integer");
  });

  test("uses a rounded conventional median for an even configured run count", async () => {
    const results = [
      judgeResult({ grace: 20, mastery: 21 }),
      judgeResult({ grace: 51, mastery: 80 }),
    ];
    let call = 0;
    const combined = await runJudgeMedian([], statsFixture, [], side, {
      runs: 2,
      judge: async () => results[call++],
    });
    expect(combined.verdict.grace).toBe(36);
    expect(combined.verdict.mastery).toBe(51);
  });
});
