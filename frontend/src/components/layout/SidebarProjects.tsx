import { useEffect, useState } from "react";
import { Plus, FolderOpen, Star, Zap, Terminal } from "lucide-react";
import { projects as projectsApi } from "@/lib/api";
import { useOpenTab } from "@/hooks/useOpenTab";
import { colors, spacing, sidebarHeader, sidebarHeaderLabel, sidebarCountBadge, listItem, separator, hoverBg, unhoverBg } from "@/lib/styles";
import type { Project } from "@/lib/types";

export function SidebarProjects() {
  const [saved, setSaved] = useState<Project[]>([]);
  const [discovered, setDiscovered] = useState<{ name: string; path: string }[]>([]);
  const { openSession, openTerminal } = useOpenTab();

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
              style={listItem}
              onMouseEnter={hoverBg}
              onMouseLeave={unhoverBg}
            >
            <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
              {p.pinned
                ? <Star size={13} color={colors.accent} fill={colors.accent} style={{ flexShrink: 0 }} />
                : <FolderOpen size={13} color={colors.textTertiary} style={{ flexShrink: 0 }} />
              }
              <span style={{
                fontSize: 13, fontWeight: 600, color: colors.text,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
              }}>
                {p.name}
              </span>
            </div>
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

      {/* Footer */}
      <div style={{ padding: `${spacing.md}px ${spacing.lg}px`, flexShrink: 0, borderTop: `1px solid ${colors.borderSubtle}` }}>
        <button
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
