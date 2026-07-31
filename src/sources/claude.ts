import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { homedir } from "node:os";
import { RE } from "../lexicons.ts";
import type { Prompt, SideCounts } from "../types.ts";

const NOISE_PREFIXES = [
  "<command-name>", "<local-command", "<system-reminder", "Caveat: the messages below",
  "This session is being continued from a previous conversation", // compaction summary injected as a user turn
  "You are the Examiner at the Bureau", // our own judge calls, if a runner ever fails to tag them sdk
];

export function claudeProjectsDir(): string {
  return process.env.MODEL_CITIZEN_CLAUDE_DIR ?? join(homedir(), ".claude", "projects");
}

/**
 * Streams session files under ~/.claude/projects (top level of each project
 * only — <session>/subagents/*.jsonl transcripts are model-authored prompts
 * and must stay excluded), yielding human-typed prompts and accumulating gag
 * counters from assistant turns.
 */
export async function scanClaude(
  dir: string,
  side: SideCounts,
  onPrompt: (p: Prompt) => void,
): Promise<{ files: number }> {
  let projects: string[];
  try {
    projects = await readdir(dir);
  } catch {
    return { files: 0 };
  }
  let files = 0;
  for (const project of projects) {
    let entries: string[];
    try {
      entries = await readdir(join(dir, project));
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith(".jsonl")) continue;
      files++;
      await scanFile(join(dir, project, entry), project, entry.replace(/\.jsonl$/, ""), side, onPrompt);
    }
  }
  return { files };
}

async function scanFile(
  path: string,
  project: string,
  fallbackSession: string,
  side: SideCounts,
  onPrompt: (p: Prompt) => void,
): Promise<void> {
  const rl = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.length < 20) continue;
    let obj: any;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (obj.type === "assistant") {
      const blocks = obj.message?.content;
      if (Array.isArray(blocks)) {
        for (const b of blocks) {
          if (b.type !== "text" || typeof b.text !== "string") continue;
          side.assistantAbsolutelyRight += count(b.text, RE.absolutelyRight);
          side.assistantApologies += count(b.text, RE.assistantApology);
        }
      }
      continue;
    }
    if (obj.type !== "user" || obj.isSidechain || obj.isMeta) continue;
    // Headless/SDK-driven sessions (agents, orchestrators) log machine-authored
    // prompts as user turns: promptSource "sdk" / entrypoint "sdk-cli". Only
    // keep turns a human typed; older CLI versions lack promptSource, so fall
    // back to entrypoint + origin.
    if (obj.origin && obj.origin.kind !== "human") continue;
    if (obj.promptSource && obj.promptSource !== "typed") continue;
    if (!obj.promptSource && typeof obj.entrypoint === "string" && obj.entrypoint.startsWith("sdk")) continue;
    const content = obj.message?.content;
    let text = "";
    if (typeof content === "string") text = content;
    else if (Array.isArray(content)) {
      if (content.some((b: any) => b.type === "tool_result")) continue;
      text = content
        .filter((b: any) => b.type === "text" && typeof b.text === "string")
        .map((b: any) => b.text)
        .join("\n");
    } else continue;
    text = text.trim();
    if (!text) continue;
    if (RE.interruptMarker.test(text)) {
      side.interrupts++;
      continue;
    }
    if (NOISE_PREFIXES.some((p) => text.startsWith(p))) continue;
    const ts = Date.parse(obj.timestamp ?? "");
    if (Number.isNaN(ts)) continue;
    onPrompt({ text, ts, session: obj.sessionId ?? fallbackSession, project, tool: "claude" });
  }
}

function count(text: string, re: RegExp): number {
  re.lastIndex = 0;
  let n = 0;
  while (re.exec(text) !== null) n++;
  return n;
}
