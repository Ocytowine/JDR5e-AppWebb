import React from "react";
import { EDITOR_THEME, editorSurfaceStyles, editorTextStyles } from "./editorTheme";

export function CollapsibleSection(props: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <details
      open={props.defaultOpen}
      style={{
        ...editorSurfaceStyles.subsection,
        gap: 0
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          padding: "10px 12px",
          ...editorTextStyles.sectionTitle,
          userSelect: "none"
        }}
      >
        {props.title}
      </summary>
      <div style={{ display: "grid", gap: 8, padding: "0 10px 10px", color: EDITOR_THEME.colors.text }}>{props.children}</div>
    </details>
  );
}
