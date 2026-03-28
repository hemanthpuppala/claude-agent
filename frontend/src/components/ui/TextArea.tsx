export function TextArea({ value, onChange, placeholder, rows }: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows || 3}
      style={{
        width: "100%", padding: "8px 10px", borderRadius: 8,
        border: "1px solid var(--color-border)",
        background: "var(--color-bg)", color: "var(--color-text)",
        fontSize: 13, fontFamily: "var(--font-sans)",
        lineHeight: 1.5, resize: "vertical", outline: "none",
        transition: "border-color 0.15s",
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-accent)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
    />
  );
}
