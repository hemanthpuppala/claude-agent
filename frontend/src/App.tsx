import { ActivityBar } from "@/components/layout/ActivityBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { TabBar } from "@/components/layout/TabBar";
import { StatusBar } from "@/components/layout/StatusBar";
import { ReconnectionBanner } from "@/components/notifications/ReconnectionBanner";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { useTabStore } from "@/stores/tabStore";
import { useUIStore } from "@/stores/uiStore";

export function App() {
  const activeTabId = useTabStore((s) => s.activeTabId);
  const tabs = useTabStore((s) => s.tabs);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const reconnecting = useUIStore((s) => s.reconnecting);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[var(--color-bg)]">
      {/* Activity Bar */}
      <ActivityBar />

      {/* Sidebar Panel */}
      {sidebarOpen && <Sidebar />}

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Reconnection Banner */}
        {reconnecting && <ReconnectionBanner />}

        {/* Tab Bar */}
        <TabBar />

        {/* Tab Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab?.type === "dashboard" && <DashboardView />}
          {activeTab?.type === "session" && (
            <div className="flex items-center justify-center h-full text-[var(--color-text-secondary)]">
              Session view — coming next
            </div>
          )}
          {activeTab?.type === "terminal" && (
            <div className="flex items-center justify-center h-full text-[var(--color-text-secondary)]">
              Terminal view — coming next
            </div>
          )}
          {activeTab?.type === "file" && (
            <div className="flex items-center justify-center h-full text-[var(--color-text-secondary)]">
              File viewer — coming next
            </div>
          )}
        </div>

        {/* Status Bar (for session tabs) */}
        {activeTab?.type === "session" && <StatusBar />}
      </div>
    </div>
  );
}
