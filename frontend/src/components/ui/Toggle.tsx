export function Toggle({ checked, onChange, label }: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label?: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        background: "none", border: "none", cursor: "pointer",
        padding: 0,
      }}
    >
      <div style={{
        width: 36, height: 20, borderRadius: 99, padding: 2,
        background: checked ? "var(--color-accent)" : "var(--color-bg-surface)",
        border: `1px solid ${checked ? "var(--color-accent)" : "var(--color-border)"}`,
        transition: "all 0.2s",
      }}>
        <div style={{
          width: 14, height: 14, borderRadius: 99,
          background: checked ? "#fff" : "var(--color-text-tertiary)",
          transform: checked ? "translateX(16px)" : "translateX(0)",
          transition: "all 0.2s",
        }} />
      </div>
      {label && (
        <span style={{ fontSize: 13, color: "var(--color-text)" }}>{label}</span>
      )}
    </button>
  );
}
