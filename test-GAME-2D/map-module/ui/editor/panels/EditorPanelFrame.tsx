import React from "react";

export function EditorPanelFrame(props: {
  title: string;
  titleColor?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section style={{ padding: 14, borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(10,14,22,0.9)", backdropFilter: "blur(10px)" }}>
      {props.title ? (
        <div style={{ fontSize: 12, fontWeight: 800, color: props.titleColor ?? "#8fb3ff", marginBottom: 10 }}>{props.title}</div>
      ) : null}
      {props.children}
    </section>
  );
}
