import React from "react";
import { EditorPanelFrame } from "./EditorPanelFrame";
import { editorTextStyles } from "../editorTheme";

export function SimulationPanel(props: {
  title: string;
  selectionLabel: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <EditorPanelFrame title="">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <div>
          <div style={editorTextStyles.panelTitle}>{props.title}</div>
          <div style={{ ...editorTextStyles.title, fontSize: 16, fontWeight: 700 }}>{props.selectionLabel}</div>
        </div>
      </div>
      {props.children}
    </EditorPanelFrame>
  );
}
