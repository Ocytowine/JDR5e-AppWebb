import React from "react";
import { EditorPanelFrame } from "./EditorPanelFrame";

export function LayerPanel(props: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <EditorPanelFrame title="Couches">
      {props.children}
    </EditorPanelFrame>
  );
}
