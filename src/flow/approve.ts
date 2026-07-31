import { createInterface } from "node:readline/promises";
import type { Excerpt } from "../evidence.ts";
import { flattenStats } from "../evidence.ts";
import type { Verdict } from "../judge/validate.ts";
import type { ApprovedReceipt } from "../payload.ts";
import type { Stats } from "../types.ts";

export interface ReceiptChoice extends ApprovedReceipt {
  ref: string;
  quote: boolean;
}

export interface ResolveReceiptOptions {
  includeQuotes?: boolean;
}

export interface ApproveReceiptOptions {
  yes?: boolean;
  tty?: boolean;
  ask?: (prompt: string) => Promise<string>;
  print?: (line: string) => void;
  onSelectionChange?: (approved: ReceiptChoice[]) => void | Promise<void>;
}

function humanize(value: string): string {
  const spaced = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return spaced ? spaced[0].toUpperCase() + spaced.slice(1) : value;
}

export function resolveReceipts(
  verdict: Verdict,
  stats: Stats,
  excerpts: Excerpt[],
  options: ResolveReceiptOptions = {},
): ReceiptChoice[] {
  const includeQuotes = options.includeQuotes ?? true;
  const flat = flattenStats(stats);
  const excerptById = new Map(excerpts.map((excerpt) => [excerpt.id, excerpt]));

  return verdict.receipts.flatMap((receipt): ReceiptChoice[] => {
    if (Object.hasOwn(flat, receipt.ref)) {
      return [{
        ref: receipt.ref,
        quote: false,
        label: humanize(receipt.ref),
        value: String(flat[receipt.ref]),
        roast: receipt.roast,
      }];
    }
    const excerpt = excerptById.get(receipt.ref);
    if (!excerpt || !includeQuotes) return [];
    return [{
      ref: receipt.ref,
      quote: true,
      label: `Quote ${receipt.ref}`,
      value: excerpt.text,
      roast: receipt.roast,
    }];
  });
}

export function verdictWithReceipts(
  verdict: Verdict,
  receipts: readonly ReceiptChoice[],
): Verdict {
  return {
    ...verdict,
    receipts: receipts.map(({ ref, roast }) => ({ ref, roast })),
  };
}

async function defaultAsk(prompt: string): Promise<string> {
  const input = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    return await input.question(prompt);
  } finally {
    input.close();
  }
}

function renderChecklist(
  receipts: readonly ReceiptChoice[],
  selected: ReadonlySet<number>,
  print: (line: string) => void,
): void {
  print("\nReceipt approval (only checked items enter the payload):");
  receipts.forEach((receipt, index) => {
    const kind = receipt.quote ? " [QUOTE]" : "";
    print(`  [${selected.has(index) ? "x" : " "}] ${index + 1}.${kind} ${receipt.label}: ${receipt.value}`);
    print(`      ${receipt.roast}`);
  });
}

export async function approveReceipts(
  receipts: readonly ReceiptChoice[],
  options: ApproveReceiptOptions = {},
): Promise<ReceiptChoice[]> {
  const print = options.print ?? console.error;
  const tty = options.tty ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
  if (options.yes || !tty) {
    const reason = options.yes ? "--yes" : "non-interactive input";
    print(`Receipt approval: automatically approved all ${receipts.length} receipt(s) (${reason}).`);
    return [...receipts];
  }

  const ask = options.ask ?? defaultAsk;
  const selected = new Set(receipts.map((_, index) => index));
  while (true) {
    renderChecklist(receipts, selected, print);
    const answer = (await ask(
      "Toggle with receipt numbers (comma-separated), or press Enter to approve checked items: ",
    )).trim();
    if (!answer || /^(done|approve)$/i.test(answer)) break;

    const indexes = answer
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((token) => Number(token) - 1);
    if (
      indexes.length === 0 ||
      indexes.some((index) => !Number.isSafeInteger(index) || index < 0 || index >= receipts.length)
    ) {
      print(`Invalid selection. Enter numbers from 1 to ${receipts.length}.`);
      continue;
    }
    for (const index of indexes) {
      if (selected.has(index)) selected.delete(index);
      else selected.add(index);
    }
    await options.onSelectionChange?.(
      receipts.filter((_, index) => selected.has(index)),
    );
  }
  return receipts.filter((_, index) => selected.has(index));
}
