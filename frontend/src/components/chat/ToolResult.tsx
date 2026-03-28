import { useState } from "react";

export function ToolResult({ content, isError }: { content: string; isError: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > 3000;
  const display = expanded ? content : content.slice(0, 3000);

  if (!content) return null;

  return (
    <div style={{
      borderRadius: "0 0 10px 10px",
      marginTop: -2,
      padding: "10px 14px",
      fontSize: 12, lineHeight: 1.5,
      fontFamily: "var(--font-mono)",
      maxHeight: expanded ? "none" : 200,
      overflowY: expanded ? "visible" : "auto",
      whiteSpace: "pre-wrap", wordBreak: "break-word",
      background: isError ? "rgba(239,68,68,0.05)" : "var(--color-bg-surface)",
      color: isError ? "var(--color-destructive)" : "var(--color-text-secondary)",
      border: "1px solid var(--color-border-subtle)",
      borderTop: "none",
    }}>
      {display}
      {isLong && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            display: "block", marginTop: 8,
            fontSize: 11, fontWeight: 500,
            color: "var(--color-accent)", background: "none", border: "none",
            cursor: "pointer", padding: 0,
          }}
        >
          Show all ({content.length.toLocaleString()} chars)
        </button>
      )}
    </div>
  );
}
