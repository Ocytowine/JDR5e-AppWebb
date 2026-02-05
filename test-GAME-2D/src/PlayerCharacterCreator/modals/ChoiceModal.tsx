import React from "react";

export function ChoiceModal(props: {
  open: boolean;
  title: string;
  options: Array<{ id: string; label: string }>;
  selected: string[];
  count: number;
  multi: boolean;
  onToggle: (id: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}): React.JSX.Element | null {
  const { open, title, options, selected, count, onToggle, onClose, onConfirm } = props;
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
        zIndex: 999
      }}
    >
      <div
        style={{
          width: "min(520px, 92vw)",
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
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
          Choix requis: {count} {count > 1 ? "elements" : "element"}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 8
          }}
        >
          {options.map(option => {
            const isSelected = selected.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onToggle(option.id)}
                style={{
                  textAlign: "left",
                  borderRadius: 8,
                  border: `1px solid ${isSelected ? "#6fd3a8" : "rgba(255,255,255,0.12)"}`,
                  background: isSelected
                    ? "rgba(46, 204, 113, 0.14)"
                    : "rgba(12,12,18,0.75)",
                  color: "#f5f5f5",
                  padding: "8px 10px",
                  cursor: "pointer",
                  fontSize: 12
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
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
            Fermer
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={selected.length < count}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background:
                selected.length < count
                  ? "rgba(80,80,90,0.55)"
                  : "rgba(46, 204, 113, 0.16)",
              color: "#f5f5f5",
              cursor: selected.length < count ? "not-allowed" : "pointer",
              fontSize: 12,
              fontWeight: 700
            }}
          >
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}
