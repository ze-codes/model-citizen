export type Tool = "claude" | "codex";

/** One human-typed prompt extracted from local history. Never leaves the machine. */
export interface Prompt {
  text: string;
  ts: number; // epoch ms
  session: string;
  project: string; // used for distinct counts only
  tool: Tool;
}

/** Signals counted from assistant/system lines while streaming (gag stats). */
export interface SideCounts {
  interrupts: number;
  assistantAbsolutelyRight: number;
  assistantApologies: number;
}

export interface Outlier {
  kind: "longest_rant" | "harshest" | "most_technical";
  text: string;
  ts: number;
  tool: Tool;
  score: number;
}

export interface Stats {
  volume: {
    prompts: number;
    sessions: number;
    projects: number;
    daysActive: number;
    firstDay: string;
    lastDay: string;
    maxPromptsInOneDay: number;
    longestSessionPrompts: number;
    longestSessionMinutes: number;
  };
  grace: {
    please: number;
    thanks: number;
    greetings: number;
    profanity: number;
    insults: number;
    allCapsWords: number;
    bareImperatives: number;
    interrupts: number;
    userApologies: number;
    userPraise: number;
  };
  mastery: {
    medianPromptWords: number;
    pctUnder6Words: number;
    pctWithCode: number;
    pctWithPaths: number;
    pctWithErrorPaste: number;
    techTermsPer1kWords: number;
    longestPromptWords: number;
  };
  gags: {
    lateNightSessions: number;
    longestRantWords: number;
    assistantAbsolutelyRight: number;
    assistantApologies: number;
    ultrathink: number;
  };
  byTool: Record<Tool, number>;
}
