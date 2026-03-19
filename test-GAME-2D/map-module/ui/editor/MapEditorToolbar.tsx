import React, { useEffect, useRef, useState } from "react";
import { EDITOR_THEME, createEditorButtonStyle } from "./editorTheme";

type PanelId = "legend" | "layers" | "json";
type EditorToolId = "inspect" | "terrain" | "places" | "zones" | "routes";

export function MapEditorToolbar(props: {
  panelLabels: Record<PanelId, string>;
  panelIds: PanelId[];
  openPanels: Record<PanelId, boolean>;
  activeTool: EditorToolId;
  canUndo: boolean;
  canRedo: boolean;
  onCloseEditor: () => void;
  onTogglePanel: (panelId: PanelId) => void;
  onSelectTool: (toolId: EditorToolId) => void;
  onUndo: () => void;
  onRedo: () => void;
}): React.JSX.Element {
  const [panelMenuOpen, setPanelMenuOpen] = useState(false);
  const panelMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent): void {
      if (!panelMenuRef.current?.contains(event.target as Node)) {
        setPanelMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        zIndex: 5,
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        justifyContent: "flex-end"
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          padding: 8,
          borderRadius: 12,
          border: `1px solid ${EDITOR_THEME.colors.border}`,
          background: EDITOR_THEME.colors.panelBg
        }}
      >
        {([
          { id: "inspect", label: "Main" },
          { id: "terrain", label: "Terrain" },
          { id: "places", label: "Lieux" },
          { id: "zones", label: "Organisation" },
          { id: "routes", label: "Trace" }
        ] as Array<{ id: EditorToolId; label: string }>).map(tool => (
          <button
            key={tool.id}
            type="button"
            onClick={() => props.onSelectTool(tool.id)}
            style={{
              ...createEditorButtonStyle({ active: props.activeTool === tool.id, compact: true }),
              borderRadius: 8
            }}
          >
            {tool.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={props.onUndo}
        disabled={!props.canUndo}
        style={{ ...createEditorButtonStyle(), cursor: props.canUndo ? "pointer" : "not-allowed", opacity: props.canUndo ? 1 : 0.45 }}
      >
        Undo
      </button>
      <button
        type="button"
        onClick={props.onRedo}
        disabled={!props.canRedo}
        style={{ ...createEditorButtonStyle(), cursor: props.canRedo ? "pointer" : "not-allowed", opacity: props.canRedo ? 1 : 0.45 }}
      >
        Redo
      </button>
      <button
        type="button"
        onClick={props.onCloseEditor}
        style={createEditorButtonStyle()}
      >
        Retour carte
      </button>
      <div ref={panelMenuRef} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setPanelMenuOpen(current => !current)}
          style={createEditorButtonStyle({ active: panelMenuOpen })}
        >
          Panneaux
        </button>
        {panelMenuOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              minWidth: 180,
              display: "grid",
              gap: 8,
              padding: 10,
              borderRadius: 12,
              border: `1px solid ${EDITOR_THEME.colors.border}`,
              background: EDITOR_THEME.colors.panelBgRaised,
              boxShadow: "0 12px 32px rgba(0,0,0,0.35)"
            }}
          >
            {props.panelIds.map(panelId => (
              <label key={panelId} style={{ display: "flex", alignItems: "center", gap: 8, color: EDITOR_THEME.colors.text, fontSize: 13, fontFamily: EDITOR_THEME.fontFamily }}>
                <input
                  type="checkbox"
                  checked={props.openPanels[panelId]}
                  onChange={() => props.onTogglePanel(panelId)}
                />
                {props.panelLabels[panelId]}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
