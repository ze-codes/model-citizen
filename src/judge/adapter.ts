/** Drives the user's own AI CLI. Claude Code first; Codex adapter to follow. */

export interface JudgeCallOpts {
  model?: string; // omit -> user's default
  timeoutMs?: number;
}

export async function callClaude(prompt: string, opts: JudgeCallOpts = {}): Promise<string> {
  const args = ["-p", "--output-format", "json"];
  if (opts.model) args.push("--model", opts.model);
  const proc = Bun.spawn(["claude", ...args], {
    stdin: new TextEncoder().encode(prompt),
    stdout: "pipe",
    stderr: "pipe",
  });
  const timeout = setTimeout(() => proc.kill(), opts.timeoutMs ?? 300_000);
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  clearTimeout(timeout);
  if (code !== 0) throw new Error(`claude exited ${code}: ${err.slice(0, 400) || out.slice(0, 400)}`);
  const envelope = JSON.parse(out);
  if (envelope.is_error) throw new Error(`claude error: ${String(envelope.result).slice(0, 400)}`);
  return String(envelope.result ?? "");
}

/** Pulls the first top-level JSON object out of a model reply. */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  if (start === -1) throw new Error("no JSON object in reply");
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') inStr = !inStr;
    if (inStr) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }
  throw new Error("unterminated JSON object in reply");
}
