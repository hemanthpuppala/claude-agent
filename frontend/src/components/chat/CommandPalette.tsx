import { useState, useEffect, useRef } from "react";
import {
  Terminal, GitCommit, FileSearch, Bug, TestTube, BookOpen, RefreshCw,
  FileText, HelpCircle, Trash2, Brain, Activity, Play, Settings,
  Zap, Wrench, MessageSquare, RotateCcw, Gauge, Server, List, GraduationCap,
  Flag,
} from "lucide-react";
import { commands as commandsApi } from "@/lib/api";

interface Command {
  name: string;
  description: string;
  scope: string;
  category?: string;
  body?: string;
}

const COMMAND_ICONS: Record<string, typeof Terminal> = {
  "/resume": RotateCcw,
  "/continue": Play,
  "/compact": Brain,
  "/clear": Trash2,
  "/status": Activity,
  "/model": Gauge,
  "/permissions": Settings,
  "/fast": Zap,
  "/init": FileText,
  "/memory": Brain,
  "/context": Activity,
  "/mcp": Server,
  "/tools": Wrench,
  "/skills": List,
  "/commit": GitCommit,
  "/pr": GitCommit,
  "/review": FileSearch,
  "/fix": Bug,
  "/test": TestTube,
  "/explain": BookOpen,
  "/refactor": RefreshCw,
  "/docs": BookOpen,
  "/help": HelpCircle,
  "/bug": Flag,
};

const CATEGORY_LABELS: Record<string, string> = {
  session: "Session",
  config: "Configuration",
  project: "Project",
  tools: "Tools & Integrations",
  code: "Code Operations",
  help: "Help",
};

const CATEGORY_ORDER = ["session", "config", "project", "tools", "code", "help"];

export function CommandPalette({ filter, cwd, onSelect, onClose }: {
  filter: string;
  cwd: string;
  onSelect: (command: string) => void;
  onClose: () => void;
}) {
  const [allCommands, setAllCommands] = useState<Command[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    commandsApi.list(cwd).then(setAllCommands).catch(() => {});
  }, [cwd]);

  const filtered = allCommands.filter((cmd) =>
    cmd.name.toLowerCase().includes(filter.toLowerCase()) ||
    cmd.description.toLowerCase().includes(filter.toLowerCase())
  );

  // Group by category
  const grouped = new Map<string, Command[]>();
  for (const cmd of filtered) {
    const cat = cmd.category || cmd.scope;
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(cmd);
  }

  // Flatten for index tracking
  const flatList: Command[] = [];
  for (const cat of CATEGORY_ORDER) {
    if (grouped.has(cat)) flatList.push(...grouped.get(cat)!);
  }
  // Add non-categorized (user commands)
  for (const [cat, cmds] of grouped) {
    if (!CATEGORY_ORDER.includes(cat)) flatList.push(...cmds);
  }

  useEffect(() => { setSelectedIndex(0); }, [filter]);

  // Scroll selected into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatList.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (flatList[selectedIndex]) onSelect(flatList[selectedIndex].name);
      } else if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (flatList[selectedIndex]) onSelect(flatList[selectedIndex].name);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [flatList, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  if (flatList.length === 0) return null;

  let globalIndex = 0;

  return (
    <div
      ref={ref}
      style={{
        position: "absolute", bottom: "calc(100% + 8px)", left: 0, right: 0,
        maxHeight: "min(380px, 60dvh)", overflowY: "auto",
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        boxShadow: "var(--shadow-card-hover)",
        padding: "6px 0", zIndex: 100,
      }}
    >
      {/* Render by category */}
      {CATEGORY_ORDER.map((cat) => {
        const cmds = grouped.get(cat);
        if (!cmds || cmds.length === 0) return null;
        const label = CATEGORY_LABELS[cat] || cat;

        return (
          <div key={cat}>
            <div style={{
              padding: "8px 14px 4px",
              fontSize: 10, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.08em",
              color: "var(--color-text-tertiary)",
            }}>
              {label}
            </div>
            {cmds.map((cmd) => {
              const idx = globalIndex++;
              return <CommandItem key={cmd.name} cmd={cmd} index={idx} selectedIndex={selectedIndex}
                setSelectedIndex={setSelectedIndex} onSelect={onSelect} selectedRef={selectedRef} />;
            })}
          </div>
        );
      })}

      {/* User-defined / non-categorized */}
      {[...grouped.entries()]
        .filter(([cat]) => !CATEGORY_ORDER.includes(cat))
        .map(([cat, cmds]) => (
          <div key={cat}>
            <div style={{
              padding: "8px 14px 4px",
              fontSize: 10, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.08em",
              color: "var(--color-tool-agent)",
            }}>
              {cat === "global" ? "Global Commands" : cat === "project" ? "Project Commands" : cat}
            </div>
            {cmds.map((cmd) => {
              const idx = globalIndex++;
              return <CommandItem key={cmd.name} cmd={cmd} index={idx} selectedIndex={selectedIndex}
                setSelectedIndex={setSelectedIndex} onSelect={onSelect} selectedRef={selectedRef} />;
            })}
          </div>
        ))
      }

      {/* Footer hint */}
      <div style={{
        padding: "6px 14px", marginTop: 4,
        borderTop: "1px solid var(--color-border-subtle)",
        fontSize: 10, color: "var(--color-text-tertiary)",
        display: "flex", gap: 12,
      }}>
        <span><kbd style={kbdStyle}>↑↓</kbd> navigate</span>
        <span><kbd style={kbdStyle}>Tab</kbd>/<kbd style={kbdStyle}>Enter</kbd> select</span>
        <span><kbd style={kbdStyle}>Esc</kbd> close</span>
      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  padding: "1px 4px", borderRadius: 3,
  background: "var(--color-bg-surface)",
  border: "1px solid var(--color-border)",
  fontSize: 9, fontFamily: "var(--font-mono)",
};

function CommandItem({ cmd, index, selectedIndex, setSelectedIndex, onSelect, selectedRef }: {
  cmd: Command;
  index: number;
  selectedIndex: number;
  setSelectedIndex: (i: number) => void;
  onSelect: (name: string) => void;
  selectedRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const Icon = COMMAND_ICONS[cmd.name] || (cmd.scope === "builtin" ? MessageSquare : GraduationCap);
  const isSelected = index === selectedIndex;

  return (
    <button
      ref={isSelected ? selectedRef : null}
      onClick={() => onSelect(cmd.name)}
      onMouseEnter={() => setSelectedIndex(index)}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "7px 14px", border: "none",
        background: isSelected ? "var(--color-bg-surface)" : "transparent",
        cursor: "pointer", textAlign: "left",
        transition: "background 0.08s",
      }}
    >
      <Icon
        size={15}
        color={cmd.scope === "builtin" ? "var(--color-accent)" : "var(--color-tool-agent)"}
        style={{ flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 13, fontWeight: 600,
            fontFamily: "var(--font-mono)",
            color: "var(--color-text)",
          }}>
            {cmd.name}
          </span>
        </div>
        <div style={{
          fontSize: 11, color: "var(--color-text-secondary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {cmd.description}
        </div>
      </div>
    </button>
  );
}
