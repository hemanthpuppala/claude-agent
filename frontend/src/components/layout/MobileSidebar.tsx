import { useState } from "react";
import { Zap, Terminal, FolderOpen, Settings, ChevronLeft, X, Files } from "lucide-react";
import { SidebarHome } from "./SidebarHome";
import { SidebarTerminals } from "./SidebarTerminals";
import { SidebarProjects } from "./SidebarProjects";
import { SidebarFiles } from "./SidebarFiles";
import { SidebarSettings } from "./SidebarSettings";
import { useTabStore } from "@/stores/tabStore";

type Panel = "menu" | "sessions" | "terminals" | "projects" | "files" | "settings";

const MENU_ITEMS: { id: Panel; icon: typeof Zap; label: string; description: string }[] = [
  { id: "sessions", icon: Zap, label: "Claude Sessions", description: "Active and recent sessions" },
  { id: "terminals", icon: Terminal, label: "Terminals", description: "tmux terminal sessions" },
  { id: "projects", icon: FolderOpen, label: "Projects", description: "Discover and manage projects" },
  { id: "files", icon: Files, label: "Workspace Files", description: "Browse current project files" },
  { id: "settings", icon: Settings, label: "Settings", description: "Permissions, model, notifications" },
];

export function MobileSidebar({ onClose }: { onClose: () => void }) {
  const [panel, setPanel] = useState<Panel>("menu");
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const projectPath = activeTab?.project || activeTab?.cwd || activeTab?.projectPath || "";

  const panelTitle =
    panel === "sessions" ? "Sessions" :
    panel === "terminals" ? "Terminals" :
    panel === "projects" ? "Projects" :
    panel === "files" ? "Files" :
    panel === "settings" ? "Settings" :
    "Menu";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 300,
          background: "rgba(0,0,0,0.5)",
          animation: "fadeIn 0.15s ease-out",
        }}
      />

      {/* Sidebar */}
      <div style={{
        position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 301,
        width: "100vw", maxWidth: 360,
        background: "var(--color-bg-elevated)",
        borderRight: "1px solid var(--color-border)",
        boxShadow: "8px 0 32px rgba(0,0,0,0.5)",
        animation: "slideInLeft 0.25s cubic-bezier(0.22, 1, 0.36, 1)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "0 12px", height: 52, flexShrink: 0,
          borderBottom: "1px solid var(--color-border-subtle)",
        }}>
          {panel !== "menu" ? (
            <button
              onClick={() => setPanel("menu")}
              style={{
                width: 36, height: 36, borderRadius: 8, border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent", color: "var(--color-text-secondary)",
                cursor: "pointer",
              }}
            >
              <ChevronLeft size={20} />
            </button>
          ) : (
            <div style={{ width: 12 }} />
          )}
          <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: "var(--color-text)" }}>
            {panelTitle}
          </span>
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: 8, border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "transparent", color: "var(--color-text-tertiary)",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          {panel === "menu" && (
            <div style={{ padding: "8px 0" }}>
              {MENU_ITEMS.map(({ id, icon: Icon, label, description }) => (
                <button
                  key={id}
                  onClick={() => setPanel(id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 14, width: "100%",
                    padding: "14px 20px", border: "none", background: "transparent",
                    cursor: "pointer", textAlign: "left",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-surface)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: "var(--color-bg-surface)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={18} color="var(--color-accent)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 2 }}>
                      {description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {panel === "sessions" && (
            <div style={{ height: "100%", overflow: "auto" }}>
              <SidebarHome />
            </div>
          )}
          {panel === "terminals" && (
            <div style={{ height: "100%", overflow: "auto" }}>
              <SidebarTerminals />
            </div>
          )}
          {panel === "projects" && (
            <div style={{ height: "100%", overflow: "auto" }}>
              <SidebarProjects />
            </div>
          )}
          {panel === "files" && (
            <div style={{ height: "100%", overflow: "auto" }}>
              {projectPath ? (
                <SidebarFiles projectPath={projectPath} />
              ) : (
                <div style={{ padding: 20, fontSize: 13, color: "var(--color-text-tertiary)" }}>
                  Open a session to browse project files.
                </div>
              )}
            </div>
          )}
          {panel === "settings" && (
            <div style={{ height: "100%", overflow: "auto" }}>
              <SidebarSettings />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
