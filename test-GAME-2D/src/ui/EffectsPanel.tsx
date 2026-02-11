import React, { useEffect, useMemo, useState } from "react";

export function EffectsPanel(props: {
  showVisionDebug: boolean;
  showLightOverlay: boolean;
  showFogSegments: boolean;
  showCellIds: boolean;
  showAllLevels: boolean;
  showTerrainIds: boolean;
  showTerrainContours: boolean;
  shadowLightAngleDeg: number;
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
  onChangeShadowLightAngleDeg: (value: number) => void;
  onChangeBumpIntensity: (value: number) => void;
  onChangeWindSpeed: (value: number) => void;
  onChangeWindStrength: (value: number) => void;
  onToggleBumpDebug: () => void;
  onClear: () => void;
  fxAnimations: Array<{ key: string; frames: string[] }>;
  usageDebug?: Array<{
    actorId: string;
    actorLabel: string;
    actions: Array<{ id: string; label: string; turn: number; combat: number }>;
  }>;
}): React.JSX.Element {
  const [mode, setMode] = useState<"zones" | "animations">("zones");
  const sortedAnimations = useMemo(() => {
    return [...props.fxAnimations].sort((a, b) => a.key.localeCompare(b.key));
  }, [props.fxAnimations]);
  const [selectedKey, setSelectedKey] = useState<string>(
    sortedAnimations[0]?.key ?? ""
  );
  const [frameIndex, setFrameIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(12);

  const selected = sortedAnimations.find(a => a.key === selectedKey) ?? null;
  const frames = selected?.frames ?? [];
  const safeIndex = frames.length > 0 ? Math.max(0, Math.min(frameIndex, frames.length - 1)) : 0;
  const currentFrame = frames[safeIndex] ?? null;

  useEffect(() => {
    if (!selected) return;
    setFrameIndex(0);
    setIsPlaying(false);
  }, [selectedKey]);

  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;
    const interval = Math.max(40, Math.round(1000 / Math.max(1, fps)));
    const timer = window.setInterval(() => {
      setFrameIndex(prev => (prev + 1) % frames.length);
    }, interval);
    return () => window.clearInterval(timer);
  }, [isPlaying, frames.length, fps]);

  return (
    <section
      style={{
        padding: "8px 12px",
        background: "#141421",
        borderRadius: 8,
        border: "1px solid #333",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxHeight: "100%",
        overflowY: "auto"
      }}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setMode("zones")}
          style={{
            padding: "4px 8px",
            background: mode === "zones" ? "#2ecc71" : "#555",
            color: mode === "zones" ? "#0b0b12" : "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 800
          }}
        >
          Zones
        </button>
        <button
          type="button"
          onClick={() => setMode("animations")}
          style={{
            padding: "4px 8px",
            background: mode === "animations" ? "#f1c40f" : "#555",
            color: mode === "animations" ? "#0b0b12" : "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 800
          }}
        >
          Animations
        </button>
      </div>

      {mode === "zones" && (
        <>
          <h2 style={{ margin: "6px 0 4px" }}>Zones d&apos;effet (demo)</h2>
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
                Lumiere angle: {Math.round(props.shadowLightAngleDeg)}°
              </label>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={props.shadowLightAngleDeg}
                onChange={event => props.onChangeShadowLightAngleDeg(Number(event.target.value))}
              />
            </div>
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
          {props.usageDebug && props.usageDebug.length > 0 && (
            <div
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTop: "1px solid rgba(255,255,255,0.08)"
              }}
            >
              <h3 style={{ margin: "0 0 6px", fontSize: 13 }}>Usage actions (debug)</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {props.usageDebug.map(actor => (
                  <div key={actor.actorId} style={{ fontSize: 12 }}>
                    <strong>{actor.actorLabel}</strong>
                    {actor.actions.length === 0 ? (
                      <div style={{ color: "#9aa0b5" }}>Aucun usage</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {actor.actions.map(action => (
                          <div key={`${actor.actorId}-${action.id}`}>
                            <code>{action.label}</code>{" "}
                            <span style={{ color: "#9aa0b5" }}>
                              (turn: {action.turn}, combat: {action.combat})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {mode === "animations" && (
        <>
          <h2 style={{ margin: "6px 0 4px" }}>Animations (FX)</h2>
          <p style={{ margin: 0, fontSize: 12 }}>
            Liste des animations chargées. Lecture ou frame par frame.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            <label style={{ fontSize: 11, color: "#bfc6d2" }}>
              Animation
              <select
                value={selectedKey}
                onChange={event => setSelectedKey(event.target.value)}
                style={{ marginLeft: 8, padding: "4px 6px", fontSize: 12 }}
              >
                {sortedAnimations.length === 0 && (
                  <option value="">Aucune animation</option>
                )}
                {sortedAnimations.map(anim => (
                  <option key={anim.key} value={anim.key}>
                    {anim.key}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setIsPlaying(prev => !prev)}
                disabled={frames.length === 0}
                style={{
                  padding: "4px 8px",
                  background: isPlaying ? "#e67e22" : "#2ecc71",
                  color: "#0b0b12",
                  border: "none",
                  borderRadius: 4,
                  cursor: frames.length === 0 ? "not-allowed" : "pointer",
                  fontSize: 12,
                  fontWeight: 800
                }}
              >
                {isPlaying ? "Pause" : "Lecture"}
              </button>
              <button
                type="button"
                onClick={() => setFrameIndex(prev => Math.max(0, prev - 1))}
                disabled={frames.length === 0}
                style={{
                  padding: "4px 8px",
                  background: "#555",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: frames.length === 0 ? "not-allowed" : "pointer",
                  fontSize: 12
                }}
              >
                Frame -
              </button>
              <button
                type="button"
                onClick={() => setFrameIndex(prev => Math.min(frames.length - 1, prev + 1))}
                disabled={frames.length === 0}
                style={{
                  padding: "4px 8px",
                  background: "#555",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: frames.length === 0 ? "not-allowed" : "pointer",
                  fontSize: 12
                }}
              >
                Frame +
              </button>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 140 }}>
                <label style={{ fontSize: 11, color: "#bfc6d2" }}>
                  FPS: {fps}
                </label>
                <input
                  type="range"
                  min="1"
                  max="30"
                  step="1"
                  value={fps}
                  onChange={event => setFps(Number(event.target.value))}
                />
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#bfc6d2" }}>
              {frames.length > 0
                ? `Frame ${safeIndex + 1} / ${frames.length}`
                : "Aucune frame"}
            </div>
            <div
              style={{
                width: "100%",
                minHeight: 180,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                padding: 8
              }}
            >
              {currentFrame ? (
                <img
                  src={currentFrame}
                  alt={selectedKey}
                  style={{ maxWidth: "100%", maxHeight: 240, imageRendering: "pixelated" }}
                />
              ) : (
                <span style={{ fontSize: 12, color: "#bfc6d2" }}>
                  Sélectionnez une animation
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
