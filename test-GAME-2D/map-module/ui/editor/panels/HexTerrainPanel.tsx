import React from "react";
import { EditorPanelFrame } from "./EditorPanelFrame";

export function HexTerrainPanel(props: {
  title: string;
  selectionLabel: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <EditorPanelFrame title="">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#f4c967" }}>{props.title}</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{props.selectionLabel}</div>
        </div>
      </div>
      {props.children}
    </EditorPanelFrame>
  );
}
