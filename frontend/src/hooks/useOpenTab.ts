/**
 * DRY hook for opening tabs with URL sync.
 * Every component that opens a tab should use this instead of
 * directly calling tabStore.openTab.
 */

import { useNavigate } from "react-router-dom";
import { useTabStore } from "@/stores/tabStore";
import { tabToUrl } from "@/lib/routes";
import { truncate, basename } from "@/lib/utils";
import type { Tab } from "@/lib/types";

export function useOpenTab() {
  const openTab = useTabStore((s) => s.openTab);
  const navigate = useNavigate();

  const open = (tab: Tab) => {
    openTab(tab);
    navigate(tabToUrl(tab));
  };

  // Convenience methods for common tab types

  const openSession = (sessionId: string, projectPath: string, prompt?: string) => {
    const project = basename(projectPath);
    open({
      id: `session-${sessionId}`,
      type: "session",
      label: `${project}: ${truncate(prompt || "New session", 30)}`,
      sessionId,
      project: projectPath,
    });
  };

  const openTerminal = (name: string, cwd: string) => {
    open({
      id: `terminal-${name}`,
      type: "terminal",
      label: name,
      cwd,
    });
  };

  const openFile = (projectPath: string, filePath: string, fileName: string) => {
    open({
      id: `file-${projectPath}-${filePath}`,
      type: "file",
      label: fileName,
      projectPath,
      filePath,
    });
  };

  const openDashboard = () => {
    open({
      id: "dashboard",
      type: "dashboard",
      label: "Dashboard",
      pinned: true,
    });
  };

  return { open, openSession, openTerminal, openFile, openDashboard };
}
