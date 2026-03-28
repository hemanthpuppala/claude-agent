import { useEffect, useState } from "react";
import { Plus, Zap } from "lucide-react";
import { sessions as sessionsApi } from "@/lib/api";
import { useTabStore } from "@/stores/tabStore";
import { formatTimeAgo, formatCost, truncate } from "@/lib/utils";
import type { Session } from "@/lib/types";

export function SidebarHome() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const openTab = useTabStore((s) => s.openTab);

  useEffect(() => {
    const load = () => sessionsApi.list().then((d) => setSessions(d as unknown as Session[]));
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const active = sessions.filter((s) => ["thinking", "waiting_permission"].includes(s.status));
  const recent = sessions.filter((s) => !["thinking", "waiting_permission"].includes(s.status));

  const openSession = (s: Session) => {
    openTab({
      id: `session-${s.id}`,
      type: "session",
      label: `${s.name || s.cwd.split("/").pop()}: ${truncate(s.last_prompt || "Session", 30)}`,
      sessionId: s.id,
      project: s.cwd,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px", height: 44, flexShrink: 0,
        borderBottom: "1px solid var(--color-border-subtle)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Zap size={13} color="var(--color-accent)" />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)" }}>
            Sessions
          </span>
        </div>
        <button
          title="New session"
          style={{
            width: 26, height: 26, borderRadius: 6, border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", background: "transparent", color: "var(--color-text-tertiary)",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--color-bg-surface)";
            e.currentTarget.style.color = "var(--color-text)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--color-text-tertiary)";
          }}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px" }}>
        {active.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{
              padding: "6px 10px", fontSize: 10, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.08em",
              color: "var(--color-text-tertiary)",
            }}>
              Active
            </div>
            {active.map((s) => (
              <SidebarSession key={s.id} session={s} onClick={() => openSession(s)} />
            ))}
          </div>
        )}

        {recent.length > 0 && (
          <div>
            <div style={{
              padding: "6px 10px", fontSize: 10, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.08em",
              color: "var(--color-text-tertiary)",
            }}>
              Recent
            </div>
            {recent.map((s) => (
              <SidebarSession key={s.id} session={s} onClick={() => openSession(s)} />
            ))}
          </div>
        )}

        {sessions.length === 0 && (
          <div style={{ padding: "40px 16px", textAlign: "center" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, margin: "0 auto 12px",
              background: "var(--color-bg-surface)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Zap size={16} color="var(--color-text-tertiary)" />
            </div>
            <p style={{ fontSize: 12, color: "var(--color-text-tertiary)", lineHeight: 1.5 }}>
              No sessions yet.<br />Create one from the Dashboard.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarSession({ session: s, onClick }: { session: Session; onClick: () => void }) {
  const isActive = ["thinking", "waiting_permission"].includes(s.status);
  const dotColor =
    s.status === "thinking" ? "var(--color-info)" :
    s.status === "waiting_permission" ? "var(--color-warning)" :
    s.status === "error" ? "var(--color-destructive)" :
    s.status === "idle" ? "var(--color-success)" :
    "var(--color-text-tertiary)";

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left", cursor: "pointer",
        padding: "10px 12px", borderRadius: 8, marginBottom: 2,
        border: "none", background: "transparent",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-surface)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {/* Name row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          className={isActive ? "animate-pulse-dot" : ""}
          style={{
            width: 7, height: 7, borderRadius: 99, flexShrink: 0,
            background: dotColor,
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {s.name || s.cwd.split("/").pop()}
        </span>
      </div>

      {/* Prompt preview */}
      {s.last_prompt && (
        <div style={{
          fontSize: 11, color: "var(--color-text-tertiary)",
          marginTop: 3, paddingLeft: 15,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {truncate(s.last_prompt, 35)}
        </div>
      )}

      {/* Meta */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        marginTop: 4, paddingLeft: 15,
        fontSize: 10, fontFamily: "var(--font-mono)",
        color: "var(--color-text-tertiary)",
      }}>
        <span style={{ color: "var(--color-success)" }}>{formatCost(s.total_cost_usd)}</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>{formatTimeAgo(s.updated_at)}</span>
      </div>
    </button>
  );
}
