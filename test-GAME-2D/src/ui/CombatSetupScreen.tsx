import React from "react";

export function CombatSetupScreen(props: {
  configEnemyCount: number;
  enemyTypeCount: number;
  gridCols: number;
  gridRows: number;
  mapPrompt: string;
  onChangeMapPrompt: (value: string) => void;
  onChangeEnemyCount: (value: number) => void;
  onStartCombat: () => void;
  onNoEnemyTypes: () => void;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#0b0b12",
        color: "#f5f5f5",
        fontFamily: "system-ui, sans-serif",
        padding: 16,
        boxSizing: "border-box"
      }}
    >
      <h1 style={{ marginBottom: 8 }}>Preparation du combat</h1>
      <p style={{ marginBottom: 16, fontSize: 13, maxWidth: 480, textAlign: "center" }}>
        Configurez le combat avant de lancer la grille : nombre d&apos;ennemis,
        puis demarrez pour effectuer les jets d&apos;initiative et entrer en mode
        tour par tour.
      </p>
      <div
        style={{
          padding: 16,
          borderRadius: 8,
          background: "#141421",
          border: "1px solid #333",
          minWidth: 260,
          display: "flex",
          flexDirection: "column",
          gap: 12
        }}
      >
        <label style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
          Contexte de la battle map :
          <textarea
            value={props.mapPrompt}
            onChange={e => props.onChangeMapPrompt(e.target.value)}
            placeholder="Ex: Un donjon humide: une salle, un couloir, une porte verrouillee, des piliers. Ennemis en embuscade au fond."
            rows={4}
            style={{
              resize: "vertical",
              minHeight: 84,
              background: "#0f0f19",
              color: "#f5f5f5",
              border: "1px solid #333",
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: 12,
              lineHeight: 1.35
            }}
          />
        </label>
        <label style={{ fontSize: 13 }}>
          Nombre d&apos;ennemis :
          <input
            type="number"
            min={1}
            max={8}
            value={props.configEnemyCount}
            onChange={e =>
              props.onChangeEnemyCount(Math.max(1, Math.min(8, Number(e.target.value) || 1)))
            }
            style={{
              marginLeft: 8,
              width: 60,
              background: "#0f0f19",
              color: "#f5f5f5",
              border: "1px solid #333",
              borderRadius: 4,
              padding: "2px 4px"
            }}
          />
        </label>
        <p style={{ fontSize: 11, color: "#b0b8c4", margin: 0 }}>
          Taille de la carte : mode texte utilise ({props.gridCols} x {props.gridRows}).
        </p>
        <button
          type="button"
          onClick={() => {
            if (props.enemyTypeCount === 0) {
              props.onNoEnemyTypes();
              return;
            }
            props.onStartCombat();
          }}
          style={{
            marginTop: 8,
            padding: "6px 12px",
            background: "#2ecc71",
            color: "#0b0b12",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13
          }}
        >
          Lancer le combat
        </button>
      </div>
    </div>
  );
}
