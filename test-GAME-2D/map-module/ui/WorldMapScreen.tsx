import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { WORLD_MAP_LAYOUT, type WorldMapLayout } from "../data/worldMapLayout";
import { WorldMapEditorScreen } from "./WorldMapEditorScreen";
import { WorldMapSimulationScreen } from "./WorldMapSimulationScreen";
import { WorldMapViewerScreen } from "./WorldMapViewerScreen";
import {
  deleteWorldMapLayout,
  duplicateWorldMapLayout,
  fetchWorldMapLayout,
  fetchWorldMapLayouts,
  renameWorldMapLayout,
  type MapLayoutDescriptor
} from "./mapShared";

export function WorldMapScreen(props: {
  onBack: () => void;
}): React.JSX.Element {
  const [mode, setMode] = useState<"viewer" | "editor" | "simulation">("viewer");
  const [layout, setLayout] = useState<WorldMapLayout>(WORLD_MAP_LAYOUT);
  const [layoutKey, setLayoutKey] = useState<string>("default");
  const [layoutCatalog, setLayoutCatalog] = useState<MapLayoutDescriptor[]>([]);
  const [layoutLoading, setLayoutLoading] = useState<boolean>(true);
  const [layoutError, setLayoutError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "editor" && mode !== "simulation") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mode]);

  async function loadLayoutCatalog(): Promise<MapLayoutDescriptor[]> {
    const layouts = await fetchWorldMapLayouts();
    setLayoutCatalog(layouts);
    return layouts;
  }

  async function loadLayout(selectedKey: string): Promise<void> {
    setLayoutLoading(true);
    setLayoutError(null);
    try {
      const nextLayout = await fetchWorldMapLayout(selectedKey);
      setLayout(nextLayout);
      setLayoutKey(selectedKey);
    } catch (error) {
      setLayoutError(error instanceof Error ? error.message : "Chargement carte impossible.");
    } finally {
      setLayoutLoading(false);
    }
  }

  async function duplicateCurrentLayout(): Promise<void> {
    const nextKey = window.prompt("Nouvelle cle technique pour la copie", `${layoutKey}-copy`);
    if (!nextKey) return;
    setLayoutLoading(true);
    setLayoutError(null);
    try {
      const nextLayout = await duplicateWorldMapLayout(layoutKey, nextKey);
      const layouts = await loadLayoutCatalog();
      setLayout(nextLayout);
      setLayoutKey(layouts.find(entry => entry.key === nextKey)?.key ?? nextKey);
    } catch (error) {
      setLayoutError(error instanceof Error ? error.message : "Duplication carte impossible.");
    } finally {
      setLayoutLoading(false);
    }
  }

  async function renameCurrentLayout(): Promise<void> {
    if (layoutKey === "default") {
      setLayoutError("La carte par defaut ne peut pas etre renommee.");
      return;
    }
    const nextKey = window.prompt("Nouvelle cle technique pour cette carte", layoutKey);
    if (!nextKey || nextKey === layoutKey) return;
    setLayoutLoading(true);
    setLayoutError(null);
    try {
      const nextLayout = await renameWorldMapLayout(layoutKey, nextKey);
      const layouts = await loadLayoutCatalog();
      setLayout(nextLayout);
      setLayoutKey(layouts.find(entry => entry.key === nextKey)?.key ?? nextKey);
    } catch (error) {
      setLayoutError(error instanceof Error ? error.message : "Renommage carte impossible.");
    } finally {
      setLayoutLoading(false);
    }
  }

  async function deleteCurrentLayout(): Promise<void> {
    if (layoutKey === "default") {
      setLayoutError("La carte par defaut ne peut pas etre supprimee.");
      return;
    }
    const confirmed = window.confirm(`Supprimer la carte "${layout.title}" ?`);
    if (!confirmed) return;
    setLayoutLoading(true);
    setLayoutError(null);
    try {
      await deleteWorldMapLayout(layoutKey);
      const layouts = await loadLayoutCatalog();
      const fallbackKey = layouts.find(entry => entry.key === "default")?.key ?? layouts[0]?.key ?? "default";
      const nextLayout = await fetchWorldMapLayout(fallbackKey);
      setLayout(nextLayout);
      setLayoutKey(fallbackKey);
      setMode("viewer");
    } catch (error) {
      setLayoutError(error instanceof Error ? error.message : "Suppression carte impossible.");
    } finally {
      setLayoutLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadInitialData() {
      try {
        const layouts = await fetchWorldMapLayouts();
        const initialKey = layouts.find(entry => entry.key === "default")?.key ?? layouts[0]?.key ?? "default";
        if (cancelled) return;
        setLayoutCatalog(layouts);
        const nextLayout = await fetchWorldMapLayout(initialKey);
        if (cancelled) return;
        setLayout(nextLayout);
        setLayoutKey(initialKey);
      } catch (error) {
        if (cancelled) return;
        setLayoutError(error instanceof Error ? error.message : "Chargement carte impossible.");
      }
      if (!cancelled) setLayoutLoading(false);
    }
    void loadInitialData();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={props.onBack}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "#f5f5f5",
              cursor: "pointer",
              fontWeight: 700
            }}
          >
            Retour combat
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#c8d0de" }}>
              Carte
              <select
                value={layoutKey}
                onChange={event => void loadLayout(event.target.value)}
                disabled={layoutLoading || layoutCatalog.length === 0}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#f5f5f5"
                }}
              >
                {layoutCatalog.map(entry => (
                  <option key={entry.key} value={entry.key}>
                    {entry.isDefault ? `${entry.title} (defaut)` : entry.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void loadLayoutCatalog()}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                color: "#f5f5f5",
                cursor: "pointer",
                fontWeight: 700
              }}
            >
              Rafraichir liste
            </button>
            <button
              type="button"
              onClick={() => void duplicateCurrentLayout()}
              disabled={layoutLoading}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                color: "#f5f5f5",
                cursor: layoutLoading ? "wait" : "pointer",
                fontWeight: 700,
                opacity: layoutLoading ? 0.7 : 1
              }}
            >
              Dupliquer
            </button>
            <button
              type="button"
              onClick={() => void renameCurrentLayout()}
              disabled={layoutLoading || layoutKey === "default"}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                color: "#f5f5f5",
                cursor: layoutLoading || layoutKey === "default" ? "not-allowed" : "pointer",
                fontWeight: 700,
                opacity: layoutLoading || layoutKey === "default" ? 0.5 : 1
              }}
            >
              Renommer
            </button>
            <button
              type="button"
              onClick={() => void deleteCurrentLayout()}
              disabled={layoutLoading || layoutKey === "default"}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,157,118,0.14)",
                color: "#f5f5f5",
                cursor: layoutLoading || layoutKey === "default" ? "not-allowed" : "pointer",
                fontWeight: 700,
                opacity: layoutLoading || layoutKey === "default" ? 0.5 : 1
              }}
            >
              Supprimer
            </button>
            <div style={{ fontSize: 12, color: layoutError ? "#ff9d76" : "#c8d0de" }}>
              {layoutLoading ? "Chargement carte..." : layoutError ? `Erreur carte: ${layoutError}` : `Carte chargee: ${layout.title}`}
            </div>
          </div>
        </div>

        {mode === "viewer" && (
          <WorldMapViewerScreen layout={layout} onOpenEditor={() => setMode("editor")} onOpenSimulation={() => setMode("simulation")} />
        )}
      </div>

      {(mode === "editor" || mode === "simulation") &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "linear-gradient(180deg, #050811 0%, #08101b 100%)",
              padding: 16,
              boxSizing: "border-box",
              overflow: "hidden"
            }}
          >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column"
                }}
              >
                {mode === "editor" ? (
                  <WorldMapEditorScreen
                    initialLayout={layout}
                    layoutStorageKey={layoutKey}
                    onRefreshLayoutCatalog={() => void loadLayoutCatalog()}
                    onCloseEditor={(nextLayout, nextLayoutKey) => {
                      setLayout(nextLayout);
                      if (nextLayoutKey) setLayoutKey(nextLayoutKey);
                      setMode("viewer");
                    }}
                    onLayoutSaved={(nextLayout, nextLayoutKey) => {
                      setLayout(nextLayout);
                      if (nextLayoutKey) setLayoutKey(nextLayoutKey);
                      void loadLayoutCatalog();
                    }}
                  />
                ) : (
                  <WorldMapSimulationScreen
                    layout={layout}
                    onOpenEditor={() => setMode("editor")}
                    onCloseSimulation={() => setMode("viewer")}
                  />
                )}
              </div>
          </div>,
          document.body
        )}
    </>
  );
}
