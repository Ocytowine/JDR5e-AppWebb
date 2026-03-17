import React from "react";
import { EditorPanelFrame } from "./EditorPanelFrame";

export function DataPanel(props: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <EditorPanelFrame title="JSON">
      {props.children}
    </EditorPanelFrame>
  );
}
