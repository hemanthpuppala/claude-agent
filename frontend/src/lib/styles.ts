/**
 * Shared style constants and helpers — single source of truth.
 * Every component uses these instead of hardcoding values.
 */

// ===== Colors (mirrors CSS variables for use in JS) =====
export const colors = {
  bg: "var(--color-bg)",
  bgElevated: "var(--color-bg-elevated)",
  bgSurface: "var(--color-bg-surface)",
  bgOverlay: "var(--color-bg-overlay)",
  text: "var(--color-text)",
  textSecondary: "var(--color-text-secondary)",
  textTertiary: "var(--color-text-tertiary)",
  accent: "var(--color-accent)",
  accentText: "var(--color-accent-text)",
  border: "var(--color-border)",
  borderSubtle: "var(--color-border-subtle)",
  destructive: "var(--color-destructive)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  info: "var(--color-info)",
  toolRead: "var(--color-tool-read)",
  toolWrite: "var(--color-tool-write)",
  toolExecute: "var(--color-tool-execute)",
  toolWeb: "var(--color-tool-web)",
  toolAgent: "var(--color-tool-agent)",
} as const;

// ===== Spacing =====
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

// ===== Common style patterns =====

export const sidebarHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: `0 ${spacing.lg}px`,
  height: 44,
  flexShrink: 0,
  borderBottom: `1px solid ${colors.borderSubtle}`,
};

export const sidebarHeaderLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: colors.textSecondary,
};

export const sidebarCountBadge: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  padding: "1px 6px",
  borderRadius: 99,
  background: colors.bgSurface,
  color: colors.textTertiary,
};

export const iconButton: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 6,
  border: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  background: "transparent",
  color: colors.textTertiary,
  transition: "all 0.15s",
  flexShrink: 0,
};

export const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: colors.textTertiary,
  marginBottom: spacing.sm,
};

export const listItem: React.CSSProperties = {
  padding: `${spacing.sm}px ${spacing.md}px`,
  margin: `0 ${spacing.xs + 2}px`,
  borderRadius: 8,
  transition: "background 0.12s",
  cursor: "pointer",
};

export const contextMenu: React.CSSProperties = {
  background: colors.bgElevated,
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
  padding: 4,
  animation: "fadeIn 0.1s ease-out",
};

export const contextMenuItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  padding: "8px 12px",
  borderRadius: 6,
  border: "none",
  background: "transparent",
  fontSize: 13,
  color: colors.text,
  cursor: "pointer",
  transition: "background 0.1s",
  minHeight: 36,
};

export const separator: React.CSSProperties = {
  height: 1,
  margin: `${spacing.xs}px ${spacing.lg}px`,
  background: colors.borderSubtle,
};

export const dividerLine: React.CSSProperties = {
  height: 1,
  background: colors.borderSubtle,
};

// ===== Hover helpers =====

export function hoverBg(e: React.MouseEvent, bg = colors.bgSurface) {
  (e.currentTarget as HTMLElement).style.background = bg;
}

export function unhoverBg(e: React.MouseEvent) {
  (e.currentTarget as HTMLElement).style.background = "transparent";
}

export function hoverColor(e: React.MouseEvent, color = colors.text) {
  (e.currentTarget as HTMLElement).style.color = color;
}

export function unhoverColor(e: React.MouseEvent, color = colors.textTertiary) {
  (e.currentTarget as HTMLElement).style.color = color;
}

// Combined hover handler factory
export function hover(styles: Partial<CSSStyleDeclaration>) {
  return {
    onMouseEnter: (e: React.MouseEvent) => {
      Object.assign((e.currentTarget as HTMLElement).style, styles);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      const reset: Record<string, string> = {};
      for (const key of Object.keys(styles)) {
        reset[key] = "";
      }
      Object.assign((e.currentTarget as HTMLElement).style, reset);
    },
  };
}
