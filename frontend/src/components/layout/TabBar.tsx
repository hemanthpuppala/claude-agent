import { useRef, useEffect } from "react";
import { Home, Zap, Terminal, FileText, X, Plus } from "lucide-react";
import { useTabStore } from "@/stores/tabStore";
import { useMobile } from "@/hooks/useMobile";
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
  const { isMobile } = useMobile();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll active tab into view
  useEffect(() => {
    if (!scrollRef.current) return;
    const activeEl = scrollRef.current.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeTabId]);

  return (
    <div style={{
      height: isMobile ? 38 : 36, flexShrink: 0,
      display: "flex", alignItems: "stretch",
      background: "#1a1918",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
    }}>
      {/* Scrollable tab container */}
      <div
        ref={scrollRef}
        className="tab-scroll-container"
        style={{
          display: "flex", alignItems: "stretch",
          flex: 1, minWidth: 0,
          overflowX: "auto", overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            active={tab.id === activeTabId}
            isMobile={isMobile}
            onActivate={() => setActive(tab.id)}
            onClose={() => closeTab(tab.id)}
          />
        ))}
      </div>

      {/* New tab button */}
      <button
        title="New tab"
        style={{
          width: isMobile ? 44 : 36, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "none", background: "transparent",
          color: "var(--color-text-tertiary)", cursor: "pointer",
          borderLeft: "1px solid rgba(255,255,255,0.04)",
          minHeight: 44,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-text-secondary)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-tertiary)"; }}
      >
        <Plus size={14} />
      </button>

      {/* Hide scrollbar CSS */}
      <style>{`
        .tab-scroll-container::-webkit-scrollbar { display: none; }
        .tab-scroll-container { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

function TabItem({ tab, active, isMobile, onActivate, onClose }: {
  tab: Tab; active: boolean; isMobile: boolean;
  onActivate: () => void; onClose: () => void;
}) {
  const Icon = TAB_ICONS[tab.type] || FileText;

  return (
    <button
      data-active={active}
      onClick={onActivate}
      onMouseDown={(e) => {
        if (e.button === 1 && !tab.pinned) { e.preventDefault(); onClose(); }
      }}
      style={{
        height: "100%",
        display: "flex", alignItems: "center", gap: isMobile ? 5 : 6,
        padding: isMobile ? "0 12px" : "0 14px",
        whiteSpace: "nowrap", flexShrink: 0,
        border: "none", cursor: "pointer",
        fontSize: isMobile ? 11 : 12,
        fontWeight: active ? 600 : 400,
        position: "relative",
        transition: "background 0.15s ease, color 0.15s ease",
        background: active ? "var(--color-bg)" : "transparent",
        color: active ? "var(--color-text)" : "var(--color-text-tertiary)",
        minWidth: isMobile ? 44 : "auto",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
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
      {/* Active indicator */}
      {active && (
        <div style={{
          position: "absolute", top: 0, left: 4, right: 4, height: 2,
          background: "var(--color-accent)",
          borderRadius: "0 0 2px 2px",
          animation: "tabIndicatorIn 0.2s ease-out",
        }} />
      )}

      <Icon size={isMobile ? 12 : 13} style={{
        flexShrink: 0,
        opacity: active ? 1 : 0.5,
        transition: "opacity 0.15s ease",
      }} />
      <span style={{
        maxWidth: isMobile ? 100 : 160,
        overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {tab.label}
      </span>

      {!tab.pinned && !isMobile && (
        <span
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="tab-close-btn"
          style={{
            width: 18, height: 18, borderRadius: 4, marginLeft: 2,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--color-text-tertiary)", flexShrink: 0,
            opacity: 0, transition: "opacity 0.15s ease, background 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.1)";
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
        button:hover .tab-close-btn { opacity: 0.5 !important; }
        @keyframes tabIndicatorIn {
          from { transform: scaleX(0); opacity: 0; }
          to { transform: scaleX(1); opacity: 1; }
        }
      `}</style>
    </button>
  );
}
