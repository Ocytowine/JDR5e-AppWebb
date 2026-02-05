import React from "react";

export function ConfirmModal(props: {
  open: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}): React.JSX.Element | null {
  const { open, title, message, onCancel, onConfirm } = props;
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 998
      }}
    >
      <div
        style={{
          width: "min(480px, 92vw)",
          background: "#141421",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 12,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{message}</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.06)",
              color: "#f5f5f5",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(231, 76, 60, 0.2)",
              color: "#f5f5f5",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700
            }}
          >
            Continuer
          </button>
        </div>
      </div>
    </div>
  );
}
