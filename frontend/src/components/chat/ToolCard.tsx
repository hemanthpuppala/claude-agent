import { useState } from "react";
import { ChevronRight, FileText, Search, FileSearch, Pencil, FilePlus, Terminal, Globe, ExternalLink, Bot, Wrench, HelpCircle } from "lucide-react";
import { TOOL_CATEGORIES, DEFAULT_TOOL, isDangerousCommand } from "@/lib/constants";
import { truncate, basename } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICONS: Record<string, any> = {
  FileText, Search, FileSearch, Pencil, FilePlus, Terminal,
  Globe, ExternalLink, Bot, Wrench, HelpCircle,
};

export function ToolCard({ toolName, toolInput }: {
  toolName: string;
  toolInput: Record<string, unknown>;
  toolId?: string;
}) {
  const category = TOOL_CATEGORIES[toolName as keyof typeof TOOL_CATEGORIES] || DEFAULT_TOOL;
  const autoExpand = ["Edit", "Write", "Bash"].includes(toolName);
  const [expanded, setExpanded] = useState(autoExpand);

  const Icon = ICONS[category.icon] || Wrench;
  const detail = getDetail(toolName, toolInput);
  const isDangerous = toolName === "Bash" && isDangerousCommand(String(toolInput.command || ""));

  return (
    <div style={{
      borderRadius: 10, overflow: "hidden",
      background: "var(--color-bg-elevated)",
      border: "1px solid var(--color-border)",
      borderLeft: `3px solid ${category.color}`,
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px", cursor: "pointer",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-surface)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        <Icon size={15} color={category.color} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)", flexShrink: 0 }}>
          {toolName}
        </span>
        <span style={{
          fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
        }}>
          {detail}
        </span>
        <ChevronRight
          size={14} color="var(--color-text-tertiary)"
          style={{
            transition: "transform 0.15s", flexShrink: 0,
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          }}
        />
      </div>

      {/* Body */}
      {expanded && (
        <div style={{
          borderTop: "1px solid var(--color-border-subtle)",
          padding: "12px 14px",
          background: "rgba(0,0,0,0.1)",
        }}>
          {isDangerous && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 10px", borderRadius: 6, marginBottom: 10,
              background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)",
              fontSize: 11, fontWeight: 600, color: "var(--color-warning)",
            }}>
              <AlertTriangle size={12} />
              Potentially destructive command
            </div>
          )}
          <ToolBody toolName={toolName} toolInput={toolInput} />
        </div>
      )}
    </div>
  );
}

function getDetail(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "Read":
    case "Write":
    case "Edit":
      return basename(String(input.file_path || ""));
    case "Glob":
      return String(input.pattern || "");
    case "Grep":
      return String(input.pattern || "");
    case "Bash":
      return truncate(String(input.command || ""), 80);
    case "WebSearch":
      return String(input.query || input.prompt || "");
    case "WebFetch":
      return truncate(String(input.url || ""), 60);
    case "Agent":
      return String(input.description || input.prompt || "").slice(0, 60);
    default:
      return "";
  }
}

function ToolBody({ toolName, toolInput }: { toolName: string; toolInput: Record<string, unknown> }) {
  switch (toolName) {
    case "Bash":
      return (
        <pre style={{
          margin: 0, padding: "8px 12px", borderRadius: 6,
          background: "var(--color-bg)", fontSize: 13, lineHeight: 1.5,
          fontFamily: "var(--font-mono)", color: "var(--color-text)",
          overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all",
        }}>
          <span style={{ color: "var(--color-text-tertiary)" }}>$ </span>
          {String(toolInput.command || "")}
        </pre>
      );

    case "Edit": {
      const filePath = String(toolInput.file_path || "");
      const oldStr = String(toolInput.old_string || "");
      const newStr = String(toolInput.new_string || "");
      return (
        <div>
          <div style={{
            fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-tertiary)",
            marginBottom: 8, padding: "4px 8px", borderRadius: 4,
            background: "var(--color-bg-surface)", display: "inline-block",
          }}>
            {filePath}
          </div>
          <div style={{ borderRadius: 6, overflow: "hidden", border: "1px solid var(--color-border-subtle)" }}>
            {oldStr && oldStr.split("\n").map((line, i) => (
              <div key={`old-${i}`} style={{
                padding: "2px 10px", fontSize: 12, fontFamily: "var(--font-mono)",
                background: "rgba(239,68,68,0.06)", color: "#fca5a5",
                borderLeft: "3px solid var(--color-destructive)",
              }}>
                <span style={{ color: "var(--color-text-tertiary)", marginRight: 8, userSelect: "none" }}>-</span>
                {line}
              </div>
            ))}
            {newStr && newStr.split("\n").map((line, i) => (
              <div key={`new-${i}`} style={{
                padding: "2px 10px", fontSize: 12, fontFamily: "var(--font-mono)",
                background: "rgba(16,185,129,0.06)", color: "#86efac",
                borderLeft: "3px solid var(--color-success)",
              }}>
                <span style={{ color: "var(--color-text-tertiary)", marginRight: 8, userSelect: "none" }}>+</span>
                {line}
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "Write": {
      const content = String(toolInput.content || "");
      const lines = content.split("\n").length;
      return (
        <div>
          <div style={{
            fontSize: 11, fontWeight: 600, color: "var(--color-success)",
            marginBottom: 8,
          }}>
            {lines} lines written
          </div>
          <pre style={{
            margin: 0, padding: "10px 12px", borderRadius: 6,
            background: "var(--color-bg)", fontSize: 12, lineHeight: 1.5,
            fontFamily: "var(--font-mono)", color: "var(--color-text)",
            maxHeight: 200, overflowY: "auto", whiteSpace: "pre-wrap",
          }}>
            {truncate(content, 2000)}
          </pre>
        </div>
      );
    }

    case "WebSearch":
      return (
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          <Globe size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} color="var(--color-tool-web)" />
          "{String(toolInput.query || toolInput.prompt || "")}"
        </div>
      );

    case "WebFetch":
      return (
        <a
          href={String(toolInput.url || "")}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 13, color: "var(--color-accent)", wordBreak: "break-all" }}
        >
          {String(toolInput.url || "")}
        </a>
      );

    default: {
      const entries = Object.entries(toolInput);
      if (entries.length === 0) return null;
      return (
        <pre style={{
          margin: 0, padding: "8px 12px", borderRadius: 6,
          background: "var(--color-bg)", fontSize: 12, lineHeight: 1.5,
          fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)",
          maxHeight: 200, overflowY: "auto", whiteSpace: "pre-wrap",
        }}>
          {JSON.stringify(toolInput, null, 2)}
        </pre>
      );
    }
  }
}
