import { Zap } from "lucide-react";

const THINKING_WORDS = [
  "Thinking", "Analyzing", "Processing", "Reasoning",
  "Exploring", "Computing", "Evaluating", "Considering",
];

export function TypingIndicator({ status }: { status: string }) {
  const word = status === "waiting_permission" ? "Waiting for approval" :
    THINKING_WORDS[Math.floor(Date.now() / 3000) % THINKING_WORDS.length];

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "16px 0",
      animation: "fadeIn 0.3s ease-out",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 16px",
        borderRadius: 16,
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border-subtle)",
      }}>
        {/* Animated icon */}
        <div style={{
          width: 20, height: 20, borderRadius: 6,
          background: "var(--gradient-primary)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "typingPulse 2s ease-in-out infinite",
        }}>
          <Zap size={11} color="#fff" />
        </div>

        {/* Thinking text */}
        <span style={{
          fontSize: 13, color: "var(--color-text-secondary)",
          fontStyle: "italic",
        }}>
          {word}
        </span>

        {/* Animated dots */}
        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 4, height: 4, borderRadius: 99,
                background: "var(--color-accent)",
                animation: `typingDot 1.4s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes typingDot {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes typingPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
