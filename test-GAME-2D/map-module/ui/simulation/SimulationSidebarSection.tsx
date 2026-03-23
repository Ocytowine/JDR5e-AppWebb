import React from "react";
import { EDITOR_THEME, editorSurfaceStyles } from "../editor/editorTheme";

export function SimulationSidebarSection(props: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <details
      open={props.defaultOpen}
      style={{
        ...editorSurfaceStyles.panel,
        padding: 0,
        overflow: "hidden"
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          listStyle: "none",
          userSelect: "none",
          padding: "12px 14px",
          display: "grid",
          gap: 4
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff", fontFamily: EDITOR_THEME.fontFamily }}>{props.title}</div>
        {props.summary ? (
          <div style={{ fontSize: 12, color: EDITOR_THEME.colors.textMuted, lineHeight: 1.4, fontFamily: EDITOR_THEME.fontFamily }}>
            {props.summary}
          </div>
        ) : null}
      </summary>
      <div style={{ display: "grid", gap: 10, padding: "0 14px 14px", color: EDITOR_THEME.colors.text, fontFamily: EDITOR_THEME.fontFamily }}>
        {props.children}
      </div>
    </details>
  );
}
