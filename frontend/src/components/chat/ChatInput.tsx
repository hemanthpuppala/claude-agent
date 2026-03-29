import { useState, useRef, useCallback } from "react";
import { ArrowUp, Square, Slash } from "lucide-react";
import { CommandPalette } from "./CommandPalette";
import { useMobile } from "@/hooks/useMobile";

// Client-side slash commands — NOT sent to Claude
const CLIENT_COMMANDS: Record<string, string> = {
  "/model": "Use the status bar (bottom right) to change models.",
  "/clear": "Clear is not yet implemented. Refresh the page to start fresh.",
  "/status": "Status is shown in the status bar below.",
  "/compact": "Compact is handled automatically by the SDK.",
  "/context": "Context usage is managed automatically by the SDK.",
  "/skills": "Skills are loaded from .claude/skills/. View them in Settings.",
  "/memory": "Memory files are in ~/.claude/CLAUDE.md. View in Settings.",
  "/mcp": "MCP servers are configured in the session config (gear icon in status bar).",
  "/tools": "Tools are configured in the session config (gear icon in status bar).",
  "/permissions": "Use the status bar (bottom right) to change permission mode.",
  "/fast": "Fast mode is not available in the web client.",
  "/help": "Type / to see all available commands. Use the status bar to change permissions and model.",
};

export function ChatInput({ onSend, onInterrupt, isRunning, disabled, cwd, onClientCommand }: {
  onSend: (prompt: string) => void;
  onInterrupt: () => void;
  isRunning: boolean;
  disabled?: boolean;
  cwd?: string;
  onClientCommand?: (message: string) => void;
}) {
  const [value, setValue] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isMobile } = useMobile();

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;

    // Check for client-side commands
    const cmd = trimmed.split(" ")[0].toLowerCase();
    if (CLIENT_COMMANDS[cmd]) {
      if (onClientCommand) onClientCommand(CLIENT_COMMANDS[cmd]);
      setValue("");
      setShowCommands(false);
      return;
    }

    onSend(trimmed);
    setValue("");
    setShowCommands(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, onSend, onClientCommand]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isRunning || disabled) return;
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setValue(v);

    // Show command palette when typing / at the start
    if (v.startsWith("/") && !v.includes(" ")) {
      setShowCommands(true);
    } else {
      setShowCommands(false);
    }

    // Auto-expand
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const handleCommandSelect = (command: string) => {
    setValue(command + " ");
    setShowCommands(false);
    textareaRef.current?.focus();
  };

  const hasText = value.trim().length > 0;
  const commandFilter = showCommands ? value : "";

  return (
    <div style={{
      borderTop: "1px solid var(--color-border-subtle)",
      padding: isMobile ? "8px 12px 12px" : "12px 24px 16px",
      paddingBottom: isMobile ? "calc(12px + env(safe-area-inset-bottom, 0px))" : "16px",
      background: "var(--color-bg)",
      position: "relative",
    }}>
      <div style={{ maxWidth: 768, margin: "0 auto", position: "relative" }}>

        {/* Command Palette */}
        {showCommands && (
          <CommandPalette
            filter={commandFilter}
            cwd={cwd || ""}
            onSelect={handleCommandSelect}
            onClose={() => setShowCommands(false)}
          />
        )}

        {/* Input */}
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
            placeholder="Message Claude... (type / for commands)"
            rows={1}
            disabled={disabled}
            style={{
              flex: 1, border: "none", outline: "none", resize: "none",
              background: "transparent", color: "var(--color-text)",
              fontSize: 15, lineHeight: 1.5, fontFamily: "var(--font-sans)",
              maxHeight: 200,
              opacity: disabled ? 0.5 : 1,
            }}
          />

          {/* Slash button */}
          <button
            onClick={() => {
              if (!value.startsWith("/")) {
                setValue("/");
                setShowCommands(true);
                textareaRef.current?.focus();
              }
            }}
            title="Slash commands"
            style={{
              width: 28, height: 28, borderRadius: 6, border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
              background: "transparent",
              color: "var(--color-text-tertiary)",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-text-secondary)"; e.currentTarget.style.background = "var(--color-bg-surface)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-tertiary)"; e.currentTarget.style.background = "transparent"; }}
          >
            <Slash size={14} />
          </button>

          {/* Send / Stop */}
          <button
            onClick={isRunning ? onInterrupt : handleSend}
            disabled={disabled || (!isRunning && !hasText)}
            style={{
              width: 32, height: 32, borderRadius: 10, border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: (disabled || (!isRunning && !hasText)) ? "default" : "pointer",
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
