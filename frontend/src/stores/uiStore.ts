import { create } from "zustand";

type SidebarPanel = "sessions" | "terminals" | "projects" | "files" | "git" | "settings";

interface UIStore {
  sidebarOpen: boolean;
  sidebarPanel: SidebarPanel;
  configOpen: boolean;
  reconnecting: boolean;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarPanel: (panel: SidebarPanel) => void;
  setConfigOpen: (open: boolean) => void;
  setReconnecting: (val: boolean) => void;
}

export const useUIStore = create<UIStore>()((set, get) => ({
  sidebarOpen: true,
  sidebarPanel: "sessions",
  configOpen: false,
  reconnecting: false,

  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarPanel: (panel) => {
    const { sidebarPanel, sidebarOpen } = get();
    if (sidebarPanel === panel && sidebarOpen) {
      set({ sidebarOpen: false });
    } else {
      set({ sidebarPanel: panel, sidebarOpen: true });
    }
  },
  setConfigOpen: (open) => set({ configOpen: open }),
  setReconnecting: (val) => set({ reconnecting: val }),
}));
