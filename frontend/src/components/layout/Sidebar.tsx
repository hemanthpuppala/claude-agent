import { useUIStore } from "@/stores/uiStore";
import { SidebarHome } from "./SidebarHome";
import { SidebarProjects } from "./SidebarProjects";

export function Sidebar() {
  const panel = useUIStore((s) => s.sidebarPanel);

  return (
    <div style={{
      width: 260, flexShrink: 0, overflowY: "auto",
      borderRight: "1px solid var(--color-border-subtle)",
      background: "var(--color-bg-elevated)",
    }}>
      {panel === "home" && <SidebarHome />}
      {panel === "projects" && <SidebarProjects />}
      {panel === "files" && (
        <div style={{ padding: 20, fontSize: 12, color: "var(--color-text-tertiary)" }}>
          Select a session tab to view its project files.
        </div>
      )}
      {panel === "settings" && (
        <div style={{ padding: 20, fontSize: 12, color: "var(--color-text-tertiary)" }}>
          Settings — coming soon.
        </div>
      )}
    </div>
  );
}
