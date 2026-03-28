import { ActivityBar } from "@/components/layout/ActivityBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { TabBar } from "@/components/layout/TabBar";
import { StatusBar } from "@/components/layout/StatusBar";
import { ReconnectionBanner } from "@/components/notifications/ReconnectionBanner";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { ChatView } from "@/components/chat/ChatView";
import { TerminalView } from "@/components/terminal/TerminalView";
import { FileViewer } from "@/components/fileviewer/FileViewer";
import { useTabStore } from "@/stores/tabStore";
import { useUIStore } from "@/stores/uiStore";

export function App() {
  const activeTabId = useTabStore((s) => s.activeTabId);
  const tabs = useTabStore((s) => s.tabs);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const reconnecting = useUIStore((s) => s.reconnecting);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div style={{ display: "flex", height: "100dvh", width: "100%", overflow: "hidden", background: "var(--color-bg)" }}>
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
            <TerminalView cwd={activeTab.cwd} />
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
