/** Tool category colors and icons */
export const TOOL_CATEGORIES = {
  Read:       { color: "var(--color-tool-read)",    icon: "FileText",     label: "Read" },
  Glob:       { color: "var(--color-tool-read)",    icon: "Search",       label: "Glob" },
  Grep:       { color: "var(--color-tool-read)",    icon: "FileSearch",   label: "Grep" },
  Edit:       { color: "var(--color-tool-write)",   icon: "Pencil",       label: "Edit" },
  Write:      { color: "var(--color-tool-write)",   icon: "FilePlus",     label: "Write" },
  NotebookEdit: { color: "var(--color-tool-write)", icon: "BookOpen",     label: "NotebookEdit" },
  Bash:       { color: "var(--color-tool-execute)", icon: "Terminal",     label: "Bash" },
  WebSearch:  { color: "var(--color-tool-web)",     icon: "Globe",        label: "WebSearch" },
  WebFetch:   { color: "var(--color-tool-web)",     icon: "ExternalLink", label: "WebFetch" },
  Agent:      { color: "var(--color-tool-agent)",   icon: "Bot",          label: "Agent" },
  TaskCreate: { color: "var(--color-tool-agent)",   icon: "ListTodo",     label: "TaskCreate" },
  AskUserQuestion: { color: "var(--color-accent)",  icon: "HelpCircle",   label: "Question" },
} as const;

export const DEFAULT_TOOL = {
  color: "var(--color-text-tertiary)",
  icon: "Wrench",
  label: "Tool",
} as const;

/** Permission modes */
export const PERMISSION_MODES = [
  { value: "default",           label: "Ask for everything",      description: "Requires approval for all tools" },
  { value: "acceptEdits",       label: "Accept file edits",       description: "Auto-approve file operations, ask for Bash" },
  { value: "bypassPermissions", label: "Bypass all permissions",  description: "Auto-approve everything (use with caution)" },
  { value: "plan",              label: "Plan only",               description: "No tool execution — planning mode" },
] as const;

/** Available models */
export const MODELS = [
  { value: "claude-opus-4-6",   label: "Claude Opus 4.6" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "claude-haiku-4-5",  label: "Claude Haiku 4.5" },
] as const;

/** All built-in tools */
export const ALL_TOOLS = [
  "Read", "Edit", "Write", "Bash", "Glob", "Grep",
  "WebSearch", "WebFetch", "Agent",
] as const;

/** Dangerous bash patterns */
export const DANGEROUS_PATTERNS = [
  /\brm\s+-rf\b/, /--force\b/, /\bsudo\b/, /\bDROP\b/i,
  /\bDELETE\s+FROM\b/i, /\bgit\s+push.*--force\b/, /\bgit\s+reset\s+--hard\b/,
];

export function isDangerousCommand(cmd: string): boolean {
  return DANGEROUS_PATTERNS.some((p) => p.test(cmd));
}

/** Git status colors — shared across SidebarFiles, SidebarGit */
export const GIT_STATUS_COLORS: Record<string, string> = {
  modified: "#E2C08D",
  added: "#73C991",
  untracked: "#73C991",
  deleted: "#C74E39",
  renamed: "#73C991",
  conflict: "#E51400",
  ignored: "#6B6B6B",
};

export const GIT_STATUS_LETTERS: Record<string, string> = {
  modified: "M",
  added: "A",
  untracked: "U",
  deleted: "D",
  renamed: "R",
  conflict: "!",
};
