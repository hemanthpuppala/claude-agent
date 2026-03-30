import { useEffect, useState, useRef } from "react";
import { Plus, FolderOpen, Star, Zap, Terminal, Check } from "lucide-react";
import { projects as projectsApi, sessions as sessionsApi } from "@/lib/api";
import { useOpenTab } from "@/hooks/useOpenTab";
import { useTabStore } from "@/stores/tabStore";
import { colors, spacing, sidebarHeader, sidebarHeaderLabel, sidebarCountBadge, listItem, separator, hoverBg } from "@/lib/styles";
import type { Project, Session } from "@/lib/types";

export function SidebarProjects() {
  const [saved, setSaved] = useState<Project[]>([]);
  const [discovered, setDiscovered] = useState<{ name: string; path: string }[]>([]);
  const { openSession, openTerminal } = useOpenTab();
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const [addingPath, setAddingPath] = useState(false);
  const [newPath, setNewPath] = useState("");
  const pathInputRef = useRef<HTMLInputElement>(null);
  const activeProject = activeTab?.project || activeTab?.cwd || activeTab?.projectPath || "";

  useEffect(() => {
    projectsApi.list().then((data) => setSaved(data as unknown as Project[]));
    projectsApi.discover().then(setDiscovered);
  }, []);

  const allPaths = new Set(saved.map((p) => p.path));
  const unsaved = discovered.filter((d) => !allPaths.has(d.path));

  const createSession = async (path: string) => {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd: path }),
      });
      const data = await res.json();
      openSession(data.session_id, path, "New session");
    } catch (e) {
      console.error("Failed to create session:", e);
    }
  };

  // Switch to project: find most recent session for this project, or create new
  const switchToProject = async (path: string) => {
    // First check if there's already an open tab for this project
    const tabs = useTabStore.getState().tabs;
    const existingTab = tabs.find(t =>
      t.type === "session" && (t.project === path || t.cwd === path)
    );
    if (existingTab) {
      useTabStore.getState().setActive(existingTab.id);
      return;
    }

    // Check for existing sessions in the DB
    try {
      const sessions = await sessionsApi.list({ cwd: path }) as unknown as Session[];
      if (sessions.length > 0) {
        // Open the most recent one
        const latest = sessions[0];
        openSession(latest.id, path, latest.last_prompt || latest.name || "Session");
        return;
      }
    } catch { /* ignore */ }

    // No existing session — create new
    await createSession(path);
  };

  const allProjects = [
    ...saved.map((p) => ({ name: p.name, path: p.path, pinned: !!p.pinned })),
    ...unsaved.map((d) => ({ name: d.name, path: d.path, pinned: false })),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={sidebarHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
          <FolderOpen size={13} color={colors.toolRead} />
          <span style={sidebarHeaderLabel}>Projects</span>
          <span style={sidebarCountBadge}>{allProjects.length}</span>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: `${spacing.xs}px 0` }}>
        {allProjects.map((p, i) => (
          <div key={p.path}>
            {i > 0 && <div style={separator} />}
            <div
              style={{
                ...listItem,
                ...(p.path === activeProject ? {
                  background: "rgba(212,132,90,0.06)",
                  borderLeft: `3px solid ${colors.accent}`,
                  paddingLeft: spacing.sm + 1,
                } : {}),
              }}
              onMouseEnter={hoverBg}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  p.path === activeProject ? "rgba(212,132,90,0.06)" : "transparent";
              }}
            >
            <button
              onClick={() => switchToProject(p.path)}
              style={{
                display: "flex", alignItems: "center", gap: spacing.sm, width: "100%",
                border: "none", background: "transparent", cursor: "pointer",
                padding: 0, textAlign: "left",
              }}
            >
              {p.pinned
                ? <Star size={13} color={colors.accent} fill={colors.accent} style={{ flexShrink: 0 }} />
                : <FolderOpen size={13} color={p.path === activeProject ? colors.accent : colors.textTertiary} style={{ flexShrink: 0 }} />
              }
              <span style={{
                fontSize: 13, fontWeight: 600, color: colors.text,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
              }}>
                {p.name}
              </span>
              {p.path === activeProject && (
                <Check size={13} color={colors.accent} style={{ flexShrink: 0 }} />
              )}
            </button>
            <div style={{
              fontSize: 11, fontFamily: "var(--font-mono)", color: colors.textTertiary,
              marginTop: 2, paddingLeft: 21,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {p.path}
            </div>
            <div style={{ display: "flex", gap: spacing.xs + 2, paddingLeft: 21, marginTop: spacing.xs + 2 }}>
              <QuickAction icon={<Zap size={10} />} label="Session" color={colors.accent} bg="rgba(212,132,90,0.08)" bgHover="rgba(212,132,90,0.15)" onClick={() => createSession(p.path)} />
              <QuickAction icon={<Terminal size={10} />} label="Terminal" color={colors.toolExecute} bg="rgba(134,239,172,0.06)" bgHover="rgba(134,239,172,0.12)" onClick={() => openTerminal(`${p.name}-1`, p.path)} />
            </div>
          </div>
          </div>
        ))}

        {allProjects.length === 0 && (
          <div style={{ padding: `${spacing.xxl}px ${spacing.lg}px`, textAlign: "center", fontSize: 12, color: colors.textTertiary }}>
            No projects found in ~/Project
          </div>
        )}
      </div>

      {/* Footer — Add project path */}
      <div style={{ padding: `${spacing.md}px ${spacing.lg}px`, flexShrink: 0, borderTop: `1px solid ${colors.borderSubtle}` }}>
        {addingPath ? (
          <div>
            <input
              ref={pathInputRef}
              autoFocus
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && newPath.trim()) {
                  try {
                    await projectsApi.save(newPath.trim());
                    setNewPath("");
                    setAddingPath(false);
                    // Refresh lists
                    projectsApi.list().then((data) => setSaved(data as unknown as Project[]));
                    projectsApi.discover().then(setDiscovered);
                  } catch (err) {
                    alert("Invalid path or directory not found");
                  }
                }
                if (e.key === "Escape") {
                  setNewPath("");
                  setAddingPath(false);
                }
              }}
              placeholder="/home/user/my-project"
              style={{
                width: "100%", padding: "8px 10px", borderRadius: 8,
                border: `1px solid ${colors.accent}`,
                background: colors.bg, color: colors.text,
                fontSize: 12, fontFamily: "var(--font-mono)",
                outline: "none", marginBottom: 6,
              }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={async () => {
                  if (!newPath.trim()) return;
                  try {
                    await projectsApi.save(newPath.trim());
                    setNewPath("");
                    setAddingPath(false);
                    projectsApi.list().then((data) => setSaved(data as unknown as Project[]));
                    projectsApi.discover().then(setDiscovered);
                  } catch {
                    alert("Invalid path or directory not found");
                  }
                }}
                style={{
                  padding: "5px 12px", borderRadius: 6, border: "none",
                  background: colors.accent, color: "#fff",
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                }}
              >
                Add
              </button>
              <button
                onClick={() => { setNewPath(""); setAddingPath(false); }}
                style={{
                  padding: "5px 12px", borderRadius: 6, border: "none",
                  background: "transparent", color: colors.textTertiary,
                  fontSize: 11, cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setAddingPath(true); setTimeout(() => pathInputRef.current?.focus(), 50); }}
            style={{
              display: "flex", alignItems: "center", gap: spacing.sm, width: "100%",
              padding: `${spacing.sm}px 0`, border: "none", background: "transparent",
              cursor: "pointer", fontSize: 13, color: colors.textSecondary, transition: "color 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = colors.text; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = colors.textSecondary; }}
          >
            <Plus size={14} />
            Add project path
          </button>
        )}
      </div>
    </div>
  );
}

function QuickAction({ icon, label, color, bg, bgHover, onClick }: {
  icon: React.ReactNode; label: string; color: string; bg: string; bgHover: string; onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: "4px 10px", borderRadius: 6, border: "none",
        background: bg, color, fontSize: 11, fontWeight: 600,
        cursor: "pointer", transition: "background 0.12s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = bgHover; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = bg; }}
    >
      {icon} {label}
    </button>
  );
}
