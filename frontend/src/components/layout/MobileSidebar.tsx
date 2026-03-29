import { useState } from "react";
import { Zap, Terminal, FolderOpen, Settings, ChevronLeft, ChevronRight, X, Files } from "lucide-react";
import { SidebarHome } from "./SidebarHome";
import { SidebarTerminals } from "./SidebarTerminals";
import { SidebarProjects } from "./SidebarProjects";
import { SidebarFiles } from "./SidebarFiles";
import { SidebarSettings } from "./SidebarSettings";
import { useTabStore } from "@/stores/tabStore";

type Panel = "menu" | "sessions" | "terminals" | "projects" | "files" | "settings";

const MENU_ITEMS: { id: Panel; icon: typeof Zap; label: string; description: string; color: string }[] = [
  { id: "sessions", icon: Zap, label: "Claude Sessions", description: "Active and recent sessions", color: "var(--color-accent)" },
  { id: "terminals", icon: Terminal, label: "Terminals", description: "tmux terminal sessions", color: "var(--color-tool-execute)" },
  { id: "projects", icon: FolderOpen, label: "Projects", description: "Discover and manage projects", color: "var(--color-tool-read)" },
  { id: "files", icon: Files, label: "Workspace Files", description: "Browse current project files", color: "var(--color-tool-write)" },
  { id: "settings", icon: Settings, label: "Settings", description: "Permissions, model, notifications", color: "var(--color-text-secondary)" },
];

export function MobileSidebar({ onClose }: { onClose: () => void }) {
  const [panel, setPanel] = useState<Panel>("menu");
  const [slideDir, setSlideDir] = useState<"in" | "out">("in");
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const projectPath = activeTab?.project || activeTab?.cwd || activeTab?.projectPath || "";

  const panelTitle = MENU_ITEMS.find(m => m.id === panel)?.label || "Menu";

  const goToPanel = (p: Panel) => {
    setSlideDir("in");
    setPanel(p);
  };

  const goBack = () => {
    setSlideDir("out");
    setPanel("menu");
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 300,
          background: "rgba(0,0,0,0.6)",
          animation: "fadeIn 0.2s ease-out",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      />

      {/* Sidebar */}
      <div style={{
        position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 301,
        width: "100vw", maxWidth: 340,
        background: "var(--color-bg-elevated)",
        boxShadow: "8px 0 40px rgba(0,0,0,0.6)",
        animation: "slideInLeft 0.25s cubic-bezier(0.22, 1, 0.36, 1)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "0 8px 0 4px", height: 52, flexShrink: 0,
          borderBottom: "1px solid var(--color-border-subtle)",
        }}>
          {panel !== "menu" ? (
            <button
              onClick={goBack}
              style={{
                width: 40, height: 40, borderRadius: 8, border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent", color: "var(--color-text-secondary)",
                cursor: "pointer", transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-surface)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <ChevronLeft size={20} />
            </button>
          ) : (
            <div style={{ width: 16 }} />
          )}
          <span style={{
            flex: 1, fontSize: 16, fontWeight: 700, color: "var(--color-text)",
            animation: panel === "menu" ? "none" : "fadeSlideIn 0.2s ease-out",
          }}>
            {panel === "menu" ? "Claude Code Web" : panelTitle}
          </span>
          <button
            onClick={onClose}
            style={{
              width: 40, height: 40, borderRadius: 8, border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "transparent", color: "var(--color-text-tertiary)",
              cursor: "pointer", transition: "background 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-surface)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1, overflow: "hidden",
          animation: slideDir === "in" ? "panelSlideIn 0.2s ease-out" : "panelSlideOut 0.15s ease-in",
        }} key={panel}>
          {panel === "menu" && (
            <div style={{ padding: "12px 8px" }}>
              {MENU_ITEMS.map(({ id, icon: Icon, label, description, color }, i) => (
                <button
                  key={id}
                  onClick={() => goToPanel(id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 14, width: "100%",
                    padding: "14px 12px", borderRadius: 12, border: "none",
                    background: "transparent", cursor: "pointer", textAlign: "left",
                    transition: "background 0.15s ease",
                    animation: `menuItemIn 0.25s ease-out ${i * 0.04}s both`,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-surface)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{
                    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                    background: "var(--color-bg-surface)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.15s",
                  }}>
                    <Icon size={20} color={color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)" }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 2 }}>
                      {description}
                    </div>
                  </div>
                  <ChevronRight size={16} color="var(--color-text-tertiary)" style={{ flexShrink: 0 }} />
                </button>
              ))}
            </div>
          )}

          {panel === "sessions" && <div style={{ height: "100%", overflow: "auto" }}><SidebarHome /></div>}
          {panel === "terminals" && <div style={{ height: "100%", overflow: "auto" }}><SidebarTerminals /></div>}
          {panel === "projects" && <div style={{ height: "100%", overflow: "auto" }}><SidebarProjects /></div>}
          {panel === "files" && (
            <div style={{ height: "100%", overflow: "auto" }}>
              {projectPath
                ? <SidebarFiles projectPath={projectPath} />
                : <div style={{ padding: 24, fontSize: 13, color: "var(--color-text-tertiary)", textAlign: "center" }}>
                    Open a session to browse project files.
                  </div>
              }
            </div>
          )}
          {panel === "settings" && <div style={{ height: "100%", overflow: "auto" }}><SidebarSettings /></div>}
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateX(8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes panelSlideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes panelSlideOut {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(-20px); }
        }
        @keyframes menuItemIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
