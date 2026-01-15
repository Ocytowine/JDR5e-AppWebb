import React from "react";

export function GameOverOverlay(props: { onRestart: () => void }): React.JSX.Element {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000
      }}
    >
      <div
        style={{
          background: "#141421",
          borderRadius: 12,
          border: "1px solid #f1c40f",
          padding: "24px 32px",
          maxWidth: 360,
          textAlign: "center",
          boxShadow: "0 0 24px rgba(0,0,0,0.6)"
        }}
      >
        <h2 style={{ margin: "0 0 8px" }}>Game Over</h2>
        <p style={{ fontSize: 13, margin: "0 0 16px" }}>
          Le héros est tombé et aucun allié n&apos;est en mesure de continuer.
        </p>
        <button
          type="button"
          onClick={props.onRestart}
          style={{
            padding: "6px 12px",
            background: "#e67e22",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600
          }}
        >
          Recommencer le combat
        </button>
      </div>
    </div>
  );
}

