import { useEffect, useState } from "react";
import { Plus, Zap, CheckCircle, XCircle, ArrowRight, FolderOpen } from "lucide-react";
import { sessions as sessionsApi, projects as projectsApi } from "@/lib/api";
import { useOpenTab } from "@/hooks/useOpenTab";
import { formatCost, formatTimeAgo, truncate } from "@/lib/utils";
import { PushOnboarding } from "@/components/notifications/PushOnboarding";
import { useMobile } from "@/hooks/useMobile";
import type { Session } from "@/lib/types";

export function DashboardView() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [discovered, setDiscovered] = useState<{ name: string; path: string }[]>([]);
  const { openSession: openSessionTab } = useOpenTab();

  useEffect(() => {
    const load = () => sessionsApi.list().then((d) => setSessions(d as unknown as Session[]));
    load();
    projectsApi.discover().then(setDiscovered);
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const { isMobile } = useMobile();
  const active = sessions.filter((s) => ["thinking", "waiting_permission"].includes(s.status));
  const recent = sessions.filter((s) => !["thinking", "waiting_permission"].includes(s.status));

  const openSession = (s: Session) => {
    openSessionTab(s.id, s.cwd, s.last_prompt || s.name || "Session");
  };

  const createSession = async (path: string) => {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd: path }),
      });
      const data = await res.json();
      openSessionTab(data.session_id, path, "New session");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "var(--color-bg)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: isMobile ? "24px 16px 32px" : "48px 32px 64px" }}>

        {/* Hero */}
        <div style={{ marginBottom: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: "var(--gradient-primary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 16px rgba(249,115,22,0.3)",
            }}>
              <Zap size={22} color="#fff" />
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--color-text)", letterSpacing: "-0.02em" }}>
              Claude Code Web
            </h1>
          </div>
          <p style={{ fontSize: 15, color: "var(--color-text-secondary)", marginLeft: 58 }}>
            Remote Claude Code terminal — persistent, autonomous, mobile-friendly
          </p>
        </div>

        {/* Push Notification Onboarding */}
        <PushOnboarding />

        {/* Active Sessions */}
        {active.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <SectionHeader title="Active Now" count={active.length} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16, marginTop: 16 }}>
              {active.map((s) => (
                <ActiveCard key={s.id} session={s} onClick={() => openSession(s)} />
              ))}
            </div>
          </section>
        )}

        {/* Sessions */}
        {recent.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <SectionHeader title="Sessions" count={recent.length} />
            <div style={{
              marginTop: 16, borderRadius: 12, overflow: "hidden",
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-elevated)",
              boxShadow: "var(--shadow-card)",
            }}>
              {recent.map((s, i) => (
                <CompletedRow key={s.id} session={s} onClick={() => openSession(s)} isLast={i === recent.length - 1} />
              ))}
            </div>
          </section>
        )}

        {/* Projects */}
        {discovered.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <SectionHeader title="Projects" />
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(200px, 1fr))", gap: isMobile ? 10 : 14, marginTop: 16 }}>
              {discovered.map((d) => (
                <ProjectCard key={d.path} name={d.name} path={d.path} onClick={() => createSession(d.path)} />
              ))}
              <button
                style={{
                  padding: 20, borderRadius: 12,
                  border: "1.5px dashed var(--color-border)",
                  background: "transparent",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
                  cursor: "pointer", transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-text-tertiary)";
                  e.currentTarget.style.background = "var(--color-bg-elevated)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-border)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <Plus size={20} color="var(--color-text-tertiary)" />
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-tertiary)" }}>Add project</span>
              </button>
            </div>
          </section>
        )}

        {/* Empty state */}
        {sessions.length === 0 && discovered.length === 0 && (
          <div style={{ textAlign: "center", paddingTop: 80, paddingBottom: 80 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20, margin: "0 auto 24px",
              background: "var(--gradient-primary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 32px rgba(249,115,22,0.3)",
            }}>
              <Zap size={32} color="#fff" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>No projects found</h2>
            <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: 24 }}>
              Add a project directory to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Sub Components ---- */

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <h2 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-tertiary)" }}>
        {title}
      </h2>
      {count !== undefined && (
        <span style={{
          padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700,
          background: "var(--color-bg-surface)", color: "var(--color-text-secondary)",
        }}>
          {count}
        </span>
      )}
      <div style={{ flex: 1, height: 1, background: "var(--color-border-subtle)" }} />
    </div>
  );
}

function ActiveCard({ session: s, onClick }: { session: Session; onClick: () => void }) {
  const isThinking = s.status === "thinking";
  const accent = isThinking ? "#3b82f6" : "#f59e0b";

  return (
    <button
      onClick={onClick}
      style={{
        padding: 20, borderRadius: 12, textAlign: "left", cursor: "pointer",
        border: `1px solid var(--color-border)`,
        background: "var(--color-bg-elevated)",
        boxShadow: "var(--shadow-card)",
        transition: "all 0.2s",
        width: "100%",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = accent;
        e.currentTarget.style.boxShadow = "var(--shadow-card-hover)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--color-border)";
        e.currentTarget.style.boxShadow = "var(--shadow-card)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span className="animate-pulse-dot" style={{ width: 8, height: 8, borderRadius: 99, background: accent, flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>
          {s.name || s.cwd.split("/").pop()}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, fontFamily: "var(--font-mono)", color: accent }}>
          {isThinking ? "Thinking..." : "Needs approval"}
        </span>
      </div>
      {s.last_prompt && (
        <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--color-text-secondary)", marginBottom: 14 }}>
          "{truncate(s.last_prompt, 100)}"
        </p>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-tertiary)" }}>
        <span style={{ color: "var(--color-success)" }}>{formatCost(s.total_cost_usd)}</span>
        <span>{s.total_turns} turns</span>
        <span>{formatTimeAgo(s.updated_at)}</span>
      </div>
    </button>
  );
}

function CompletedRow({ session: s, onClick, isLast }: { session: Session; onClick: () => void; isLast: boolean }) {
  const isError = s.status === "error";
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 14,
        padding: "14px 20px", textAlign: "left", cursor: "pointer",
        borderBottom: isLast ? "none" : "1px solid var(--color-border-subtle)",
        background: "transparent", transition: "background 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-surface)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {isError
        ? <XCircle size={15} color="var(--color-destructive)" style={{ flexShrink: 0 }} />
        : <CheckCircle size={15} color="var(--color-success)" style={{ flexShrink: 0 }} />
      }
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text)", minWidth: 90, flexShrink: 0 }}>
        {s.name || s.cwd.split("/").pop()}
      </span>
      <span style={{ fontSize: 12, color: "var(--color-text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {truncate(s.last_prompt || "No prompt", 80)}
      </span>
      <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-success)", flexShrink: 0 }}>
        {formatCost(s.total_cost_usd)}
      </span>
      <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-tertiary)", flexShrink: 0, minWidth: 55, textAlign: "right" }}>
        {formatTimeAgo(s.updated_at)}
      </span>
      <ArrowRight size={14} color="var(--color-text-tertiary)" style={{ flexShrink: 0, opacity: 0.4 }} />
    </button>
  );
}

function ProjectCard({ name, onClick }: { name: string; path: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: 20, borderRadius: 12, textAlign: "left", cursor: "pointer",
        border: "1px solid var(--color-border)",
        background: "var(--color-bg-elevated)",
        boxShadow: "var(--shadow-card)",
        transition: "all 0.2s",
        width: "100%",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--color-accent)";
        e.currentTarget.style.boxShadow = "var(--shadow-card-hover)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--color-border)";
        e.currentTarget.style.boxShadow = "var(--shadow-card)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <FolderOpen size={16} color="var(--color-text-tertiary)" />
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>{name}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--color-accent)" }}>
        <Plus size={12} />
        <span>New session</span>
      </div>
    </button>
  );
}
