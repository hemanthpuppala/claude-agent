import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Tab } from "@/lib/types";

const DASHBOARD_TAB: Tab = {
  id: "dashboard",
  type: "dashboard",
  label: "Dashboard",
  pinned: true,
};

interface TabStore {
  tabs: Tab[];
  activeTabId: string;

  openTab: (tab: Tab) => void;
  closeTab: (tabId: string) => void;
  setActive: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<Tab>) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
}

export const useTabStore = create<TabStore>()(
  persist(
    (set, get) => ({
      tabs: [DASHBOARD_TAB],
      activeTabId: "dashboard",

      openTab: (tab) => {
        const { tabs } = get();
        // If tab already exists, focus it
        const existing = tabs.find((t) => t.id === tab.id);
        if (existing) {
          set({ activeTabId: tab.id });
          return;
        }
        set({ tabs: [...tabs, tab], activeTabId: tab.id });
      },

      closeTab: (tabId) => {
        const { tabs, activeTabId } = get();
        const tab = tabs.find((t) => t.id === tabId);
        if (tab?.pinned) return;

        const idx = tabs.findIndex((t) => t.id === tabId);
        const next = tabs.filter((t) => t.id !== tabId);
        if (next.length === 0) {
          set({ tabs: [DASHBOARD_TAB], activeTabId: "dashboard" });
          return;
        }
        const newActive =
          activeTabId === tabId
            ? next[Math.min(idx, next.length - 1)].id
            : activeTabId;
        set({ tabs: next, activeTabId: newActive });
      },

      setActive: (tabId) => set({ activeTabId: tabId }),

      updateTab: (tabId, updates) => {
        set({
          tabs: get().tabs.map((t) => (t.id === tabId ? { ...t, ...updates } : t)),
        });
      },

      reorderTabs: (fromIndex, toIndex) => {
        const tabs = [...get().tabs];
        const [moved] = tabs.splice(fromIndex, 1);
        tabs.splice(toIndex, 0, moved);
        set({ tabs });
      },

      closeOtherTabs: (tabId) => {
        set({
          tabs: get().tabs.filter((t) => t.id === tabId || t.pinned),
          activeTabId: tabId,
        });
      },

      closeAllTabs: () => {
        set({ tabs: [DASHBOARD_TAB], activeTabId: "dashboard" });
      },
    }),
    {
      name: "claude-code-web-tabs",
    },
  ),
);
