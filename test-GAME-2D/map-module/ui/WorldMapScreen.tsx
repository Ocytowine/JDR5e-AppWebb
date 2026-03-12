import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { WorldMapEditorScreen } from "./WorldMapEditorScreen";
import { WorldMapViewerScreen } from "./WorldMapViewerScreen";

export function WorldMapScreen(props: {
  onBack: () => void;
}): React.JSX.Element {
  const [mode, setMode] = useState<"viewer" | "editor">("viewer");

  useEffect(() => {
    if (mode !== "editor") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mode]);

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
        </div>

        <WorldMapViewerScreen onOpenEditor={() => setMode("editor")} />
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
              <WorldMapEditorScreen onCloseEditor={() => setMode("viewer")} />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
