import React from "react";
import { editorSurfaceStyles, editorTextStyles } from "../editorTheme";

export function EditorPanelFrame(props: {
  title: string;
  titleColor?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section style={editorSurfaceStyles.panel}>
      {props.title ? (
        <div style={{ ...editorTextStyles.sectionTitle, color: props.titleColor ?? editorTextStyles.sectionTitle.color, marginBottom: 10 }}>{props.title}</div>
      ) : null}
      {props.children}
    </section>
  );
}
