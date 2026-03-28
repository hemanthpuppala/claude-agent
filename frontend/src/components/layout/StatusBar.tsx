import { useTabStore } from "@/stores/tabStore";
import { useSessionStore } from "@/stores/sessionStore";
import { formatCost } from "@/lib/utils";
import { useMobile } from "@/hooks/useMobile";

export function StatusBar() {
  const { isMobile } = useMobile();
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const sessionId = activeTab?.sessionId || null;
  const session = useSessionStore((s) => sessionId ? s.getSession(sessionId) : undefined);

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

  return (
    <div style={{
      height: 32, display: "flex", alignItems: "center", gap: 16,
      padding: "0 16px", fontSize: 12, fontFamily: "var(--font-mono)",
      borderTop: "1px solid var(--color-border-subtle)",
      background: "var(--color-bg)",
    }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          className={session.status === "thinking" ? "animate-pulse-dot" : ""}
          style={{ width: 7, height: 7, borderRadius: 99, background: dotColor }}
        />
        <span style={{ color: "var(--color-text-secondary)" }}>{statusLabel}</span>
      </span>

      <span style={{ color: "var(--color-success)" }}>{formatCost(session.totalCost)}</span>

      {!isMobile && (
        <span style={{ color: "var(--color-text-tertiary)" }}>
          {session.config.model
            ? session.config.model.replace("claude-", "").replace(/-/g, " ")
            : "opus 4.6"}
        </span>
      )}

      {!isMobile && (
        <span style={{ color: "var(--color-text-tertiary)" }}>
          {session.cwd.split("/").pop()}
        </span>
      )}

      <span style={{ color: "var(--color-text-tertiary)" }}>
        {session.totalTurns} turns
      </span>
    </div>
  );
}
