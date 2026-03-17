import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { WORLD_MAP_LAYOUT, type WorldMapLayout } from "../data/worldMapLayout";
import { WorldMapEditorScreen } from "./WorldMapEditorScreen";
import { WorldMapViewerScreen } from "./WorldMapViewerScreen";
import { fetchWorldMapLayout } from "./mapShared";

export function WorldMapScreen(props: {
  onBack: () => void;
}): React.JSX.Element {
  const [mode, setMode] = useState<"viewer" | "editor">("viewer");
  const [layout, setLayout] = useState<WorldMapLayout>(WORLD_MAP_LAYOUT);
  const [layoutLoading, setLayoutLoading] = useState<boolean>(true);
  const [layoutError, setLayoutError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "editor") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mode]);

  useEffect(() => {
    let cancelled = false;
    async function loadLayout() {
      setLayoutLoading(true);
      setLayoutError(null);
      try {
        const nextLayout = await fetchWorldMapLayout();
        if (!cancelled) setLayout(nextLayout);
      } catch (error) {
        if (!cancelled) {
          setLayoutError(error instanceof Error ? error.message : "Chargement carte impossible.");
        }
      } finally {
        if (!cancelled) setLayoutLoading(false);
      }
    }
    void loadLayout();
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
          <div style={{ fontSize: 12, color: layoutError ? "#ff9d76" : "#c8d0de" }}>
            {layoutLoading ? "Chargement carte..." : layoutError ? `Erreur carte: ${layoutError}` : `Carte chargee: ${layout.title}`}
          </div>
        </div>

        <WorldMapViewerScreen layout={layout} onOpenEditor={() => setMode("editor")} />
      </div>

      {mode === "editor" &&
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
              <WorldMapEditorScreen
                initialLayout={layout}
                onCloseEditor={nextLayout => {
                  setLayout(nextLayout);
                  setMode("viewer");
                }}
                onLayoutSaved={nextLayout => setLayout(nextLayout)}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
