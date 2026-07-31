import type { Outlier, Stats } from "./types.ts";

const B = "\x1b[1m", D = "\x1b[2m", R = "\x1b[0m", CY = "\x1b[33m", YE = "\x1b[33m";

export function printReport(stats: Stats, outliers: Outlier[]): void {
  const { volume: v, grace: g, mastery: m, gags } = stats;
  const line = (label: string, value: string | number) =>
    console.log(`  ${label.padEnd(34)}${B}${value}${R}`);

  console.log(`\n${B}${CY}EVIDENCE ON FILE${R} ${D}— summary of the record (nothing has left this machine)${R}\n`);

  console.log(`${B}Volume${R}`);
  line("prompts on record", v.prompts.toLocaleString());
  line("sessions", v.sessions.toLocaleString());
  line("projects", v.projects);
  line("days active", `${v.daysActive}  ${D}(${v.firstDay} → ${v.lastDay})${R}`);
  line("busiest day", `${v.maxPromptsInOneDay} prompts`);
  line("longest session", `${v.longestSessionPrompts} prompts / ${fmtMin(v.longestSessionMinutes)}`);
  line("split (claude / codex)", `${stats.byTool.claude.toLocaleString()} / ${stats.byTool.codex.toLocaleString()}`);

  console.log(`\n${B}Grace signals${R}`);
  line("please / thanks", `${g.please} / ${g.thanks}`);
  line("greetings", g.greetings);
  line("praise given", g.userPraise);
  line("apologies offered", g.userApologies);
  line("profanity", g.profanity);
  line("insults (directed or ambient)", g.insults);
  line("ALL-CAPS outbursts", g.allCapsWords);
  line("bare imperatives (“just fix it”)", g.bareImperatives);
  line("interruptions mid-answer", g.interrupts);

  console.log(`\n${B}Mastery signals${R}`);
  line("median prompt length", `${m.medianPromptWords} words`);
  line("prompts under 6 words", `${m.pctUnder6Words}%`);
  line("with code blocks", `${m.pctWithCode}%`);
  line("with file paths", `${m.pctWithPaths}%`);
  line("with pasted errors", `${m.pctWithErrorPaste}%`);
  line("tech terms / 1k words", m.techTermsPer1kWords);
  line("longest prompt", `${m.longestPromptWords.toLocaleString()} words`);

  console.log(`\n${B}For the record${R}`);
  line("sessions begun after midnight", gags.lateNightSessions);
  line("longest uninterrupted rant", `${gags.longestRantWords.toLocaleString()} words`);
  line("times told “you're absolutely right”", gags.assistantAbsolutelyRight.toLocaleString());
  line("apologies received from the AI", gags.assistantApologies.toLocaleString());
  line("ultrathink invocations", gags.ultrathink);

  if (outliers.length) {
    console.log(`\n${B}Exhibits under seal${R} ${D}(local preview only — nothing is shared without approval)${R}`);
    for (const o of outliers.slice(0, 6)) {
      const preview = o.text.replace(/\s+/g, " ").slice(0, 90);
      console.log(`  ${YE}${o.kind}${R} ${D}[${o.tool}, score ${o.score}]${R} ${preview}${o.text.length > 90 ? "…" : ""}`);
    }
  }
  console.log();
}

function fmtMin(min: number): string {
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}m`;
}
