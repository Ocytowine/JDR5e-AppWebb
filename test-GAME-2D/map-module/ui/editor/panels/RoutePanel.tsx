import React from "react";
import { EditorPanelFrame } from "./EditorPanelFrame";

export function RoutePanel(props: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <EditorPanelFrame title="Routes">
      {props.children}
    </EditorPanelFrame>
  );
}
