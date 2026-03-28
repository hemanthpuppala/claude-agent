import { formatCost, formatDuration } from "@/lib/utils";
import type { ResultMsg } from "@/lib/types";

export function ResultBar({ result }: { result: ResultMsg }) {
  const isError = result.is_error;
  const cost = result.total_cost_usd ?? 0;
  const duration = result.duration_ms ?? 0;
  const turns = result.num_turns ?? 0;
  const stopReason = result.stop_reason || result.subtype || "";

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 12,
        padding: "6px 16px", borderRadius: 99,
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border-subtle)",
        fontSize: 11, fontFamily: "var(--font-mono)",
      }}>
        {isError ? (
          <span style={{ color: "var(--color-destructive)", fontWeight: 600 }}>
            Error: {result.result?.slice(0, 60) || stopReason}
          </span>
        ) : (
          <>
            <span style={{ color: "var(--color-success)", fontWeight: 600 }}>{formatCost(cost)}</span>
            {duration > 0 && <span style={{ color: "var(--color-text-tertiary)" }}>{formatDuration(duration)}</span>}
            {turns > 0 && <span style={{ color: "var(--color-text-tertiary)" }}>{turns} turn{turns !== 1 ? "s" : ""}</span>}
            {stopReason && <span style={{ color: "var(--color-text-tertiary)" }}>{stopReason}</span>}
          </>
        )}
      </div>
    </div>
  );
}
