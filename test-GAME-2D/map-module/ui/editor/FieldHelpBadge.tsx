import React from "react";

export function FieldHelpBadge(props: {
  label: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={props.label}
      aria-label={props.label}
      style={{
        width: 18,
        height: 18,
        padding: 0,
        borderRadius: 999,
        border: "1px solid rgba(143,179,255,0.35)",
        background: "rgba(143,179,255,0.16)",
        color: "#eef3ff",
        fontSize: 11,
        fontWeight: 800,
        cursor: "help",
        lineHeight: 1
      }}
    >
      ?
    </button>
  );
}
