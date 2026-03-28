import { WifiOff } from "lucide-react";

export function ReconnectionBanner() {
  return (
    <div className="flex items-center justify-center gap-2 py-1 bg-[var(--color-warning)] text-[var(--color-accent-text)] text-xs font-medium">
      <WifiOff size={14} />
      Reconnecting...
    </div>
  );
}
