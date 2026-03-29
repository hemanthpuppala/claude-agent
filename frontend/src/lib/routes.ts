/**
 * Centralized route definitions — single source of truth.
 *
 * URL structure:
 *   /                                          → Dashboard
 *   /project/:projectName                      → Project overview (future)
 *   /project/:projectName/session/:sessionId   → Claude session
 *   /project/:projectName/terminal/:name       → Terminal
 *   /project/:projectName/file/*filePath       → File viewer
 */

// --- Route patterns (for react-router) ---
export const ROUTES = {
  DASHBOARD: "/",
  SESSION: "/project/:projectName/session/:sessionId",
  TERMINAL: "/project/:projectName/terminal/:termName",
  FILE: "/project/:projectName/file/*",
} as const;

// --- URL builders (for navigation) ---

export function dashboardUrl(): string {
  return "/";
}

export function sessionUrl(projectPath: string, sessionId: string): string {
  const name = projectPath.split("/").pop() || "project";
  return `/project/${encodeURIComponent(name)}/session/${sessionId}`;
}

export function terminalUrl(projectPath: string, termName: string): string {
  const name = projectPath.split("/").pop() || "project";
  return `/project/${encodeURIComponent(name)}/terminal/${encodeURIComponent(termName)}`;
}

export function fileUrl(projectPath: string, filePath: string): string {
  const name = projectPath.split("/").pop() || "project";
  return `/project/${encodeURIComponent(name)}/file/${filePath}`;
}

// --- Tab ID ↔ URL mapping ---

import type { Tab } from "./types";

export function tabToUrl(tab: Tab): string {
  switch (tab.type) {
    case "dashboard":
      return dashboardUrl();
    case "session":
      return sessionUrl(tab.project || "", tab.sessionId || "");
    case "terminal":
      return terminalUrl(tab.cwd || "", tab.label);
    case "file":
      return fileUrl(tab.projectPath || "", tab.filePath || "");
    default:
      return "/";
  }
}
