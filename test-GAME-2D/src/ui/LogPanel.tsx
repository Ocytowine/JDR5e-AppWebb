import React from "react";

export function LogPanel(props: { log: string[] }): React.JSX.Element {
  return (
    <section
      style={{
        padding: "8px 12px",
        background: "#141421",
        borderRadius: 8,
        border: "1px solid #333",
        flex: "1 1 auto",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "100%",
        minHeight: 0
      }}
    >
      <h2 style={{ margin: "0 0 8px" }}>Log</h2>
      <div
        style={{
          flex: "1 1 auto",
          overflowY: "auto",
          fontSize: 12,
          lineHeight: 1.4,
          minHeight: 0
        }}
      >
        {props.log.map((line, idx) => (
          <div key={idx}>- {line}</div>
        ))}
      </div>
    </section>
  );
}

