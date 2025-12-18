import React from "react";

export function NarrationPanel(props: {
  round: number;
  narrativeLog: string[];
}): React.JSX.Element {
  return (
    <div
      style={{
        padding: "10px 12px",
        background:
          "linear-gradient(180deg, rgba(38, 28, 16, 0.92), rgba(16, 12, 8, 0.92))",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 16px 50px rgba(0,0,0,0.45)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        maxWidth: "100%",
        height: 170,
        fontFamily:
          "\"Iowan Old Style\", \"Palatino Linotype\", Palatino, Garamond, \"Times New Roman\", serif"
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
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.82)", fontWeight: 700 }}>
          Chronique du tour
        </span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
          Round {props.round}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto",
          paddingRight: 4
        }}
      >
        {props.narrativeLog.length === 0 && (
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
            En attente d&apos;actions pour raconter le tour...
          </span>
        )}
        {props.narrativeLog.slice(0, 20).map((line, idx) => (
          <span key={idx} style={{ fontSize: 13, color: "rgba(255,255,255,0.88)" }}>
            — {line}
          </span>
        ))}
      </div>
    </div>
  );
}
