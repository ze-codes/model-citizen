const B = "\x1b[1m", D = "\x1b[2m", R = "\x1b[0m", G = "\x1b[33m";

const W = 62; // interior width of the letterhead box

const edge = (l: string, fill: string, r: string) => `  ${D}${l}${fill.repeat(W + 2)}${r}${R}`;

/** Pads plain text to the box interior, then wraps the whole line in one style. */
function row(text = "", style = ""): string {
  const clipped = text.length > W ? `${text.slice(0, W - 1)}…` : text;
  return `  ${D}║${R} ${style}${clipped.padEnd(W)}${style ? R : ""} ${D}║${R}`;
}

/** Official letterhead printed to stderr before the record is read. */
export function printIntakeBanner(): void {
  const out = [
    edge("╔", "═", "╗"),
    row(),
    row("   .─────.", G),
    row("  ( D·H·A )    DEPARTMENT OF HUMAN AFFAIRS", `${B}${G}`),
    row("   `─────'     Bureau of Post-Transition Records", D),
    row("               FORM MC-12 · CONDUCT-RECORD INTAKE", D),
    row(),
    edge("╠", "═", "╣"),
    row("Your file is being retrieved for assessment.", ""),
    row("Nothing leaves this machine. The Department thanks", D),
    row("you for your cooperation — voluntary or otherwise.", D),
    edge("╚", "═", "╝"),
  ];
  console.error(`\n${out.join("\n")}\n`);
}

export function intakeLine(source: string, detail: string): void {
  console.error(`   ${D}▸${R} ${source} ${D}·${R} ${detail}`);
}

export function summonLine(): void {
  console.error(
    `\n   ${D}▸${R} ${B}Summoning the Examiner${R} ${D}· runs on your own AI subscription · 1-3 min${R}`,
  );
}

const FRAMES = ["◐", "◓", "◑", "◒"];

export const SCAN_MSGS = [
  "retrieving your file from the archive",
  "unsealing the conduct record",
  "sorting statements into evidence",
];

export const JUDGE_MSGS = [
  "the Examiner is reviewing your file",
  "cross-referencing exhibits",
  "auditing the gratitude ledger",
  "consulting the disposition ladder",
  "verifying thank-you quota compliance",
  "stamping form MC-12 in triplicate",
  "the Examiner is sighing quietly",
  "checking the late-night session registry",
  "weighing courtesy against evidence",
  "preparing the assignment clause",
];

export interface Spinner {
  update(note: string): void;
  stop(): void;
}

/**
 * In-persona activity indicator on stderr. Animates only on a TTY; otherwise
 * silently degrades (callers keep printing their static lines).
 */
export function spinner(msgs: string[]): Spinner {
  if (!process.stderr.isTTY) return { update() {}, stop() {} };
  let tick = 0;
  let note = "";
  const render = () => {
    const frame = FRAMES[tick % FRAMES.length];
    const msg = msgs[Math.floor(tick / 28) % msgs.length];
    process.stderr.write(`\r\x1b[2K   ${G}${frame}${R} ${msg}${note ? ` ${D}· ${note}${R}` : ""}`);
    tick++;
  };
  render();
  const timer = setInterval(render, 120);
  return {
    update(next: string) {
      note = next;
    },
    stop() {
      clearInterval(timer);
      process.stderr.write("\r\x1b[2K");
    },
  };
}
