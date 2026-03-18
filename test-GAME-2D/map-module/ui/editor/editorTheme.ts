import type React from "react";

export const EDITOR_THEME = {
  fontFamily: "\"Trebuchet MS\", \"Segoe UI\", sans-serif",
  colors: {
    text: "#eef3ff",
    textMuted: "#c6d0df",
    textSoft: "#9eabc0",
    accent: "#9bc2ff",
    accentStrong: "#f4c967",
    border: "rgba(196,210,232,0.18)",
    borderSoft: "rgba(196,210,232,0.12)",
    panelBg: "rgba(9,14,24,0.92)",
    panelBgRaised: "rgba(14,21,33,0.94)",
    fieldBg: "rgba(20,29,43,0.96)",
    fieldBgHover: "rgba(24,35,52,0.98)",
    sectionBg: "rgba(255,255,255,0.045)",
    dangerBg: "rgba(130,28,28,0.22)",
    dangerBorder: "rgba(255,160,160,0.18)",
    dangerText: "#ffd7d7"
  }
} as const;

export const editorTextStyles = {
  body: {
    color: EDITOR_THEME.colors.text,
    fontFamily: EDITOR_THEME.fontFamily
  } satisfies React.CSSProperties,
  label: {
    color: EDITOR_THEME.colors.textMuted,
    fontSize: 12,
    fontFamily: EDITOR_THEME.fontFamily
  } satisfies React.CSSProperties,
  title: {
    color: EDITOR_THEME.colors.text,
    fontFamily: EDITOR_THEME.fontFamily
  } satisfies React.CSSProperties,
  sectionTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: EDITOR_THEME.colors.accent,
    fontFamily: EDITOR_THEME.fontFamily,
    letterSpacing: 0.2
  } satisfies React.CSSProperties,
  panelTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: EDITOR_THEME.colors.accentStrong,
    fontFamily: EDITOR_THEME.fontFamily
  } satisfies React.CSSProperties,
  helper: {
    fontSize: 12,
    color: EDITOR_THEME.colors.textMuted,
    lineHeight: 1.45,
    fontFamily: EDITOR_THEME.fontFamily
  } satisfies React.CSSProperties
};

export const editorSurfaceStyles = {
  panel: {
    padding: 14,
    borderRadius: 14,
    border: `1px solid ${EDITOR_THEME.colors.borderSoft}`,
    background: EDITOR_THEME.colors.panelBg,
    backdropFilter: "blur(10px)",
    color: EDITOR_THEME.colors.text,
    fontFamily: EDITOR_THEME.fontFamily,
    boxShadow: "0 14px 30px rgba(0,0,0,0.22)"
  } satisfies React.CSSProperties,
  subsection: {
    display: "grid",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    border: `1px solid ${EDITOR_THEME.colors.borderSoft}`,
    background: EDITOR_THEME.colors.sectionBg
  } satisfies React.CSSProperties
};

export const editorFieldStyles = {
  control: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: `1px solid ${EDITOR_THEME.colors.border}`,
    background: EDITOR_THEME.colors.fieldBg,
    color: EDITOR_THEME.colors.text,
    boxSizing: "border-box",
    fontFamily: EDITOR_THEME.fontFamily,
    colorScheme: "dark"
  } satisfies React.CSSProperties,
  textarea: {
    width: "100%",
    minHeight: 220,
    resize: "vertical",
    borderRadius: 10,
    border: `1px solid ${EDITOR_THEME.colors.border}`,
    background: EDITOR_THEME.colors.fieldBg,
    color: EDITOR_THEME.colors.text,
    padding: "10px 12px",
    boxSizing: "border-box",
    fontFamily: "Consolas, monospace",
    fontSize: 12
  } satisfies React.CSSProperties
};

export function createEditorButtonStyle(options?: {
  active?: boolean;
  danger?: boolean;
  compact?: boolean;
}): React.CSSProperties {
  if (options?.danger) {
    return {
      padding: options.compact ? "8px 10px" : "10px 14px",
      borderRadius: 10,
      border: `1px solid ${EDITOR_THEME.colors.dangerBorder}`,
      background: EDITOR_THEME.colors.dangerBg,
      color: EDITOR_THEME.colors.dangerText,
      cursor: "pointer",
      fontWeight: 700,
      fontFamily: EDITOR_THEME.fontFamily
    };
  }

  return {
    padding: options?.compact ? "8px 10px" : "10px 14px",
    borderRadius: 10,
    border: `1px solid ${EDITOR_THEME.colors.border}`,
    background: options?.active ? "rgba(79,125,242,0.22)" : EDITOR_THEME.colors.panelBgRaised,
    color: EDITOR_THEME.colors.text,
    cursor: "pointer",
    fontWeight: 700,
    fontFamily: EDITOR_THEME.fontFamily
  };
}
