import { ActivityBar } from "@/components/layout/ActivityBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { TabBar } from "@/components/layout/TabBar";
import { StatusBar } from "@/components/layout/StatusBar";
import { ReconnectionBanner } from "@/components/notifications/ReconnectionBanner";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { ChatView } from "@/components/chat/ChatView";
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
          {activeTab?.type === "terminal" && (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-secondary)" }}>
              Terminal — coming next
            </div>
          )}
          {activeTab?.type === "file" && (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-secondary)" }}>
              File viewer — coming next
            </div>
          )}
        </div>

        {activeTab?.type === "session" && <StatusBar />}
      </div>
    </div>
  );
}
