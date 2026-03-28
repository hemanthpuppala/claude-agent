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
        <div style={{ marginBottom: 20 }}>
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

        {/* MCP Servers */}
        <div>
          <SectionLabel>MCP Servers</SectionLabel>
          <McpServerConfig
            servers={config.mcp_servers}
            onChange={(v) => onConfigChange({ mcp_servers: v })}
          />
        </div>
      </div>
    </div>
  );
}

function McpServerConfig({ servers, onChange }: {
  servers: Record<string, unknown> | null;
  onChange: (servers: Record<string, unknown> | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCommand, setNewCommand] = useState("");
  const [newArgs, setNewArgs] = useState("");

  const serverEntries = Object.entries(servers || {});

  const handleAdd = () => {
    if (!newName.trim() || !newCommand.trim()) return;
    const updated = {
      ...(servers || {}),
      [newName.trim()]: {
        command: newCommand.trim(),
        args: newArgs.trim() ? newArgs.trim().split(/\s+/) : [],
      },
    };
    onChange(updated);
    setNewName("");
    setNewCommand("");
    setNewArgs("");
    setAdding(false);
  };

  const handleRemove = (name: string) => {
    const updated = { ...(servers || {}) };
    delete updated[name];
    onChange(Object.keys(updated).length > 0 ? updated : null);
  };

  return (
    <div>
      {serverEntries.length === 0 && !adding && (
        <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginBottom: 8 }}>
          No MCP servers configured
        </div>
      )}

      {serverEntries.map(([name, config]) => {
        const cfg = config as { command?: string; args?: string[] };
        return (
          <div key={name} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 8px", borderRadius: 6, marginBottom: 4,
            background: "var(--color-bg)",
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: 99,
              background: "var(--color-success)", flexShrink: 0,
            }} />
            <span style={{ fontSize: 12, fontWeight: 500, fontFamily: "var(--font-mono)", color: "var(--color-text)", flex: 1 }}>
              {name}
            </span>
            <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>
              {cfg.command}
            </span>
            <button
              onClick={() => handleRemove(name)}
              style={{
                fontSize: 11, color: "var(--color-destructive)",
                background: "none", border: "none", cursor: "pointer",
                padding: "2px 6px",
              }}
            >
              Remove
            </button>
          </div>
        );
      })}

      {adding ? (
        <div style={{
          padding: 10, borderRadius: 8, marginTop: 8,
          background: "var(--color-bg)",
          border: "1px solid var(--color-border-subtle)",
        }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Server name (e.g. playwright)"
            style={{
              width: "100%", padding: "6px 8px", borderRadius: 6, marginBottom: 6,
              border: "1px solid var(--color-border)", background: "var(--color-bg-elevated)",
              color: "var(--color-text)", fontSize: 12, fontFamily: "var(--font-mono)",
              outline: "none",
            }}
          />
          <input
            value={newCommand}
            onChange={(e) => setNewCommand(e.target.value)}
            placeholder="Command (e.g. npx)"
            style={{
              width: "100%", padding: "6px 8px", borderRadius: 6, marginBottom: 6,
              border: "1px solid var(--color-border)", background: "var(--color-bg-elevated)",
              color: "var(--color-text)", fontSize: 12, fontFamily: "var(--font-mono)",
              outline: "none",
            }}
          />
          <input
            value={newArgs}
            onChange={(e) => setNewArgs(e.target.value)}
            placeholder="Args (space-separated, e.g. @playwright/mcp@latest)"
            style={{
              width: "100%", padding: "6px 8px", borderRadius: 6, marginBottom: 8,
              border: "1px solid var(--color-border)", background: "var(--color-bg-elevated)",
              color: "var(--color-text)", fontSize: 12, fontFamily: "var(--font-mono)",
              outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={handleAdd}
              style={{
                padding: "5px 12px", borderRadius: 6, border: "none",
                background: "var(--color-accent)", color: "#fff",
                fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}
            >
              Add
            </button>
            <button
              onClick={() => setAdding(false)}
              style={{
                padding: "5px 12px", borderRadius: 6, border: "none",
                background: "transparent", color: "var(--color-text-tertiary)",
                fontSize: 11, cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            marginTop: 6, fontSize: 12, color: "var(--color-accent)",
            background: "none", border: "none", cursor: "pointer",
            padding: 0,
          }}
        >
          + Add MCP server
        </button>
      )}
    </div>
  );
}
