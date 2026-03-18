import { getWorldMapCellKey, type WorldMapLayout } from "../../data/worldMapLayout";
import { cloneLayout } from "../mapShared";
import { type MapEditorState } from "./mapEditorReducer";

export function createInitialMapEditorState(initialLayout: WorldMapLayout, initialJsonBuffer: string): MapEditorState {
  return {
    layout: cloneLayout(initialLayout),
    layerVisibility: { ...initialLayout.defaultLayers },
    selectedCellKey: getWorldMapCellKey({ x: 13, y: 11 }),
    selectedRouteId: initialLayout.paths[0]?.id ?? "",
    routeDrawActive: false,
    selectedAreaCellKeys: [],
    activeTool: "inspect",
    jsonBuffer: initialJsonBuffer,
    jsonError: null,
    openPanels: {
      legend: true,
      layers: true,
      json: false
    },
    selectedLoreCityId: "",
    selectedLoreLocationId: "",
    draftCityName: "",
    draftTerritoryId: "",
    draftTerritoryColor: "#d7b56d",
    draftRegionId: "",
    draftRegionColor: "#5a7d8f",
    selectedTerritoryLoreId: "",
    selectedRegionLoreId: "",
    hexModalPosition: { x: 420, y: 20 },
    customGeographies: [],
    customTags: [],
    draftGeographyName: "",
    draftGeographyColor: "#5a7d8f",
    draftGeographySurface: "land",
    draftGeographyDifficulty: "5",
    draftTagName: "",
    draftTagColor: "#5fa8d3",
    pendingGeographyId: "",
    pendingReliefElevation: "",
    pendingTagIds: [],
    persistenceState: "idle",
    lastSavedLayoutJson: initialJsonBuffer
  };
}
