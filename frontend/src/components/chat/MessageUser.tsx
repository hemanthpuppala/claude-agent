export function MessageUser({ content }: { content: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 0" }}>
      <div style={{
        maxWidth: "80%",
        padding: "12px 16px",
        borderRadius: 18,
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }}>
        <p style={{
          fontSize: 15, lineHeight: 1.6, color: "var(--color-text)",
          whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0,
        }}>
          {content}
        </p>
      </div>
    </div>
  );
}
