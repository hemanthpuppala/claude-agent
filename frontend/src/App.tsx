import { useState } from "react";
import { ActivityBar } from "@/components/layout/ActivityBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { TabBar } from "@/components/layout/TabBar";
import { StatusBar } from "@/components/layout/StatusBar";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { MobileSidebar } from "@/components/layout/MobileSidebar";
import { WorkspaceBar } from "@/components/layout/WorkspaceBar";
import { ReconnectionBanner } from "@/components/notifications/ReconnectionBanner";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { ChatView } from "@/components/chat/ChatView";
import { TerminalView } from "@/components/terminal/TerminalView";
import { FileViewer } from "@/components/fileviewer/FileViewer";
import { useTabStore } from "@/stores/tabStore";
import { useUIStore } from "@/stores/uiStore";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { useRouteSync } from "@/hooks/useRouteSync";

export function App() {
  useRouteSync();
  const activeTabId = useTabStore((s) => s.activeTabId);
  const tabs = useTabStore((s) => s.tabs);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const reconnecting = useUIStore((s) => s.reconnecting);
  const isMobile = useIsMobile();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // ===== MOBILE LAYOUT =====
  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden", background: "var(--color-bg)", position: "fixed", inset: 0 }}>
        {reconnecting && <ReconnectionBanner />}

        {/* Mobile Header */}
        <MobileHeader
          onMenuClick={() => setMobileSidebarOpen(true)}
          onConfigClick={() => setMobileSidebarOpen(true)}
          onFilesClick={() => setMobileSidebarOpen(true)}
        />

        {/* Tab Bar */}
        <TabBar />
        <WorkspaceBar />

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

        {/* Mobile Sidebar — full-width drawer with drill-down menu */}
        {mobileSidebarOpen && (
          <MobileSidebar onClose={() => setMobileSidebarOpen(false)} />
        )}
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
