interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

export function RadioGroup({ options, value, onChange }: {
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            padding: "8px 10px", borderRadius: 8, border: "none",
            background: value === opt.value ? "rgba(212,132,90,0.08)" : "transparent",
            cursor: "pointer", textAlign: "left",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            if (value !== opt.value) e.currentTarget.style.background = "var(--color-bg-surface)";
          }}
          onMouseLeave={(e) => {
            if (value !== opt.value) e.currentTarget.style.background = "transparent";
          }}
        >
          <span style={{
            width: 16, height: 16, borderRadius: 99, flexShrink: 0, marginTop: 1,
            border: value === opt.value ? "5px solid var(--color-accent)" : "2px solid var(--color-border)",
            background: value === opt.value ? "var(--color-bg)" : "transparent",
            transition: "all 0.15s",
          }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text)" }}>
              {opt.label}
            </div>
            {opt.description && (
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>
                {opt.description}
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
