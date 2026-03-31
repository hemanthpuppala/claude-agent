import { useUIStore } from "@/stores/uiStore";
import { useTabStore } from "@/stores/tabStore";
import { SidebarHome } from "./SidebarHome";
import { SidebarTerminals } from "./SidebarTerminals";
import { SidebarProjects } from "./SidebarProjects";
import { SidebarFiles } from "./SidebarFiles";
import { SidebarSettings } from "./SidebarSettings";
import { SidebarGit } from "./SidebarGit";

export function Sidebar() {
  const panel = useUIStore((s) => s.sidebarPanel);
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));

  const projectPath = activeTab?.project || activeTab?.cwd || activeTab?.projectPath || "";

  return (
    <div style={{
      width: 260, flexShrink: 0, overflowY: "auto",
      borderRight: "1px solid var(--color-border-subtle)",
      background: "var(--color-bg-elevated)",
    }}>
      {panel === "sessions" && <SidebarHome />}
      {panel === "terminals" && <SidebarTerminals />}
      {panel === "projects" && <SidebarProjects />}
      {panel === "files" && (
        projectPath
          ? <SidebarFiles projectPath={projectPath} />
          : <div style={{ padding: 20, fontSize: 12, color: "var(--color-text-tertiary)" }}>
              Select a session or terminal tab to view its project files.
            </div>
      )}
      {panel === "git" && <SidebarGit />}
      {panel === "settings" && <SidebarSettings />}
    </div>
  );
}
