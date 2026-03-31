import { useRef, useEffect, useState } from "react";
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
  const closeOtherTabs = useTabStore((s) => s.closeOtherTabs);
  const closeAllTabs = useTabStore((s) => s.closeAllTabs);
  const { isMobile } = useMobile();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll active tab into view
  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current.querySelector('[data-active="true"]') as HTMLElement;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeTabId]);

  return (
    <div style={{
      height: isMobile ? 38 : 36, flexShrink: 0,
      display: "flex", alignItems: "stretch",
      background: "var(--color-bg-bar)",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div
        ref={scrollRef}
        className="hide-scrollbar"
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
            onCloseOthers={() => closeOtherTabs(tab.id)}
            onCloseAll={closeAllTabs}
          />
        ))}
      </div>

      <button
        title="New tab"
        style={{
          width: isMobile ? 44 : 36, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "none", background: "transparent",
          color: "var(--color-text-tertiary)", cursor: "pointer",
          borderLeft: "1px solid rgba(255,255,255,0.04)",
          transition: "color 0.15s, background 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-text-secondary)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-tertiary)"; e.currentTarget.style.background = "transparent"; }}
      >
        <Plus size={14} />
      </button>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

function TabItem({ tab, active, isMobile, onActivate, onClose, onCloseOthers, onCloseAll }: {
  tab: Tab; active: boolean; isMobile: boolean;
  onActivate: () => void; onClose: () => void;
  onCloseOthers: () => void; onCloseAll: () => void;
}) {
  const Icon = TAB_ICONS[tab.type] || FileText;
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setContextMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // On mobile: long press for context menu
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      setContextMenu({ x: 100, y: 60 }); // Fixed position for mobile
    }, 500);
  };
  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  // Show close button: always on active tab, always on mobile, hover on desktop inactive
  const showClose = !tab.pinned;

  return (
    <>
      <div
        data-active={active}
        onClick={onActivate}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={(e) => {
          if (e.button === 1 && !tab.pinned) { e.preventDefault(); onClose(); }
        }}
        className="tab-item"
        style={{
          height: "100%",
          display: "flex", alignItems: "center", gap: isMobile ? 4 : 6,
          padding: isMobile ? "0 6px 0 10px" : "0 4px 0 14px",
          whiteSpace: "nowrap", flexShrink: 0,
          border: "none", cursor: "pointer",
          fontSize: isMobile ? 11 : 12,
          fontWeight: active ? 500 : 400,
          position: "relative",
          transition: "background 0.12s ease, color 0.12s ease",
          background: active ? "var(--color-bg)" : "transparent",
          color: active ? "var(--color-text)" : "var(--color-text-tertiary)",
          userSelect: "none",
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
            position: "absolute", top: 0, left: 0, right: 0, height: 2,
            background: "var(--color-accent)",
            animation: "tabLineIn 0.2s ease-out",
          }} />
        )}

        {/* Separator line between inactive tabs */}
        {!active && (
          <div style={{
            position: "absolute", right: 0, top: 6, bottom: 6,
            width: 1, background: "rgba(255,255,255,0.06)",
          }} />
        )}

        <Icon size={isMobile ? 12 : 13} style={{
          flexShrink: 0,
          opacity: active ? 1 : 0.45,
          transition: "opacity 0.15s ease",
        }} />

        <span style={{
          maxWidth: isMobile ? 90 : 140,
          overflow: "hidden", textOverflow: "ellipsis",
          flex: 1,
        }}>
          {tab.label}
        </span>

        {/* Close button */}
        {showClose && (
          <div
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="tab-close"
            style={{
              width: isMobile ? 24 : 20, height: isMobile ? 24 : 20,
              borderRadius: 4,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              transition: "opacity 0.12s ease, background 0.12s ease",
              opacity: active || isMobile ? 0.6 : 0,
              color: "var(--color-text-tertiary)",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.1)";
              e.currentTarget.style.opacity = "1";
              e.currentTarget.style.color = "var(--color-text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.opacity = active || isMobile ? "0.6" : "0";
              e.currentTarget.style.color = "var(--color-text-tertiary)";
            }}
          >
            <X size={isMobile ? 12 : 11} />
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            left: isMobile ? 16 : contextMenu.x,
            top: isMobile ? 60 : contextMenu.y,
            width: isMobile ? "calc(100vw - 32px)" : 200,
            zIndex: 500,
            background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            padding: 4,
            animation: "fadeIn 0.1s ease-out",
          }}
        >
          {!tab.pinned && (
            <ContextItem label="Close" shortcut={isMobile ? "" : "⌘W"} onClick={() => { setContextMenu(null); onClose(); }} />
          )}
          <ContextItem label="Close Others" onClick={() => { setContextMenu(null); onCloseOthers(); }} />
          <ContextItem label="Close All" onClick={() => { setContextMenu(null); onCloseAll(); }} />
          <div style={{ height: 1, margin: "4px 0", background: "var(--color-border-subtle)" }} />
          <ContextItem label="Copy Path" onClick={() => {
            setContextMenu(null);
            const path = tab.project || tab.cwd || tab.filePath || "";
            if (path) navigator.clipboard.writeText(path);
          }} />
        </div>
      )}

      <style>{`
        .tab-item:hover .tab-close { opacity: 0.5 !important; }
        @keyframes tabLineIn {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>
    </>
  );
}

function ContextItem({ label, shortcut, onClick }: { label: string; shortcut?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        width: "100%", padding: "8px 12px", borderRadius: 6,
        border: "none", background: "transparent",
        fontSize: 13, color: "var(--color-text)", cursor: "pointer",
        transition: "background 0.1s",
        minHeight: 36,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-surface)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {label}
      {shortcut && <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", fontFamily: "var(--font-mono)" }}>{shortcut}</span>}
    </button>
  );
}
