import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

interface SelectOption {
  value: string;
  label: string;
}

export function Select({ options, value, onChange, placeholder }: {
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", padding: "7px 10px", borderRadius: 8,
          border: "1px solid var(--color-border)",
          background: "var(--color-bg)", color: "var(--color-text)",
          fontSize: 13, cursor: "pointer", gap: 8,
          transition: "border-color 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-text-tertiary)"; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.borderColor = "var(--color-border)"; }}
      >
        <span style={{ color: selected ? "var(--color-text)" : "var(--color-text-tertiary)" }}>
          {selected?.label || placeholder || "Select..."}
        </span>
        <ChevronDown size={14} color="var(--color-text-tertiary)" style={{
          transition: "transform 0.15s",
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
        }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
          background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)",
          borderRadius: 8, boxShadow: "var(--shadow-card-hover)",
          padding: 4, maxHeight: 200, overflowY: "auto",
        }}>
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", padding: "7px 10px", borderRadius: 6,
                border: "none", background: "transparent",
                fontSize: 13, color: "var(--color-text)", cursor: "pointer",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-surface)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              {opt.label}
              {opt.value === value && <Check size={14} color="var(--color-accent)" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
