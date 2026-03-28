import { useState } from "react";
import { Terminal, Pencil, FilePlus, FileText, Globe, ExternalLink, Check, X } from "lucide-react";
import { TOOL_CATEGORIES, DEFAULT_TOOL, isDangerousCommand } from "@/lib/constants";
import { AlertTriangle } from "lucide-react";
import { truncate, basename } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  Terminal, Pencil, FilePlus, FileText, Globe, ExternalLink,
};

export function PermissionCard({ toolName, toolInput, requestId, onDecision }: {
  toolName: string;
  toolInput: Record<string, unknown>;
  requestId: string;
  onDecision: (requestId: string, decision: string, message?: string) => void;
}) {
  const [resolved, setResolved] = useState<string | null>(null);
  const [showDenyInput, setShowDenyInput] = useState(false);
  const [denyMessage, setDenyMessage] = useState("");

  const category = TOOL_CATEGORIES[toolName as keyof typeof TOOL_CATEGORIES] || DEFAULT_TOOL;
  const Icon = ICONS[category.icon] || Terminal;
  const isDangerous = toolName === "Bash" && isDangerousCommand(String(toolInput.command || ""));

  const handleDecision = (decision: string, msg = "") => {
    setResolved(decision);
    onDecision(requestId, decision, msg);
  };

  if (resolved) {
    const allowed = resolved === "allow" || resolved === "allow_session" || resolved === "allow_always";
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 0", fontSize: 12, opacity: 0.6,
      }}>
        <Icon size={14} color={category.color} />
        <span style={{ fontWeight: 500, color: "var(--color-text)" }}>{toolName}</span>
        <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>
          {getDetail(toolName, toolInput)}
        </span>
        {allowed
          ? <><Check size={13} color="var(--color-success)" /><span style={{ color: "var(--color-success)" }}>Allowed</span></>
          : <><X size={13} color="var(--color-destructive)" /><span style={{ color: "var(--color-destructive)" }}>Denied{denyMessage ? `: ${denyMessage}` : ""}</span></>
        }
      </div>
    );
  }

  return (
    <div style={{
      margin: "12px 0", borderRadius: 12, overflow: "hidden",
      border: "1px solid var(--color-border)",
      background: "var(--color-bg-elevated)",
      boxShadow: "var(--shadow-card)",
    }}>
      {/* Accent bar */}
      <div style={{ height: 3, background: category.color }} />

      <div style={{ padding: 20 }}>
        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Icon size={18} color={category.color} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>
            Claude wants to {getAction(toolName)}
          </span>
        </div>

        {/* Danger warning */}
        {isDangerous && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 12px", borderRadius: 8, marginBottom: 14,
            background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)",
            fontSize: 12, fontWeight: 600, color: "var(--color-warning)",
          }}>
            <AlertTriangle size={14} />
            Potentially destructive command
          </div>
        )}

        {/* Content preview */}
        <div style={{
          padding: "10px 14px", borderRadius: 8, marginBottom: 16,
          background: "var(--color-bg)", fontFamily: "var(--font-mono)",
          fontSize: 13, color: "var(--color-text)",
          whiteSpace: "pre-wrap", wordBreak: "break-word",
          maxHeight: 200, overflowY: "auto",
        }}>
          {getPreview(toolName, toolInput)}
        </div>

        {/* Deny feedback input */}
        {showDenyInput && (
          <div style={{ marginBottom: 14 }}>
            <textarea
              value={denyMessage}
              onChange={(e) => setDenyMessage(e.target.value)}
              placeholder="Tell Claude what to do instead..."
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                background: "var(--color-bg)", border: "1px solid var(--color-border)",
                color: "var(--color-text)", fontSize: 13, fontFamily: "var(--font-sans)",
                resize: "none", outline: "none", minHeight: 60,
              }}
            />
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => handleDecision("allow")}
            style={{
              padding: "8px 18px", borderRadius: 8, border: "none",
              background: "var(--color-success)", color: "#fff",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            Allow
          </button>

          <button
            onClick={() => handleDecision("allow_session")}
            style={{
              padding: "8px 14px", borderRadius: 8,
              border: "1px solid var(--color-border)", background: "transparent",
              color: "var(--color-text-secondary)",
              fontSize: 12, fontWeight: 500, cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-surface)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Accept edits this session
          </button>

          {showDenyInput ? (
            <>
              <button
                onClick={() => handleDecision("deny", denyMessage)}
                style={{
                  padding: "8px 14px", borderRadius: 8, border: "none",
                  background: "rgba(239,68,68,0.1)", color: "var(--color-destructive)",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
              >
                Send & Deny
              </button>
              <button
                onClick={() => setShowDenyInput(false)}
                style={{
                  padding: "8px 14px", borderRadius: 8, border: "none",
                  background: "transparent", color: "var(--color-text-tertiary)",
                  fontSize: 12, cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowDenyInput(true)}
              style={{
                padding: "8px 14px", borderRadius: 8, border: "none",
                background: "transparent", color: "var(--color-destructive)",
                fontSize: 12, fontWeight: 500, cursor: "pointer",
                marginLeft: "auto",
              }}
            >
              Deny
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function getAction(toolName: string): string {
  switch (toolName) {
    case "Bash": return "run a command";
    case "Edit": return "edit a file";
    case "Write": return "create a file";
    case "Read": return "read a file";
    case "Glob": return "search for files";
    case "Grep": return "search file contents";
    case "WebSearch": return "search the web";
    case "WebFetch": return "fetch a URL";
    default: return `use ${toolName}`;
  }
}

function getDetail(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "Bash": return truncate(String(input.command || ""), 60);
    case "Edit": case "Write": case "Read": return basename(String(input.file_path || ""));
    default: return "";
  }
}

function getPreview(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "Bash": return `$ ${input.command || ""}`;
    case "Edit": return `File: ${input.file_path || ""}\n\n- ${String(input.old_string || "").slice(0, 200)}\n+ ${String(input.new_string || "").slice(0, 200)}`;
    case "Write": return `File: ${input.file_path || ""}\n\n${String(input.content || "").slice(0, 500)}`;
    case "Read": return String(input.file_path || "");
    case "WebSearch": return String(input.query || input.prompt || "");
    case "WebFetch": return String(input.url || "");
    default: return JSON.stringify(input, null, 2);
  }
}
