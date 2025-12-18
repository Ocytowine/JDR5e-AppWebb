import React from "react";

export function CombatSetupScreen(props: {
  configEnemyCount: number;
  enemyTypeCount: number;
  gridCols: number;
  gridRows: number;
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
      <h1 style={{ marginBottom: 8 }}>Préparation du combat</h1>
      <p style={{ marginBottom: 16, fontSize: 13, maxWidth: 480, textAlign: "center" }}>
        Configurez le combat avant de lancer la grille : nombre d&apos;ennemis,
        puis démarrez pour effectuer les jets d&apos;initiative et entrer en mode
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
          Taille de la carte : actuellement fixe ({props.gridCols} x {props.gridRows}). Un
          redimensionnement dynamique demandera une refonte de boardConfig.ts.
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

