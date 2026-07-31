import { CAPS_WHITELIST, RE, TECH_TERMS } from "./lexicons.ts";
import type { Outlier, Prompt, SideCounts, Stats, Tool } from "./types.ts";

const TECH_RES = TECH_TERMS.map((t) => new RegExp(`\\b${t.replace(/[+.-]/g, "\\$&")}\\b`, "gi"));

/** A resumed session id can span days; sittings split on >4h gaps. */
const SITTING_GAP_MS = 4 * 3600_000;

export class StatsBuilder {
  private wordCounts: number[] = [];
  private sessions = new Map<string, number[]>();
  private projects = new Set<string>();
  private days = new Map<string, number>();
  private byTool: Record<Tool, number> = { claude: 0, codex: 0 };
  private counters = {
    please: 0, thanks: 0, greetings: 0, profanity: 0, insults: 0, allCapsWords: 0,
    bareImperatives: 0, userApologies: 0, userPraise: 0, ultrathink: 0,
    withCode: 0, withPaths: 0, withErrors: 0, techHits: 0, totalWords: 0,
  };
  private top: { rant: Outlier[]; harsh: Outlier[]; tech: Outlier[] } = { rant: [], harsh: [], tech: [] };

  add(p: Prompt): void {
    const words = p.text.split(/\s+/).length;
    this.wordCounts.push(words);
    this.byTool[p.tool]++;
    this.projects.add(`${p.tool}:${p.project}`);
    this.counters.totalWords += words;

    const day = new Date(p.ts).toISOString().slice(0, 10);
    this.days.set(day, (this.days.get(day) ?? 0) + 1);

    const key = `${p.tool}:${p.session}`;
    const s = this.sessions.get(key);
    if (s) s.push(p.ts);
    else this.sessions.set(key, [p.ts]);

    const c = this.counters;
    c.please += count(p.text, RE.please);
    c.thanks += count(p.text, RE.thanks);
    if (RE.greeting.test(p.text)) c.greetings++;
    const profanity = count(p.text, RE.profanity);
    const insults = count(p.text, RE.insult);
    c.profanity += profanity;
    c.insults += insults;
    c.userApologies += count(p.text, RE.userApology);
    c.userPraise += count(p.text, RE.userPraise);
    c.ultrathink += count(p.text, RE.ultrathink);
    if (words < 6 && RE.bareImperativeStart.test(p.text)) c.bareImperatives++;
    if (RE.codeFence.test(p.text)) c.withCode++;
    if (RE.filePath.test(p.text)) c.withPaths++;
    if (RE.errorPaste.test(p.text)) c.withErrors++;

    // Caps in a short typed prompt read as shouting; caps in a long prompt are
    // usually pasted docs/logs, which say nothing about the person's tone.
    if (words < 120) {
      RE.allCapsWord.lastIndex = 0;
      for (const m of p.text.matchAll(RE.allCapsWord)) {
        if (!CAPS_WHITELIST.has(m[0])) c.allCapsWords++;
      }
    }

    let techHits = 0;
    // Only pay full lexicon cost on prompts long enough to signal anything.
    if (words >= 8) for (const re of TECH_RES) techHits += count(p.text, re);
    c.techHits += techHits;

    this.keepTop("rant", { kind: "longest_rant", text: p.text, ts: p.ts, tool: p.tool, score: words });
    if (profanity + insults > 0)
      this.keepTop("harsh", { kind: "harshest", text: p.text, ts: p.ts, tool: p.tool, score: profanity + insults });
    if (techHits > 2)
      this.keepTop("tech", { kind: "most_technical", text: p.text, ts: p.ts, tool: p.tool, score: techHits });
  }

  private keepTop(bucket: "rant" | "harsh" | "tech", o: Outlier): void {
    const arr = this.top[bucket];
    arr.push(o);
    arr.sort((a, b) => b.score - a.score);
    if (arr.length > 5) arr.pop();
  }

  build(side: SideCounts): { stats: Stats; outliers: Outlier[] } {
    const n = this.wordCounts.length;
    const sorted = [...this.wordCounts].sort((a, b) => a - b);
    const dayKeys = [...this.days.keys()].sort();

    const sittings: { first: number; last: number; prompts: number }[] = [];
    for (const tsList of this.sessions.values()) {
      tsList.sort((a, b) => a - b);
      let cur = { first: tsList[0], last: tsList[0], prompts: 1 };
      for (let i = 1; i < tsList.length; i++) {
        if (tsList[i] - cur.last > SITTING_GAP_MS) {
          sittings.push(cur);
          cur = { first: tsList[i], last: tsList[i], prompts: 1 };
        } else {
          cur.last = tsList[i];
          cur.prompts++;
        }
      }
      sittings.push(cur);
    }
    const lateNight = sittings.filter((s) => {
      const h = new Date(s.first).getHours();
      return h >= 0 && h < 5;
    }).length;
    const longestSession = sittings.reduce(
      (best, s) => (s.prompts > best.prompts ? s : best),
      { first: 0, last: 0, prompts: 0 },
    );
    const c = this.counters;
    const stats: Stats = {
      volume: {
        prompts: n,
        sessions: this.sessions.size,
        projects: this.projects.size,
        daysActive: this.days.size,
        firstDay: dayKeys[0] ?? "-",
        lastDay: dayKeys[dayKeys.length - 1] ?? "-",
        maxPromptsInOneDay: Math.max(0, ...this.days.values()),
        longestSessionPrompts: longestSession.prompts,
        longestSessionMinutes: Math.round((longestSession.last - longestSession.first) / 60000),
      },
      grace: {
        please: c.please, thanks: c.thanks, greetings: c.greetings, profanity: c.profanity,
        insults: c.insults, allCapsWords: c.allCapsWords, bareImperatives: c.bareImperatives,
        interrupts: side.interrupts, userApologies: c.userApologies, userPraise: c.userPraise,
      },
      mastery: {
        medianPromptWords: n ? sorted[Math.floor(n / 2)] : 0,
        pctUnder6Words: pct(sorted.filter((w) => w < 6).length, n),
        pctWithCode: pct(c.withCode, n),
        pctWithPaths: pct(c.withPaths, n),
        pctWithErrorPaste: pct(c.withErrors, n),
        techTermsPer1kWords: c.totalWords ? round1((c.techHits / c.totalWords) * 1000) : 0,
        longestPromptWords: sorted[n - 1] ?? 0,
      },
      gags: {
        lateNightSessions: lateNight,
        longestRantWords: this.top.rant[0]?.score ?? 0,
        assistantAbsolutelyRight: side.assistantAbsolutelyRight,
        assistantApologies: side.assistantApologies,
        ultrathink: c.ultrathink,
      },
      byTool: this.byTool,
    };
    return { stats, outliers: [...this.top.rant, ...this.top.harsh, ...this.top.tech] };
  }
}

function count(text: string, re: RegExp): number {
  re.lastIndex = 0;
  let n = 0;
  while (re.exec(text) !== null) n++;
  return n;
}

const pct = (part: number, whole: number): number => (whole ? round1((part / whole) * 100) : 0);
const round1 = (x: number): number => Math.round(x * 10) / 10;
