import React from "react";

export function EffectsPanel(props: {
  showVisionDebug: boolean;
  showLightOverlay: boolean;
  showFogSegments: boolean;
  showCellIds: boolean;
  showAllLevels: boolean;
  showTerrainIds: boolean;
  showTerrainContours: boolean;
  bumpIntensity: number;
  windSpeed: number;
  windStrength: number;
  bumpDebug: boolean;
  visionLegend?: string;
  onShowCircle: () => void;
  onShowRectangle: () => void;
  onShowCone: () => void;
  onToggleVisionDebug: () => void;
  onToggleLightOverlay: () => void;
  onToggleFogSegments: () => void;
  onToggleCellIds: () => void;
  onToggleShowAllLevels: () => void;
  onToggleTerrainIds: () => void;
  onToggleTerrainContours: () => void;
  onChangeBumpIntensity: (value: number) => void;
  onChangeWindSpeed: (value: number) => void;
  onChangeWindStrength: (value: number) => void;
  onToggleBumpDebug: () => void;
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
      {props.visionLegend ? (
        <p style={{ margin: 0, fontSize: 12, color: "#bfc6d2" }}>
          {props.visionLegend}
        </p>
      ) : null}
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
          onClick={props.onToggleFogSegments}
          style={{
            padding: "4px 8px",
            background: props.showFogSegments ? "#ecf0f1" : "#555",
            color: props.showFogSegments ? "#111" : "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12
          }}
        >
          {props.showFogSegments ? "Masquer segments fog" : "Tracer segments fog"}
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
          onClick={props.onToggleTerrainIds}
          style={{
            padding: "4px 8px",
            background: props.showTerrainIds ? "#16a085" : "#555",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12
          }}
        >
          {props.showTerrainIds ? "Masquer sol IDs" : "Afficher sol IDs"}
        </button>
        <button
          type="button"
          onClick={props.onToggleTerrainContours}
          style={{
            padding: "4px 8px",
            background: props.showTerrainContours ? "#1abc9c" : "#555",
            color: "#0b0b12",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12
          }}
        >
          {props.showTerrainContours ? "Masquer contours sol" : "Afficher contours sol"}
        </button>
        <button
          type="button"
          onClick={props.onToggleBumpDebug}
          style={{
            padding: "4px 8px",
            background: props.bumpDebug ? "#f1c40f" : "#555",
            color: "#0b0b12",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12
          }}
        >
          {props.bumpDebug ? "Masquer bump debug" : "Afficher bump debug"}
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 180 }}>
          <label style={{ fontSize: 11, color: "#bfc6d2" }}>
            Bump: {props.bumpIntensity.toFixed(2)}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={props.bumpIntensity}
            onChange={event => props.onChangeBumpIntensity(Number(event.target.value))}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 180 }}>
          <label style={{ fontSize: 11, color: "#bfc6d2" }}>
            Vent vitesse: {props.windSpeed.toFixed(2)}
          </label>
          <input
            type="range"
            min="0"
            max="0.2"
            step="0.01"
            value={props.windSpeed}
            onChange={event => props.onChangeWindSpeed(Number(event.target.value))}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 180 }}>
          <label style={{ fontSize: 11, color: "#bfc6d2" }}>
            Vent force: {props.windStrength.toFixed(2)}
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={props.windStrength}
            onChange={event => props.onChangeWindStrength(Number(event.target.value))}
          />
        </div>
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
