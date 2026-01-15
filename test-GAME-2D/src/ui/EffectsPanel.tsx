import React from "react";

export function EffectsPanel(props: {
  showVisionDebug: boolean;
  showLightOverlay: boolean;
  showCellIds: boolean;
  showAllLevels: boolean;
  onShowCircle: () => void;
  onShowRectangle: () => void;
  onShowCone: () => void;
  onToggleVisionDebug: () => void;
  onToggleLightOverlay: () => void;
  onToggleCellIds: () => void;
  onToggleShowAllLevels: () => void;
  onClear: () => void;
}): React.JSX.Element {
  return (
    <section
      style={{
        padding: "8px 12px",
        background: "#141421",
        borderRadius: 8,
        border: "1px solid #333",
        display: "flex",
        flexDirection: "column",
        gap: 8
      }}
    >
      <h2 style={{ margin: "0 0 4px" }}>Zones d&apos;effet (demo)</h2>
      <p style={{ margin: 0, fontSize: 12 }}>
        Ces boutons utilisent les helpers de <code>boardEffects.ts</code> pour dessiner des
        zones en coordonnées de grille autour du joueur.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        <button
          type="button"
          onClick={props.onShowCircle}
          style={{
            padding: "4px 8px",
            background: "#2980b9",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12
          }}
        >
          Cercle R=2
        </button>
        <button
          type="button"
          onClick={props.onShowRectangle}
          style={{
            padding: "4px 8px",
            background: "#27ae60",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12
          }}
        >
          Rectangle 3x3
        </button>
        <button
          type="button"
          onClick={props.onShowCone}
          style={{
            padding: "4px 8px",
            background: "#c0392b",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12
          }}
        >
          Cône portée 4
        </button>
        <button
          type="button"
          onClick={props.onToggleVisionDebug}
          style={{
            padding: "4px 8px",
            background: props.showVisionDebug ? "#f1c40f" : "#555",
            color: "#0b0b12",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12
          }}
        >
          {props.showVisionDebug ? "Masquer vision" : "Afficher vision"}
        </button>
        <button
          type="button"
          onClick={props.onToggleLightOverlay}
          style={{
            padding: "4px 8px",
            background: props.showLightOverlay ? "#f39c12" : "#555",
            color: "#0b0b12",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12
          }}
        >
          {props.showLightOverlay ? "Masquer lumiere" : "Afficher lumiere"}
        </button>
        <button
          type="button"
          onClick={props.onToggleCellIds}
          style={{
            padding: "4px 8px",
            background: props.showCellIds ? "#8e44ad" : "#555",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12
          }}
        >
          {props.showCellIds ? "Masquer IDs" : "Afficher IDs"}
        </button>
        <button
          type="button"
          onClick={props.onToggleShowAllLevels}
          style={{
            padding: "4px 8px",
            background: props.showAllLevels ? "#e67e22" : "#555",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12
          }}
        >
          {props.showAllLevels ? "Masquer tout" : "Voir tout"}
        </button>
        <button
          type="button"
          onClick={props.onClear}
          style={{
            padding: "4px 8px",
            background: "#7f8c8d",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12
          }}
        >
          Effacer zones
        </button>
      </div>
    </section>
  );
}
