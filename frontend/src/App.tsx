import { useState } from "react";
import { ActivityBar } from "@/components/layout/ActivityBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { TabBar } from "@/components/layout/TabBar";
import { StatusBar } from "@/components/layout/StatusBar";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { ReconnectionBanner } from "@/components/notifications/ReconnectionBanner";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { ChatView } from "@/components/chat/ChatView";
import { TerminalView } from "@/components/terminal/TerminalView";
import { FileViewer } from "@/components/fileviewer/FileViewer";
import { SidebarFiles } from "@/components/layout/SidebarFiles";
import { useTabStore } from "@/stores/tabStore";
import { useUIStore } from "@/stores/uiStore";
import { useIsMobile } from "@/hooks/useMediaQuery";

export function App() {
  const activeTabId = useTabStore((s) => s.activeTabId);
  const tabs = useTabStore((s) => s.tabs);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const reconnecting = useUIStore((s) => s.reconnecting);
  const isMobile = useIsMobile();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileConfigOpen, setMobileConfigOpen] = useState(false);
  const [mobileFilesOpen, setMobileFilesOpen] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const projectPath = activeTab?.project || activeTab?.cwd || activeTab?.projectPath || "";

  // ===== MOBILE LAYOUT =====
  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden", background: "var(--color-bg)", position: "fixed", inset: 0 }}>
        {reconnecting && <ReconnectionBanner />}

        {/* Mobile Header */}
        <MobileHeader
          onMenuClick={() => setMobileMenuOpen(true)}
          onConfigClick={() => setMobileConfigOpen(true)}
          onFilesClick={() => setMobileFilesOpen(true)}
        />

        {/* Tab Bar (compact, scrollable) */}
        <TabBar />

        {/* Content */}
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          {activeTab?.type === "dashboard" && <DashboardView />}
          {activeTab?.type === "session" && (
            <ChatView sessionId={activeTab.sessionId} cwd={activeTab.project} />
          )}
          {activeTab?.type === "terminal" && activeTab.cwd && (
            <TerminalView cwd={activeTab.cwd} name={activeTab.label} />
          )}
          {activeTab?.type === "file" && activeTab.projectPath && activeTab.filePath && (
            <FileViewer projectPath={activeTab.projectPath} filePath={activeTab.filePath} />
          )}
        </div>

        {/* Status Bar (session tabs only) */}
        {activeTab?.type === "session" && <StatusBar />}

        {/* Bottom Nav */}
        <MobileNav />

        {/* Sidebar as slide-over */}
        {mobileMenuOpen && (
          <>
            <div
              onClick={() => setMobileMenuOpen(false)}
              style={{
                position: "fixed", inset: 0, zIndex: 300,
                background: "rgba(0,0,0,0.5)",
                animation: "fadeIn 0.2s ease-out",
              }}
            />
            <div style={{
              position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 301,
              width: "min(85vw, 320px)",
              background: "var(--color-bg-elevated)",
              borderRight: "1px solid var(--color-border)",
              boxShadow: "8px 0 32px rgba(0,0,0,0.4)",
              animation: "slideInLeft 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
              overflowY: "auto",
            }}>
              <Sidebar />
            </div>
          </>
        )}

        {/* Files bottom sheet */}
        <BottomSheet
          open={mobileFilesOpen}
          onClose={() => setMobileFilesOpen(false)}
          title="Files"
        >
          {projectPath ? (
            <SidebarFiles projectPath={projectPath} />
          ) : (
            <div style={{ padding: 20, fontSize: 13, color: "var(--color-text-tertiary)" }}>
              Open a session to browse project files.
            </div>
          )}
        </BottomSheet>

        {/* Config bottom sheet */}
        <BottomSheet
          open={mobileConfigOpen}
          onClose={() => setMobileConfigOpen(false)}
          title="Session Config"
        >
          <div style={{ padding: 16, fontSize: 13, color: "var(--color-text-tertiary)" }}>
            Use the config popover in the status bar to change session settings.
          </div>
        </BottomSheet>
      </div>
    );
  }

  // ===== DESKTOP LAYOUT =====
  return (
    <div style={{ display: "flex", height: "100%", width: "100%", overflow: "hidden", background: "var(--color-bg)", position: "fixed", inset: 0 }}>
      <ActivityBar />
      {sidebarOpen && <Sidebar />}

      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        {reconnecting && <ReconnectionBanner />}
        <TabBar />

        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          {activeTab?.type === "dashboard" && <DashboardView />}
          {activeTab?.type === "session" && (
            <ChatView sessionId={activeTab.sessionId} cwd={activeTab.project} />
          )}
          {activeTab?.type === "terminal" && activeTab.cwd && (
            <TerminalView cwd={activeTab.cwd} name={activeTab.label} />
          )}
          {activeTab?.type === "file" && activeTab.projectPath && activeTab.filePath && (
            <FileViewer projectPath={activeTab.projectPath} filePath={activeTab.filePath} />
          )}
        </div>

        {activeTab?.type === "session" && <StatusBar />}
      </div>
    </div>
  );
}
