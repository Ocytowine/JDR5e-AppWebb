import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  createRuntimeWorldMapLayout,
  type GeographicZoneKind,
  getWorldMapCellKey,
  serializeWorldMapLayout,
  type MapCell,
  type MapLayerId,
  type ReliefElevationLevel,
  type WorldMapCity,
  type WorldMapGeographicZone,
  type WorldMapLayout,
  type WorldMapLayoutSource
} from "../data/worldMapLayout";
import {
  GEOGRAPHY_PRESET_COLORS,
  MapCanvas,
  TAG_PRESET_COLORS,
  type MapLabelAppearanceSet,
  getFrontMatterList,
  cloneLayout,
  fetchWorldMapLayout,
  saveWorldMapLayout,
  useWikiCatalog,
  useWikiEntries
} from "./mapShared";
import { getSharedHexEdge } from "./cliffOverlayHelpers";
import { buildCellFeatureIndex, getRiverFlowCategoryLabel, getRiverSourceTypeLabel, getRiverFlowValue } from "./mapTraversal";
import { MapEditorSidebar } from "./editor/MapEditorSidebar";
import { MapSelectionSummary } from "./editor/MapSelectionSummary";
import { MapEditorToolbar } from "./editor/MapEditorToolbar";
import { MapEditorTopbar } from "./editor/MapEditorTopbar";
import { CollapsibleSection } from "./editor/CollapsibleSection";
import { EDITOR_THEME, createEditorButtonStyle, editorFieldStyles, editorSurfaceStyles, editorTextStyles } from "./editor/editorTheme";
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

function getUniquePathsByKind(layout: WorldMapLayout, kind: "road" | "river") {
  const unique = new Map<string, (typeof layout.paths)[number]>();
  layout.paths.forEach(path => {
    if (path.kind !== kind) return;
    if (!unique.has(path.id)) {
      unique.set(path.id, path);
    }
  });
  return Array.from(unique.values());
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

const FIELD_STYLE: React.CSSProperties = editorFieldStyles.control;

const SUBSECTION_STYLE: React.CSSProperties = editorSurfaceStyles.subsection;

const DEFAULT_LABEL_APPEARANCE: MapLabelAppearanceSet = {
  geography: { fontSize: 14, opacity: 0.96, fontFamily: "Georgia, serif", underline: false },
  territory: { fontSize: 22, opacity: 1, fontFamily: "Georgia, serif", underline: false },
  region: { fontSize: 16, opacity: 1, fontFamily: "Georgia, serif", underline: false },
  geographicZone: { fontSize: 15, opacity: 1, fontFamily: "Georgia, serif", underline: false },
  city: { fontSize: 12, opacity: 1, fontFamily: "Georgia, serif", underline: false },
  road: { fontSize: 13, opacity: 1, fontFamily: "Georgia, serif", underline: false },
  river: { fontSize: 13, opacity: 1, fontFamily: "Georgia, serif", underline: false }
};

export function WorldMapEditorScreen(props: {
  initialLayout: WorldMapLayout;
  onCloseEditor: (layout: WorldMapLayout) => void;
  onLayoutSaved: (layout: WorldMapLayout) => void;
}): React.JSX.Element {
  const [terrainSelectionMode, setTerrainSelectionMode] = useState<"single" | "multi">("single");
  const [editorStore, dispatch] = useReducer(
    mapEditorReducer,
    undefined,
    () => createMapEditorHistoryState(createInitialMapEditorState(props.initialLayout, layoutToJson(props.initialLayout)))
  );
  const [zoneEditSession, setZoneEditSession] = useState<null | { kind: "territory" | "region" | "geographicZone"; id: string; originalCellKeys: string[] }>(null);
  const [footprintFeedback, setFootprintFeedback] = useState<string | null>(null);
  const [labelAppearance, setLabelAppearance] = useState<MapLabelAppearanceSet>(DEFAULT_LABEL_APPEARANCE);
  const [territoryPropertiesEditActive, setTerritoryPropertiesEditActive] = useState(false);
  const [territoryPropertyDraft, setTerritoryPropertyDraft] = useState({
    id: "",
    wikiEntityId: "",
    color: "#6b5d90",
    capitalCityId: ""
  });
  const [regionPropertiesEditActive, setRegionPropertiesEditActive] = useState(false);
  const [regionPropertyDraft, setRegionPropertyDraft] = useState({
    id: "",
    wikiEntityId: "",
    color: "#6d8ca0",
    territoryId: "",
    principalCityId: ""
  });
  const [geographicZonePropertiesEditActive, setGeographicZonePropertiesEditActive] = useState(false);
  const [geographicZonePropertyDraft, setGeographicZonePropertyDraft] = useState({
    id: "",
    wikiEntityId: "",
    label: "",
    kind: "natural" as GeographicZoneKind,
    color: "#5d8f7b",
    borderColor: "#5d8f7b",
    borderWidth: "1.6",
    borderDashArray: "5 4"
  });
  const hexModalDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorState = editorStore.present;
  const {
    layout,
    layerVisibility,
    selectedCellKey,
    selectedRouteId,
    routeDrawActive,
    selectedAreaCellKeys,
    activeTool,
    jsonBuffer,
    jsonError,
    openPanels,
    selectedLoreCityId,
    selectedLoreLocationId,
    draftCityName,
    selectedGovernanceTerritoryId,
    selectedGovernanceRegionId,
    selectedGeographicZoneId,
    draftTerritoryId,
    draftTerritoryColor,
    draftRegionId,
    draftRegionColor,
    draftGovernanceId,
    draftGovernanceColor,
    draftGovernanceCapitalCityId,
    draftGeographicZoneId,
    draftGeographicZoneLabel,
    draftGeographicZoneColor,
    draftGeographicZoneBorderColor,
    draftGeographicZoneBorderWidth,
    draftGeographicZoneBorderDashArray,
    draftGeographicZoneKind,
    selectedGovernanceLoreId,
    selectedGeographicZoneLoreId,
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
  const selectedGovernanceTerritory = useMemo(
    () => layout.governanceTerritories?.find(entry => entry.id === selectedGovernanceTerritoryId) ?? null,
    [layout.governanceTerritories, selectedGovernanceTerritoryId]
  );
  const selectedGovernanceRegion = useMemo(
    () => layout.governanceRegions?.find(entry => entry.id === selectedGovernanceRegionId) ?? null,
    [layout.governanceRegions, selectedGovernanceRegionId]
  );
  const selectedGeographicZone = useMemo(
    () => layout.geographicZones?.find(entry => entry.id === selectedGeographicZoneId) ?? null,
    [layout.geographicZones, selectedGeographicZoneId]
  );
  const selectedTerritoryWiki = selectedGovernanceTerritory?.wikiEntityId ? wikiEntriesById[selectedGovernanceTerritory.wikiEntityId] : null;
  const selectedRegionWiki = selectedGovernanceRegion?.wikiEntityId ? wikiEntriesById[selectedGovernanceRegion.wikiEntityId] : null;
  const selectedTerritoryGovernance = useMemo(
    () =>
      selectedGovernanceTerritory?.governanceId
        ? layout.governances?.find(entry => entry.id === selectedGovernanceTerritory.governanceId) ?? null
        : null,
    [layout.governances, selectedGovernanceTerritory]
  );
  const selectedTerritoryCapital = useMemo(
    () =>
      selectedTerritoryGovernance?.capitalCityId
        ? layout.cities.find(city => city.id === selectedTerritoryGovernance.capitalCityId) ?? null
        : null,
    [layout.cities, selectedTerritoryGovernance]
  );
  const selectedTerritoryRegions = useMemo(
    () => (layout.governanceRegions ?? []).filter(entry => entry.territoryId === selectedGovernanceTerritoryId),
    [layout.governanceRegions, selectedGovernanceTerritoryId]
  );
  const selectedTerritoryCellKeys = useMemo(
    () =>
      layout.cells
        .filter(cell => cell.governanceTerritoryId === selectedGovernanceTerritoryId)
        .map(cell => getWorldMapCellKey(cell.cell)),
    [layout.cells, selectedGovernanceTerritoryId]
  );
  const selectedRegionCellKeys = useMemo(
    () =>
      layout.cells
        .filter(cell => cell.governanceRegionId === selectedGovernanceRegionId)
        .map(cell => getWorldMapCellKey(cell.cell)),
    [layout.cells, selectedGovernanceRegionId]
  );
  const selectedRegionPrincipalCity = useMemo(
    () =>
      selectedGovernanceRegion?.principalCityId
        ? layout.cities.find(city => city.id === selectedGovernanceRegion.principalCityId) ?? null
        : null,
    [layout.cities, selectedGovernanceRegion]
  );
  const selectedGeographicZoneCellKeys = useMemo(
    () =>
      layout.cells
        .filter(cell => (cell.geographicZoneIds ?? []).includes(selectedGeographicZoneId))
        .map(cell => getWorldMapCellKey(cell.cell)),
    [layout.cells, selectedGeographicZoneId]
  );
  const selectedGeographicZones = useMemo(
    () =>
      (selectedCell?.geographicZoneIds ?? [])
        .map(zoneId => layout.geographicZones?.find(entry => entry.id === zoneId) ?? null)
        .filter((entry): entry is WorldMapGeographicZone => Boolean(entry)),
    [layout.geographicZones, selectedCell]
  );
  const selectedRoute = layout.paths.find(path => path.id === selectedRouteId) ?? null;
  const roadPaths = useMemo(() => getUniquePathsByKind(layout, "road"), [layout]);
  const riverPaths = useMemo(() => getUniquePathsByKind(layout, "river"), [layout]);
  const cellFeatureIndex = useMemo(() => buildCellFeatureIndex(layout), [layout]);
  const selectedRiverWaterfallCount = useMemo(() => {
    if (!selectedRoute || selectedRoute.kind !== "river") return 0;
    let total = 0;
    for (let index = 1; index < selectedRoute.cells.length; index += 1) {
      const previous = selectedRoute.cells[index - 1];
      const current = selectedRoute.cells[index];
      const previousKey = getWorldMapCellKey(previous);
      const currentKey = getWorldMapCellKey(current);
      const currentCellRiver = cellFeatureIndex[currentKey]?.rivers.find(entry => entry.featureId === selectedRoute.id) ?? null;
      const previousCellRiver = cellFeatureIndex[previousKey]?.rivers.find(entry => entry.featureId === selectedRoute.id) ?? null;
      if (currentCellRiver?.cliffDrop || previousCellRiver?.cliffDrop) {
        total += 1;
      }
    }
    return total;
  }, [cellFeatureIndex, selectedRoute]);
  const routeEditorActive = activeTool === "routes" && routeDrawActive;
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
  const wikiGovernances = useMemo(
    () =>
      wikiCatalog.filter(entry => {
        const type = String(entry.type).trim().toLowerCase();
        return type === "gouvernance" || entry.relativePath.includes("gouvernances/");
      }),
    [wikiCatalog]
  );
  const wikiGeoZones = useMemo(
    () => [] as typeof wikiCatalog,
    [wikiCatalog]
  );
  const allGeographyPresets = useMemo(() => [...GEOGRAPHY_PRESETS, ...customGeographies], [customGeographies]);
  const allTagPresets = useMemo(() => [...TAG_PRESETS, ...customTags], [customTags]);
  const contextualHexSection = activeTool === "terrain" ? "terrain" : activeTool === "places" ? "places" : activeTool === "zones" ? "zones" : activeTool === "routes" ? "routes" : null;

  function buildTerritoryPropertyDraft(territoryId: string) {
    const territory = layout.governanceTerritories?.find(entry => entry.id === territoryId) ?? null;
    const governance = territory?.governanceId ? layout.governances?.find(entry => entry.id === territory.governanceId) ?? null : null;
    return {
      id: territory?.id ?? territoryId,
      wikiEntityId: territory?.wikiEntityId ?? "",
      color: territory?.color ?? "#6b5d90",
      capitalCityId: governance?.capitalCityId ?? ""
    };
  }

  function buildRegionPropertyDraft(regionId: string) {
    const region = layout.governanceRegions?.find(entry => entry.id === regionId) ?? null;
    return {
      id: region?.id ?? regionId,
      wikiEntityId: region?.wikiEntityId ?? "",
      color: region?.color ?? "#6d8ca0",
      territoryId: region?.territoryId ?? "",
      principalCityId: region?.principalCityId ?? ""
    };
  }

  function buildGeographicZonePropertyDraft(zoneId: string) {
    const zone = layout.geographicZones?.find(entry => entry.id === zoneId) ?? null;
    return {
      id: zone?.id ?? zoneId,
      wikiEntityId: zone?.wikiEntityId ?? "",
      label: zone?.label ?? "",
      kind: zone?.kind ?? ("natural" as GeographicZoneKind),
      color: zone?.color ?? "#5d8f7b",
      borderColor: zone?.borderColor ?? zone?.color ?? "#5d8f7b",
      borderWidth: String(zone?.borderWidth ?? 1.6),
      borderDashArray: zone?.borderDashArray ?? "5 4"
    };
  }

  function getTerritoryDisplayName(territoryId: string): string {
    const territory = layout.governanceTerritories?.find(entry => entry.id === territoryId) ?? null;
    if (!territory) return territoryId;
    const wikiName = territory.wikiEntityId ? wikiEntriesById[territory.wikiEntityId]?.name : "";
    return wikiName || territory.wikiEntityId || territory.id;
  }

  function getRegionDisplayName(regionId: string): string {
    const region = layout.governanceRegions?.find(entry => entry.id === regionId) ?? null;
    if (!region) return regionId;
    const wikiName = region.wikiEntityId ? wikiEntriesById[region.wikiEntityId]?.name : "";
    return wikiName || region.wikiEntityId || region.id;
  }

  function getGeographicZoneDisplayName(zoneId: string): string {
    const zone = layout.geographicZones?.find(entry => entry.id === zoneId) ?? null;
    if (!zone) return zoneId;
    const wikiName = zone.wikiEntityId ? wikiEntriesById[zone.wikiEntityId]?.name : "";
    return wikiName || zone.label || zone.wikiEntityId || zone.id;
  }

  useEffect(() => {
    if (!selectedGovernanceTerritoryId) {
      setTerritoryPropertiesEditActive(false);
      setTerritoryPropertyDraft({ id: "", wikiEntityId: "", color: "#6b5d90", capitalCityId: "" });
      return;
    }
    if (!territoryPropertiesEditActive) {
      setTerritoryPropertyDraft(buildTerritoryPropertyDraft(selectedGovernanceTerritoryId));
    }
  }, [layout.governanceTerritories, layout.governances, selectedGovernanceTerritoryId, territoryPropertiesEditActive]);

  useEffect(() => {
    if (!selectedGovernanceRegionId) {
      setRegionPropertiesEditActive(false);
      setRegionPropertyDraft({ id: "", wikiEntityId: "", color: "#6d8ca0", territoryId: "", principalCityId: "" });
      return;
    }
    if (!regionPropertiesEditActive) {
      setRegionPropertyDraft(buildRegionPropertyDraft(selectedGovernanceRegionId));
    }
  }, [layout.governanceRegions, selectedGovernanceRegionId, regionPropertiesEditActive]);

  useEffect(() => {
    if (!selectedGeographicZoneId) {
      setGeographicZonePropertiesEditActive(false);
      setGeographicZonePropertyDraft({
        id: "",
        wikiEntityId: "",
        label: "",
        kind: "natural",
        color: "#5d8f7b",
        borderColor: "#5d8f7b",
        borderWidth: "1.6",
        borderDashArray: "5 4"
      });
      return;
    }
    if (!geographicZonePropertiesEditActive) {
      setGeographicZonePropertyDraft(buildGeographicZonePropertyDraft(selectedGeographicZoneId));
    }
  }, [layout.geographicZones, selectedGeographicZoneId, geographicZonePropertiesEditActive]);

  useEffect(() => {
    if (!footprintFeedback) return;
    const timer = window.setTimeout(() => setFootprintFeedback(null), 2200);
    return () => window.clearTimeout(timer);
  }, [footprintFeedback]);
  useEffect(() => {
    updateJsonBuffer(layoutToJson(layout));
  }, [layout]);

  function activateTool(toolId: EditorToolId): void {
    if (toolId !== "zones" && zoneEditSession) {
      setZoneEditSession(null);
    }
    if (toolId !== "terrain" && toolId !== "zones") {
      dispatch({ type: "clearAreaSelection" });
    }
    dispatch({ type: "activateTool", toolId });
  }

  const activeToolLabel = useMemo(() => {
    switch (activeTool) {
      case "terrain":
        return "Terrain";
      case "places":
        return "Lieux";
      case "zones":
        return "Organisation";
      case "routes":
        return "Trace";
      default:
        return "Main";
    }
  }, [activeTool]);

  const activeToolHint = useMemo(() => {
    switch (activeTool) {
      case "terrain":
        return "Clic simple: remplace la selection par cette case. Shift+clic: ajoute ou retire des cases.";
      case "places":
        return "Clique un hex ou une ville pour preparer les liaisons de lieux.";
      case "zones":
        return zoneEditSession ? "Mode emprise actif: clique pour ajouter ou retirer des cases, puis valide ou annule." : "Selectionne un element dans la bibliotheque, puis utilise `Editer l'emprise` pour charger sa zone.";
      case "routes":
        return "Clique un hex ajoute un point au trace actif.";
      default:
        return "Clique un hex pour inspecter. Maintiens Espace puis glisse pour deplacer la carte.";
    }
  }, [activeTool, zoneEditSession]);

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
    field:
      | "selectedLoreCityId"
      | "selectedLoreLocationId"
      | "selectedGovernanceLoreId"
      | "selectedGeographicZoneLoreId",
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
      | "draftGovernanceId"
      | "draftGovernanceColor"
      | "draftGovernanceCapitalCityId"
      | "selectedGovernanceTerritoryId"
      | "selectedGovernanceRegionId"
      | "selectedGeographicZoneId"
      | "draftGeographicZoneId"
      | "draftGeographicZoneLabel"
      | "draftGeographicZoneColor"
      | "draftGeographicZoneBorderColor"
      | "draftGeographicZoneBorderWidth"
      | "draftGeographicZoneBorderDashArray"
      | "draftGeographicZoneKind"
      | "draftGeographyName"
      | "draftGeographyColor"
      | "draftGeographySurface"
      | "draftGeographyDifficulty"
      | "draftTagName"
      | "draftTagColor",
    value: string | "land" | "ocean" | GeographicZoneKind
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

  function updateLabelAppearance<K extends keyof MapLabelAppearanceSet>(
    family: K,
    field: keyof MapLabelAppearanceSet[K],
    value: string | number | boolean
  ): void {
    setLabelAppearance(current => ({
      ...current,
      [family]: {
        ...current[family],
        [field]: value
      }
    }));
  }

  function selectGovernanceTerritoryFromLibrary(territoryId: string): void {
    updateDraftField("selectedGovernanceTerritoryId", territoryId);
    setTerritoryPropertiesEditActive(false);
    setTerritoryPropertyDraft(buildTerritoryPropertyDraft(territoryId));
    if (zoneEditSession) {
      setZoneEditSession(null);
    }
    dispatch({ type: "clearAreaSelection" });
  }

  function activateGovernanceTerritorySelection(territoryId: string): void {
    selectGovernanceTerritoryFromLibrary(territoryId);
  }

  function selectGovernanceRegionFromLibrary(regionId: string): void {
    updateDraftField("selectedGovernanceRegionId", regionId);
    setRegionPropertiesEditActive(false);
    setRegionPropertyDraft(buildRegionPropertyDraft(regionId));
  }

  function activateGovernanceRegionSelection(regionId: string): void {
    selectGovernanceRegionFromLibrary(regionId);
    if (zoneEditSession) {
      setZoneEditSession(null);
    }
    dispatch({ type: "clearAreaSelection" });
  }

  function selectGeographicZoneFromLibrary(zoneId: string): void {
    updateDraftField("selectedGeographicZoneId", zoneId);
    setGeographicZonePropertiesEditActive(false);
    setGeographicZonePropertyDraft(buildGeographicZonePropertyDraft(zoneId));
  }

  function activateGeographicZoneSelection(zoneId: string): void {
    selectGeographicZoneFromLibrary(zoneId);
    if (zoneEditSession) {
      setZoneEditSession(null);
    }
    dispatch({ type: "clearAreaSelection" });
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

  function createLinearFeature(kind: "road" | "river"): void {
    const uniquePart =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const id = `${kind}-${uniquePart}`;
    dispatch({ type: "createRoute", routeId: id, kind });
    activateTool("routes");
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

  function createGovernanceTerritoryDefinitionOnly(): void {
    const territoryId = draftTerritoryId.trim();
    const wikiEntityId = territoryId;
    const governanceId = draftGovernanceId.trim() || selectedGovernanceLoreId.trim();
    const capitalCityId = draftGovernanceCapitalCityId.trim();
    if (!territoryId) return;
    dispatch({
      type: "createGovernanceTerritoryDefinition",
      territoryId,
      wikiEntityId,
      governanceId,
      color: draftTerritoryColor,
      capitalCityId
    });
    updateDraftField("selectedGovernanceTerritoryId", territoryId);
    startFootprintEdit("territory", territoryId);
  }

  function openTerritoryPropertiesEditor(): void {
    if (!selectedGovernanceTerritoryId) return;
    setTerritoryPropertyDraft(buildTerritoryPropertyDraft(selectedGovernanceTerritoryId));
    setTerritoryPropertiesEditActive(true);
  }

  function cancelTerritoryPropertiesEditor(): void {
    if (!selectedGovernanceTerritoryId) {
      setTerritoryPropertiesEditActive(false);
      return;
    }
    setTerritoryPropertyDraft(buildTerritoryPropertyDraft(selectedGovernanceTerritoryId));
    setTerritoryPropertiesEditActive(false);
  }

  function saveTerritoryProperties(): void {
    if (!selectedGovernanceTerritory) return;
    const nextTerritoryId = territoryPropertyDraft.id.trim();
    if (!nextTerritoryId) {
      updateJsonError("L'id technique du territoire est obligatoire.");
      return;
    }
    if (
      nextTerritoryId !== selectedGovernanceTerritory.id &&
      (layout.governanceTerritories ?? []).some(entry => entry.id === nextTerritoryId)
    ) {
      updateJsonError("Cet id de territoire existe deja.");
      return;
    }
    const capitalCityId = territoryPropertyDraft.capitalCityId.trim();
    if (capitalCityId) {
      const capitalCity = layout.cities.find(city => city.id === capitalCityId) ?? null;
      const capitalKey = capitalCity ? getWorldMapCellKey(capitalCity.cell) : "";
      if (!capitalKey || !selectedTerritoryCellKeys.includes(capitalKey)) {
        updateJsonError("La capitale choisie doit se trouver dans l'emprise actuelle du territoire.");
        return;
      }
    }
    dispatch({ type: "updateSelectedGovernanceTerritoryField", field: "id", value: nextTerritoryId });
    dispatch({ type: "updateSelectedGovernanceTerritoryField", field: "wikiEntityId", value: territoryPropertyDraft.wikiEntityId.trim() || selectedGovernanceTerritory.id });
    dispatch({ type: "updateSelectedGovernanceTerritoryField", field: "color", value: territoryPropertyDraft.color });
    dispatch({ type: "updateSelectedGovernanceTerritoryField", field: "capitalCityId", value: capitalCityId });
    updateJsonError(null);
    setTerritoryPropertiesEditActive(false);
  }

  function createGovernanceRegionDefinitionOnly(): void {
    const regionId = draftRegionId.trim();
    const wikiEntityId = regionId;
    const territoryId = selectedGovernanceTerritoryId.trim() || selectedCell?.governanceTerritoryId || draftTerritoryId.trim();
    const governanceId = draftGovernanceId.trim() || selectedGovernanceLoreId.trim();
    const principalCityId = selectedCity?.id ?? "";
    if (!regionId) return;
    dispatch({
      type: "createGovernanceRegionDefinition",
      regionId,
      wikiEntityId,
      territoryId,
      governanceId,
      principalCityId,
      color: draftRegionColor
    });
    updateDraftField("selectedGovernanceRegionId", regionId);
    startFootprintEdit("region", regionId);
  }

  function openRegionPropertiesEditor(): void {
    if (!selectedGovernanceRegionId) return;
    setRegionPropertyDraft(buildRegionPropertyDraft(selectedGovernanceRegionId));
    setRegionPropertiesEditActive(true);
  }

  function cancelRegionPropertiesEditor(): void {
    if (!selectedGovernanceRegionId) {
      setRegionPropertiesEditActive(false);
      return;
    }
    setRegionPropertyDraft(buildRegionPropertyDraft(selectedGovernanceRegionId));
    setRegionPropertiesEditActive(false);
  }

  function saveRegionProperties(): void {
    if (!selectedGovernanceRegion) return;
    const nextRegionId = regionPropertyDraft.id.trim();
    if (!nextRegionId) {
      updateJsonError("L'id technique de la region est obligatoire.");
      return;
    }
    if (
      nextRegionId !== selectedGovernanceRegion.id &&
      (layout.governanceRegions ?? []).some(entry => entry.id === nextRegionId)
    ) {
      updateJsonError("Cet id de region existe deja.");
      return;
    }
    dispatch({ type: "updateSelectedGovernanceRegionField", field: "id", value: nextRegionId });
    dispatch({ type: "updateSelectedGovernanceRegionField", field: "wikiEntityId", value: regionPropertyDraft.wikiEntityId.trim() || selectedGovernanceRegion.id });
    dispatch({ type: "updateSelectedGovernanceRegionField", field: "color", value: regionPropertyDraft.color });
    dispatch({ type: "updateSelectedGovernanceRegionField", field: "territoryId", value: regionPropertyDraft.territoryId.trim() });
    dispatch({ type: "updateSelectedGovernanceRegionField", field: "principalCityId", value: regionPropertyDraft.principalCityId.trim() });
    updateJsonError(null);
    setRegionPropertiesEditActive(false);
  }

  function createGeographicZoneDefinitionOnly(): void {
    const zoneId = draftGeographicZoneId.trim() || selectedGeographicZoneLoreId.trim();
    const wikiEntityId = selectedGeographicZoneLoreId.trim() || undefined;
    const label =
      draftGeographicZoneLabel.trim() ||
      wikiCatalog.find(entry => entry.id === selectedGeographicZoneLoreId)?.name ||
      zoneId;
    if (!zoneId || !label) return;
    dispatch({
      type: "createGeographicZoneDefinition",
      zoneId,
      wikiEntityId,
      label,
      kind: draftGeographicZoneKind,
      color: draftGeographicZoneColor,
      borderColor: draftGeographicZoneBorderColor,
      borderWidth: Number(draftGeographicZoneBorderWidth) || 1.6,
      borderDashArray: draftGeographicZoneBorderDashArray
    });
    updateDraftField("selectedGeographicZoneId", zoneId);
    startFootprintEdit("geographicZone", zoneId);
  }

  function openGeographicZonePropertiesEditor(): void {
    if (!selectedGeographicZoneId) return;
    setGeographicZonePropertyDraft(buildGeographicZonePropertyDraft(selectedGeographicZoneId));
    setGeographicZonePropertiesEditActive(true);
  }

  function cancelGeographicZonePropertiesEditor(): void {
    if (!selectedGeographicZoneId) {
      setGeographicZonePropertiesEditActive(false);
      return;
    }
    setGeographicZonePropertyDraft(buildGeographicZonePropertyDraft(selectedGeographicZoneId));
    setGeographicZonePropertiesEditActive(false);
  }

  function saveGeographicZoneProperties(): void {
    if (!selectedGeographicZone) return;
    const nextZoneId = geographicZonePropertyDraft.id.trim();
    if (!nextZoneId) {
      updateJsonError("L'id technique de la zone est obligatoire.");
      return;
    }
    if (
      nextZoneId !== selectedGeographicZone.id &&
      (layout.geographicZones ?? []).some(entry => entry.id === nextZoneId)
    ) {
      updateJsonError("Cet id de zone existe deja.");
      return;
    }
    dispatch({ type: "updateSelectedGeographicZoneField", field: "id", value: nextZoneId });
    dispatch({ type: "updateSelectedGeographicZoneField", field: "wikiEntityId", value: geographicZonePropertyDraft.wikiEntityId.trim() });
    dispatch({ type: "updateSelectedGeographicZoneField", field: "label", value: geographicZonePropertyDraft.label.trim() || selectedGeographicZone.label });
    dispatch({ type: "updateSelectedGeographicZoneField", field: "kind", value: geographicZonePropertyDraft.kind });
    dispatch({ type: "updateSelectedGeographicZoneField", field: "color", value: geographicZonePropertyDraft.color });
    dispatch({ type: "updateSelectedGeographicZoneField", field: "borderColor", value: geographicZonePropertyDraft.borderColor });
    dispatch({ type: "updateSelectedGeographicZoneField", field: "borderWidth", value: geographicZonePropertyDraft.borderWidth });
    dispatch({ type: "updateSelectedGeographicZoneField", field: "borderDashArray", value: geographicZonePropertyDraft.borderDashArray });
    updateJsonError(null);
    setGeographicZonePropertiesEditActive(false);
  }

  function startFootprintEdit(kind: "territory" | "region" | "geographicZone", id: string): void {
    const originalCellKeys = layout.cells
      .filter(cell => {
        if (kind === "territory") return cell.governanceTerritoryId === id;
        if (kind === "region") return cell.governanceRegionId === id;
        return (cell.geographicZoneIds ?? []).includes(id);
      })
      .map(cell => getWorldMapCellKey(cell.cell));
    if (kind === "territory") {
      setTerritoryPropertiesEditActive(false);
    }
    setZoneEditSession({ kind, id, originalCellKeys });
    dispatch({ type: "setAreaSelection", cellKeys: originalCellKeys });
    activateTool("zones");
  }

  function cancelFootprintEdit(): void {
    if (!zoneEditSession) return;
    dispatch({ type: "clearAreaSelection" });
    setZoneEditSession(null);
    setFootprintFeedback(null);
  }

  function validateFootprintEdit(): void {
    if (!zoneEditSession) return;
    const feedbackKind = zoneEditSession.kind;
    const cellKeys = selectedAreaCellKeys;
    if (zoneEditSession.kind === "territory") {
      const territory = layout.governanceTerritories?.find(entry => entry.id === zoneEditSession.id) ?? null;
      const governance = territory?.governanceId ? layout.governances?.find(entry => entry.id === territory.governanceId) ?? null : null;
      const capitalCityId = governance?.capitalCityId ?? "";
      if (capitalCityId) {
        const capitalCity = layout.cities.find(city => city.id === capitalCityId) ?? null;
        const capitalKey = capitalCity ? getWorldMapCellKey(capitalCity.cell) : "";
        if (!capitalKey || !cellKeys.includes(capitalKey)) {
          updateJsonError("La capitale choisie doit se trouver dans l'emprise du territoire.");
          return;
        }
      }
      dispatch({ type: "replaceGovernanceTerritorySelection", territoryId: zoneEditSession.id, cellKeys });
    } else if (zoneEditSession.kind === "region") {
      dispatch({
        type: "replaceGovernanceRegionSelection",
        regionId: zoneEditSession.id,
        territoryId: selectedGovernanceRegion?.territoryId,
        cellKeys
      });
    } else {
      dispatch({ type: "replaceGeographicZoneSelection", zoneId: zoneEditSession.id, cellKeys });
    }
    dispatch({ type: "clearAreaSelection" });
    setZoneEditSession(null);
    setFootprintFeedback(
      feedbackKind === "territory"
        ? "Emprise du territoire mise a jour."
        : feedbackKind === "region"
          ? "Emprise de la region mise a jour."
          : "Emprise de la zone mise a jour."
    );
  }

  function handleEditorCellClick(cell: MapCell, meta?: { shiftKey: boolean }): void {
    const key = getWorldMapCellKey(cell);
    dispatch({ type: "setSelectedCell", cellKey: key });

    if (routeEditorActive) {
      addRoutePoint(cell);
      return;
    }

    if (activeTool === "terrain") {
      if (terrainSelectionMode === "multi") {
        dispatch({ type: "toggleAreaCell", cellKey: key });
      } else {
        dispatch({ type: "setAreaSelection", cellKeys: [key] });
      }
      return;
    }

    if (activeTool === "zones") {
      if (!zoneEditSession) {
        return;
      }
      dispatch({ type: "toggleAreaCell", cellKey: key });
      return;
    }

    dispatch({ type: "clearAreaSelection" });
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

        <div style={{ marginBottom: 12 }}>
          <CollapsibleSection title="Textes" defaultOpen={false}>
            <div style={{ display: "grid", gap: 10 }}>
              {([
                ["geography", "Types de geographie"],
                ["territory", "Territoires"],
                ["region", "Regions"],
                ["geographicZone", "Zones geographiques"],
                ["city", "Villes"],
                ["road", "Routes"],
                ["river", "Cours d'eau"]
              ] as const).map(([family, label]) => (
                <div key={family} style={{ ...SUBSECTION_STYLE, gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>{label}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                      Taille
                      <input
                        type="number"
                        min={8}
                        max={48}
                        value={labelAppearance[family].fontSize}
                        onChange={event => updateLabelAppearance(family, "fontSize", Number(event.target.value) || 12)}
                        style={FIELD_STYLE}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                      Transparence
                      <input
                        type="number"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={labelAppearance[family].opacity}
                        onChange={event => updateLabelAppearance(family, "opacity", Math.max(0.1, Math.min(1, Number(event.target.value) || 1)))}
                        style={FIELD_STYLE}
                      />
                    </label>
                  </div>
                  <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                    Police
                    <select
                      value={labelAppearance[family].fontFamily}
                      onChange={event => updateLabelAppearance(family, "fontFamily", event.target.value)}
                      style={FIELD_STYLE}
                    >
                      <option value="Georgia, serif">Georgia</option>
                      <option value="Times New Roman, serif">Times New Roman</option>
                      <option value="Garamond, serif">Garamond</option>
                      <option value="Trebuchet MS, sans-serif">Trebuchet MS</option>
                      <option value="Verdana, sans-serif">Verdana</option>
                    </select>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#dce5f2" }}>
                    <input
                      type="checkbox"
                      checked={labelAppearance[family].underline}
                      onChange={event => updateLabelAppearance(family, "underline", event.target.checked)}
                    />
                    Soulignage
                  </label>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        </div>

        <HexTerrainPanel
            title={
              contextualHexSection === "terrain"
                ? "Terrain"
                : contextualHexSection === "places"
                  ? "Lieux"
                : contextualHexSection === "zones"
                    ? "Zones"
                  : contextualHexSection === "routes"
                      ? "Trace"
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
                    Mode de selection: {terrainSelectionMode === "multi" ? "multi cases" : "unitaire"}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setTerrainSelectionMode("single");
                        if (selectedCellKey) {
                          dispatch({ type: "setAreaSelection", cellKeys: [selectedCellKey] });
                        }
                      }}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: terrainSelectionMode === "single" ? "1px solid rgba(143,179,255,0.56)" : "1px solid rgba(255,255,255,0.12)",
                        background: terrainSelectionMode === "single" ? "rgba(79,125,242,0.18)" : "rgba(255,255,255,0.06)",
                        color: "#eef3ff",
                        cursor: "pointer",
                        fontWeight: terrainSelectionMode === "single" ? 700 : 500
                      }}
                    >
                      Unitaire
                    </button>
                    <button
                      type="button"
                      onClick={() => setTerrainSelectionMode("multi")}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: terrainSelectionMode === "multi" ? "1px solid rgba(143,179,255,0.56)" : "1px solid rgba(255,255,255,0.12)",
                        background: terrainSelectionMode === "multi" ? "rgba(79,125,242,0.18)" : "rgba(255,255,255,0.06)",
                        color: "#eef3ff",
                        cursor: "pointer",
                        fontWeight: terrainSelectionMode === "multi" ? 700 : 500
                      }}
                    >
                      Multi cases
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
                  {footprintFeedback && (
                    <div
                      style={{
                        padding: "9px 12px",
                        borderRadius: 10,
                        border: "1px solid rgba(141,214,165,0.32)",
                        background: "rgba(141,214,165,0.12)",
                        color: "#dff7e6",
                        fontSize: 12,
                        fontWeight: 700
                      }}
                    >
                      {footprintFeedback}
                    </div>
                  )}
                  <CollapsibleSection title="Territoire politique" defaultOpen>
                    <div style={{ fontSize: 12, color: "#c9d3e2", lineHeight: 1.45 }}>
                      Un seul territoire politique par case. La pastille selectionne un territoire. L'emprise ne se charge qu'en cliquant sur `Editer l'emprise`.
                    </div>
                    <div style={{ fontSize: 12, color: "#dce5f2" }}>Bibliotheque</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(layout.governanceTerritories ?? []).map(entry => {
                        const active = selectedGovernanceTerritoryId === entry.id;
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => activateGovernanceTerritorySelection(entry.id)}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 999,
                              border: active ? "1px solid rgba(255,255,255,0.66)" : "1px solid rgba(255,255,255,0.14)",
                              background: entry.color,
                              color: "#f8fbff",
                              cursor: "pointer",
                              fontWeight: 700,
                              fontSize: 12,
                              boxShadow: active ? "0 0 0 2px rgba(255,255,255,0.18) inset" : "none"
                            }}
                            title="Selectionner ce territoire"
                          >
                            {getTerritoryDisplayName(entry.id)}
                          </button>
                        );
                      })}
                    </div>
                    {selectedGovernanceTerritory && (
                      <div style={{ ...SUBSECTION_STYLE, border: "1px solid rgba(143,179,255,0.38)", boxShadow: "0 0 0 1px rgba(143,179,255,0.14) inset" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Territoire selectionne: {getTerritoryDisplayName(selectedGovernanceTerritory.id)}</div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>
                          Wiki entity id: {selectedTerritoryWiki?.name ?? selectedGovernanceTerritory.wikiEntityId}
                        </div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>
                          Gouvernance associee: {selectedTerritoryGovernance?.label ?? selectedTerritoryGovernance?.id ?? selectedGovernanceTerritory.governanceId ?? "aucune"}
                        </div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>
                          Capitale: {selectedTerritoryCapital?.wikiEntityId ?? selectedTerritoryCapital?.id ?? "aucune"}
                        </div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>
                          Regions associees: {selectedTerritoryRegions.length > 0 ? selectedTerritoryRegions.map(entry => entry.id).join(", ") : "aucune"}
                        </div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>
                          Emprise actuelle: {selectedTerritoryCellKeys.length} case{selectedTerritoryCellKeys.length > 1 ? "s" : ""}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => selectedGovernanceTerritoryId && startFootprintEdit("territory", selectedGovernanceTerritoryId)}
                            disabled={zoneEditSession?.kind === "territory" && zoneEditSession.id === selectedGovernanceTerritoryId}
                            style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: selectedGovernanceTerritoryId ? 1 : 0.45 }}
                          >
                            Editer l'emprise
                          </button>
                          <button
                            type="button"
                            onClick={openTerritoryPropertiesEditor}
                            disabled={territoryPropertiesEditActive}
                            style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: territoryPropertiesEditActive ? 0.6 : 1 }}
                          >
                            Editer les proprietes
                          </button>
                          <button
                            type="button"
                            onClick={() => dispatch({ type: "deleteSelectedGovernanceTerritory" })}
                            style={{ ...createEditorButtonStyle({ compact: true, danger: true }), borderRadius: 8 }}
                          >
                            Supprimer l'element
                          </button>
                        </div>
                        {zoneEditSession?.kind === "territory" && zoneEditSession.id === selectedGovernanceTerritoryId && (
                          <div style={{ display: "grid", gap: 8, marginTop: 8, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                            <div style={{ fontSize: 12, color: "#dce5f2" }}>
                              Edition d'emprise en cours: {selectedAreaCellKeys.length} case{selectedAreaCellKeys.length > 1 ? "s" : ""} selectionnee{selectedAreaCellKeys.length > 1 ? "s" : ""}
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button type="button" onClick={validateFootprintEdit} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                                Valider
                              </button>
                              <button type="button" onClick={cancelFootprintEdit} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}
                        {territoryPropertiesEditActive && (
                          <div style={{ display: "grid", gap: 8, marginTop: 8, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Id technique
                              <input
                                value={territoryPropertyDraft.id}
                                onChange={event => setTerritoryPropertyDraft(current => ({ ...current, id: event.target.value }))}
                                style={FIELD_STYLE}
                              />
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Wiki entity id
                              <input
                                value={territoryPropertyDraft.wikiEntityId}
                                onChange={event => setTerritoryPropertyDraft(current => ({ ...current, wikiEntityId: event.target.value }))}
                                style={FIELD_STYLE}
                              />
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Capitale
                              <select
                                value={territoryPropertyDraft.capitalCityId}
                                onChange={event => setTerritoryPropertyDraft(current => ({ ...current, capitalCityId: event.target.value }))}
                                style={FIELD_STYLE}
                              >
                                <option value="">Aucune</option>
                                {layout.cities.map(city => (
                                  <option key={city.id} value={city.id}>
                                    {city.wikiEntityId} ({city.id})
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Couleur
                              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, alignItems: "center" }}>
                                <input
                                  type="color"
                                  value={territoryPropertyDraft.color}
                                  onChange={event => setTerritoryPropertyDraft(current => ({ ...current, color: event.target.value }))}
                                />
                                <input
                                  value={territoryPropertyDraft.color}
                                  onChange={event => setTerritoryPropertyDraft(current => ({ ...current, color: event.target.value }))}
                                  style={FIELD_STYLE}
                                />
                              </div>
                            </label>
                            <div style={{ fontSize: 12, color: "#8fa0b7" }}>
                              Les regions associees restent gerees depuis le sous-onglet `Region administrative`.
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button type="button" onClick={saveTerritoryProperties} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                                Enregistrer
                              </button>
                              <button type="button" onClick={cancelTerritoryPropertiesEditor} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {!selectedGovernanceTerritory && (
                      <div style={{ fontSize: 12, color: "#8fa0b7" }}>Selectionne une pastille pour afficher les details d'un territoire existant.</div>
                    )}
                    <CollapsibleSection title="Creer territoire">
                      <input value={draftTerritoryId} placeholder="slug_territoire" onChange={event => updateDraftField("draftTerritoryId", event.target.value)} style={FIELD_STYLE} />
                      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                        Gouvernance du lore
                        <select value={selectedGovernanceLoreId} onChange={event => updateLoreField("selectedGovernanceLoreId", event.target.value)} style={FIELD_STYLE}>
                          <option value="">Choisir une gouvernance</option>
                          {wikiGovernances.map(entry => (
                            <option key={entry.id} value={entry.id}>
                              {entry.name} ({entry.id})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                        Id gouvernance custom
                        <input value={draftGovernanceId} placeholder="slug_gouvernance" onChange={event => updateDraftField("draftGovernanceId", event.target.value)} style={FIELD_STYLE} />
                      </label>
                      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, alignItems: "center" }}>
                        <input type="color" value={draftTerritoryColor} onChange={event => updateDraftField("draftTerritoryColor", event.target.value)} />
                        <input value={draftTerritoryColor} onChange={event => updateDraftField("draftTerritoryColor", event.target.value)} style={FIELD_STYLE} />
                      </div>
                      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                        Capitale du territoire
                        <select value={draftGovernanceCapitalCityId} onChange={event => updateDraftField("draftGovernanceCapitalCityId", event.target.value)} style={FIELD_STYLE}>
                          <option value="">Aucune</option>
                          {layout.cities.map(city => (
                            <option key={city.id} value={city.id}>
                              {city.wikiEntityId} ({city.id})
                            </option>
                          ))}
                        </select>
                      </label>
                      <div style={{ fontSize: 11, color: "#8fa0b7", lineHeight: 1.45 }}>
                        La creation definit le territoire et ses proprietes. L'emprise se modifie ensuite via `Editer l'emprise`.
                      </div>
                      <button
                        type="button"
                        onClick={createGovernanceTerritoryDefinitionOnly}
                        disabled={!draftTerritoryId.trim()}
                        style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: draftTerritoryId.trim() ? "pointer" : "not-allowed", fontWeight: 700, opacity: draftTerritoryId.trim() ? 1 : 0.55 }}
                      >
                        Creer territoire
                      </button>
                    </CollapsibleSection>
                  </CollapsibleSection>

                  <CollapsibleSection title="Region administrative">
                    <div style={{ fontSize: 12, color: "#c9d3e2", lineHeight: 1.45 }}>
                      Une region administrative peut etre rattachee a un territoire et a une ville principale. La pastille selectionne la region sans charger son emprise.
                    </div>
                    <div style={{ fontSize: 12, color: "#dce5f2" }}>Bibliotheque</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(layout.governanceRegions ?? []).map(entry => {
                        const active = selectedGovernanceRegionId === entry.id;
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => activateGovernanceRegionSelection(entry.id)}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 999,
                              border: active ? "1px solid rgba(255,255,255,0.66)" : "1px solid rgba(255,255,255,0.14)",
                              background: entry.color,
                              color: "#f8fbff",
                              cursor: "pointer",
                              fontWeight: 700,
                              fontSize: 12,
                              boxShadow: active ? "0 0 0 2px rgba(255,255,255,0.18) inset" : "none"
                            }}
                            title="Selectionner cette region"
                          >
                            {getRegionDisplayName(entry.id)}
                          </button>
                        );
                      })}
                    </div>
                    {selectedGovernanceRegion && (
                      <div style={{ ...SUBSECTION_STYLE, border: "1px solid rgba(143,179,255,0.38)", boxShadow: "0 0 0 1px rgba(143,179,255,0.14) inset" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Region selectionnee: {getRegionDisplayName(selectedGovernanceRegion.id)}</div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>Wiki entity id: {selectedRegionWiki?.name ?? selectedGovernanceRegion.wikiEntityId}</div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>Territoire parent: {selectedGovernanceRegion.territoryId ?? "aucun"}</div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>Ville principale: {selectedRegionPrincipalCity?.wikiEntityId ?? selectedRegionPrincipalCity?.id ?? "aucune"}</div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>Emprise actuelle: {selectedRegionCellKeys.length} case{selectedRegionCellKeys.length > 1 ? "s" : ""}</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" onClick={() => selectedGovernanceRegionId && startFootprintEdit("region", selectedGovernanceRegionId)} disabled={zoneEditSession?.kind === "region" && zoneEditSession.id === selectedGovernanceRegionId} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: selectedGovernanceRegionId ? 1 : 0.45 }}>
                            Editer l'emprise
                          </button>
                          <button type="button" onClick={openRegionPropertiesEditor} disabled={regionPropertiesEditActive} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: regionPropertiesEditActive ? 0.6 : 1 }}>
                            Editer les proprietes
                          </button>
                          <button type="button" onClick={() => dispatch({ type: "deleteSelectedGovernanceRegion" })} style={{ ...createEditorButtonStyle({ compact: true, danger: true }), borderRadius: 8 }}>
                            Supprimer l'element
                          </button>
                        </div>
                        {zoneEditSession?.kind === "region" && zoneEditSession.id === selectedGovernanceRegionId && (
                          <div style={{ display: "grid", gap: 8, marginTop: 8, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                            <div style={{ fontSize: 12, color: "#dce5f2" }}>Edition d'emprise en cours: {selectedAreaCellKeys.length} case{selectedAreaCellKeys.length > 1 ? "s" : ""} selectionnee{selectedAreaCellKeys.length > 1 ? "s" : ""}</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button type="button" onClick={validateFootprintEdit} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                                Valider
                              </button>
                              <button type="button" onClick={cancelFootprintEdit} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}
                        {regionPropertiesEditActive && (
                          <div style={{ display: "grid", gap: 8, marginTop: 8, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Id technique
                              <input value={regionPropertyDraft.id} onChange={event => setRegionPropertyDraft(current => ({ ...current, id: event.target.value }))} style={FIELD_STYLE} />
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Wiki entity id
                              <input value={regionPropertyDraft.wikiEntityId} onChange={event => setRegionPropertyDraft(current => ({ ...current, wikiEntityId: event.target.value }))} style={FIELD_STYLE} />
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Territoire parent
                              <select value={regionPropertyDraft.territoryId} onChange={event => setRegionPropertyDraft(current => ({ ...current, territoryId: event.target.value }))} style={FIELD_STYLE}>
                                <option value="">Aucun</option>
                                {(layout.governanceTerritories ?? []).map(entry => (
                                  <option key={entry.id} value={entry.id}>
                                    {entry.id}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Ville principale
                              <select value={regionPropertyDraft.principalCityId} onChange={event => setRegionPropertyDraft(current => ({ ...current, principalCityId: event.target.value }))} style={FIELD_STYLE}>
                                <option value="">Aucune</option>
                                {layout.cities.map(city => (
                                  <option key={city.id} value={city.id}>
                                    {city.wikiEntityId} ({city.id})
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Couleur
                              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, alignItems: "center" }}>
                                <input type="color" value={regionPropertyDraft.color} onChange={event => setRegionPropertyDraft(current => ({ ...current, color: event.target.value }))} />
                                <input value={regionPropertyDraft.color} onChange={event => setRegionPropertyDraft(current => ({ ...current, color: event.target.value }))} style={FIELD_STYLE} />
                              </div>
                            </label>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button type="button" onClick={saveRegionProperties} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                                Enregistrer
                              </button>
                              <button type="button" onClick={cancelRegionPropertiesEditor} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {!selectedGovernanceRegion && <div style={{ fontSize: 12, color: "#8fa0b7" }}>Selectionne une pastille pour afficher les details d'une region existante.</div>}
                    <CollapsibleSection title="Creer region">
                      <input value={draftRegionId} placeholder="slug_region" onChange={event => updateDraftField("draftRegionId", event.target.value)} style={FIELD_STYLE} />
                      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, alignItems: "center" }}>
                        <input type="color" value={draftRegionColor} onChange={event => updateDraftField("draftRegionColor", event.target.value)} />
                        <input value={draftRegionColor} onChange={event => updateDraftField("draftRegionColor", event.target.value)} style={FIELD_STYLE} />
                      </div>
                      <button type="button" onClick={createGovernanceRegionDefinitionOnly} disabled={!draftRegionId.trim()} style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: draftRegionId.trim() ? "pointer" : "not-allowed", fontWeight: 700, opacity: draftRegionId.trim() ? 1 : 0.55 }}>
                        Creer region
                      </button>
                    </CollapsibleSection>
                  </CollapsibleSection>

                  <CollapsibleSection title="Zones geographiques">
                    <div style={{ fontSize: 12, color: "#c9d3e2", lineHeight: 1.45 }}>
                      Une case peut appartenir a plusieurs zones geographiques. La pastille selectionne une zone sans charger son emprise.
                    </div>
                    <div style={{ fontSize: 12, color: "#dce5f2" }}>Bibliotheque</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(layout.geographicZones ?? []).map(entry => {
                        const active = selectedGeographicZoneId === entry.id;
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => activateGeographicZoneSelection(entry.id)}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 999,
                              border: active ? "1px solid rgba(255,255,255,0.66)" : "1px solid rgba(255,255,255,0.14)",
                              background: entry.color,
                              color: "#f8fbff",
                              cursor: "pointer",
                              fontWeight: 700,
                              fontSize: 12,
                              boxShadow: active ? "0 0 0 2px rgba(255,255,255,0.18) inset" : "none"
                            }}
                            title="Selectionner cette zone"
                          >
                            {getGeographicZoneDisplayName(entry.id)}
                          </button>
                        );
                      })}
                    </div>
                    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                      Zone du lore
                      <select value={selectedGeographicZoneLoreId} onChange={event => updateLoreField("selectedGeographicZoneLoreId", event.target.value)} style={FIELD_STYLE}>
                        <option value="">Aucune entree de lore</option>
                        {wikiGeoZones.map(entry => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name} ({entry.id})
                          </option>
                        ))}
                      </select>
                    </label>
                    {selectedGeographicZone && (
                      <div style={{ ...SUBSECTION_STYLE, border: "1px solid rgba(143,179,255,0.38)", boxShadow: "0 0 0 1px rgba(143,179,255,0.14) inset" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Zone selectionnee: {getGeographicZoneDisplayName(selectedGeographicZone.id)}</div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>Wiki entity id: {selectedGeographicZone.wikiEntityId ?? "aucun"}</div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>Type: {selectedGeographicZone.kind}</div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>Emprise actuelle: {selectedGeographicZoneCellKeys.length} case{selectedGeographicZoneCellKeys.length > 1 ? "s" : ""}</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" onClick={() => selectedGeographicZoneId && startFootprintEdit("geographicZone", selectedGeographicZoneId)} disabled={zoneEditSession?.kind === "geographicZone" && zoneEditSession.id === selectedGeographicZoneId} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: selectedGeographicZoneId ? 1 : 0.45 }}>
                            Editer l'emprise
                          </button>
                          <button type="button" onClick={openGeographicZonePropertiesEditor} disabled={geographicZonePropertiesEditActive} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: geographicZonePropertiesEditActive ? 0.6 : 1 }}>
                            Editer les proprietes
                          </button>
                          <button type="button" onClick={() => dispatch({ type: "deleteSelectedGeographicZone" })} style={{ ...createEditorButtonStyle({ compact: true, danger: true }), borderRadius: 8 }}>
                            Supprimer l'element
                          </button>
                        </div>
                        {zoneEditSession?.kind === "geographicZone" && zoneEditSession.id === selectedGeographicZoneId && (
                          <div style={{ display: "grid", gap: 8, marginTop: 8, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                            <div style={{ fontSize: 12, color: "#dce5f2" }}>Edition d'emprise en cours: {selectedAreaCellKeys.length} case{selectedAreaCellKeys.length > 1 ? "s" : ""} selectionnee{selectedAreaCellKeys.length > 1 ? "s" : ""}</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button type="button" onClick={validateFootprintEdit} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                                Valider
                              </button>
                              <button type="button" onClick={cancelFootprintEdit} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}
                        {geographicZonePropertiesEditActive && (
                          <div style={{ display: "grid", gap: 8, marginTop: 8, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Id technique
                              <input value={geographicZonePropertyDraft.id} onChange={event => setGeographicZonePropertyDraft(current => ({ ...current, id: event.target.value }))} style={FIELD_STYLE} />
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Wiki entity id
                              <input value={geographicZonePropertyDraft.wikiEntityId} onChange={event => setGeographicZonePropertyDraft(current => ({ ...current, wikiEntityId: event.target.value }))} style={FIELD_STYLE} />
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Libelle
                              <input value={geographicZonePropertyDraft.label} onChange={event => setGeographicZonePropertyDraft(current => ({ ...current, label: event.target.value }))} style={FIELD_STYLE} />
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Type
                              <select value={geographicZonePropertyDraft.kind} onChange={event => setGeographicZonePropertyDraft(current => ({ ...current, kind: event.target.value as GeographicZoneKind }))} style={FIELD_STYLE}>
                                <option value="natural">Naturelle</option>
                                <option value="cultural">Culturelle</option>
                                <option value="historical">Historique</option>
                                <option value="religious">Religieuse</option>
                                <option value="strategic">Strategique</option>
                                <option value="custom">Personnalisee</option>
                              </select>
                            </label>
                            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto 1fr", gap: 8, alignItems: "center" }}>
                              <input type="color" value={geographicZonePropertyDraft.color} onChange={event => setGeographicZonePropertyDraft(current => ({ ...current, color: event.target.value }))} />
                              <input value={geographicZonePropertyDraft.color} onChange={event => setGeographicZonePropertyDraft(current => ({ ...current, color: event.target.value }))} style={FIELD_STYLE} />
                              <input type="color" value={geographicZonePropertyDraft.borderColor} onChange={event => setGeographicZonePropertyDraft(current => ({ ...current, borderColor: event.target.value }))} />
                              <input value={geographicZonePropertyDraft.borderColor} onChange={event => setGeographicZonePropertyDraft(current => ({ ...current, borderColor: event.target.value }))} style={FIELD_STYLE} />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              <input type="number" min={1} step={0.2} value={geographicZonePropertyDraft.borderWidth} onChange={event => setGeographicZonePropertyDraft(current => ({ ...current, borderWidth: event.target.value }))} style={FIELD_STYLE} />
                              <input value={geographicZonePropertyDraft.borderDashArray} onChange={event => setGeographicZonePropertyDraft(current => ({ ...current, borderDashArray: event.target.value }))} style={FIELD_STYLE} />
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button type="button" onClick={saveGeographicZoneProperties} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                                Enregistrer
                              </button>
                              <button type="button" onClick={cancelGeographicZonePropertiesEditor} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {!selectedGeographicZone && <div style={{ fontSize: 12, color: "#8fa0b7" }}>Selectionne une pastille pour afficher les details d'une zone existante.</div>}
                    <CollapsibleSection title="Creer zone geographique">
                      <input value={draftGeographicZoneId} placeholder="slug_zone_geo" onChange={event => updateDraftField("draftGeographicZoneId", event.target.value)} style={FIELD_STYLE} />
                      <input value={draftGeographicZoneLabel} placeholder="Zone geographique" onChange={event => updateDraftField("draftGeographicZoneLabel", event.target.value)} style={FIELD_STYLE} />
                      <select value={draftGeographicZoneKind} onChange={event => updateDraftField("draftGeographicZoneKind", event.target.value as GeographicZoneKind)} style={FIELD_STYLE}>
                        <option value="natural">Naturelle</option>
                        <option value="cultural">Culturelle</option>
                        <option value="historical">Historique</option>
                        <option value="religious">Religieuse</option>
                        <option value="strategic">Strategique</option>
                        <option value="custom">Personnalisee</option>
                      </select>
                      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto 1fr", gap: 8, alignItems: "center" }}>
                        <input type="color" value={draftGeographicZoneColor} onChange={event => updateDraftField("draftGeographicZoneColor", event.target.value)} />
                        <input value={draftGeographicZoneColor} onChange={event => updateDraftField("draftGeographicZoneColor", event.target.value)} style={FIELD_STYLE} />
                        <input type="color" value={draftGeographicZoneBorderColor} onChange={event => updateDraftField("draftGeographicZoneBorderColor", event.target.value)} />
                        <input value={draftGeographicZoneBorderColor} onChange={event => updateDraftField("draftGeographicZoneBorderColor", event.target.value)} style={FIELD_STYLE} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        <input type="number" min={1} step={0.2} value={draftGeographicZoneBorderWidth} onChange={event => updateDraftField("draftGeographicZoneBorderWidth", event.target.value)} style={FIELD_STYLE} />
                        <input value={draftGeographicZoneBorderDashArray} onChange={event => updateDraftField("draftGeographicZoneBorderDashArray", event.target.value)} style={FIELD_STYLE} />
                        <div style={{ fontSize: 12, color: "#8fa0b7", alignSelf: "center" }}>Contour</div>
                      </div>
                      <button type="button" onClick={createGeographicZoneDefinitionOnly} disabled={!(draftGeographicZoneId.trim() || selectedGeographicZoneLoreId.trim())} style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: draftGeographicZoneId.trim() || selectedGeographicZoneLoreId.trim() ? "pointer" : "not-allowed", fontWeight: 700, opacity: draftGeographicZoneId.trim() || selectedGeographicZoneLoreId.trim() ? 1 : 0.55 }}>
                        Creer zone
                      </button>
                    </CollapsibleSection>
                  </CollapsibleSection>
                </div>
              </HexZonesPanel>
            )}

            {contextualHexSection === "routes" && (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>
                      {selectedRoute?.kind === "river" ? "Cours d'eau actif" : "Route active"}
                    </div>
                    {selectedRoute && (
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "deleteSelectedRoute" })}
                        title={selectedRoute.kind === "river" ? "Supprimer ce cours d'eau" : "Supprimer cette route"}
                        aria-label={selectedRoute.kind === "river" ? "Supprimer ce cours d'eau" : "Supprimer cette route"}
                        style={{
                          ...createEditorButtonStyle({ danger: true, compact: true }),
                          width: 32,
                          height: 32,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 8,
                          padding: 0
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M4 7H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <path d="M9 4H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <path d="M7 7L8 19C8.1 20.1 8.9 21 10 21H14C15.1 21 15.9 20.1 16 19L17 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M10 11V17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <path d="M14 11V17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div style={{ ...editorTextStyles.helper, color: routeDrawActive ? "#8dd6a5" : editorTextStyles.helper.color, fontWeight: 700 }}>
                    {routeDrawActive ? "Trace en cours" : "Trace en pause"}
                  </div>
                </div>
                <div style={{ ...SUBSECTION_STYLE, gap: 10 }}>
                  <div style={editorTextStyles.sectionTitle}>Creation et selection</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => createLinearFeature("road")}
                      style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}
                    >
                      Nouvelle route
                    </button>
                    <button
                      type="button"
                      onClick={() => createLinearFeature("river")}
                      style={{ ...createEditorButtonStyle({ active: true, compact: true }), borderRadius: 8, border: "1px solid rgba(110,201,255,0.26)" }}
                    >
                      Nouveau cours d'eau
                    </button>
                  </div>
                  <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                    Routes terrestres
                    <select
                      value={selectedRoute?.kind === "road" ? selectedRouteId : ""}
                      onChange={event => {
                        if (event.target.value) dispatch({ type: "setSelectedRoute", routeId: event.target.value });
                      }}
                      style={FIELD_STYLE}
                    >
                      <option value="">Choisir une route</option>
                      {roadPaths.map(path => (
                        <option key={path.id} value={path.id}>
                          {path.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                    Cours d'eau
                    <select
                      value={selectedRoute?.kind === "river" ? selectedRouteId : ""}
                      onChange={event => {
                        if (event.target.value) dispatch({ type: "setSelectedRoute", routeId: event.target.value });
                      }}
                      style={FIELD_STYLE}
                    >
                      <option value="">Choisir un cours d'eau</option>
                      {riverPaths.map(path => (
                        <option key={path.id} value={path.id}>
                          {path.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {selectedRoute && (
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ ...SUBSECTION_STYLE, gap: 6 }}>
                      <div style={editorTextStyles.sectionTitle}>Element actif</div>
                      <div style={{ ...editorTextStyles.helper, color: EDITOR_THEME.colors.text }}>
                        {selectedRoute.kind === "road" ? "Route terrestre" : "Cours d'eau"}
                      </div>
                    </div>
                    <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                      Label
                      <input
                        value={selectedRoute.label}
                        onChange={event => dispatch({ type: "updateSelectedRouteField", field: "label", value: event.target.value })}
                        style={FIELD_STYLE}
                      />
                    </label>
                    {selectedRoute.kind === "road" && (
                      <div style={SUBSECTION_STYLE}>
                        <div style={editorTextStyles.sectionTitle}>Parametres de route</div>
                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                          Type de route
                          <select
                            value={selectedRoute.roadType ?? "road"}
                            onChange={event => dispatch({ type: "updateSelectedRouteField", field: "roadType", value: event.target.value })}
                            style={FIELD_STYLE}
                          >
                            <option value="track">Piste</option>
                            <option value="road">Route</option>
                            <option value="major_road">Grande route</option>
                          </select>
                        </label>
                        <div style={editorTextStyles.helper}>
                          {routeDrawActive
                            ? "Clique sur les hex pour ajouter des points. Une route ne peut pas traverser une falaise."
                            : "Active le trace pour poser de nouveaux segments sur la carte."}
                        </div>
                        <button
                          type="button"
                          onClick={() => dispatch({ type: "updateSelectedRouteField", field: "kind", value: "river" })}
                          style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}
                        >
                          Convertir en cours d'eau
                        </button>
                      </div>
                    )}
                    {selectedRoute.kind === "river" && (
                      <div style={SUBSECTION_STYLE}>
                        <div style={editorTextStyles.sectionTitle}>Parametres du cours d'eau</div>
                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                          Debit de depart
                          <input
                            type="number"
                            min={1}
                            step={0.5}
                            value={selectedRoute.sourceFlow ?? 1}
                            onChange={event => dispatch({ type: "updateSelectedRouteField", field: "sourceFlow", value: event.target.value })}
                            style={FIELD_STYLE}
                          />
                        </label>
                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                          Origine
                          <select
                            value={selectedRoute.sourceType ?? "source"}
                            onChange={event => dispatch({ type: "updateSelectedRouteField", field: "sourceType", value: event.target.value })}
                            style={FIELD_STYLE}
                          >
                            <option value="source">Source</option>
                            <option value="tributary">Affluent</option>
                            <option value="main">Cours principal</option>
                          </select>
                        </label>
                        <div style={{ display: "grid", gap: 4, ...editorTextStyles.helper }}>
                          <div>
                            Type actuel: {getRiverFlowCategoryLabel(getRiverFlowValue(selectedRoute))}
                          </div>
                          <div>
                            Debit derive: {getRiverFlowValue(selectedRoute)}
                          </div>
                          <div>
                            Sens: source vers aval, selon l'ordre des cases
                          </div>
                          <div>
                            Origine actuelle: {getRiverSourceTypeLabel(selectedRoute.sourceType ?? "source")}
                          </div>
                          <div>
                            Passages de falaise: {selectedRiverWaterfallCount}
                          </div>
                        </div>
                        <div style={editorTextStyles.helper}>
                          {routeDrawActive
                            ? "Clique sur les hex pour ajouter des points. Le sens suit l'ordre du trace, de la source vers l'aval."
                            : "Active le trace pour prolonger le cours d'eau sur la carte."}
                        </div>
                        <button
                          type="button"
                          onClick={() => dispatch({ type: "updateSelectedRouteField", field: "kind", value: "road" })}
                          style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}
                        >
                          Convertir en route terrestre
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "setRouteDrawActive", value: !routeDrawActive })}
                      style={{ ...createEditorButtonStyle({ active: routeDrawActive, compact: true }), borderRadius: 8, border: routeDrawActive ? "1px solid rgba(141,214,165,0.28)" : "1px solid rgba(196,210,232,0.18)" }}
                    >
                      {routeDrawActive ? "Valider le trace" : "Commencer le trace"}
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "reverseSelectedRoute" })}
                      style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}
                    >
                      Inverser le sens
                    </button>
                    {selectedCellKey && cellFeatureIndex[selectedCellKey] && (
                      <div style={editorTextStyles.helper}>
                        Case active: {cellFeatureIndex[selectedCellKey].roads.length > 0 ? `${cellFeatureIndex[selectedCellKey].roads.length} route(s)` : "aucune route"} |{" "}
                        {cellFeatureIndex[selectedCellKey].rivers.length > 0 ? `${cellFeatureIndex[selectedCellKey].rivers.length} cours d'eau` : "aucun cours d'eau"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 12, ...editorTextStyles.helper }}>
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
              style={editorFieldStyles.textarea}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <button type="button" onClick={applyJson} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                Appliquer JSON
              </button>
              <button type="button" onClick={() => updateJsonBuffer(layoutToJson(layout))} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                Regenerer JSON
              </button>
              <button type="button" onClick={downloadJson} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                Telecharger JSON
              </button>
              <button type="button" onClick={() => void persistLayoutToServer()} disabled={persistenceState === "saving"} style={{ ...createEditorButtonStyle({ active: true, compact: true }), borderRadius: 8, cursor: persistenceState === "saving" ? "wait" : "pointer", opacity: persistenceState === "saving" ? 0.7 : 1 }}>
                Sauver serveur
              </button>
              <button type="button" onClick={() => void reloadLayoutFromServer()} disabled={persistenceState === "saving"} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, cursor: persistenceState === "saving" ? "wait" : "pointer" }}>
                Recharger serveur
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
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
            <div style={{ marginTop: 8, fontSize: 12, color: persistenceMeta.color, fontFamily: EDITOR_THEME.fontFamily }}>
              {persistenceMeta.label}
            </div>
            {jsonError && <div style={{ marginTop: 8, fontSize: 12, color: "#ff9d76", fontFamily: EDITOR_THEME.fontFamily }}>{jsonError}</div>}
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
        organizationOverlayActive={activeTool === "zones"}
        labelAppearance={labelAppearance}
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
        onCellClick={handleEditorCellClick}
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
              selectedZoneNames={selectedGeographicZones.map(zone => zone.label)}
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
