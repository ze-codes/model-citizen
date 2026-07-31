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
