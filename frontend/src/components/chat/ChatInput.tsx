import { useState, useRef, useCallback } from "react";
import { ArrowUp, Square } from "lucide-react";

export function ChatInput({ onSend, onInterrupt, isRunning, disabled }: {
  onSend: (prompt: string) => void;
  onInterrupt: () => void;
  isRunning: boolean;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isRunning || disabled) return;
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // Auto-expand
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const hasText = value.trim().length > 0;

  return (
    <div style={{
      borderTop: "1px solid var(--color-border-subtle)",
      padding: "12px 24px 16px",
      background: "var(--color-bg)",
    }}>
      <div style={{ maxWidth: 768, margin: "0 auto" }}>
        <div style={{
          display: "flex", alignItems: "flex-end", gap: 10,
          padding: "10px 14px",
          borderRadius: 16,
          background: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Message Claude..."
            rows={1}
            style={{
              flex: 1, border: "none", outline: "none", resize: "none",
              background: "transparent", color: "var(--color-text)",
              fontSize: 15, lineHeight: 1.5, fontFamily: "var(--font-sans)",
              maxHeight: 200,
            }}
          />

          <button
            onClick={isRunning ? onInterrupt : handleSend}
            disabled={disabled || (!isRunning && !hasText)}
            style={{
              width: 32, height: 32, borderRadius: 10, border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: (!isRunning && !hasText) ? "default" : "pointer",
              flexShrink: 0,
              transition: "all 0.2s",
              background: isRunning
                ? "var(--color-destructive)"
                : hasText
                  ? "var(--color-accent)"
                  : "var(--color-bg-surface)",
              color: isRunning || hasText ? "#fff" : "var(--color-text-tertiary)",
              boxShadow: (isRunning || hasText)
                ? "0 2px 8px rgba(212,132,90,0.3)"
                : "none",
            }}
          >
            {isRunning ? <Square size={14} /> : <ArrowUp size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
