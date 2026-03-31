import { Zap, Terminal, FolderOpen, Files, GitBranch, Settings } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";

const items = [
  { id: "sessions" as const, icon: Zap, label: "Claude Sessions" },
  { id: "terminals" as const, icon: Terminal, label: "Terminals" },
  { id: "projects" as const, icon: FolderOpen, label: "Projects" },
  { id: "files" as const, icon: Files, label: "Workspace Files" },
  { id: "git" as const, icon: GitBranch, label: "Source Control" },
] as const;

export function ActivityBar() {
  const panel = useUIStore((s) => s.sidebarPanel);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarPanel = useUIStore((s) => s.setSidebarPanel);

  const isActive = (id: string) => panel === id && sidebarOpen;

  return (
    <div style={{
      width: 48, flexShrink: 0,
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "10px 0", gap: 4,
      borderRight: "1px solid var(--color-border-subtle)",
      background: "var(--color-bg)",
    }}>
      {items.map(({ id, icon: Icon, label }) => (
        <ActivityButton key={id} active={isActive(id)} label={label} onClick={() => setSidebarPanel(id)}>
          <Icon size={18} strokeWidth={isActive(id) ? 2.5 : 1.5} />
        </ActivityButton>
      ))}

      <div style={{ flex: 1 }} />

      <ActivityButton active={isActive("settings")} label="Settings" onClick={() => setSidebarPanel("settings")}>
        <Settings size={18} strokeWidth={isActive("settings") ? 2.5 : 1.5} />
      </ActivityButton>
    </div>
  );
}

function ActivityButton({ active, label, onClick, children }: {
  active: boolean; label: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        width: 36, height: 36, borderRadius: 8, border: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", transition: "all 0.15s",
        background: active ? "var(--color-bg-surface)" : "transparent",
        color: active ? "var(--color-text)" : "var(--color-text-tertiary)",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = "var(--color-text-secondary)";
          e.currentTarget.style.background = "var(--color-bg-elevated)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = "var(--color-text-tertiary)";
          e.currentTarget.style.background = "transparent";
        }
      }}
    >
      {children}
    </button>
  );
}
