import React from "react";

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
        <div style={{ fontSize: 12, color: "#8fb3ff", fontWeight: 800, letterSpacing: 0.8 }}>MODE EDITION</div>
        <h3 style={{ margin: "4px 0 0", fontSize: 22 }}>{props.title}</h3>
      </div>
      <div style={{ display: "grid", gap: 2, justifyItems: "end" }}>
        <div style={{ fontSize: 12, color: props.persistenceColor, fontWeight: 800 }}>{props.persistenceLabel}</div>
        <div style={{ fontSize: 12, color: "#8fb3ff", fontWeight: 700 }}>Outil: {props.activeToolLabel}</div>
        <div style={{ fontSize: 12, color: "#c8d0de" }}>{props.activeToolHint}</div>
      </div>
    </div>
  );
}
