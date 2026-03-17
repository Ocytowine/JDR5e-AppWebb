import React from "react";

export function CollapsibleSection(props: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <details
      open={props.defaultOpen}
      style={{
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(255,255,255,0.04)"
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          padding: "10px 12px",
          fontSize: 12,
          fontWeight: 800,
          color: "#8fb3ff",
          userSelect: "none"
        }}
      >
        {props.title}
      </summary>
      <div style={{ display: "grid", gap: 8, padding: "0 10px 10px" }}>{props.children}</div>
    </details>
  );
}
