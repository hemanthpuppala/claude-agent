import { Menu, Settings, FolderTree } from "lucide-react";
import { useTabStore } from "@/stores/tabStore";

export function MobileHeader({ onMenuClick, onConfigClick, onFilesClick }: {
  onMenuClick: () => void;
  onConfigClick: () => void;
  onFilesClick: () => void;
}) {
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      height: 48, padding: "0 12px", flexShrink: 0,
      background: "var(--color-bg-elevated)",
      borderBottom: "1px solid var(--color-border-subtle)",
    }}>
      <button
        onClick={onMenuClick}
        style={{
          width: 36, height: 36, borderRadius: 8, border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "transparent", color: "var(--color-text-secondary)",
          cursor: "pointer",
        }}
      >
        <Menu size={20} />
      </button>

      <span style={{
        flex: 1, fontSize: 14, fontWeight: 600, color: "var(--color-text)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {activeTab?.label || "Claude Code Web"}
      </span>

      <button
        onClick={onConfigClick}
        style={{
          width: 36, height: 36, borderRadius: 8, border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "transparent", color: "var(--color-text-tertiary)",
          cursor: "pointer",
        }}
      >
        <Settings size={18} />
      </button>

      <button
        onClick={onFilesClick}
        style={{
          width: 36, height: 36, borderRadius: 8, border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "transparent", color: "var(--color-text-tertiary)",
          cursor: "pointer",
        }}
      >
        <FolderTree size={18} />
      </button>
    </div>
  );
}
