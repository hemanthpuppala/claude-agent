/**
 * Shared DiffViewer component — used by:
 * - SidebarGit (clicking a changed file)
 * - ToolCard Edit (showing tool input diff)
 * - FileViewer (future: inline diff view)
 *
 * Renders unified diff hunks with green/red lines, line numbers, and hunk headers.
 */

interface DiffLine {
  type: "add" | "del" | "ctx";
  content: string;
}

interface DiffHunk {
  header?: string;
  lines: DiffLine[];
}

export function DiffViewer({ hunks, fileName, isNew, maxHeight }: {
  hunks: DiffHunk[];
  fileName?: string;
  isNew?: boolean;
  maxHeight?: number;
}) {
  if (hunks.length === 0) {
    return (
      <div style={{
        padding: 16, textAlign: "center",
        fontSize: 13, color: "var(--color-text-tertiary)",
      }}>
        No changes
      </div>
    );
  }

  return (
    <div style={{
      borderRadius: "var(--radius-md)",
      overflow: "hidden",
      border: "1px solid var(--color-border)",
      fontSize: 12, fontFamily: "var(--font-mono)",
      lineHeight: 1.6,
      maxHeight: maxHeight || "none",
      overflowY: maxHeight ? "auto" : "visible",
    }}>
      {/* File header */}
      {fileName && (
        <div style={{
          padding: "6px 12px",
          background: "var(--color-bg-surface)",
          borderBottom: "1px solid var(--color-border-subtle)",
          fontSize: 11, fontWeight: 600,
          color: "var(--color-text-secondary)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span>{isNew ? "New file" : "Modified"}</span>
          <span style={{ color: "var(--color-text)" }}>{fileName}</span>
        </div>
      )}

      {/* Hunks */}
      {hunks.map((hunk, hi) => (
        <div key={hi}>
          {/* Hunk header */}
          {hunk.header && (
            <div style={{
              padding: "4px 12px",
              background: "rgba(59,130,246,0.06)",
              color: "var(--color-info)",
              fontSize: 11, fontStyle: "italic",
              borderTop: hi > 0 ? "1px solid var(--color-border-subtle)" : "none",
            }}>
              {hunk.header}
            </div>
          )}

          {/* Lines */}
          {hunk.lines.map((line, li) => (
            <DiffLine key={`${hi}-${li}`} line={line} />
          ))}
        </div>
      ))}
    </div>
  );
}

function DiffLine({ line }: { line: DiffLine }) {
  const bgColor =
    line.type === "add" ? "rgba(16,185,129,0.08)" :
    line.type === "del" ? "rgba(239,68,68,0.08)" :
    "transparent";

  const borderColor =
    line.type === "add" ? "var(--color-success)" :
    line.type === "del" ? "var(--color-destructive)" :
    "transparent";

  const textColor =
    line.type === "add" ? "#86EFAC" :
    line.type === "del" ? "#FCA5A5" :
    "var(--color-text-secondary)";

  const prefix =
    line.type === "add" ? "+" :
    line.type === "del" ? "−" :
    " ";

  return (
    <div style={{
      display: "flex", alignItems: "stretch",
      background: bgColor,
      borderLeft: `3px solid ${borderColor}`,
      minHeight: 20,
    }}>
      {/* Prefix */}
      <span style={{
        width: 20, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: textColor, fontSize: 11, fontWeight: 600,
        userSelect: "none", opacity: 0.7,
      }}>
        {prefix}
      </span>

      {/* Content */}
      <span style={{
        flex: 1, padding: "1px 8px 1px 4px",
        color: textColor,
        whiteSpace: "pre-wrap", wordBreak: "break-all",
      }}>
        {line.content || " "}
      </span>
    </div>
  );
}
