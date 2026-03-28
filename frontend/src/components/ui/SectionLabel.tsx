export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.08em", color: "var(--color-text-tertiary)",
      marginBottom: 8,
    }}>
      {children}
    </div>
  );
}
