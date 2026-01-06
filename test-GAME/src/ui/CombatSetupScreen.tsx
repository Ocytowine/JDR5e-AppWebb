import React from "react";
import type { ObstacleTypeDefinition } from "../game/obstacleTypes";
import type { ManualMapConfig } from "../game/map/types";
import type { ManualMapPreset } from "../game/map/presets";
import { getObstacleSvgDataUrl } from "../svgObstacleHelper";
import { loadMapPatternsFromIndex } from "../game/mapPatternCatalog";

export function CombatSetupScreen(props: {
  mode: "prompt" | "manual";
  manualConfig: ManualMapConfig;
  manualPresets: ManualMapPreset[];
  obstacleTypes: ObstacleTypeDefinition[];
  onChangeMode: (mode: "prompt" | "manual") => void;
  onChangeManualConfig: (config: ManualMapConfig) => void;
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
  const obstacleList = props.obstacleTypes.filter(
    t => t.appearance?.spriteKey && t.category !== "wall"
  );
  const patternList = loadMapPatternsFromIndex();
  const activePreset =
    props.manualPresets.find(p => p.id === props.manualConfig.presetId) ??
    props.manualPresets[0];

  function updateManualConfig(next: Partial<ManualMapConfig>) {
    props.onChangeManualConfig({
      ...props.manualConfig,
      ...next
    });
  }

  function updateManualOptions(next: Partial<ManualMapConfig["options"]>) {
    props.onChangeManualConfig({
      ...props.manualConfig,
      options: {
        ...props.manualConfig.options,
        ...next
      }
    });
  }

  function updateBorderMask(side: "north" | "south" | "west" | "east", value: boolean) {
    props.onChangeManualConfig({
      ...props.manualConfig,
      options: {
        ...props.manualConfig.options,
        borderMask: {
          ...props.manualConfig.options.borderMask,
          [side]: value
        }
      }
    });
  }

  function getCountForType(typeId: string): number {
    const entry = props.manualConfig.obstacles.find(o => o.typeId === typeId);
    return entry ? entry.count : 0;
  }

  function updateCount(typeId: string, count: number) {
    const next = obstacleList.map(t => ({
      typeId: t.id,
      count: t.id === typeId ? count : getCountForType(t.id)
    }));
    props.onChangeManualConfig({
      ...props.manualConfig,
      obstacles: next
    });
  }

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
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => props.onChangeMode("prompt")}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #333",
              background: props.mode === "prompt" ? "#2d7dd2" : "#1b1b2a",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 12
            }}
          >
            Mode texte
          </button>
          <button
            type="button"
            onClick={() => props.onChangeMode("manual")}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #333",
              background: props.mode === "manual" ? "#2d7dd2" : "#1b1b2a",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 12
            }}
          >
            Mode manuel
          </button>
        </div>

        {props.mode === "prompt" ? (
        <label style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
          Contexte de la battle map :
          <textarea
            value={props.mapPrompt}
            onChange={e => props.onChangeMapPrompt(e.target.value)}
            placeholder="Ex: Un donjon humide: une salle, un couloir, une porte verrouillée, des piliers. Ennemis en embuscade au fond."
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
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
              Preset :
              <select
                value={props.manualConfig.presetId}
                onChange={e => {
                  const preset = props.manualPresets.find(p => p.id === e.target.value) ?? activePreset;
                  props.onChangeManualConfig({
                    ...props.manualConfig,
                    presetId: preset.id,
                    grid: { ...preset.grid },
                    options: { ...preset.options }
                  });
                }}
                style={{
                  background: "#0f0f19",
                  color: "#f5f5f5",
                  border: "1px solid #333",
                  borderRadius: 6,
                  padding: "6px 8px",
                  fontSize: 12
                }}
              >
                {props.manualPresets.map(preset => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 13 }}>Taille map :</span>
              <input
                type="number"
                min={6}
                max={60}
                value={props.manualConfig.grid.cols}
                onChange={e =>
                  updateManualConfig({
                    grid: {
                      ...props.manualConfig.grid,
                      cols: Math.max(1, Number(e.target.value) || 1)
                    }
                  })
                }
                style={{
                  width: 60,
                  background: "#0f0f19",
                  color: "#f5f5f5",
                  border: "1px solid #333",
                  borderRadius: 4,
                  padding: "2px 4px"
                }}
              />
              <span style={{ fontSize: 12 }}>x</span>
              <input
                type="number"
                min={6}
                max={60}
                value={props.manualConfig.grid.rows}
                onChange={e =>
                  updateManualConfig({
                    grid: {
                      ...props.manualConfig.grid,
                      rows: Math.max(1, Number(e.target.value) || 1)
                    }
                  })
                }
                style={{
                  width: 60,
                  background: "#0f0f19",
                  color: "#f5f5f5",
                  border: "1px solid #333",
                  borderRadius: 4,
                  padding: "2px 4px"
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label style={{ fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={props.manualConfig.options.walls}
                  onChange={e => updateManualOptions({ walls: e.target.checked })}
                  style={{ marginRight: 6 }}
                />
                Murs (placeholder)
              </label>
              <label style={{ fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={props.manualConfig.options.corridors}
                  onChange={e => updateManualOptions({ corridors: e.target.checked })}
                  style={{ marginRight: 6 }}
                />
                Couloirs (placeholder)
              </label>
              <label style={{ fontSize: 12 }}>
                Densite (placeholder)
                <select
                  value={props.manualConfig.options.density}
                  onChange={e =>
                    updateManualOptions({ density: e.target.value as ManualMapConfig["options"]["density"] })
                  }
                  style={{
                    marginLeft: 8,
                    background: "#0f0f19",
                    color: "#f5f5f5",
                    border: "1px solid #333",
                    borderRadius: 4,
                    padding: "2px 4px"
                  }}
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </label>
              <label style={{ fontSize: 12 }}>
                Entrees (placeholder)
                <input
                  type="number"
                  min={0}
                  max={6}
                  value={props.manualConfig.options.entrances}
                  onChange={e => updateManualOptions({ entrances: Number(e.target.value) || 0 })}
                  style={{
                    marginLeft: 8,
                    width: 50,
                    background: "#0f0f19",
                    color: "#f5f5f5",
                    border: "1px solid #333",
                    borderRadius: 4,
                    padding: "2px 4px"
                  }}
                />
              </label>
              <label style={{ fontSize: 12 }}>
                Lumiere (placeholder)
                <select
                  value={props.manualConfig.options.lighting}
                  onChange={e =>
                    updateManualOptions({ lighting: e.target.value as ManualMapConfig["options"]["lighting"] })
                  }
                  style={{
                    marginLeft: 8,
                    background: "#0f0f19",
                    color: "#f5f5f5",
                    border: "1px solid #333",
                    borderRadius: 4,
                    padding: "2px 4px"
                  }}
                >
                  <option value="low">low</option>
                  <option value="normal">normal</option>
                  <option value="bright">bright</option>
                </select>
              </label>
              <label style={{ fontSize: 12 }}>
                Theme (placeholder)
                <select
                  value={props.manualConfig.options.theme}
                  onChange={e =>
                    updateManualOptions({ theme: e.target.value as ManualMapConfig["options"]["theme"] })
                  }
                  style={{
                    marginLeft: 8,
                    background: "#0f0f19",
                    color: "#f5f5f5",
                    border: "1px solid #333",
                    borderRadius: 4,
                    padding: "2px 4px"
                  }}
                >
                  <option value="generic">generic</option>
                  <option value="dungeon">dungeon</option>
                  <option value="forest">forest</option>
                  <option value="city">city</option>
                </select>
              </label>
            </div>

            <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              Patterns (multi-selection)
              <select
                multiple
                value={props.manualConfig.options.patterns ?? []}
                onChange={e => {
                  const selected = Array.from(e.currentTarget.selectedOptions).map(o => o.value);
                  updateManualOptions({ patterns: selected });
                }}
                style={{
                  minHeight: 90,
                  background: "#0f0f19",
                  color: "#f5f5f5",
                  border: "1px solid #333",
                  borderRadius: 6,
                  padding: "6px 8px",
                  fontSize: 12
                }}
              >
                {patternList.map(pattern => (
                  <option key={pattern.id} value={pattern.id}>
                    {pattern.label} ({pattern.theme})
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 12, minWidth: 72 }}>Bordures:</span>
              <label style={{ fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={props.manualConfig.options.borderMask.north}
                  onChange={e => updateBorderMask("north", e.target.checked)}
                  style={{ marginRight: 4 }}
                />
                Nord
              </label>
              <label style={{ fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={props.manualConfig.options.borderMask.south}
                  onChange={e => updateBorderMask("south", e.target.checked)}
                  style={{ marginRight: 4 }}
                />
                Sud
              </label>
              <label style={{ fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={props.manualConfig.options.borderMask.west}
                  onChange={e => updateBorderMask("west", e.target.checked)}
                  style={{ marginRight: 4 }}
                />
                Ouest
              </label>
              <label style={{ fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={props.manualConfig.options.borderMask.east}
                  onChange={e => updateBorderMask("east", e.target.checked)}
                  style={{ marginRight: 4 }}
                />
                Est
              </label>
            </div>

            <div style={{ fontSize: 12, color: "#b0b8c4" }}>
              Parametres avances: stockes mais non appliques pour l'instant.
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Obstacles (compte exact)</div>
              <div
                style={{
                  maxHeight: 200,
                  overflowY: "auto",
                  border: "1px solid #333",
                  borderRadius: 6,
                  padding: 8,
                  background: "#0f0f19",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6
                }}
              >
                {obstacleList.map(type => (
                  <div
                    key={type.id}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div
                      aria-hidden="true"
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 4,
                        background: "#141421",
                        border: "1px solid #2b2b3a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flex: "0 0 auto"
                      }}
                    >
                      {getObstacleSvgDataUrl(type.appearance?.spriteKey) ? (
                        <img
                          src={getObstacleSvgDataUrl(type.appearance?.spriteKey) as string}
                          alt=""
                          width={18}
                          height={18}
                          style={{ display: "block" }}
                        />
                      ) : (
                        <span style={{ fontSize: 10, color: "#9aa3b2" }}>
                          {type.label?.slice(0, 1) ?? "?"}
                        </span>
                      )}
                    </div>
                    <div style={{ flex: "1 1 auto", fontSize: 12 }}>
                      {type.label} ({type.id})
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={getCountForType(type.id)}
                      onChange={e =>
                        updateCount(type.id, Math.max(0, Number(e.target.value) || 0))
                      }
                      style={{
                        width: 60,
                        background: "#0b0b12",
                        color: "#f5f5f5",
                        border: "1px solid #333",
                        borderRadius: 4,
                        padding: "2px 4px"
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
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
          Mode manuel permet de forcer une taille.
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
