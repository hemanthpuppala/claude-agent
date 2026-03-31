import { useRef, useEffect, useState, useCallback } from "react";
import { useMobile } from "@/hooks/useMobile";
import { useSessionStore } from "@/stores/sessionStore";
import { useClaudeWebSocket } from "@/hooks/useWebSocket";
import { ChatInput } from "./ChatInput";
import { MessageUser } from "./MessageUser";
import { MessageClaude } from "./MessageClaude";
import { ResultBar } from "./ResultBar";
import { PermissionCard } from "./PermissionCard";
import { TypingIndicator } from "./TypingIndicator";
import { Zap, Loader2 } from "lucide-react";
import type { ServerMessage, AssistantMsg, ResultMsg, UserEchoMsg, PermissionRequestMsg } from "@/lib/types";

export function ChatView({ sessionId, cwd }: { sessionId?: string; cwd?: string }) {
  const session = useSessionStore((s) => sessionId ? s.getSession(sessionId) : undefined);
  const { sendQuery, sendPermission, sendInterrupt } = useClaudeWebSocket(sessionId ?? null, cwd);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useMobile();

  const isReplaying = session?.replaying ?? false;
  const prevMsgCount = useRef(0);

  useEffect(() => {
    if (isReplaying) return; // Don't scroll during replay — wait until it's done

    const count = session?.messages.length ?? 0;
    if (count > prevMsgCount.current) {
      // New message arrived — scroll to bottom
      // Use instant scroll on first load, smooth on new messages
      const behavior = prevMsgCount.current === 0 ? "instant" : "smooth";
      bottomRef.current?.scrollIntoView({ behavior: behavior as ScrollBehavior });
    }
    prevMsgCount.current = count;
  }, [session?.messages.length, isReplaying]);

  const isConnected = !!session;
  const messages = session?.messages || [];
  const isRunning = session?.status === "thinking" || session?.status === "waiting_permission";

  const addMessage = useSessionStore((s) => s.addMessage);
  const [dragOverChat, setDragOverChat] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<{ type: string; name: string; path?: string }[]>([]);
  const dragCountRef = useRef(0);

  const handleSend = (prompt: string) => {
    sendQuery(prompt);
  };

  const handleChatDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleChatDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCountRef.current++;
    setDragOverChat(true);
  }, []);

  const handleChatDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCountRef.current--;
    if (dragCountRef.current <= 0) {
      dragCountRef.current = 0;
      setDragOverChat(false);
    }
  }, []);

  const handleChatDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current = 0;
    setDragOverChat(false);

    // Project file from sidebar
    const filePath = e.dataTransfer.getData("application/x-file-path");
    if (filePath) {
      const fullPath = (session?.cwd || cwd || "") + "/" + filePath;
      const name = filePath.split("/").pop() || filePath;
      setDroppedFiles(prev => [...prev, { type: "project-file", name, path: fullPath }]);
      return;
    }

    // Local files from desktop
    if (e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).map(f => ({
        type: "local-file", name: f.name,
      }));
      setDroppedFiles(prev => [...prev, ...files]);
    }
  }, [session?.cwd, cwd]);

  const handleClientCommand = (message: string) => {
    if (sessionId) {
      addMessage(sessionId, { type: "system", subtype: "client", data: message } as ServerMessage);
    }
  };

  return (
    <div
      style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--color-bg)", position: "relative" }}
      onDragOver={handleChatDragOver}
      onDragEnter={handleChatDragEnter}
      onDragLeave={handleChatDragLeave}
      onDrop={handleChatDrop}
    >
      {/* Full-screen drop overlay */}
      {dragOverChat && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 50,
          background: "rgba(249,115,22,0.08)",
          border: "3px dashed var(--color-accent)",
          borderRadius: 12, margin: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <div style={{
            padding: "16px 32px", borderRadius: 12,
            background: "var(--color-bg-elevated)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            border: "1px solid var(--color-accent)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📎</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)" }}>Drop to attach</div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>Files will be attached to your message</div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 0" }}>
        <div style={{ maxWidth: 768, margin: "0 auto", padding: isMobile ? "0 12px" : "0 24px" }}>

          {/* Empty / connecting state */}
          {messages.length === 0 && (
            <div style={{ textAlign: "center", paddingTop: 80 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, margin: "0 auto 20px",
                background: "var(--gradient-primary)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 32px rgba(249,115,22,0.25)",
              }}>
                {isConnected
                  ? <Zap size={28} color="#fff" />
                  : <Loader2 size={24} color="#fff" className="animate-spin" style={{ animation: "spin 1s linear infinite" }} />
                }
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text)", marginBottom: 6 }}>
                Claude Code
              </h2>
              <p style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
                {isConnected ? "Type a message to start coding." : "Connecting to session..."}
              </p>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg, i) => (
            <MessageRenderer key={i} message={msg} onPermission={sendPermission} sessionId={sessionId} />
          ))}

          {/* Typing indicator */}
          {isRunning && <TypingIndicator status={session?.status || "thinking"} />}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar — ALWAYS visible */}
      <ChatInput
        onSend={handleSend}
        onInterrupt={sendInterrupt}
        isRunning={isRunning}
        disabled={!isConnected}
        cwd={session?.cwd || cwd}
        onClientCommand={handleClientCommand}
        externalAttachments={droppedFiles}
        onExternalAttachmentsConsumed={() => setDroppedFiles([])}
      />
    </div>
  );
}

function MessageRenderer({ message, onPermission, sessionId }: {
  message: ServerMessage;
  onPermission: (requestId: string, decision: string, message?: string) => void;
  sessionId?: string;
}) {
  switch (message.type) {
    case "user_echo":
      return <MessageUser content={(message as UserEchoMsg).content} />;
    case "assistant":
      return <MessageClaude message={message as AssistantMsg} sessionId={sessionId} />;
    case "result":
      return <ResultBar result={message as ResultMsg} />;
    case "permission_request": {
      const perm = message as PermissionRequestMsg;
      return (
        <PermissionCard
          toolName={perm.tool_name}
          toolInput={perm.tool_input}
          requestId={perm.request_id}
          onDecision={onPermission}
          sessionId={sessionId}
        />
      );
    }
    case "system": {
      const sysMsg = message as { subtype?: string; data?: string };
      if (sysMsg.subtype === "init" || sysMsg.subtype === "config" || !sysMsg.subtype) return null;
      // Client-side command responses
      if (sysMsg.subtype === "client") {
        return (
          <div style={{
            margin: "8px 0", padding: "10px 14px", borderRadius: 8,
            background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-subtle)",
            fontSize: 13, color: "var(--color-text-secondary)",
          }}>
            {sysMsg.data}
          </div>
        );
      }
      return (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "16px 0", fontSize: 11, color: "var(--color-text-tertiary)",
        }}>
          <div style={{ flex: 1, height: 1, background: "var(--color-border-subtle)" }} />
          <span>{sysMsg.subtype || "System"}</span>
          <div style={{ flex: 1, height: 1, background: "var(--color-border-subtle)" }} />
        </div>
      );
    }
    case "error":
      return (
        <div style={{
          margin: "12px 0", padding: "12px 16px", borderRadius: 8,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          fontSize: 13, color: "var(--color-destructive)",
        }}>
          {(message as { message: string }).message}
        </div>
      );
    default:
      return null;
  }
}
