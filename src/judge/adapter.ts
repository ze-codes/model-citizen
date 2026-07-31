/** Drives the user's own AI CLI. */

export interface JudgeCallOpts {
  model?: string; // omit -> user's default
  timeoutMs?: number;
}

export type JudgeBackendName = "claude" | "codex";
export type JudgeBackendPreference = JudgeBackendName | "auto";

export interface JudgeBackend {
  name: JudgeBackendName;
  call(prompt: string, opts?: JudgeCallOpts): Promise<string>;
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

export async function callCodex(prompt: string, opts: JudgeCallOpts = {}): Promise<string> {
  // Codex emits only the final assistant message on stdout in plain output mode.
  // Deliberately omit --model so the user's configured default remains authoritative.
  const args = [
    "exec",
    "--sandbox", "read-only",
    "--cd", "/tmp",
    "--skip-git-repo-check",
    "--ephemeral",
    "--color", "never",
    "-",
  ];
  const proc = Bun.spawn(["codex", ...args], {
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
  if (code !== 0) throw new Error(`codex exited ${code}: ${err.slice(0, 400) || out.slice(0, 400)}`);
  return out;
}

const BACKENDS: Record<JudgeBackendName, JudgeBackend> = {
  claude: { name: "claude", call: callClaude },
  codex: { name: "codex", call: callCodex },
};

export function selectBackend(preference: JudgeBackendPreference = "auto"): JudgeBackend {
  const names: JudgeBackendName[] = preference === "auto"
    ? ["claude", "codex"]
    : [preference];
  const probed: string[] = [];
  for (const name of names) {
    const path = Bun.which(name);
    probed.push(`${name} (${path ?? "not found on PATH"})`);
    if (path) return BACKENDS[name];
  }
  throw new Error(`no judge backend available; probed: ${probed.join(", ")}`);
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
