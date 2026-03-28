import { Home, Zap, Terminal, FileText, X, Plus } from "lucide-react";
import { useTabStore } from "@/stores/tabStore";
import type { Tab } from "@/lib/types";

const TAB_ICONS = {
  dashboard: Home,
  session: Zap,
  terminal: Terminal,
  file: FileText,
} as const;

export function TabBar() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const setActive = useTabStore((s) => s.setActive);
  const closeTab = useTabStore((s) => s.closeTab);

  return (
    <div className="h-9 flex-shrink-0 flex items-stretch overflow-x-auto"
         style={{
           background: "var(--color-bg)",
           borderBottom: "1px solid var(--color-border-subtle)",
         }}>
      {tabs.map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab}
          active={tab.id === activeTabId}
          onActivate={() => setActive(tab.id)}
          onClose={() => closeTab(tab.id)}
        />
      ))}

      <button
        title="New tab"
        className="w-9 flex items-center justify-center flex-shrink-0 transition-colors duration-150"
        style={{ color: "var(--color-text-tertiary)" }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-text-secondary)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-tertiary)"; }}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

function TabItem({
  tab,
  active,
  onActivate,
  onClose,
}: {
  tab: Tab;
  active: boolean;
  onActivate: () => void;
  onClose: () => void;
}) {
  const Icon = TAB_ICONS[tab.type] || FileText;

  return (
    <button
      onClick={onActivate}
      onMouseDown={(e) => {
        if (e.button === 1 && !tab.pinned) {
          e.preventDefault();
          onClose();
        }
      }}
      className="group h-full px-3 flex items-center gap-1.5 text-[12px] whitespace-nowrap flex-shrink-0 transition-colors duration-150 relative"
      style={{
        borderRight: "1px solid var(--color-border-subtle)",
        background: active ? "var(--color-bg-elevated)" : "transparent",
        color: active ? "var(--color-text)" : "var(--color-text-secondary)",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "var(--color-bg-surface)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      {/* Active indicator */}
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px]"
             style={{ background: "var(--color-accent)" }} />
      )}

      <Icon size={13} style={{ opacity: active ? 1 : 0.6 }} />
      <span className="max-w-[140px] truncate font-medium">{tab.label}</span>

      {!tab.pinned && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="ml-1 w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: "var(--color-text-tertiary)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-surface)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <X size={11} />
        </span>
      )}
    </button>
  );
}
