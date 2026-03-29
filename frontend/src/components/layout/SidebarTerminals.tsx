import { useEffect, useState, useCallback, useRef } from "react";
import { Terminal, Plus, ChevronDown, ChevronRight, FolderOpen, Trash2, MoreHorizontal, Pencil, Pin } from "lucide-react";
import { terminals as terminalsApi } from "@/lib/api";
import { useTabStore } from "@/stores/tabStore";
import { TerminalNamePrompt } from "@/components/terminal/TerminalNamePrompt";

interface TermSession {
  name: string;
  created_at: number;
  windows: number;
  cwd: string;
  project: string;
}

export function SidebarTerminals() {
  const [sessions, setSessions] = useState<TermSession[]>([]);
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptCwd, setPromptCwd] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const openTab = useTabStore((s) => s.openTab);

  const load = useCallback(() => {
    terminalsApi.list().then(setSessions).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  // Group by project
  const grouped = new Map<string, TermSession[]>();
  for (const s of sessions) {
    const key = s.project || "other";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }

  // Auto-expand all
  useEffect(() => {
    if (expanded.size === 0 && grouped.size > 0) {
      setExpanded(new Set(grouped.keys()));
    }
  }, [grouped.size]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleProject = (name: string) => {
    const next = new Set(expanded);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setExpanded(next);
  };

  const attachTerminal = (t: TermSession) => {
    openTab({
      id: `terminal-${t.name}`,
      type: "terminal",
      label: t.name,
      cwd: t.cwd,
    });
  };

  const killTerminal = async (name: string) => {
    await terminalsApi.kill(name);
    load();
  };

  const openNewTerminal = (cwd: string, name: string) => {
    openTab({
      id: `terminal-${name}`,
      type: "terminal",
      label: name,
      cwd,
    });
    load();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px", height: 44, flexShrink: 0,
        borderBottom: "1px solid var(--color-border-subtle)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Terminal size={13} color="var(--color-tool-execute)" />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)" }}>
            Terminals
          </span>
          {sessions.length > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 99,
              background: "var(--color-bg-surface)", color: "var(--color-text-tertiary)",
            }}>
              {sessions.length}
            </span>
          )}
        </div>
        <button
          title="New terminal"
          onClick={() => { setPromptCwd(""); setShowPrompt(true); }}
          style={{
            width: 26, height: 26, borderRadius: 6, border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", background: "transparent", color: "var(--color-text-tertiary)",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-surface)"; e.currentTarget.style.color = "var(--color-text)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-text-tertiary)"; }}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Session list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {[...grouped.entries()].map(([project, terms]) => (
          <div key={project}>
            {/* Project header */}
            <button
              onClick={() => toggleProject(project)}
              style={{
                display: "flex", alignItems: "center", gap: 6, width: "100%",
                padding: "8px 12px", border: "none", background: "transparent",
                cursor: "pointer", textAlign: "left",
              }}
            >
              {expanded.has(project)
                ? <ChevronDown size={12} color="var(--color-text-tertiary)" />
                : <ChevronRight size={12} color="var(--color-text-tertiary)" />
              }
              <FolderOpen size={13} color="var(--color-accent)" />
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)", flex: 1 }}>
                {project}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 99,
                background: "var(--color-bg-surface)", color: "var(--color-text-tertiary)",
              }}>
                {terms.length}
              </span>
            </button>

            {/* Terminal items */}
            {expanded.has(project) && terms.map((t) => (
              <TerminalItem
                key={t.name}
                session={t}
                onAttach={() => attachTerminal(t)}
                onKill={() => killTerminal(t.name)}
                onRename={async (newName) => {
                  await terminalsApi.rename(t.name, newName);
                  load();
                }}
              />
            ))}
          </div>
        ))}

        {sessions.length === 0 && (
          <div style={{ padding: "40px 16px", textAlign: "center" }}>
            <Terminal size={24} color="var(--color-text-tertiary)" style={{ margin: "0 auto 12px", display: "block" }} />
            <p style={{ fontSize: 12, color: "var(--color-text-tertiary)", lineHeight: 1.5 }}>
              No terminal sessions.<br />
              Open one from a project's file explorer.
            </p>
          </div>
        )}
      </div>

      {/* Name prompt */}
      {showPrompt && (
        <TerminalNamePrompt
          defaultName={`session-${sessions.length + 1}`}
          onConfirm={(name) => {
            setShowPrompt(false);
            const cwd = promptCwd || sessions[0]?.cwd || "~";
            openNewTerminal(cwd, name);
          }}
          onCancel={() => setShowPrompt(false)}
        />
      )}
    </div>
  );
}

function TerminalItem({ session: t, onAttach, onKill, onRename }: {
  session: { name: string; created_at: number; cwd: string };
  onAttach: () => void;
  onKill: () => void;
  onRename: (newName: string) => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(t.name);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleRename = async () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== t.name) {
      await onRename(trimmed);
    }
    setRenaming(false);
  };

  if (renaming) {
    return (
      <div style={{ padding: "6px 12px 6px 32px" }}>
        <input
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRename();
            if (e.key === "Escape") setRenaming(false);
          }}
          onBlur={handleRename}
          style={{
            width: "100%", padding: "6px 8px", borderRadius: 6,
            border: "1px solid var(--color-accent)",
            background: "var(--color-bg)", color: "var(--color-text)",
            fontSize: 12, fontFamily: "var(--font-mono)", outline: "none",
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "7px 12px 7px 32px",
        transition: "background 0.1s",
        position: "relative",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-surface)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <button
        onClick={onAttach}
        onContextMenu={(e) => { e.preventDefault(); setMenuOpen(true); }}
        style={{
          display: "flex", alignItems: "center", gap: 8, flex: 1,
          border: "none", background: "transparent", cursor: "pointer",
          textAlign: "left", padding: 0,
        }}
      >
        <Terminal size={13} color="var(--color-tool-execute)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 500, color: "var(--color-text)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {t.name}
          </div>
          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-text-tertiary)" }}>
            {new Date(t.created_at * 1000).toLocaleString([], {
              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
            })}
          </div>
        </div>
      </button>

      {/* Menu trigger */}
      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
        style={{
          width: 24, height: 24, borderRadius: 4, border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "transparent", color: "var(--color-text-tertiary)",
          cursor: "pointer", opacity: 0, transition: "opacity 0.15s",
        }}
        className="term-menu-btn"
      >
        <MoreHorizontal size={12} />
      </button>

      {/* Context menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          style={{
            position: "absolute", top: 0, right: 8, zIndex: 50,
            background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border)",
            borderRadius: 8, boxShadow: "var(--shadow-card-hover)",
            padding: 4, minWidth: 140,
          }}
        >
          <ContextMenuButton icon={<Pencil size={13} />} label="Rename" onClick={() => { setMenuOpen(false); setRenaming(true); }} />
          <ContextMenuButton icon={<Pin size={13} />} label="Pin" onClick={() => setMenuOpen(false)} />
          <ContextMenuButton icon={<Trash2 size={13} />} label="Kill" danger onClick={() => { setMenuOpen(false); onKill(); }} />
        </div>
      )}

      <style>{`
        div:hover > .term-menu-btn { opacity: 0.6 !important; }
      `}</style>
    </div>
  );
}

function ContextMenuButton({ icon, label, onClick, danger }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%",
        padding: "7px 10px", borderRadius: 6, border: "none",
        background: "transparent", cursor: "pointer",
        fontSize: 12, color: danger ? "var(--color-destructive)" : "var(--color-text)",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-surface)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {icon}
      {label}
    </button>
  );
}
