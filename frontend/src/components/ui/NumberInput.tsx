export function NumberInput({ value, onChange, placeholder, min, max, step, prefix }: {
  value: number | null;
  onChange: (val: number | null) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center",
      borderRadius: 8, border: "1px solid var(--color-border)",
      background: "var(--color-bg)", overflow: "hidden",
      transition: "border-color 0.15s",
    }}>
      {prefix && (
        <span style={{
          padding: "0 8px", fontSize: 13, color: "var(--color-text-tertiary)",
          borderRight: "1px solid var(--color-border-subtle)",
          background: "var(--color-bg-surface)",
          lineHeight: "32px",
        }}>
          {prefix}
        </span>
      )}
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        style={{
          flex: 1, padding: "7px 10px", border: "none", outline: "none",
          background: "transparent", color: "var(--color-text)",
          fontSize: 13, fontFamily: "var(--font-mono)",
          width: "100%",
        }}
      />
    </div>
  );
}
