import { useState, useRef, useEffect } from "react";
import { Shield, ShieldCheck, ShieldOff, ShieldAlert, ChevronUp } from "lucide-react";
import { useTabStore } from "@/stores/tabStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useClaudeWebSocket } from "@/hooks/useWebSocket";
import { formatCost } from "@/lib/utils";
import { useMobile } from "@/hooks/useMobile";

const PERMISSION_MODES = [
  {
    value: "acceptEdits",
    label: "Accept Edits",
    short: "accept edits",
    icon: ShieldCheck,
    color: "var(--color-success)",
    description: "Auto-approve file edits, ask for Bash commands",
  },
  {
    value: "default",
    label: "Ask Everything",
    short: "ask all",
    icon: Shield,
    color: "var(--color-info)",
    description: "Ask permission for every tool use",
  },
  {
    value: "bypassPermissions",
    label: "Allow Everything",
    short: "bypass",
    icon: ShieldOff,
    color: "var(--color-destructive)",
    description: "Auto-approve everything (use with caution)",
    critical: true,
  },
  {
    value: "plan",
    label: "Plan Only",
    short: "plan only",
    icon: ShieldAlert,
    color: "var(--color-warning)",
    description: "No tool execution — planning mode only",
  },
] as const;

export function StatusBar() {
  const { isMobile } = useMobile();
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const sessionId = activeTab?.sessionId || null;
  const session = useSessionStore((s) => sessionId ? s.getSession(sessionId) : undefined);
  const { sendConfig } = useClaudeWebSocket(sessionId);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  if (!session) {
    return (
      <div style={{
        height: 32, display: "flex", alignItems: "center",
        padding: "0 16px", fontSize: 12, fontFamily: "var(--font-mono)",
        color: "var(--color-text-tertiary)",
        borderTop: "1px solid var(--color-border-subtle)",
        background: "var(--color-bg)",
      }}>
        No session connected
      </div>
    );
  }

  const currentMode = PERMISSION_MODES.find((m) => m.value === session.config.permission_mode) || PERMISSION_MODES[0];
  const ModeIcon = currentMode.icon;

  const dotColor =
    session.status === "thinking" ? "var(--color-info)" :
    session.status === "waiting_permission" ? "var(--color-warning)" :
    session.status === "error" ? "var(--color-destructive)" :
    "var(--color-success)";

  const statusLabel =
    session.status === "thinking" ? "Thinking..." :
    session.status === "waiting_permission" ? "Needs approval" :
    session.status === "error" ? "Error" :
    "Ready";

  const handleModeChange = (mode: string) => {
    sendConfig({ permission_mode: mode });
    // Also update locally for immediate feedback
    const store = useSessionStore.getState();
    if (sessionId) {
      store.setConfig(sessionId, { ...session.config, permission_mode: mode });
    }
    setMenuOpen(false);
  };

  return (
    <div style={{
      height: 36, display: "flex", alignItems: "center", gap: 12,
      padding: "0 12px", fontSize: 12, fontFamily: "var(--font-mono)",
      borderTop: "1px solid var(--color-border-subtle)",
      background: "#1a1918",
      position: "relative",
    }}>
      {/* Status dot + label */}
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          className={session.status === "thinking" ? "animate-pulse-dot" : ""}
          style={{ width: 7, height: 7, borderRadius: 99, background: dotColor }}
        />
        <span style={{ color: "var(--color-text-secondary)" }}>{statusLabel}</span>
      </span>

      {/* Cost */}
      <span style={{ color: "var(--color-success)" }}>{formatCost(session.totalCost)}</span>

      {/* Model */}
      {!isMobile && (
        <span style={{ color: "var(--color-text-tertiary)" }}>
          {session.config.model
            ? session.config.model.replace("claude-", "").replace(/-/g, " ")
            : "opus 4.6"}
        </span>
      )}

      {/* Project */}
      {!isMobile && (
        <span style={{ color: "var(--color-text-tertiary)" }}>
          {session.cwd.split("/").pop()}
        </span>
      )}

      {/* Turns */}
      <span style={{ color: "var(--color-text-tertiary)" }}>
        {session.totalTurns} turns
      </span>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Permission mode toggle */}
      <div ref={menuRef} style={{ position: "relative" }}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 10px", borderRadius: 6, border: "none",
            background: menuOpen ? "var(--color-bg-surface)" : "transparent",
            cursor: "pointer", transition: "all 0.15s",
            color: currentMode.color,
            fontSize: 11, fontWeight: 600,
          }}
          onMouseEnter={(e) => { if (!menuOpen) e.currentTarget.style.background = "var(--color-bg-elevated)"; }}
          onMouseLeave={(e) => { if (!menuOpen) e.currentTarget.style.background = "transparent"; }}
        >
          <ModeIcon size={13} />
          <span>{isMobile ? currentMode.short : currentMode.label.toLowerCase()}</span>
          <ChevronUp size={10} style={{
            transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
          }} />
        </button>

        {/* Mode selector popover */}
        {menuOpen && (
          <div style={{
            position: "absolute", bottom: "calc(100% + 8px)", right: 0,
            width: isMobile ? "calc(100vw - 24px)" : 280, maxWidth: 320,
            background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border)",
            borderRadius: 10,
            boxShadow: "0 -4px 24px rgba(0,0,0,0.4)",
            padding: 6, zIndex: 100,
          }}>
            <div style={{
              padding: "6px 10px 8px", fontSize: 10, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.08em",
              color: "var(--color-text-tertiary)",
            }}>
              Permission Mode
            </div>

            {PERMISSION_MODES.map((mode) => {
              const Icon = mode.icon;
              const isActive = mode.value === session.config.permission_mode;
              return (
                <button
                  key={mode.value}
                  onClick={() => handleModeChange(mode.value)}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    width: "100%", padding: "10px 12px", borderRadius: 8,
                    border: "none", cursor: "pointer", textAlign: "left",
                    background: isActive ? "rgba(212,132,90,0.06)" : "transparent",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--color-bg-surface)"; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = isActive ? "rgba(212,132,90,0.06)" : "transparent"; }}
                >
                  <Icon size={16} color={mode.color} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{
                      fontSize: 13, fontWeight: 600,
                      color: isActive ? "var(--color-text)" : "var(--color-text-secondary)",
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      {mode.label}
                      {"critical" in mode && mode.critical && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: "1px 5px",
                          borderRadius: 4, background: "rgba(239,68,68,0.15)",
                          color: "var(--color-destructive)", textTransform: "uppercase",
                        }}>
                          caution
                        </span>
                      )}
                      {isActive && (
                        <span style={{
                          width: 6, height: 6, borderRadius: 99,
                          background: "var(--color-accent)",
                        }} />
                      )}
                    </div>
                    <div style={{
                      fontSize: 11, color: "var(--color-text-tertiary)",
                      marginTop: 2, lineHeight: 1.4,
                    }}>
                      {mode.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
