export const RE = {
  please: /\b(please|pls|plz)\b/gi,
  thanks: /\b(thanks?|thank you|thx|ty)\b/gi,
  greeting: /^(hi|hey|hello|yo|good (morning|afternoon|evening))\b/i,
  profanity: /\b(fuck\w*|shit\w*|damn|dammit|goddamn|crap|bullshit|wtf|ffs)\b/gi,
  insult: /\b(stupid|dumb|dumbest|useless|idiot\w*|garbage|trash|braindead|moron\w*|pathetic|incompetent)\b/gi,
  userApology: /\b(sorry|my bad|apolog\w+|my mistake)\b/gi,
  userPraise: /\b(good job|great work|well done|perfect|excellent|beautiful|amazing|nice work|love it|impressive)\b/gi,
  ultrathink: /\b(ultrathink|think harder|think hard|megathink)\b/gi,
  codeFence: /```/,
  filePath: /(^|[\s"'`(])(\/|~\/|\.\/)[\w.@-]+\/[\w.@/-]+/m,
  errorPaste: /\b(Traceback \(most recent call last\)|at [\w.$<>]+ \(|[A-Z][a-zA-Z]*Error:|Exception in|errno|EADDRINUSE|ENOENT|segfault|panic:)\b/,
  bareImperativeStart:
    /^(just\s+)?(fix|do|try|make|go|continue|cont|stop|no|yes|yep|yeah|ok|okay|sure|again|retry|redo|run|ship|build|deploy|push|commit|revert|undo|proceed|next|wait)\b/i,
  allCapsWord: /\b[A-Z]{4,}\b/g,
  interruptMarker: /\[Request interrupted by user/,
  absolutelyRight: /you('|’)?re absolutely right/gi,
  assistantApology: /\b(sorry|apologi[sz]e|apologies|my mistake)\b/gi,
};

// Acronyms that read as shouting to a regex but aren't.
export const CAPS_WHITELIST = new Set([
  "HTTP", "HTTPS", "JSON", "JSONL", "YAML", "TOML", "HTML", "CSS", "API", "APIS", "SDK",
  "SQL", "SQLITE", "URL", "URLS", "URI", "UUID", "README", "TODO", "CRUD", "REST",
  "GRPC", "AUTH", "OAUTH", "CORS", "CSRF", "JWT", "SSH", "DNS", "TCP", "UDP", "CLI",
  "GUI", "IDE", "NPM", "PNPM", "CORS", "USD", "EUR", "GBP", "ETH", "BTC", "PERP",
  "APR", "APY", "GPU", "CPU", "RAM", "LLM", "LLMS", "GPT", "MCP", "PATH", "ENV",
  "UTC", "ISO", "CSV", "PDF", "PNG", "SVG", "JPEG", "WASM", "AWS", "GCP", "OSS",
]);

// Occurrences per 1k words -> mastery signal. Deliberately generic across stacks.
export const TECH_TERMS = [
  "endpoint", "schema", "regex", "async", "await", "mutex", "race condition", "webhook",
  "migration", "refactor", "idempotent", "backfill", "cache", "ttl", "latency",
  "throughput", "middleware", "reverse proxy", "docker", "container", "compose",
  "kubernetes", "sqlite", "postgres", "index", "transaction", "foreign key", "orm",
  "payload", "serialize", "deserialize", "lint", "typecheck", "stack trace", "heap",
  "memory leak", "file descriptor", "env var", "environment variable", "symlink",
  "cron", "daemon", "socket", "websocket", "stream", "buffer", "encoding", "utf-8",
  "base64", "hash", "sha256", "jwt", "oauth", "token", "rate limit", "pagination",
  "debounce", "throttle", "retry", "timeout", "rollback", "branch", "rebase",
  "cherry-pick", "worktree", "monorepo", "dependency", "lockfile", "bundler", "vite",
  "tsconfig", "generics", "interface", "closure", "recursion", "big-o", "n+1",
];
