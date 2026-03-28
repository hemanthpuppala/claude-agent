import { Home, FolderOpen, Settings } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";

const items = [
  { id: "home" as const, icon: Home, label: "Home" },
  { id: "projects" as const, icon: FolderOpen, label: "Projects" },
  { id: "settings" as const, icon: Settings, label: "Settings" },
] as const;

export function MobileNav() {
  const panel = useUIStore((s) => s.sidebarPanel);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarPanel = useUIStore((s) => s.setSidebarPanel);

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-around",
      height: 56,
      background: "var(--color-bg-elevated)",
      borderTop: "1px solid var(--color-border-subtle)",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
      flexShrink: 0,
    }}>
      {items.map(({ id, icon: Icon, label }) => {
        const isActive = panel === id && sidebarOpen;
        return (
          <button
            key={id}
            onClick={() => setSidebarPanel(id)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              padding: "6px 16px", border: "none", background: "transparent",
              cursor: "pointer", minWidth: 64, minHeight: 44,
              color: isActive ? "var(--color-accent)" : "var(--color-text-tertiary)",
              transition: "color 0.15s",
            }}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
            <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500 }}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
