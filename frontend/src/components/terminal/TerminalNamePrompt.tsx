import { useState, useEffect, useRef } from "react";
import { Terminal } from "lucide-react";

export function TerminalNamePrompt({ defaultName, onConfirm, onCancel }: {
  defaultName: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-select the text so user can immediately type a new name
    inputRef.current?.select();
  }, []);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (trimmed) onConfirm(trimmed);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{
          position: "fixed", inset: 0, zIndex: 300,
          background: "rgba(0,0,0,0.5)",
          animation: "fadeIn 0.15s ease-out",
        }}
      />

      {/* Dialog */}
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)", zIndex: 301,
        width: "min(400px, 90vw)",
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
        padding: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Terminal size={18} color="var(--color-accent)" />
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)" }}>
            New Terminal
          </span>
        </div>

        <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 12 }}>
          Name this terminal session:
        </div>

        <input
          ref={inputRef}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onCancel();
          }}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8,
            border: "1px solid var(--color-accent)",
            background: "var(--color-bg)", color: "var(--color-text)",
            fontSize: 14, fontFamily: "var(--font-mono)",
            outline: "none",
          }}
        />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "none",
              background: "transparent", color: "var(--color-text-secondary)",
              fontSize: 13, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{
              padding: "8px 20px", borderRadius: 8, border: "none",
              background: "var(--color-accent)", color: "#fff",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            Open Terminal
          </button>
        </div>
      </div>
    </>
  );
}
