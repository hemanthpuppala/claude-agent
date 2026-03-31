import { useState } from "react";
import { ChevronRight, FileText, Search, FileSearch, Pencil, FilePlus, Terminal, Globe, ExternalLink, Bot, Wrench, HelpCircle, AlertTriangle } from "lucide-react";
import { TOOL_CATEGORIES, DEFAULT_TOOL, isDangerousCommand } from "@/lib/constants";
import { truncate, basename } from "@/lib/utils";
import { DiffViewer } from "@/components/ui/DiffViewer";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICONS: Record<string, any> = {
  FileText, Search, FileSearch, Pencil, FilePlus, Terminal,
  Globe, ExternalLink, Bot, Wrench, HelpCircle,
};

export function ToolCard({ toolName, toolInput, output, outputError }: {
  toolName: string;
  toolInput: Record<string, unknown>;
  toolId?: string;
  output?: string;
  outputError?: boolean;
}) {
  const category = TOOL_CATEGORIES[toolName as keyof typeof TOOL_CATEGORIES] || DEFAULT_TOOL;
  const [expanded, setExpanded] = useState(false);

  const Icon = ICONS[category.icon] || Wrench;
  const detail = getDetail(toolName, toolInput);
  const isDangerous = toolName === "Bash" && isDangerousCommand(String(toolInput.command || ""));
  const hasOutput = output && output.trim().length > 0;

  return (
    <div style={{
      borderRadius: 10, overflow: "hidden",
      background: "var(--color-bg-elevated)",
      border: "1px solid var(--color-border)",
      borderLeft: `3px solid ${category.color}`,
    }}>
      {/* Header — always visible */}
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
        {hasOutput && !expanded && (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
            background: outputError ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
            color: outputError ? "var(--color-destructive)" : "var(--color-success)",
          }}>
            {outputError ? "error" : "done"}
          </span>
        )}
        <ChevronRight
          size={14} color="var(--color-text-tertiary)"
          style={{
            transition: "transform 0.15s", flexShrink: 0,
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          }}
        />
      </div>

      {/* Expanded body — input + output */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
          {/* Input section */}
          <div style={{
            padding: "12px 14px",
            background: "rgba(0,0,0,0.08)",
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.05em", color: "var(--color-text-tertiary)",
              marginBottom: 8,
            }}>
              Input
            </div>

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

          {/* Output section */}
          {hasOutput && (
            <div style={{
              padding: "12px 14px",
              borderTop: "1px solid var(--color-border-subtle)",
              background: "rgba(0,0,0,0.04)",
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.05em", marginBottom: 8,
                color: outputError ? "var(--color-destructive)" : "var(--color-text-tertiary)",
              }}>
                {outputError ? "Error" : "Output"}
              </div>
              <pre style={{
                margin: 0, padding: "8px 10px", borderRadius: 6,
                background: outputError ? "rgba(239,68,68,0.05)" : "var(--color-bg)",
                border: "1px solid var(--color-border-subtle)",
                fontSize: 12, lineHeight: 1.5,
                fontFamily: "var(--font-mono)",
                color: outputError ? "var(--color-destructive)" : "var(--color-text-secondary)",
                maxHeight: 300, overflowY: "auto",
                whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {output!.length > 5000 ? output!.substring(0, 5000) + "\n... [truncated]" : output}
              </pre>
            </div>
          )}

          {/* Waiting for output */}
          {!hasOutput && !outputError && (
            <div style={{
              padding: "8px 14px",
              borderTop: "1px solid var(--color-border-subtle)",
              fontSize: 11, color: "var(--color-text-tertiary)", fontStyle: "italic",
              background: "rgba(0,0,0,0.04)",
            }}>
              Running...
            </div>
          )}
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
          border: "1px solid var(--color-border-subtle)",
        }}>
          <span style={{ color: "var(--color-text-tertiary)" }}>$ </span>
          {String(toolInput.command || "")}
        </pre>
      );

    case "Edit": {
      const filePath = String(toolInput.file_path || "");
      const oldStr = String(toolInput.old_string || "");
      const newStr = String(toolInput.new_string || "");
      // Convert Edit tool input into DiffViewer hunks
      const editLines: { type: "add" | "del"; content: string }[] = [];
      if (oldStr) oldStr.split("\n").forEach(line => editLines.push({ type: "del", content: line }));
      if (newStr) newStr.split("\n").forEach(line => editLines.push({ type: "add", content: line }));
      return (
        <DiffViewer
          hunks={[{ lines: editLines }]}
          fileName={filePath}
          maxHeight={300}
        />
      );
    }

    case "Write": {
      const content = String(toolInput.content || "");
      const lines = content.split("\n").length;
      return (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-success)", marginBottom: 8 }}>
            {lines} lines
          </div>
          <pre style={{
            margin: 0, padding: "10px 12px", borderRadius: 6,
            background: "var(--color-bg)", fontSize: 12, lineHeight: 1.5,
            fontFamily: "var(--font-mono)", color: "var(--color-text)",
            maxHeight: 200, overflowY: "auto", whiteSpace: "pre-wrap",
            border: "1px solid var(--color-border-subtle)",
          }}>
            {truncate(content, 2000)}
          </pre>
        </div>
      );
    }

    case "Read":
      return (
        <div style={{
          fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)",
          padding: "6px 10px", borderRadius: 6, background: "var(--color-bg)",
          border: "1px solid var(--color-border-subtle)",
        }}>
          {String(toolInput.file_path || "")}
        </div>
      );

    case "Glob":
    case "Grep":
      return (
        <div style={{
          fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)",
          padding: "6px 10px", borderRadius: 6, background: "var(--color-bg)",
          border: "1px solid var(--color-border-subtle)",
        }}>
          {String(toolInput.pattern || toolInput.query || "")}
          {toolInput.path ? <span style={{ color: "var(--color-text-tertiary)" }}> in {String(toolInput.path)}</span> : null}
        </div>
      );

    case "WebSearch":
      return (
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          <Globe size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} color="var(--color-tool-web)" />
          "{String(toolInput.query || toolInput.prompt || "")}"
        </div>
      );

    case "WebFetch":
      return (
        <a href={String(toolInput.url || "")} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 13, color: "var(--color-accent)", wordBreak: "break-all" }}>
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
          border: "1px solid var(--color-border-subtle)",
        }}>
          {JSON.stringify(toolInput, null, 2)}
        </pre>
      );
    }
  }
}
