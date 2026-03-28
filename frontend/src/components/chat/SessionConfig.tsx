import { useState, useRef, useEffect } from "react";
import { Settings, X } from "lucide-react";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { Select } from "@/components/ui/Select";
import { CheckboxGrid } from "@/components/ui/CheckboxGrid";
import { NumberInput } from "@/components/ui/NumberInput";
import { TextArea } from "@/components/ui/TextArea";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { PERMISSION_MODES, MODELS, ALL_TOOLS } from "@/lib/constants";
import type { SessionConfig } from "@/lib/types";

export function SessionConfigButton({ config, onConfigChange }: {
  config: SessionConfig;
  onConfigChange: (changes: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        title="Session config"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 28, height: 28, borderRadius: 6, border: "none",
          background: open ? "var(--color-bg-surface)" : "transparent",
          color: open ? "var(--color-text)" : "var(--color-text-tertiary)",
          cursor: "pointer", transition: "all 0.15s",
        }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.color = "var(--color-text-secondary)"; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.color = "var(--color-text-tertiary)"; }}
      >
        <Settings size={15} />
      </button>

      {open && (
        <SessionConfigPanel
          config={config}
          onConfigChange={onConfigChange}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function SessionConfigPanel({ config, onConfigChange, onClose }: {
  config: SessionConfig;
  onConfigChange: (changes: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [systemPrompt, setSystemPrompt] = useState(config.system_prompt || "");

  return (
    <div style={{
      position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 100,
      width: 340, maxHeight: "70vh", overflowY: "auto",
      background: "var(--color-bg-elevated)",
      border: "1px solid var(--color-border)",
      borderRadius: 12,
      boxShadow: "var(--shadow-card-hover)",
      padding: 0,
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: "1px solid var(--color-border-subtle)",
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>
          Session Config
        </span>
        <button
          onClick={onClose}
          style={{
            width: 24, height: 24, borderRadius: 6, border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", color: "var(--color-text-tertiary)",
            cursor: "pointer",
          }}
        >
          <X size={14} />
        </button>
      </div>

      <div style={{ padding: "16px" }}>
        {/* Permission Mode */}
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>Permission Mode</SectionLabel>
          <RadioGroup
            options={PERMISSION_MODES.map((m) => ({
              value: m.value, label: m.label, description: m.description,
            }))}
            value={config.permission_mode}
            onChange={(v) => onConfigChange({ permission_mode: v })}
          />
        </div>

        {/* Model */}
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>Model</SectionLabel>
          <Select
            options={MODELS.map((m) => ({ value: m.value, label: m.label }))}
            value={config.model}
            onChange={(v) => onConfigChange({ model: v })}
            placeholder="Default (Opus 4.6)"
          />
        </div>

        {/* Tools */}
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>Allowed Tools</SectionLabel>
          <CheckboxGrid
            items={[...ALL_TOOLS]}
            selected={config.allowed_tools}
            onChange={(v) => onConfigChange({ allowed_tools: v })}
          />
          <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginTop: 6 }}>
            All checked = all tools enabled
          </div>
        </div>

        {/* Limits */}
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>Limits</SectionLabel>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4 }}>Max cost</div>
              <NumberInput
                value={config.max_budget_usd}
                onChange={(v) => onConfigChange({ max_budget_usd: v })}
                placeholder="No limit"
                prefix="$"
                min={0}
                step={0.5}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4 }}>Max turns</div>
              <NumberInput
                value={config.max_turns}
                onChange={(v) => onConfigChange({ max_turns: v })}
                placeholder="No limit"
                min={1}
                step={1}
              />
            </div>
          </div>
        </div>

        {/* System Prompt */}
        <div>
          <SectionLabel>System Prompt</SectionLabel>
          <TextArea
            value={systemPrompt}
            onChange={setSystemPrompt}
            placeholder="Custom instructions for Claude..."
            rows={4}
          />
          {systemPrompt !== (config.system_prompt || "") && (
            <button
              onClick={() => onConfigChange({ system_prompt: systemPrompt || null })}
              style={{
                marginTop: 8, padding: "6px 14px", borderRadius: 6,
                border: "none", background: "var(--color-accent)",
                color: "#fff", fontSize: 12, fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Apply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
