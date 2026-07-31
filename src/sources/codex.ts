import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Prompt } from "../types.ts";

export function codexHistoryPath(): string {
  return process.env.MODEL_CITIZEN_CODEX_HISTORY ?? join(homedir(), ".codex", "history.jsonl");
}

/**
 * ~/.codex/history.jsonl is already a clean feed of user-typed prompts:
 * {session_id, ts (epoch seconds), text}. Project attribution isn't recorded
 * there, so all Codex prompts share one bucket for the distinct-project count.
 */
export async function scanCodex(path: string, onPrompt: (p: Prompt) => void): Promise<{ found: boolean }> {
  if (!existsSync(path)) return { found: false };
  const rl = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of rl) {
    let obj: any;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const text = typeof obj.text === "string" ? obj.text.trim() : "";
    if (!text || typeof obj.ts !== "number") continue;
    onPrompt({
      text,
      ts: obj.ts * 1000,
      session: obj.session_id ?? "codex-unknown",
      project: "codex",
      tool: "codex",
    });
  }
  return { found: true };
}
