import React from "react";
import { EDITOR_THEME, editorTextStyles } from "./editorTheme";

export function MapEditorTopbar(props: {
  title: string;
  activeToolLabel: string;
  activeToolHint: string;
  persistenceLabel: string;
  persistenceColor: string;
}): React.JSX.Element {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div>
        <div style={{ ...editorTextStyles.sectionTitle, letterSpacing: 0.8 }}>MODE EDITION</div>
        <h3 style={{ margin: "4px 0 0", fontSize: 22, color: EDITOR_THEME.colors.text, fontFamily: EDITOR_THEME.fontFamily }}>{props.title}</h3>
      </div>
      <div style={{ display: "grid", gap: 2, justifyItems: "end" }}>
        <div style={{ fontSize: 12, color: props.persistenceColor, fontWeight: 800, fontFamily: EDITOR_THEME.fontFamily }}>{props.persistenceLabel}</div>
        <div style={{ fontSize: 12, color: EDITOR_THEME.colors.accent, fontWeight: 700, fontFamily: EDITOR_THEME.fontFamily }}>Outil: {props.activeToolLabel}</div>
        <div style={{ ...editorTextStyles.helper, maxWidth: 520, textAlign: "right" }}>{props.activeToolHint}</div>
      </div>
    </div>
  );
}
