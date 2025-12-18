import React from "react";

export function NarrationPanel(props: {
  round: number;
  narrativeLog: string[];
}): React.JSX.Element {
  return (
    <div
      style={{
        marginBottom: 8,
        padding: "6px 10px",
        background: "#111322",
        borderRadius: 8,
        border: "1px solid #333",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        maxWidth: "100%"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4
        }}
      >
        <span style={{ fontSize: 12, color: "#b0b8c4" }}>Narration du tour</span>
        <span style={{ fontSize: 11, color: "#9aa0b5" }}>Round {props.round}</span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          maxHeight: 80,
          overflowY: "auto"
        }}
      >
        {props.narrativeLog.length === 0 && (
          <span style={{ fontSize: 11, color: "#7f8694" }}>
            En attente d&apos;actions pour raconter le tour...
          </span>
        )}
        {props.narrativeLog.slice(0, 6).map((line, idx) => (
          <span key={idx} style={{ fontSize: 11, color: "#e0e4ff" }}>
            - {line}
          </span>
        ))}
      </div>
    </div>
  );
}

