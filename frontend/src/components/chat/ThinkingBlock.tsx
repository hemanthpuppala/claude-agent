import { useState } from "react";
import { ChevronRight, Brain } from "lucide-react";
import { truncate } from "@/lib/utils";

export function ThinkingBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        borderRadius: 10,
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border-subtle)",
        cursor: "pointer",
        overflow: "hidden",
        transition: "all 0.2s",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 14px",
      }}>
        <ChevronRight
          size={14}
          color="var(--color-text-tertiary)"
          style={{
            transition: "transform 0.15s",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}
        />
        <Brain size={14} color="var(--color-text-tertiary)" style={{ flexShrink: 0 }} />
        <span style={{
          fontSize: 12, fontStyle: "italic", color: "var(--color-text-secondary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {expanded ? "Thinking" : truncate(text, 80)}
        </span>
      </div>

      {/* Body */}
      {expanded && (
        <div style={{
          borderTop: "1px solid var(--color-border-subtle)",
          padding: "12px 14px",
          maxHeight: 300, overflowY: "auto",
          fontSize: 12, lineHeight: 1.6,
          fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)",
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          {text}
        </div>
      )}
    </div>
  );
}
