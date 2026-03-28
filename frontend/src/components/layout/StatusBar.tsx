import { useTabStore } from "@/stores/tabStore";
import { useSessionStore } from "@/stores/sessionStore";
import { formatCost } from "@/lib/utils";

export function StatusBar() {
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const session = useSessionStore((s) =>
    activeTab?.sessionId ? s.getSession(activeTab.sessionId) : undefined,
  );

  if (!session) {
    return (
      <div className="h-8 flex items-center px-4 text-[12px] font-mono text-[var(--color-text-tertiary)] border-t border-[var(--color-border-subtle)]">
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
    <div className="h-8 flex items-center gap-4 px-4 text-[12px] font-mono border-t border-[var(--color-border-subtle)] bg-[var(--color-bg)]">
      <span className="flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rounded-full ${session.status === "thinking" ? "animate-pulse-dot" : ""}`}
          style={{ backgroundColor: dotColor }}
        />
        <span className="text-[var(--color-text-secondary)]">{statusLabel}</span>
      </span>

      <span className="text-[var(--color-success)]">
        {formatCost(session.totalCost)}
      </span>

      {session.config.model && (
        <span className="text-[var(--color-text-tertiary)]">
          {session.config.model.replace("claude-", "").replace(/-/g, " ")}
        </span>
      )}

      <span className="text-[var(--color-text-tertiary)]">
        {session.cwd.split("/").pop()}
      </span>

      <span className="text-[var(--color-text-tertiary)]">
        {session.totalTurns} turns
      </span>
    </div>
  );
}
