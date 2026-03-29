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
    <div style={{
      height: 36, flexShrink: 0,
      display: "flex", alignItems: "stretch",
      overflow: "hidden",
      background: "#1a1918",
    }}>
      <div style={{
        display: "flex", alignItems: "stretch",
        overflowX: "auto", flex: 1,
        scrollbarWidth: "none",
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
      </div>

      <button
        title="New tab"
        style={{
          width: 36, height: 36, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "none", background: "transparent",
          color: "var(--color-text-tertiary)", cursor: "pointer",
          borderLeft: "1px solid rgba(255,255,255,0.04)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-text-secondary)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-tertiary)"; }}
      >
        <Plus size={13} />
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
      className="group"
      style={{
        height: "100%",
        display: "flex", alignItems: "center", gap: 6,
        padding: "0 14px",
        whiteSpace: "nowrap", flexShrink: 0,
        border: "none", cursor: "pointer",
        fontSize: 12, fontWeight: active ? 500 : 400,
        position: "relative",
        transition: "background 0.1s, color 0.1s",
        background: active ? "var(--color-bg)" : "transparent",
        color: active ? "var(--color-text)" : "var(--color-text-tertiary)",
        borderRight: "1px solid rgba(255,255,255,0.03)",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "rgba(255,255,255,0.03)";
          e.currentTarget.style.color = "var(--color-text-secondary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--color-text-tertiary)";
        }
      }}
    >
      {/* Active indicator — thin line at top */}
      {active && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "var(--color-accent)",
        }} />
      )}

      <Icon size={13} style={{ flexShrink: 0, opacity: active ? 0.9 : 0.5 }} />
      <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
        {tab.label}
      </span>

      {!tab.pinned && (
        <span
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{
            width: 18, height: 18, borderRadius: 4, marginLeft: 2,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--color-text-tertiary)", flexShrink: 0,
            opacity: 0, transition: "opacity 0.1s, background 0.1s",
          }}
          className="tab-close-btn"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            e.currentTarget.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <X size={11} />
        </span>
      )}

      <style>{`
        button:hover .tab-close-btn { opacity: 0.6 !important; }
      `}</style>
    </button>
  );
}
