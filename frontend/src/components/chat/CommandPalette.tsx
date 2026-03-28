import { useState, useEffect, useRef } from "react";
import { Terminal, GitCommit, FileSearch, Bug, TestTube, BookOpen, RefreshCw, FileText, HelpCircle, Trash2, Brain, Activity, Slash } from "lucide-react";
import { commands as commandsApi } from "@/lib/api";

interface Command {
  name: string;
  description: string;
  scope: string;
  body?: string;
}

const COMMAND_ICONS: Record<string, typeof Terminal> = {
  "/commit": GitCommit,
  "/review": FileSearch,
  "/fix": Bug,
  "/test": TestTube,
  "/docs": BookOpen,
  "/refactor": RefreshCw,
  "/explain": BookOpen,
  "/init": FileText,
  "/clear": Trash2,
  "/help": HelpCircle,
  "/compact": Brain,
  "/status": Activity,
  "/memory": Brain,
  "/pr": GitCommit,
};

export function CommandPalette({ filter, cwd, onSelect, onClose }: {
  filter: string;
  cwd: string;
  onSelect: (command: string) => void;
  onClose: () => void;
}) {
  const [allCommands, setAllCommands] = useState<Command[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    commandsApi.list(cwd).then(setAllCommands).catch(() => {});
  }, [cwd]);

  const filtered = allCommands.filter((cmd) =>
    cmd.name.toLowerCase().includes(filter.toLowerCase()) ||
    cmd.description.toLowerCase().includes(filter.toLowerCase())
  );

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex].name);
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [filtered, selectedIndex, onSelect, onClose]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  if (filtered.length === 0) return null;

  return (
    <div
      ref={ref}
      style={{
        position: "absolute", bottom: "calc(100% + 8px)", left: 0, right: 0,
        maxHeight: 320, overflowY: "auto",
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        boxShadow: "var(--shadow-card-hover)",
        padding: 6, zIndex: 100,
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "6px 10px", fontSize: 10, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.08em",
        color: "var(--color-text-tertiary)",
      }}>
        <Slash size={10} />
        Commands
      </div>

      {filtered.map((cmd, i) => {
        const Icon = COMMAND_ICONS[cmd.name] || Terminal;
        const isBuiltin = cmd.scope === "builtin";

        return (
          <button
            key={cmd.name}
            onClick={() => onSelect(cmd.name)}
            onMouseEnter={() => setSelectedIndex(i)}
            style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              padding: "8px 10px", borderRadius: 8, border: "none",
              background: i === selectedIndex ? "var(--color-bg-surface)" : "transparent",
              cursor: "pointer", textAlign: "left",
              transition: "background 0.1s",
            }}
          >
            <Icon size={15} color={isBuiltin ? "var(--color-accent)" : "var(--color-tool-agent)"} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--color-text)" }}>
                  {cmd.name}
                </span>
                {!isBuiltin && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                    padding: "1px 5px", borderRadius: 4,
                    background: "var(--color-bg-surface)",
                    color: "var(--color-text-tertiary)",
                  }}>
                    {cmd.scope}
                  </span>
                )}
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
      })}
    </div>
  );
}
