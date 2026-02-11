import React from "react";

export function JsonInfoPanel(props: {
  open: boolean;
  title: string;
  subtitle?: string | null;
  data: unknown;
  onClose: () => void;
}): React.ReactNode {
  if (!props.open) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 12,
        zIndex: 80,
        background: "rgba(7, 9, 12, 0.96)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 12,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        boxShadow: "0 20px 60px rgba(0,0,0,0.65)",
        backdropFilter: "blur(8px)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>{props.title}</div>
          {props.subtitle && (
            <div style={{ marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.65)" }}>
              {props.subtitle}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={props.onClose}
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.85)",
            cursor: "pointer",
            fontWeight: 900
          }}
        >
          X
        </button>
      </div>

      <pre
        style={{
          margin: 0,
          flex: "1 1 auto",
          overflow: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: 11,
          color: "rgba(255,255,255,0.8)",
          background: "#0f0f19",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 8,
          padding: 8
        }}
      >
        {JSON.stringify(props.data, null, 2)}
      </pre>
    </div>
  );
}
