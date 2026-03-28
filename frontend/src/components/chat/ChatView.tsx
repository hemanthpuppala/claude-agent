import { useRef, useEffect } from "react";
import { useSessionStore } from "@/stores/sessionStore";
import { useClaudeWebSocket } from "@/hooks/useWebSocket";
import { ChatInput } from "./ChatInput";
import { MessageUser } from "./MessageUser";
import { MessageClaude } from "./MessageClaude";
import { ResultBar } from "./ResultBar";
import { Zap } from "lucide-react";
import type { ServerMessage, AssistantMsg, ResultMsg, UserEchoMsg, PermissionRequestMsg } from "@/lib/types";

export function ChatView({ sessionId, cwd }: { sessionId?: string; cwd?: string }) {
  const session = useSessionStore((s) => sessionId ? s.getSession(sessionId) : undefined);
  const { sendQuery, sendPermission, sendInterrupt } = useClaudeWebSocket(sessionId ?? null, cwd);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages.length]);

  if (!session) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, margin: "0 auto 20px",
              background: "linear-gradient(135deg, #d4845a, #b86d47)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 32px rgba(212,132,90,0.25)",
            }}>
              <Zap size={28} color="#fff" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text)", marginBottom: 6 }}>
              Claude Code
            </h2>
            <p style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
              Connecting to session...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Group messages into conversation turns
  const messages = session.messages;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--color-bg)" }}>
      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "24px 0" }}>
        <div style={{ maxWidth: 768, margin: "0 auto", padding: "0 24px" }}>
          {messages.length === 0 && (
            <EmptyState />
          )}

          {messages.map((msg, i) => (
            <MessageRenderer
              key={i}
              message={msg}
              onPermission={sendPermission}
            />
          ))}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <ChatInput
        onSend={sendQuery}
        onInterrupt={sendInterrupt}
        isRunning={session.status === "thinking" || session.status === "waiting_permission"}
      />
    </div>
  );
}

function MessageRenderer({ message, onPermission }: {
  message: ServerMessage;
  onPermission: (requestId: string, decision: string, message?: string) => void;
}) {
  switch (message.type) {
    case "user_echo":
      return <MessageUser content={(message as UserEchoMsg).content} />;
    case "assistant":
      return <MessageClaude message={message as AssistantMsg} />;
    case "result":
      return <ResultBar result={message as ResultMsg} />;
    case "permission_request": {
      const perm = message as PermissionRequestMsg;
      return (
        <PermissionCardInline
          toolName={perm.tool_name}
          toolInput={perm.tool_input}
          requestId={perm.request_id}
          onDecision={onPermission}
        />
      );
    }
    case "system":
      return <SystemDivider text={(message as { data?: string }).data || "System"} />;
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

function EmptyState() {
  return (
    <div style={{ textAlign: "center", paddingTop: 80 }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16, margin: "0 auto 20px",
        background: "linear-gradient(135deg, #d4845a, #b86d47)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 8px 32px rgba(212,132,90,0.25)",
      }}>
        <Zap size={28} color="#fff" />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text)", marginBottom: 6 }}>
        Claude Code
      </h2>
      <p style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
        Type a message to start coding.
      </p>
    </div>
  );
}

function SystemDivider({ text }: { text: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "16px 0", fontSize: 11, color: "var(--color-text-tertiary)",
    }}>
      <div style={{ flex: 1, height: 1, background: "var(--color-border-subtle)" }} />
      <span>{text}</span>
      <div style={{ flex: 1, height: 1, background: "var(--color-border-subtle)" }} />
    </div>
  );
}

// Inline permission card — imported separately below
import { PermissionCard } from "./PermissionCard";

function PermissionCardInline({ toolName, toolInput, requestId, onDecision }: {
  toolName: string;
  toolInput: Record<string, unknown>;
  requestId: string;
  onDecision: (requestId: string, decision: string, message?: string) => void;
}) {
  return (
    <PermissionCard
      toolName={toolName}
      toolInput={toolInput}
      requestId={requestId}
      onDecision={onDecision}
    />
  );
}
