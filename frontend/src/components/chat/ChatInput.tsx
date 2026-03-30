import { useState, useRef, useCallback } from "react";
import { ArrowUp, Square, Slash, Paperclip, X, FileText, Image } from "lucide-react";
import { CommandPalette } from "./CommandPalette";
import { useMobile } from "@/hooks/useMobile";
import { colors } from "@/lib/styles";

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

interface Attachment {
  type: "project-file" | "local-file";
  name: string;
  path?: string;       // Full path for project files
  file?: File;         // File object for local uploads
}

export function ChatInput({ onSend, onInterrupt, isRunning, disabled, cwd, onClientCommand, externalAttachments, onExternalAttachmentsConsumed }: {
  onSend: (prompt: string) => void;
  onInterrupt: () => void;
  isRunning: boolean;
  disabled?: boolean;
  cwd?: string;
  onClientCommand?: (message: string) => void;
  externalAttachments?: { type: string; name: string; path?: string }[];
  onExternalAttachmentsConsumed?: () => void;
}) {
  const [value, setValue] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isMobile } = useMobile();

  // Consume externally dropped files (from ChatView drop zone)
  const prevExternal = useRef<number>(0);
  if (externalAttachments && externalAttachments.length > prevExternal.current) {
    const newOnes = externalAttachments.slice(prevExternal.current);
    for (const ext of newOnes) {
      const att: Attachment = {
        type: ext.type as "project-file" | "local-file",
        name: ext.name,
        path: ext.path,
      };
      if (!attachments.some(a => a.name === att.name && a.path === att.path)) {
        attachments.push(att); // Direct push OK — will trigger re-render via setAttachments below
      }
    }
    prevExternal.current = externalAttachments.length;
    if (newOnes.length > 0) {
      setAttachments([...attachments]);
      onExternalAttachmentsConsumed?.();
      textareaRef.current?.focus();
    }
  }

  const addAttachment = (att: Attachment) => {
    // Prevent duplicates
    if (attachments.some(a => a.name === att.name && a.path === att.path)) return;
    setAttachments(prev => [...prev, att]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    const hasAttachments = attachments.length > 0;
    if (!trimmed && !hasAttachments) return;

    // Check client-side commands
    const cmd = trimmed.split(" ")[0].toLowerCase();
    if (CLIENT_COMMANDS[cmd] && !hasAttachments) {
      if (onClientCommand) onClientCommand(CLIENT_COMMANDS[cmd]);
      setValue("");
      setShowCommands(false);
      return;
    }

    // Build prompt with attachments
    let prompt = trimmed;
    if (hasAttachments) {
      const fileRefs = attachments.map(a => {
        if (a.type === "project-file" && a.path) {
          return `[Attached file: ${a.path}]`;
        }
        return `[Attached: ${a.name}]`;
      }).join("\n");
      prompt = fileRefs + (trimmed ? "\n\n" + trimmed : "");
    }

    onSend(prompt);
    setValue("");
    setAttachments([]);
    setShowCommands(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, attachments, onSend, onClientCommand]);

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
    if (v.startsWith("/") && !v.includes(" ")) {
      setShowCommands(true);
    } else {
      setShowCommands(false);
    }
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const handleCommandSelect = (command: string) => {
    setValue(command + " ");
    setShowCommands(false);
    textareaRef.current?.focus();
  };

  // ===== Drag & Drop =====

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    // Check for project file path (from file tree sidebar)
    const filePath = e.dataTransfer.getData("application/x-file-path");
    if (filePath) {
      const fullPath = cwd ? `${cwd}/${filePath}` : filePath;
      const name = filePath.split("/").pop() || filePath;
      addAttachment({ type: "project-file", name, path: fullPath });
      textareaRef.current?.focus();
      return;
    }

    // Check for local files (dragged from desktop)
    if (e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach(file => {
        addAttachment({ type: "local-file", name: file.name, file });
      });
      textareaRef.current?.focus();
      return;
    }

    // Plain text drop
    const text = e.dataTransfer.getData("text/plain");
    if (text) {
      setValue(prev => prev + text);
      textareaRef.current?.focus();
    }
  };

  // ===== Paste image =====

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          addAttachment({ type: "local-file", name: `pasted-image.${file.type.split("/")[1] || "png"}`, file });
        }
        return;
      }
    }
  };

  // ===== File picker =====

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      addAttachment({ type: "local-file", name: file.name, file });
    });
    e.target.value = ""; // Reset so same file can be selected again
  };

  const hasContent = value.trim().length > 0 || attachments.length > 0;

  return (
    <div
      style={{
        borderTop: "1px solid var(--color-border-subtle)",
        padding: isMobile ? "8px 12px 12px" : "12px 24px 16px",
        paddingBottom: isMobile ? "calc(12px + env(safe-area-inset-bottom, 0px))" : "16px",
        background: "var(--color-bg)",
        position: "relative",
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div style={{ maxWidth: 768, margin: "0 auto", position: "relative" }}>

        {/* Command Palette */}
        {showCommands && (
          <CommandPalette
            filter={showCommands ? value : ""}
            cwd={cwd || ""}
            onSelect={handleCommandSelect}
            onClose={() => setShowCommands(false)}
          />
        )}

        {/* Input container */}
        <div style={{
          borderRadius: 16,
          background: "var(--color-bg-elevated)",
          border: dragOver
            ? "2px solid var(--color-accent)"
            : "1px solid var(--color-border)",
          boxShadow: dragOver
            ? "0 0 16px rgba(212,132,90,0.2)"
            : "0 2px 8px rgba(0,0,0,0.15)",
          transition: "border 0.15s, box-shadow 0.15s",
          overflow: "hidden",
        }}>
          {/* Attachments bar */}
          {attachments.length > 0 && (
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 6,
              padding: "8px 14px 4px",
              borderBottom: "1px solid var(--color-border-subtle)",
            }}>
              {attachments.map((att, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "3px 8px 3px 6px", borderRadius: 6,
                  background: att.type === "project-file" ? "rgba(212,132,90,0.1)" : "var(--color-bg-surface)",
                  border: "1px solid var(--color-border-subtle)",
                  fontSize: 12, color: colors.text,
                }}>
                  {att.type === "project-file"
                    ? <FileText size={12} color={colors.accent} />
                    : <Image size={12} color={colors.textSecondary} />
                  }
                  <span style={{
                    maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    fontFamily: att.type === "project-file" ? "var(--font-mono)" : "var(--font-sans)",
                    fontSize: 11,
                  }}>
                    {att.name}
                  </span>
                  <button
                    onClick={() => removeAttachment(i)}
                    style={{
                      width: 16, height: 16, borderRadius: 99, border: "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "transparent", color: colors.textTertiary,
                      cursor: "pointer", marginLeft: 2,
                    }}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Drop overlay */}
          {dragOver && (
            <div style={{
              padding: "12px 14px",
              textAlign: "center", fontSize: 13, fontWeight: 500,
              color: colors.accent,
            }}>
              Drop files to attach
            </div>
          )}

          {/* Input row */}
          <div style={{
            display: "flex", alignItems: "flex-end", gap: 8,
            padding: "10px 14px",
          }}>
            {/* Attach button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach file"
              style={{
                width: 28, height: 28, borderRadius: 6, border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0,
                background: "transparent",
                color: colors.textTertiary,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = colors.textSecondary; e.currentTarget.style.background = colors.bgSurface; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = colors.textTertiary; e.currentTarget.style.background = "transparent"; }}
            >
              <Paperclip size={15} />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={handleFileSelect}
              accept="*/*"
            />

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={isMobile ? "Message Claude..." : "Message Claude... (type / for commands)"}
              rows={1}
              disabled={disabled}
              style={{
                flex: 1, border: "none", outline: "none", resize: "none",
                background: "transparent", color: colors.text,
                fontSize: 15, lineHeight: 1.5, fontFamily: "var(--font-sans)",
                maxHeight: 200,
                opacity: disabled ? 0.5 : 1,
              }}
            />

            {/* Slash button */}
            {!isMobile && (
              <button
                onClick={() => {
                  if (!value.startsWith("/")) {
                    setValue("/");
                    setShowCommands(true);
                    textareaRef.current?.focus();
                  }
                }}
                aria-label="Slash commands"
                style={{
                  width: 28, height: 28, borderRadius: 6, border: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", flexShrink: 0,
                  background: "transparent", color: colors.textTertiary,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = colors.textSecondary; e.currentTarget.style.background = colors.bgSurface; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = colors.textTertiary; e.currentTarget.style.background = "transparent"; }}
              >
                <Slash size={14} />
              </button>
            )}

            {/* Send / Stop */}
            <button
              onClick={isRunning ? onInterrupt : handleSend}
              disabled={disabled || (!isRunning && !hasContent)}
              style={{
                width: 32, height: 32, borderRadius: 10, border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: (disabled || (!isRunning && !hasContent)) ? "default" : "pointer",
                flexShrink: 0, transition: "all 0.2s",
                background: isRunning
                  ? colors.destructive
                  : hasContent
                    ? colors.accent
                    : colors.bgSurface,
                color: isRunning || hasContent ? "#fff" : colors.textTertiary,
                boxShadow: (isRunning || hasContent)
                  ? "0 2px 8px rgba(212,132,90,0.3)" : "none",
              }}
            >
              {isRunning ? <Square size={14} /> : <ArrowUp size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
