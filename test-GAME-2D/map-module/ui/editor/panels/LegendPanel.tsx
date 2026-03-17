import React from "react";
import { EditorPanelFrame } from "./EditorPanelFrame";

export function LegendPanel(props: { children: React.ReactNode }): React.JSX.Element {
  return <EditorPanelFrame title="Legende">{props.children}</EditorPanelFrame>;
}
