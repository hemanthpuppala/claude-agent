import { FolderOpen, ChevronRight } from "lucide-react";
import { useTabStore } from "@/stores/tabStore";
import { useUIStore } from "@/stores/uiStore";
import { colors, spacing } from "@/lib/styles";
import { useMobile } from "@/hooks/useMobile";
import { basename } from "@/lib/utils";

export function WorkspaceBar() {
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const setSidebarPanel = useUIStore((s) => s.setSidebarPanel);
  const { isMobile } = useMobile();

  const projectPath = activeTab?.project || activeTab?.cwd || activeTab?.projectPath || "";
  const projectName = projectPath ? basename(projectPath) : null;

  // Build breadcrumb parts
  const parts: { label: string; color: string }[] = [];
  if (projectName) {
    parts.push({ label: projectName, color: colors.accent });
  }
  if (activeTab?.type === "session" && activeTab.label) {
    const sessionLabel = activeTab.label.includes(": ")
      ? activeTab.label.split(": ").slice(1).join(": ")
      : activeTab.label;
    parts.push({ label: sessionLabel, color: colors.text });
  } else if (activeTab?.type === "terminal") {
    parts.push({ label: activeTab.label || "Terminal", color: colors.toolExecute });
  } else if (activeTab?.type === "file" && activeTab.filePath) {
    parts.push({ label: activeTab.filePath, color: colors.text });
  }

  if (parts.length === 0 || activeTab?.type === "dashboard") return null;

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 4,
        height: 28, flexShrink: 0,
        padding: `0 ${isMobile ? spacing.md : spacing.lg}px`,
        background: colors.bgElevated,
        borderBottom: `1px solid ${colors.borderSubtle}`,
        fontSize: 11, fontFamily: "var(--font-mono)",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setSidebarPanel("projects")}
        style={{
          display: "flex", alignItems: "center", gap: 4,
          border: "none", background: "transparent",
          cursor: "pointer", padding: "2px 6px", borderRadius: 4,
          color: parts[0]?.color || colors.textSecondary,
          fontWeight: 600, fontSize: 11, fontFamily: "var(--font-mono)",
          transition: "background 0.12s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = colors.bgSurface; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        <FolderOpen size={11} />
        {parts[0]?.label}
      </button>

      {parts.slice(1).map((part, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 4, color: colors.textTertiary }}>
          <ChevronRight size={10} />
          <span style={{
            color: part.color,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            maxWidth: isMobile ? 120 : 300,
          }}>
            {part.label}
          </span>
        </span>
      ))}
    </div>
  );
}
