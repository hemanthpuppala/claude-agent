import { WifiOff } from "lucide-react";

export function ReconnectionBanner() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      padding: "5px 0",
      background: "rgba(245,158,11,0.15)",
      borderBottom: "1px solid rgba(245,158,11,0.2)",
      fontSize: 12, fontWeight: 500,
      color: "var(--color-warning)",
    }}>
      <WifiOff size={13} />
      Reconnecting to server...
    </div>
  );
}
