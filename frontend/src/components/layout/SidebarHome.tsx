import { useEffect, useState } from "react";
import { Plus, Zap, ChevronDown, ChevronRight, FolderOpen, FolderTree } from "lucide-react";
import { sessions as sessionsApi } from "@/lib/api";
import { useTabStore } from "@/stores/tabStore";
import { useUIStore } from "@/stores/uiStore";
import { formatTimeAgo, formatCost, truncate } from "@/lib/utils";
import type { Session } from "@/lib/types";

export function SidebarHome() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const openTab = useTabStore((s) => s.openTab);
  const setSidebarPanel = useUIStore((s) => s.setSidebarPanel);

  useEffect(() => {
    const load = () => sessionsApi.list().then((d) => setSessions(d as unknown as Session[]));
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  // Group sessions by project (cwd)
  const grouped = new Map<string, Session[]>();
  for (const s of sessions) {
    const project = s.cwd.split("/").pop() || s.cwd;
    if (!grouped.has(project)) grouped.set(project, []);
    grouped.get(project)!.push(s);
  }

  // Auto-expand all projects on first load
  useEffect(() => {
    if (expandedProjects.size === 0 && grouped.size > 0) {
      setExpandedProjects(new Set(grouped.keys()));
    }
  }, [grouped.size]); // eslint-disable-line react-hooks/exhaustive-deps

  const projectNames = ["all", ...grouped.keys()];
  const filteredGroups = filter === "all"
    ? [...grouped.entries()]
    : [...grouped.entries()].filter(([name]) => name === filter);

  const toggleProject = (name: string) => {
    const next = new Set(expandedProjects);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setExpandedProjects(next);
  };

  const openSession = (s: Session) => {
    const project = s.cwd.split("/").pop() || "project";
    openTab({
      id: `session-${s.id}`,
      type: "session",
      label: `${project}: ${truncate(s.last_prompt || "Session", 30)}`,
      sessionId: s.id,
      project: s.cwd,
    });
  };

  const openFiles = (cwd: string) => {
    // Switch to files panel with this project
    openTab({
      id: `files-${cwd}`,
      type: "file",
      label: `Files: ${cwd.split("/").pop()}`,
      projectPath: cwd,
      filePath: "",
    });
    setSidebarPanel("files");
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
          <Zap size={13} color="var(--color-accent)" />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)" }}>
            Sessions
          </span>
        </div>
        <button
          title="New session"
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

      {/* Project filter dropdown */}
      {grouped.size > 1 && (
        <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--color-border-subtle)" }}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              width: "100%", padding: "6px 8px", borderRadius: 6,
              border: "1px solid var(--color-border)",
              background: "var(--color-bg)", color: "var(--color-text)",
              fontSize: 12, outline: "none", cursor: "pointer",
              appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23706c64' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 8px center",
              paddingRight: 28,
            }}
          >
            {projectNames.map((name) => (
              <option key={name} value={name}>
                {name === "all" ? "All projects" : name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Grouped session list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {filteredGroups.map(([projectName, projectSessions]) => {
          const isExpanded = expandedProjects.has(projectName);
          const active = projectSessions.filter((s) => ["thinking", "waiting_permission"].includes(s.status));
          const cwd = projectSessions[0]?.cwd || "";

          return (
            <div key={projectName} style={{ marginBottom: 4 }}>
              {/* Project header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 12px",
              }}>
                <button
                  onClick={() => toggleProject(projectName)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, flex: 1,
                    background: "none", border: "none", cursor: "pointer",
                    padding: 0, textAlign: "left",
                  }}
                >
                  {isExpanded
                    ? <ChevronDown size={12} color="var(--color-text-tertiary)" />
                    : <ChevronRight size={12} color="var(--color-text-tertiary)" />
                  }
                  <FolderOpen size={13} color="var(--color-accent)" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text)", flex: 1 }}>
                    {projectName}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: "var(--color-text-tertiary)",
                    padding: "1px 6px", borderRadius: 99,
                    background: "var(--color-bg-surface)",
                  }}>
                    {projectSessions.length}
                  </span>
                  {active.length > 0 && (
                    <span style={{
                      width: 6, height: 6, borderRadius: 99,
                      background: "var(--color-info)",
                    }} className="animate-pulse-dot" />
                  )}
                </button>

                {/* Open file tree button */}
                <button
                  onClick={() => openFiles(cwd)}
                  title="Browse files"
                  style={{
                    width: 24, height: 24, borderRadius: 4, border: "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "transparent", color: "var(--color-text-tertiary)",
                    cursor: "pointer", flexShrink: 0,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-text)"; e.currentTarget.style.background = "var(--color-bg-surface)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-tertiary)"; e.currentTarget.style.background = "transparent"; }}
                >
                  <FolderTree size={12} />
                </button>
              </div>

              {/* Sessions under this project */}
              {isExpanded && (
                <div style={{ paddingLeft: 8 }}>
                  {projectSessions.map((s) => (
                    <SessionItem key={s.id} session={s} onClick={() => openSession(s)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {sessions.length === 0 && (
          <div style={{ padding: "40px 16px", textAlign: "center" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, margin: "0 auto 12px",
              background: "var(--color-bg-surface)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Zap size={16} color="var(--color-text-tertiary)" />
            </div>
            <p style={{ fontSize: 12, color: "var(--color-text-tertiary)", lineHeight: 1.5 }}>
              No sessions yet.<br />Create one from the Dashboard.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SessionItem({ session: s, onClick }: { session: Session; onClick: () => void }) {
  const isActive = ["thinking", "waiting_permission"].includes(s.status);
  const dotColor =
    s.status === "thinking" ? "var(--color-info)" :
    s.status === "waiting_permission" ? "var(--color-warning)" :
    s.status === "error" ? "var(--color-destructive)" :
    "var(--color-success)";

  // Use last_prompt as display name, fallback to session name
  const displayName = s.last_prompt
    ? truncate(s.last_prompt, 35)
    : s.name || "New session";

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left", cursor: "pointer",
        padding: "8px 12px", borderRadius: 8, marginBottom: 1,
        border: "none", background: "transparent",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-surface)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          className={isActive ? "animate-pulse-dot" : ""}
          style={{ width: 6, height: 6, borderRadius: 99, flexShrink: 0, background: dotColor }}
        />
        <span style={{
          fontSize: 13, fontWeight: 500, color: "var(--color-text)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {displayName}
        </span>
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        marginTop: 3, paddingLeft: 14,
        fontSize: 10, fontFamily: "var(--font-mono)",
        color: "var(--color-text-tertiary)",
      }}>
        <span style={{ color: "var(--color-success)" }}>{formatCost(s.total_cost_usd)}</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>{formatTimeAgo(s.updated_at)}</span>
      </div>
    </button>
  );
}
