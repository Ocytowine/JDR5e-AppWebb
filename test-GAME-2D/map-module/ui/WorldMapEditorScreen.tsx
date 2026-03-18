import React, { useEffect, useMemo, useReducer, useRef } from "react";
import {
  createRuntimeWorldMapLayout,
  getWorldMapCellKey,
  serializeWorldMapLayout,
  type MapCell,
  type MapLayerId,
  type ReliefElevationLevel,
  type WorldMapCity,
  type WorldMapLayout,
  type WorldMapLayoutSource
} from "../data/worldMapLayout";
import {
  GEOGRAPHY_PRESET_COLORS,
  MapCanvas,
  TAG_PRESET_COLORS,
  cloneLayout,
  fetchWorldMapLayout,
  getSharedHexEdge,
  getFrontMatterList,
  saveWorldMapLayout,
  useWikiCatalog,
  useWikiEntries
} from "./mapShared";
import { MapEditorSidebar } from "./editor/MapEditorSidebar";
import { MapSelectionSummary } from "./editor/MapSelectionSummary";
import { MapEditorToolbar } from "./editor/MapEditorToolbar";
import { MapEditorTopbar } from "./editor/MapEditorTopbar";
import { CollapsibleSection } from "./editor/CollapsibleSection";
import { createInitialMapEditorState } from "./editor/mapEditorInitialState";
import {
  createMapEditorHistoryState,
  mapEditorReducer,
  type EditorToolId,
  type PanelId
} from "./editor/mapEditorReducer";
import { DataPanel } from "./editor/panels/DataPanel";
import { HexPlacesPanel } from "./editor/panels/HexPlacesPanel";
import { HexTerrainPanel } from "./editor/panels/HexTerrainPanel";
import { HexZonesPanel } from "./editor/panels/HexZonesPanel";
import { LayerPanel } from "./editor/panels/LayerPanel";
import { LegendPanel } from "./editor/panels/LegendPanel";

const PANEL_LABELS: Record<PanelId, string> = {
  legend: "Legende",
  layers: "Couches",
  json: "Donnees"
};

function sanitizeLayoutSource(value: unknown): WorldMapLayoutSource | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<WorldMapLayoutSource>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.title !== "string" ||
    typeof candidate.backgroundImageKey !== "string" ||
    !candidate.grid ||
    !candidate.defaultLayers ||
    !Array.isArray(candidate.territories) ||
    !Array.isArray(candidate.regions) ||
    !Array.isArray(candidate.cities) ||
    !Array.isArray(candidate.paths) ||
    !Array.isArray(candidate.cliffSegments ?? []) ||
    !Array.isArray(candidate.cells)
  ) {
    return null;
  }
  return candidate as WorldMapLayoutSource;
}

function layoutToJson(layout: WorldMapLayout): string {
  return JSON.stringify(serializeWorldMapLayout(layout), null, 2);
}

function getSelectedCity(layout: WorldMapLayout, selectedCellKey: string | null): WorldMapCity | null {
  if (!selectedCellKey) return null;
  return layout.cities.find(city => getWorldMapCellKey(city.cell) === selectedCellKey) ?? null;
}

const UTILITY_PANEL_IDS: PanelId[] = ["legend", "layers", "json"];

function slugifyDraft(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const GEOGRAPHY_PRESETS: Array<{ id: string; label: string; geography: string; color: string; surface: "land" | "ocean"; difficulty: number }> = [
  { id: "terre", label: "Terre", geography: "terre", color: "#8c7a58", surface: "land", difficulty: 5 },
  { id: "plaine", label: "Plaine", geography: "plaine", color: GEOGRAPHY_PRESET_COLORS.plaine, surface: "land", difficulty: 5 },
  { id: "colline", label: "Colline", geography: "colline", color: GEOGRAPHY_PRESET_COLORS.colline, surface: "land", difficulty: 6 },
  { id: "foret_claire", label: "Foret claire", geography: "foret_claire", color: GEOGRAPHY_PRESET_COLORS.foret_claire, surface: "land", difficulty: 6 },
  { id: "foret_dense", label: "Foret dense", geography: "foret_dense", color: GEOGRAPHY_PRESET_COLORS.foret_dense, surface: "land", difficulty: 7 },
  { id: "marais", label: "Marais", geography: "marais", color: GEOGRAPHY_PRESET_COLORS.marais, surface: "land", difficulty: 7 },
  { id: "montagne", label: "Montagne", geography: "montagne", color: GEOGRAPHY_PRESET_COLORS.montagne, surface: "land", difficulty: 8 },
  { id: "desert", label: "Desert", geography: "desert", color: GEOGRAPHY_PRESET_COLORS.desert, surface: "land", difficulty: 6 },
  { id: "cote", label: "Cote", geography: "cote", color: GEOGRAPHY_PRESET_COLORS.cote, surface: "land", difficulty: 5 },
  { id: "toundra", label: "Toundra", geography: "toundra", color: GEOGRAPHY_PRESET_COLORS.toundra, surface: "land", difficulty: 6 },
  { id: "jungle", label: "Jungle", geography: "jungle", color: GEOGRAPHY_PRESET_COLORS.jungle, surface: "land", difficulty: 7 },
  { id: "urbain", label: "Urbain", geography: "urbain", color: GEOGRAPHY_PRESET_COLORS.urbain, surface: "land", difficulty: 4 },
  { id: "ocean", label: "Ocean", geography: "ocean", color: GEOGRAPHY_PRESET_COLORS.ocean, surface: "ocean", difficulty: 9 }
];

const TAG_PRESETS: Array<{ id: string; label: string; color: string }> = [
  { id: "maritime", label: "Maritime", color: TAG_PRESET_COLORS.maritime },
  { id: "commerce", label: "Commerce", color: TAG_PRESET_COLORS.commerce },
  { id: "dangereux", label: "Dangereux", color: TAG_PRESET_COLORS.dangereux },
  { id: "sacre", label: "Sacre", color: TAG_PRESET_COLORS.sacre },
  { id: "ruines", label: "Ruines", color: TAG_PRESET_COLORS.ruines },
  { id: "frontalier", label: "Frontalier", color: TAG_PRESET_COLORS.frontalier },
  { id: "agricole", label: "Agricole", color: TAG_PRESET_COLORS.agricole },
  { id: "minier", label: "Minier", color: TAG_PRESET_COLORS.minier },
  { id: "forestier", label: "Forestier", color: TAG_PRESET_COLORS.forestier },
  { id: "urbain", label: "Urbain", color: TAG_PRESET_COLORS.urbain }
];

const FIELD_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#eef3ff",
  boxSizing: "border-box"
};

const SUBSECTION_STYLE: React.CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 10,
  borderRadius: 10,
  background: "rgba(255,255,255,0.04)"
};

export function WorldMapEditorScreen(props: {
  initialLayout: WorldMapLayout;
  onCloseEditor: (layout: WorldMapLayout) => void;
  onLayoutSaved: (layout: WorldMapLayout) => void;
}): React.JSX.Element {
  const [editorStore, dispatch] = useReducer(
    mapEditorReducer,
    undefined,
    () => createMapEditorHistoryState(createInitialMapEditorState(props.initialLayout, layoutToJson(props.initialLayout)))
  );
  const hexModalDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorState = editorStore.present;
  const {
    layout,
    layerVisibility,
    selectedCellKey,
    selectedRouteId,
    selectedAreaCellKeys,
    activeTool,
    jsonBuffer,
    jsonError,
    openPanels,
    selectedLoreCityId,
    selectedLoreLocationId,
    draftCityName,
    draftTerritoryId,
    draftTerritoryColor,
    draftRegionId,
    draftRegionColor,
    selectedTerritoryLoreId,
    selectedRegionLoreId,
    hexModalPosition,
    customGeographies,
    customTags,
    draftGeographyName,
    draftGeographyColor,
    draftGeographySurface,
    draftGeographyDifficulty,
    draftTagName,
    draftTagColor,
    pendingGeographyId,
    pendingReliefElevation,
    pendingTagIds,
    persistenceState,
    lastSavedLayoutJson
  } = editorState;
  const { wikiEntriesById, wikiLoading, wikiError } = useWikiEntries(layout);
  const { wikiCatalog, wikiCatalogLoading, wikiCatalogError } = useWikiCatalog();

  const selectedCell = useMemo(() => {
    return layout.cells.find(cell => getWorldMapCellKey(cell.cell) === selectedCellKey) ?? null;
  }, [layout.cells, selectedCellKey]);

  const selectedCity = useMemo(() => getSelectedCity(layout, selectedCellKey), [layout, selectedCellKey]);
  const selectedCityWiki = selectedCity?.wikiEntityId ? wikiEntriesById[selectedCity.wikiEntityId] : null;
  const selectedTerritoryWiki = selectedCell?.territoryWikiId ? wikiEntriesById[selectedCell.territoryWikiId] : null;
  const selectedRegionWiki = selectedCell?.regionWikiId ? wikiEntriesById[selectedCell.regionWikiId] : null;
  const selectedRoute = layout.paths.find(path => path.id === selectedRouteId) ?? null;
  const routeEditorActive = activeTool === "routes";
  const currentLayoutJson = useMemo(() => layoutToJson(layout), [layout]);
  const isDirty = currentLayoutJson !== lastSavedLayoutJson;
  const canUndo = editorStore.past.length > 0;
  const canRedo = editorStore.future.length > 0;
  const wikiCities = useMemo(
    () => wikiCatalog.filter(entry => String(entry.type).trim().toLowerCase() === "ville"),
    [wikiCatalog]
  );
  const wikiLocations = useMemo(
    () =>
      wikiCatalog.filter(entry => {
        const type = String(entry.type).trim().toLowerCase();
        return type === "batiment" || type === "quartier" || type === "lieu" || type === "site";
      }),
    [wikiCatalog]
  );
  const wikiTerritories = useMemo(
    () =>
      wikiCatalog.filter(entry => {
        const type = String(entry.type).trim().toLowerCase();
        return type === "royaume" || type === "territoire";
      }),
    [wikiCatalog]
  );
  const wikiRegions = useMemo(
    () => wikiCatalog.filter(entry => String(entry.type).trim().toLowerCase() === "region"),
    [wikiCatalog]
  );
  const allGeographyPresets = useMemo(() => [...GEOGRAPHY_PRESETS, ...customGeographies], [customGeographies]);
  const allTagPresets = useMemo(() => [...TAG_PRESETS, ...customTags], [customTags]);
  const contextualHexSection = activeTool === "terrain" ? "terrain" : activeTool === "places" ? "places" : activeTool === "zones" ? "zones" : activeTool === "routes" ? "routes" : null;

  useEffect(() => {
    updateJsonBuffer(layoutToJson(layout));
  }, [layout]);

  function activateTool(toolId: EditorToolId): void {
    dispatch({ type: "activateTool", toolId });
  }

  const activeToolLabel = useMemo(() => {
    switch (activeTool) {
      case "terrain":
        return "Terrain";
      case "places":
        return "Lieux";
      case "zones":
        return "Zones";
      case "routes":
        return "Routes";
      default:
        return "Main";
    }
  }, [activeTool]);

  const activeToolHint = useMemo(() => {
    switch (activeTool) {
      case "terrain":
        return "Clique un hex pour le selectionner. Shift+clic ajoute ou retire des cases de la selection.";
      case "places":
        return "Clique un hex ou une ville pour preparer les liaisons de lieux.";
      case "zones":
        return "Clique sur plusieurs hex pour construire la selection de territoire ou de region.";
      case "routes":
        return "Clique un hex ajoute un point a la route active.";
      default:
        return "Clique un hex pour inspecter. Maintiens Espace puis glisse pour deplacer la carte.";
    }
  }, [activeTool]);

  const persistenceMeta = useMemo(() => {
    if (persistenceState === "saving") {
      return { label: "Sauvegarde en cours", color: "#8fb3ff" };
    }
    if (isDirty) {
      return { label: "Modifications non sauvegardees", color: "#f4c967" };
    }
    if (persistenceState === "error") {
      return { label: "Erreur de sauvegarde", color: "#ff9d76" };
    }
    if (persistenceState === "saved") {
      return { label: "Sauvegarde serveur OK", color: "#8dd6a5" };
    }
    return { label: "Carte a jour", color: "#c8d0de" };
  }, [isDirty, persistenceState]);

  function updateJsonBuffer(value: string): void {
    dispatch({ type: "setJsonBuffer", value });
  }

  function updateJsonError(value: string | null): void {
    dispatch({ type: "setJsonError", value });
  }

  function updateLoreField(
    field: "selectedLoreCityId" | "selectedLoreLocationId" | "selectedTerritoryLoreId" | "selectedRegionLoreId",
    value: string
  ): void {
    dispatch({ type: "setLoreField", field, value });
  }

  function updateDraftField(
    field:
      | "draftCityName"
      | "draftTerritoryId"
      | "draftTerritoryColor"
      | "draftRegionId"
      | "draftRegionColor"
      | "draftGeographyName"
      | "draftGeographyColor"
      | "draftGeographySurface"
      | "draftGeographyDifficulty"
      | "draftTagName"
      | "draftTagColor",
    value: string | "land" | "ocean"
  ): void {
    dispatch({ type: "setDraftField", field, value });
  }

  function updateHexModalPosition(position: { x: number; y: number }): void {
    dispatch({ type: "setHexModalPosition", position });
  }

  function updatePersistenceState(value: "idle" | "saving" | "saved" | "error"): void {
    dispatch({ type: "setPersistenceState", value });
  }

  function updateLastSavedLayoutJson(value: string): void {
    dispatch({ type: "setLastSavedLayoutJson", value });
  }

  function replaceLayoutState(nextLayout: WorldMapLayout, resetHistory = false): void {
    dispatch({
      type: "replaceLayout",
      resetHistory,
      nextState: {
        layout: cloneLayout(nextLayout),
        layerVisibility: { ...nextLayout.defaultLayers },
        selectedRouteId: nextLayout.paths[0]?.id ?? "",
        selectedAreaCellKeys: [],
        jsonBuffer: layoutToJson(nextLayout),
        jsonError: null
      }
    });
  }

  useEffect(() => {
    function handleMouseMove(event: MouseEvent): void {
      const drag = hexModalDragRef.current;
      if (!drag) return;
      updateHexModalPosition({
        x: Math.max(16, drag.originX + (event.clientX - drag.startX)),
        y: Math.max(16, drag.originY + (event.clientY - drag.startY))
      });
    }

    function handleMouseUp(): void {
      hexModalDragRef.current = null;
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (!(event.ctrlKey || event.metaKey)) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tagName = target.tagName.toLowerCase();
        if (target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select") {
          return;
        }
      }

      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
        return;
      }

      if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function togglePanel(panelId: PanelId): void {
    dispatch({ type: "togglePanel", panelId });
  }

  function toggleTagPreset(tagId: string): void {
    dispatch({
      type: "setPendingTags",
      value: pendingTagIds.includes(tagId) ? pendingTagIds.filter(item => item !== tagId) : [...pendingTagIds, tagId]
    });
  }

  function selectPendingReliefElevation(value: "" | ReliefElevationLevel): void {
    dispatch({ type: "setPendingReliefElevation", value });
  }

  function applyPendingGeographySelection(): void {
    dispatch({ type: "applyPendingTerrain", allGeographyPresets });
  }

  function saveCustomGeography(): void {
    const slug = slugifyDraft(draftGeographyName);
    if (!slug) return;
    dispatch({
      type: "setCustomGeographies",
      value: customGeographies.some(item => item.id === slug)
        ? customGeographies
        : [...customGeographies, { id: slug, label: draftGeographyName.trim(), geography: slug, color: draftGeographyColor, surface: draftGeographySurface, difficulty: Math.max(1, Number(draftGeographyDifficulty) || 1) }]
    });
    dispatch({ type: "setPendingGeography", value: slug });
    updateDraftField("draftGeographyName", "");
  }

  function saveCustomTag(): void {
    const slug = slugifyDraft(draftTagName);
    if (!slug) return;
    dispatch({
      type: "setCustomTags",
      value: customTags.some(item => item.id === slug)
        ? customTags
        : [...customTags, { id: slug, label: draftTagName.trim(), color: draftTagColor }]
    });
    dispatch({ type: "setPendingTags", value: pendingTagIds.includes(slug) ? pendingTagIds : [...pendingTagIds, slug] });
    updateDraftField("draftTagName", "");
  }

  function applyJson(): void {
    try {
      const parsed = JSON.parse(jsonBuffer) as unknown;
      const source = sanitizeLayoutSource(parsed);
      if (!source) throw new Error("Structure JSON invalide.");
      replaceLayoutState(createRuntimeWorldMapLayout(source));
      updateJsonError(null);
    } catch (error) {
      updateJsonError(error instanceof Error ? error.message : "JSON invalide.");
    }
  }

  function downloadJson(): void {
    const blob = new Blob([jsonBuffer], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "worldMapLayout.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function addRoutePoint(cell: MapCell): void {
    dispatch({ type: "appendRoutePoint", cell });
  }

  async function persistLayoutToServer(): Promise<void> {
    try {
      updatePersistenceState("saving");
      const nextLayout = await saveWorldMapLayout(layout);
      replaceLayoutState(nextLayout, true);
      updateJsonError(null);
      updateLastSavedLayoutJson(layoutToJson(nextLayout));
      updatePersistenceState("saved");
      props.onLayoutSaved(nextLayout);
    } catch (error) {
      updatePersistenceState("error");
      updateJsonError(error instanceof Error ? error.message : "Sauvegarde serveur impossible.");
    }
  }

  async function reloadLayoutFromServer(): Promise<void> {
    try {
      updatePersistenceState("saving");
      const nextLayout = await fetchWorldMapLayout();
      replaceLayoutState(nextLayout, true);
      updateJsonError(null);
      updateLastSavedLayoutJson(layoutToJson(nextLayout));
      updatePersistenceState("saved");
      props.onLayoutSaved(nextLayout);
    } catch (error) {
      updatePersistenceState("error");
      updateJsonError(error instanceof Error ? error.message : "Rechargement serveur impossible.");
    }
  }

  function updateCityField(field: "wikiEntityId" | "kind" | "markerColor", value: string): void {
    dispatch({ type: "updateSelectedCityField", field, value });
  }

  function applyLoreCityToCell(wikiEntityId: string): void {
    dispatch({ type: "attachLoreCityToSelectedCell", wikiEntityId });
  }

  function createDraftCity(): void {
    const wikiEntityId = slugifyDraft(draftCityName);
    dispatch({ type: "createDraftCityOnSelectedCell", wikiEntityId });
  }

  function addLoreLocationToCell(wikiEntityId: string): void {
    dispatch({ type: "addLoreLocationToSelectedCell", wikiEntityId });
  }

  function createTerritoryOnCell(): void {
    if (!selectedCell && selectedAreaCellKeys.length === 0) return;
    const wikiEntityId = draftTerritoryId.trim() || selectedTerritoryLoreId.trim();
    if (!wikiEntityId) return;
    dispatch({ type: "assignTerritoryToSelection", wikiEntityId, color: draftTerritoryColor });
  }

  function createRegionOnCell(): void {
    if (!selectedCell && selectedAreaCellKeys.length === 0) return;
    const wikiEntityId = draftRegionId.trim() || selectedRegionLoreId.trim();
    const territoryWikiId = selectedCell?.territoryWikiId ?? selectedTerritoryLoreId.trim();
    if (!wikiEntityId) return;
    dispatch({ type: "assignRegionToSelection", wikiEntityId, territoryWikiId: territoryWikiId ?? "", color: draftRegionColor });
  }

  const terrainPair = useMemo(
    () =>
      selectedAreaCellKeys.length === 2
        ? selectedAreaCellKeys.map(cellKey => {
            const [x, y] = cellKey.split(",").map(Number);
            return { cell: { x, y } };
          })
        : [],
    [selectedAreaCellKeys]
  );
  const terrainCellsAdjacent = terrainPair.length === 2 ? Boolean(getSharedHexEdge(layout, terrainPair[0].cell, terrainPair[1].cell)) : false;
  const activeCliffSegment = useMemo(() => {
    if (terrainPair.length !== 2) return null;
    const pairKeys = [getWorldMapCellKey(terrainPair[0].cell), getWorldMapCellKey(terrainPair[1].cell)].sort();
    return layout.cliffSegments.find(segment => {
      const segmentKeys = [getWorldMapCellKey(segment.a), getWorldMapCellKey(segment.b)].sort();
      return segmentKeys[0] === pairKeys[0] && segmentKeys[1] === pairKeys[1];
    }) ?? null;
  }, [layout.cliffSegments, terrainPair]);

  const overlay = (
    <>
      <MapEditorToolbar
        panelLabels={PANEL_LABELS}
        panelIds={UTILITY_PANEL_IDS}
        openPanels={openPanels}
        activeTool={activeTool}
        canUndo={canUndo}
        canRedo={canRedo}
        onCloseEditor={() => props.onCloseEditor(layout)}
        onTogglePanel={togglePanel}
        onSelectTool={activateTool}
        onUndo={() => dispatch({ type: "undo" })}
        onRedo={() => dispatch({ type: "redo" })}
      />

      <MapEditorSidebar>
        {openPanels.legend && (
          <LegendPanel>
            <div style={{ display: "grid", gap: 12 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "72px 1fr",
                  gap: 12,
                  alignItems: "center",
                  padding: 10,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.04)"
                }}
              >
                <svg width="72" height="64" viewBox="0 0 72 64" aria-hidden="true">
                  <polygon
                    points="18,4 54,4 68,32 54,60 18,60 4,32"
                    fill="rgba(79,125,242,0.16)"
                    stroke="rgba(143,179,255,0.9)"
                    strokeWidth="2"
                  />
                  <line x1="4" y1="32" x2="68" y2="32" stroke="rgba(143,179,255,0.65)" strokeWidth="2" strokeDasharray="4 4" />
                  <circle cx="36" cy="32" r="3" fill="#8fb3ff" />
                </svg>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#eef3ff" }}>Reference d'echelle</div>
                  <div style={{ fontSize: 12, color: "#c9d3e2", lineHeight: 1.5 }}>
                    Un hexagone mesure 10 km d'un cote a l'autre en passant par le centre.
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 8, padding: 10, borderRadius: 12, background: "rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#eef3ff" }}>Reference de deplacement</div>
                <div style={{ fontSize: 12, color: "#c9d3e2", lineHeight: 1.5 }}>
                  Un humain normal traverse un hex en 2 h a rythme de marche normal sur un terrain de difficulte 5.
                </div>
                <div style={{ fontSize: 12, color: "#8fb3ff", lineHeight: 1.45 }}>
                  Cette valeur sert de base pour lire les temps de trajet.
                </div>
              </div>
            </div>
          </LegendPanel>
        )}

        {openPanels.layers && (
          <LayerPanel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              {(Object.keys(layerVisibility) as MapLayerId[]).map(layerId => (
                <label key={layerId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#dce5f2" }}>
                  <input
                    type="checkbox"
                    checked={layerVisibility[layerId]}
                    onChange={() =>
                      dispatch({
                        type: "setLayerVisibility",
                        layerVisibility: { ...layerVisibility, [layerId]: !layerVisibility[layerId] }
                      })
                    }
                  />
                  {layerId}
                </label>
                ))}
            </div>
          </LayerPanel>
        )}

        <HexTerrainPanel
            title={
              contextualHexSection === "terrain"
                ? "Terrain"
                : contextualHexSection === "places"
                  ? "Lieux"
                  : contextualHexSection === "zones"
                    ? "Zones"
                    : contextualHexSection === "routes"
                      ? "Routes"
                    : "Selection"
            }
            selectionLabel={selectedCellKey ?? "Aucune selection"}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: "#c9d3e2", textAlign: "right" }}>
                {selectedAreaCellKeys.length > 0 ? `${selectedAreaCellKeys.length} cases selectionnees` : "1 case active"}
              </div>
            </div>

            {!contextualHexSection && (
              <div style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", fontSize: 12, color: "#c9d3e2", lineHeight: 1.5 }}>
                Choisis un outil d'edition pour afficher ses options ici. `Main` sert surtout a inspecter la carte et la selection.
              </div>
            )}

            {contextualHexSection === "terrain" && (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={SUBSECTION_STYLE}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Bibliotheque de geographies</div>
                  <div style={{ fontSize: 12, color: "#c9d3e2", lineHeight: 1.45 }}>
                    Choisis un type de terrain, puis applique-le directement a ta selection d'hex. Les proprietes derivees seront mises a jour automatiquement.
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {allGeographyPresets.map(preset => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => dispatch({ type: "setPendingGeography", value: preset.id })}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 999,
                          border: pendingGeographyId === preset.id ? "1px solid rgba(255,255,255,0.66)" : "1px solid rgba(255,255,255,0.14)",
                          background: preset.color,
                          color: "#f8fbff",
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 12,
                          boxShadow: pendingGeographyId === preset.id ? "0 0 0 2px rgba(255,255,255,0.18) inset" : "none"
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Relief et jonctions</div>
                    <div style={{ fontSize: 12, color: "#c9d3e2", lineHeight: 1.45 }}>
                      La hauteur reste portee par la case. Les falaises sont maintenant definies entre 2 cases adjacentes, avec un cote haut et un cote bas.
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontSize: 12, color: "#dce5f2" }}>Hauteur de la case</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {([
                          { id: "", label: "Ne pas changer" },
                          { id: "none", label: "Standard" },
                          { id: "low_mountain", label: "Basse montagne" },
                          { id: "high_mountain", label: "Haute montagne" }
                        ] as Array<{ id: "" | ReliefElevationLevel; label: string }>).map(option => {
                          const active = pendingReliefElevation === option.id;
                          return (
                            <button
                              key={option.label}
                              type="button"
                              onClick={() => selectPendingReliefElevation(option.id)}
                              style={{
                                padding: "8px 10px",
                                borderRadius: 999,
                                border: active ? "1px solid rgba(255,255,255,0.66)" : "1px solid rgba(255,255,255,0.14)",
                                background:
                                  option.id === "high_mountain"
                                    ? "rgba(214,223,236,0.24)"
                                    : option.id === "low_mountain"
                                      ? "rgba(173,191,212,0.18)"
                                      : option.id === "none"
                                        ? "rgba(79,125,242,0.18)"
                                        : "rgba(255,255,255,0.06)",
                                color: "#f8fbff",
                                cursor: "pointer",
                                fontWeight: 700,
                                fontSize: 12,
                                boxShadow: active ? "0 0 0 2px rgba(255,255,255,0.18) inset" : "none"
                              }}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <CollapsibleSection title="Falaises par segment">
                    <div style={{ display: "grid", gap: 8, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Falaises par segment</div>
                      <div style={{ fontSize: 12, color: "#c9d3e2", lineHeight: 1.45 }}>
                        Selectionne exactement 2 cases adjacentes pour definir une falaise sur leur frontiere commune.
                      </div>
                      <div style={{ fontSize: 12, color: "#c9d3e2" }}>
                        Paire active: {terrainPair.length === 2 ? `${getWorldMapCellKey(terrainPair[0].cell)} | ${getWorldMapCellKey(terrainPair[1].cell)}` : "selectionne 2 cases"}
                      </div>
                      <div style={{ fontSize: 12, color: terrainPair.length === 2 && terrainCellsAdjacent ? "#8dd6a5" : "#ffb38b" }}>
                        {terrainPair.length !== 2
                          ? "La falaise demande 2 cases exactement."
                          : terrainCellsAdjacent
                            ? "Les 2 cases sont adjacentes. Tu peux definir le cote haut et le cote bas."
                            : "Les 2 cases selectionnees ne partagent pas de bord."}
                      </div>
                      {activeCliffSegment && (
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>
                          Falaise actuelle: haut {getWorldMapCellKey(activeCliffSegment.high)} | bas {getWorldMapCellKey(activeCliffSegment.low)}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: "#c9d3e2", lineHeight: 1.45 }}>
                        Sur la grille, clique sur `+` pour choisir la case haute. Clique sur `-` au milieu pour supprimer la falaise de cette paire.
                      </div>
                    </div>
                    </CollapsibleSection>
                  </div>
                  <CollapsibleSection title="Creer un type de geographie">
                    <input
                      value={draftGeographyName}
                      placeholder="Nom du type"
                      onChange={event => updateDraftField("draftGeographyName", event.target.value)}
                      style={FIELD_STYLE}
                    />
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input type="color" value={draftGeographyColor} onChange={event => updateDraftField("draftGeographyColor", event.target.value)} />
                      <input
                        value={draftGeographyColor}
                        onChange={event => updateDraftField("draftGeographyColor", event.target.value)}
                        style={{ ...FIELD_STYLE, maxWidth: 120 }}
                      />
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#dce5f2" }}>
                        Type
                        <select value={draftGeographySurface} onChange={event => updateDraftField("draftGeographySurface", event.target.value === "ocean" ? "ocean" : "land")} style={{ ...FIELD_STYLE, width: 110, padding: "6px 8px" }}>
                          <option value="land">terre</option>
                          <option value="ocean">ocean</option>
                        </select>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#dce5f2" }}>
                        Difficulte
                        <input
                          type="number"
                          min={1}
                          value={draftGeographyDifficulty}
                          onChange={event => updateDraftField("draftGeographyDifficulty", event.target.value)}
                          style={{ ...FIELD_STYLE, width: 90, padding: "6px 8px" }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={saveCustomGeography}
                        disabled={!slugifyDraft(draftGeographyName)}
                        style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: slugifyDraft(draftGeographyName) ? "pointer" : "not-allowed", opacity: slugifyDraft(draftGeographyName) ? 1 : 0.55 }}
                      >
                        Sauvegarder type
                      </button>
                    </div>
                  </CollapsibleSection>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Tags proposes</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {allTagPresets.map(tag => {
                        const active = pendingTagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggleTagPreset(tag.id)}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 999,
                              border: active ? "1px solid rgba(255,255,255,0.6)" : "1px solid rgba(255,255,255,0.14)",
                              background: tag.color,
                              color: "#f8fbff",
                              cursor: "pointer",
                              fontWeight: 700,
                              fontSize: 12,
                              boxShadow: active ? "0 0 0 2px rgba(255,255,255,0.18) inset" : "none"
                            }}
                          >
                            {tag.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <CollapsibleSection title="Creer un tag">
                    <input
                      value={draftTagName}
                      placeholder="Nom du tag"
                      onChange={event => updateDraftField("draftTagName", event.target.value)}
                      style={FIELD_STYLE}
                    />
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input type="color" value={draftTagColor} onChange={event => updateDraftField("draftTagColor", event.target.value)} />
                      <input value={draftTagColor} onChange={event => updateDraftField("draftTagColor", event.target.value)} style={{ ...FIELD_STYLE, maxWidth: 120 }} />
                      <button
                        type="button"
                        onClick={saveCustomTag}
                        disabled={!slugifyDraft(draftTagName)}
                        style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: slugifyDraft(draftTagName) ? "pointer" : "not-allowed", opacity: slugifyDraft(draftTagName) ? 1 : 0.55 }}
                      >
                        Sauvegarder tag
                      </button>
                    </div>
                  </CollapsibleSection>
                </div>

                <div style={SUBSECTION_STYLE}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Preparation avant application</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "clearAreaSelection" })}
                      style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: "pointer" }}
                    >
                      Vider selection
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: "#c9d3e2" }}>
                    Selection a modifier: {selectedAreaCellKeys.length > 0 ? selectedAreaCellKeys.join(" | ") : selectedCellKey ?? "aucune"}
                  </div>
                  <div style={{ fontSize: 12, color: "#c9d3e2" }}>
                    Geographie choisie: {allGeographyPresets.find(item => item.id === pendingGeographyId)?.label ?? "aucune"}
                  </div>
                  <div style={{ fontSize: 12, color: "#c9d3e2" }}>
                    Difficulte derivee: {allGeographyPresets.find(item => item.id === pendingGeographyId)?.difficulty ?? "-"}
                  </div>
                  <div style={{ fontSize: 12, color: "#c9d3e2" }}>
                    Hauteur choisie: {pendingReliefElevation === "high_mountain" ? "haute montagne" : pendingReliefElevation === "low_mountain" ? "basse montagne" : pendingReliefElevation === "none" ? "standard" : "inchangee"}
                  </div>
                  <div style={{ fontSize: 12, color: "#c9d3e2" }}>
                    Tags choisis: {pendingTagIds.length > 0 ? pendingTagIds.join(", ") : "aucun"}
                  </div>
                  <button
                    type="button"
                    onClick={applyPendingGeographySelection}
                    disabled={!pendingGeographyId && !pendingReliefElevation && pendingTagIds.length === 0}
                    style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(79,125,242,0.22)", color: "#eef3ff", cursor: pendingGeographyId || pendingReliefElevation || pendingTagIds.length > 0 ? "pointer" : "not-allowed", fontWeight: 700, opacity: pendingGeographyId || pendingReliefElevation || pendingTagIds.length > 0 ? 1 : 0.55 }}
                  >
                    Appliquer a la selection
                  </button>
                </div>
              </div>
            )}

            {contextualHexSection === "places" && (
              <HexPlacesPanel>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={SUBSECTION_STYLE}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Element actif</div>
                    {selectedCity ? (
                      <>
                        <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                          Wiki entity id
                          <input value={selectedCity.wikiEntityId} onChange={event => updateCityField("wikiEntityId", event.target.value)} style={FIELD_STYLE} />
                        </label>
                        <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                          Type
                          <select value={selectedCity.kind} onChange={event => updateCityField("kind", event.target.value)} style={FIELD_STYLE}>
                            <option value="capital">capital</option>
                            <option value="secondary">secondary</option>
                          </select>
                        </label>
                        <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                          Couleur
                          <input value={selectedCity.markerColor ?? ""} onChange={event => updateCityField("markerColor", event.target.value)} style={FIELD_STYLE} />
                        </label>
                        {selectedCityWiki && (
                          <div style={{ fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>{selectedCityWiki.name}</div>
                            <div>{selectedCityWiki.snippet || "Pas de resume."}</div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: "#c9d3e2", lineHeight: 1.45 }}>
                        Selectionne une ville ou associe-en une a la case active pour l'editer ici.
                      </div>
                    )}
                  </div>

                  <div style={SUBSECTION_STYLE}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Bibliotheque et references</div>
                    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                      Ville du lore
                      <select value={selectedLoreCityId} onChange={event => updateLoreField("selectedLoreCityId", event.target.value)} style={FIELD_STYLE}>
                        <option value="">Choisir une ville existante</option>
                        {wikiCities.map(entry => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name} ({entry.id})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                      Lieu du lore
                      <select value={selectedLoreLocationId} onChange={event => updateLoreField("selectedLoreLocationId", event.target.value)} style={FIELD_STYLE}>
                        <option value="">Choisir un lieu existant</option>
                        {wikiLocations.map(entry => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name} ({entry.id})
                          </option>
                        ))}
                      </select>
                    </label>
                    <CollapsibleSection title="Creer une ville simple">
                      <input
                        value={draftCityName}
                        placeholder="Nom ou slug de la ville"
                        onChange={event => updateDraftField("draftCityName", event.target.value)}
                        style={FIELD_STYLE}
                      />
                      <div style={{ fontSize: 12, color: "#c9d3e2", lineHeight: 1.45 }}>
                        Mode simple base sur le schema de `lysenthe` : `territoire`, `region`, `type_ville`, `quartiers`, `batiments_importants`, `factions_presentes`, `liaisons`, `mots_cles`.
                      </div>
                      <button
                        type="button"
                        onClick={createDraftCity}
                        disabled={!slugifyDraft(draftCityName)}
                        style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: slugifyDraft(draftCityName) ? "pointer" : "not-allowed", fontWeight: 700, opacity: slugifyDraft(draftCityName) ? 1 : 0.55 }}
                      >
                        Creer ville brouillon
                      </button>
                    </CollapsibleSection>
                  </div>

                  <div style={SUBSECTION_STYLE}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Application a la case active</div>
                    <div style={{ fontSize: 12, color: "#c9d3e2" }}>
                      Case cible: {selectedCellKey ?? "aucune"}
                    </div>
                    <button
                      type="button"
                      onClick={() => applyLoreCityToCell(selectedLoreCityId)}
                      disabled={!selectedLoreCityId}
                      style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: selectedLoreCityId ? "pointer" : "not-allowed", fontWeight: 700, opacity: selectedLoreCityId ? 1 : 0.55 }}
                    >
                      Appliquer ville du lore
                    </button>
                    <button
                      type="button"
                      onClick={() => addLoreLocationToCell(selectedLoreLocationId)}
                      disabled={!selectedLoreLocationId}
                      style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: selectedLoreLocationId ? "pointer" : "not-allowed", fontWeight: 700, opacity: selectedLoreLocationId ? 1 : 0.55 }}
                    >
                      Ajouter lieu a la case
                    </button>
                  </div>
                </div>
              </HexPlacesPanel>
            )}

            {contextualHexSection === "zones" && (
              <HexZonesPanel>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={SUBSECTION_STYLE}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Selection active</div>
                    <div style={{ fontSize: 12, color: "#c9d3e2", lineHeight: 1.45 }}>
                      Active la selection multi-cases, puis clique sur plusieurs hex pour definir une emprise de territoire ou de region.
                    </div>
                    <div style={{ fontSize: 12, color: "#c9d3e2" }}>
                      Selection a modifier: {selectedAreaCellKeys.length > 0 ? selectedAreaCellKeys.join(" | ") : selectedCellKey ?? "aucune"}
                    </div>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "clearAreaSelection" })}
                      style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: "pointer" }}
                    >
                      Vider selection
                    </button>
                  </div>

                  <div style={SUBSECTION_STYLE}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Bibliotheque et references</div>
                    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                      Territoire du lore
                      <select value={selectedTerritoryLoreId} onChange={event => updateLoreField("selectedTerritoryLoreId", event.target.value)} style={FIELD_STYLE}>
                        <option value="">Choisir un territoire</option>
                        {wikiTerritories.map(entry => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name} ({entry.id})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                      Nouveau territoire
                      <input value={draftTerritoryId} placeholder="slug_territoire" onChange={event => updateDraftField("draftTerritoryId", event.target.value)} style={FIELD_STYLE} />
                    </label>
                    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                      Couleur territoire
                      <input value={draftTerritoryColor} onChange={event => updateDraftField("draftTerritoryColor", event.target.value)} style={FIELD_STYLE} />
                    </label>
                    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                      Region du lore
                      <select value={selectedRegionLoreId} onChange={event => updateLoreField("selectedRegionLoreId", event.target.value)} style={FIELD_STYLE}>
                        <option value="">Choisir une region</option>
                        {wikiRegions.map(entry => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name} ({entry.id})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                      Nouvelle region
                      <input value={draftRegionId} placeholder="slug_region" onChange={event => updateDraftField("draftRegionId", event.target.value)} style={FIELD_STYLE} />
                    </label>
                    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                      Couleur region
                      <input value={draftRegionColor} onChange={event => updateDraftField("draftRegionColor", event.target.value)} style={FIELD_STYLE} />
                    </label>
                  </div>

                  <div style={SUBSECTION_STYLE}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Application a la selection</div>
                    <button
                      type="button"
                      onClick={createTerritoryOnCell}
                      disabled={!draftTerritoryId.trim() && !selectedTerritoryLoreId.trim()}
                      style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: draftTerritoryId.trim() || selectedTerritoryLoreId.trim() ? "pointer" : "not-allowed", fontWeight: 700, opacity: draftTerritoryId.trim() || selectedTerritoryLoreId.trim() ? 1 : 0.55 }}
                    >
                      Creer / appliquer territoire
                    </button>
                    <button
                      type="button"
                      onClick={createRegionOnCell}
                      disabled={!draftRegionId.trim() && !selectedRegionLoreId.trim()}
                      style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: draftRegionId.trim() || selectedRegionLoreId.trim() ? "pointer" : "not-allowed", fontWeight: 700, opacity: draftRegionId.trim() || selectedRegionLoreId.trim() ? 1 : 0.55 }}
                    >
                      Creer / appliquer region
                    </button>
                  </div>
                </div>
              </HexZonesPanel>
            )}

            {contextualHexSection === "routes" && (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{selectedRoute?.label ?? "Aucune route"}</div>
                  <div style={{ fontSize: 12, color: "#8fb3ff", fontWeight: 700 }}>Mode trace actif</div>
                </div>
                <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                  Route active
                  <select value={selectedRouteId} onChange={event => dispatch({ type: "setSelectedRoute", routeId: event.target.value })} style={FIELD_STYLE}>
                    {layout.paths.map(path => (
                      <option key={path.id} value={path.id}>
                        {path.label} ({path.kind})
                      </option>
                    ))}
                  </select>
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      const id = `route-${Date.now()}`;
                      dispatch({ type: "createRoute", routeId: id });
                      activateTool("routes");
                    }}
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: "pointer" }}
                  >
                    Ajouter
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: "deleteSelectedRoute" });
                    }}
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,160,160,0.18)", background: "rgba(130,28,28,0.22)", color: "#ffd7d7", cursor: "pointer" }}
                  >
                    Supprimer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: "popSelectedRoutePoint" });
                    }}
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: "pointer" }}
                  >
                    Retirer dernier
                  </button>
                </div>
                {selectedRoute && (
                  <div style={{ display: "grid", gap: 8 }}>
                    <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                      Label
                      <input
                        value={selectedRoute.label}
                        onChange={event => dispatch({ type: "updateSelectedRouteField", field: "label", value: event.target.value })}
                        style={FIELD_STYLE}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                      Type
                      <select
                        value={selectedRoute.kind}
                        onChange={event => dispatch({ type: "updateSelectedRouteField", field: "kind", value: event.target.value })}
                        style={FIELD_STYLE}
                      >
                        <option value="road">road</option>
                        <option value="river">river</option>
                      </select>
                    </label>
                    <div style={{ fontSize: 12, color: "#c9d3e2", lineHeight: 1.45 }}>
                      Clique sur les hex pour ajouter des points au centre des cases.
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 12, fontSize: 12, color: "#c9d3e2", lineHeight: 1.45 }}>
              {(wikiCatalogLoading || wikiCatalogError) && (
                <div>Catalogue lore: {wikiCatalogLoading ? "chargement..." : `erreur ${wikiCatalogError}`}</div>
              )}
            </div>
          </HexTerrainPanel>

        {openPanels.json && (
          <DataPanel>
            <textarea
              value={jsonBuffer}
              onChange={event => updateJsonBuffer(event.target.value)}
              spellCheck={false}
              style={{ width: "100%", minHeight: 220, resize: "vertical", fontFamily: "Consolas, monospace", fontSize: 12 }}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <button type="button" onClick={applyJson} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: "pointer" }}>
                Appliquer JSON
              </button>
              <button type="button" onClick={() => updateJsonBuffer(layoutToJson(layout))} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: "pointer" }}>
                Regenerer JSON
              </button>
              <button type="button" onClick={downloadJson} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: "pointer" }}>
                Telecharger JSON
              </button>
              <button type="button" onClick={() => void persistLayoutToServer()} disabled={persistenceState === "saving"} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(79,125,242,0.32)", background: "rgba(79,125,242,0.22)", color: "#eef3ff", cursor: persistenceState === "saving" ? "wait" : "pointer", fontWeight: 700, opacity: persistenceState === "saving" ? 0.7 : 1 }}>
                Sauver serveur
              </button>
              <button type="button" onClick={() => void reloadLayoutFromServer()} disabled={persistenceState === "saving"} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: persistenceState === "saving" ? "wait" : "pointer" }}>
                Recharger serveur
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: "pointer" }}>
                Charger fichier
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={async event => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  updateJsonBuffer(await file.text());
                  event.currentTarget.value = "";
                }}
              />
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: persistenceMeta.color }}>
              {persistenceMeta.label}
            </div>
            {jsonError && <div style={{ marginTop: 8, fontSize: 12, color: "#ff9d76" }}>{jsonError}</div>}
          </DataPanel>
        )}
      </MapEditorSidebar>
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", minHeight: "100%" }}>
      <MapEditorTopbar
        title={layout.title}
        activeToolLabel={activeToolLabel}
        activeToolHint={activeToolHint}
        persistenceLabel={persistenceMeta.label}
        persistenceColor={persistenceMeta.color}
      />

      <MapCanvas
        layout={layout}
        layerVisibility={layerVisibility}
        selectedCellKey={selectedCellKey}
        highlightedCellKeys={selectedAreaCellKeys}
        selectedCityId={selectedCity?.id ?? null}
        selectedRouteId={selectedRouteId}
        routeEditorActive={routeEditorActive}
        terrainOverlayActive={activeTool === "terrain"}
        cliffEditPair={terrainCellsAdjacent ? { first: terrainPair[0].cell, second: terrainPair[1].cell } : null}
        onSetCliffHighCell={cell => {
          if (!terrainCellsAdjacent || terrainPair.length !== 2) return;
          const firstKey = getWorldMapCellKey(terrainPair[0].cell);
          const secondKey = getWorldMapCellKey(terrainPair[1].cell);
          const highCellKey = getWorldMapCellKey(cell);
          const lowCellKey = highCellKey === firstKey ? secondKey : firstKey;
          dispatch({ type: "setCliffBetweenCells", highCellKey, lowCellKey });
        }}
        onRemoveCliffPair={() => {
          if (!terrainCellsAdjacent || terrainPair.length !== 2) return;
          dispatch({
            type: "removeCliffBetweenCells",
            firstCellKey: getWorldMapCellKey(terrainPair[0].cell),
            secondCellKey: getWorldMapCellKey(terrainPair[1].cell)
          });
        }}
        wikiEntriesById={wikiEntriesById}
        onCellClick={(cell, meta) => {
          const key = getWorldMapCellKey(cell);
          dispatch({ type: "setSelectedCell", cellKey: key });
          if (routeEditorActive) {
            addRoutePoint(cell);
            return;
          }
          if (activeTool === "zones" || activeTool === "terrain") {
            dispatch({ type: "toggleAreaCell", cellKey: key });
            return;
          }
          dispatch({ type: "clearAreaSelection" });
        }}
        onCityClick={cityId => {
          const city = layout.cities.find(entry => entry.id === cityId);
          if (!city) return;
          dispatch({ type: "setSelectedCell", cellKey: getWorldMapCellKey(city.cell) });
        }}
        minHeight="calc(100vh - 180px)"
        overlay={
          <>
            {overlay}
            <MapSelectionSummary
              visible
              position={hexModalPosition}
              selectedCellKey={selectedCellKey}
              selectedCell={selectedCell}
              selectedCity={selectedCity}
              selectedCityWikiName={selectedCityWiki?.name ?? null}
              selectedTerritoryName={selectedTerritoryWiki?.name ?? null}
              selectedRegionName={selectedRegionWiki?.name ?? null}
              selectedCityFactions={!wikiLoading && !wikiError && selectedCityWiki ? getFrontMatterList(selectedCityWiki.frontMatter, "factions_presentes") : []}
              onMouseDown={event => {
                hexModalDragRef.current = {
                  startX: event.clientX,
                  startY: event.clientY,
                  originX: hexModalPosition.x,
                  originY: hexModalPosition.y
                };
              }}
              onDeleteCity={() => {
                dispatch({ type: "removeSelectedCity" });
              }}
            />
          </>
        }
      />
    </div>
  );
}
