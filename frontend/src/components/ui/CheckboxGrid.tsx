import { Check } from "lucide-react";

export function CheckboxGrid({ items, selected, onChange }: {
  items: string[];
  selected: string[] | null;
  onChange: (items: string[] | null) => void;
}) {
  const allSelected = selected === null;

  const toggle = (item: string) => {
    if (allSelected) {
      // From "all" → deselect this one
      onChange(items.filter((i) => i !== item));
    } else if (selected.includes(item)) {
      const next = selected.filter((i) => i !== item);
      onChange(next.length === 0 ? null : next);
    } else {
      const next = [...selected, item];
      onChange(next.length === items.length ? null : next);
    }
  };

  const isChecked = (item: string) => allSelected || (selected?.includes(item) ?? false);

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 6,
    }}>
      {items.map((item) => (
        <button
          key={item}
          onClick={() => toggle(item)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 8px", borderRadius: 6, border: "none",
            background: isChecked(item) ? "rgba(212,132,90,0.08)" : "transparent",
            cursor: "pointer", transition: "background 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = isChecked(item) ? "rgba(212,132,90,0.12)" : "var(--color-bg-surface)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = isChecked(item) ? "rgba(212,132,90,0.08)" : "transparent"; }}
        >
          <span style={{
            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
            border: isChecked(item) ? "none" : "2px solid var(--color-border)",
            background: isChecked(item) ? "var(--color-accent)" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
          }}>
            {isChecked(item) && <Check size={11} color="#fff" strokeWidth={3} />}
          </span>
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text)" }}>
            {item}
          </span>
        </button>
      ))}
    </div>
  );
}
