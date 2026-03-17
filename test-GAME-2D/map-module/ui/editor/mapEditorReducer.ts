import { getWorldMapCellKey, type MapLayerId, type ReliefElevationLevel, type WorldMapLayout } from "../../data/worldMapLayout";
import { cloneLayout, ensureCell } from "../mapShared";
import {
  addLocationToCell,
  attachLoreCityToCell,
  appendRoutePoint,
  applyPendingTerrainToCells,
  assignRegionToCells,
  assignTerritoryToCells,
  createDraftCityOnCell,
  createRoute,
  getTargetCellKeys,
  removeCityFromSelectedCell,
  removeCliffSegment,
  upsertCliffSegment,
  updateCityFieldOnLayout
} from "./mapEditorLayoutUtils";

export type EditorToolId = "inspect" | "terrain" | "places" | "zones" | "routes";
export type PanelId = "legend" | "layers" | "json";

export type CustomGeography = {
  id: string;
  label: string;
  geography: string;
  color: string;
  surface: "land" | "ocean";
  difficulty: number;
};

export type CustomTag = {
  id: string;
  label: string;
  color: string;
};

export type PersistenceState = "idle" | "saving" | "saved" | "error";

export type MapEditorState = {
  layout: WorldMapLayout;
  layerVisibility: Record<MapLayerId, boolean>;
  selectedCellKey: string;
  selectedRouteId: string;
  selectedAreaCellKeys: string[];
  activeTool: EditorToolId;
  jsonBuffer: string;
  jsonError: string | null;
  openPanels: Record<PanelId, boolean>;
  selectedLoreCityId: string;
  selectedLoreLocationId: string;
  draftCityName: string;
  draftTerritoryId: string;
  draftTerritoryColor: string;
  draftRegionId: string;
  draftRegionColor: string;
  selectedTerritoryLoreId: string;
  selectedRegionLoreId: string;
  hexModalPosition: { x: number; y: number };
  customGeographies: CustomGeography[];
  customTags: CustomTag[];
  draftGeographyName: string;
  draftGeographyColor: string;
  draftGeographySurface: "land" | "ocean";
  draftGeographyDifficulty: string;
  draftTagName: string;
  draftTagColor: string;
  pendingGeographyId: string;
  pendingReliefElevation: "" | ReliefElevationLevel;
  pendingTagIds: string[];
  persistenceState: PersistenceState;
  lastSavedLayoutJson: string;
};

export type MapEditorHistoryState = {
  past: MapEditorState[];
  present: MapEditorState;
  future: MapEditorState[];
};

type DraftField =
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
  | "draftTagColor";

type LoreField =
  | "selectedLoreCityId"
  | "selectedLoreLocationId"
  | "selectedTerritoryLoreId"
  | "selectedRegionLoreId";

export type MapEditorAction =
  | { type: "togglePanel"; panelId: PanelId }
  | { type: "activateTool"; toolId: EditorToolId }
  | { type: "setLayerVisibility"; layerVisibility: Record<MapLayerId, boolean> }
  | { type: "setJsonBuffer"; value: string }
  | { type: "setJsonError"; value: string | null }
  | { type: "setSelectedCell"; cellKey: string }
  | { type: "setSelectedRoute"; routeId: string }
  | { type: "toggleAreaCell"; cellKey: string }
  | { type: "clearAreaSelection" }
  | { type: "setLoreField"; field: LoreField; value: string }
  | { type: "setDraftField"; field: DraftField; value: string | "land" | "ocean" }
  | { type: "setHexModalPosition"; position: { x: number; y: number } }
  | { type: "setCustomGeographies"; value: CustomGeography[] }
  | { type: "setCustomTags"; value: CustomTag[] }
  | { type: "setPendingGeography"; value: string }
  | { type: "setPendingReliefElevation"; value: "" | ReliefElevationLevel }
  | { type: "setPendingTags"; value: string[] }
  | { type: "setPersistenceState"; value: PersistenceState }
  | { type: "setLastSavedLayoutJson"; value: string }
  | {
      type: "applyPendingTerrain";
      allGeographyPresets: Array<{ id: string; label: string; geography: string; color: string; surface: "land" | "ocean"; difficulty: number }>;
    }
  | { type: "setCliffBetweenCells"; highCellKey: string; lowCellKey: string }
  | { type: "removeCliffBetweenCells"; firstCellKey: string; secondCellKey: string }
  | { type: "assignTerritoryToSelection"; wikiEntityId: string; color: string }
  | { type: "assignRegionToSelection"; wikiEntityId: string; territoryWikiId: string; color: string }
  | { type: "appendRoutePoint"; cell: { x: number; y: number } }
  | { type: "createRoute"; routeId: string }
  | { type: "deleteSelectedRoute" }
  | { type: "popSelectedRoutePoint" }
  | { type: "updateSelectedRouteField"; field: "label" | "kind"; value: string }
  | { type: "attachLoreCityToSelectedCell"; wikiEntityId: string }
  | { type: "createDraftCityOnSelectedCell"; wikiEntityId: string }
  | { type: "addLoreLocationToSelectedCell"; wikiEntityId: string }
  | { type: "removeSelectedCity" }
  | { type: "updateSelectedCityField"; field: "wikiEntityId" | "kind" | "markerColor"; value: string }
  | { type: "replaceLayout"; nextState: Partial<MapEditorState>; resetHistory?: boolean }
  | { type: "undo" }
  | { type: "redo" };

const HISTORY_LIMIT = 100;

function normalizeSelectionState(state: MapEditorState): MapEditorState {
  const selectedCellExists = state.layout.cells.some(cell => getWorldMapCellKey(cell.cell) === state.selectedCellKey);
  const selectedCellKey = selectedCellExists
    ? state.selectedCellKey
    : (state.layout.cells[0] ? getWorldMapCellKey(state.layout.cells[0].cell) : "");
  const selectedCell = state.layout.cells.find(cell => getWorldMapCellKey(cell.cell) === selectedCellKey) ?? null;
  const selectedRouteId = state.layout.paths.some(path => path.id === state.selectedRouteId)
    ? state.selectedRouteId
    : (state.layout.paths[0]?.id ?? "");
  const selectedAreaCellKeys = state.selectedAreaCellKeys.filter(cellKey =>
    state.layout.cells.some(cell => getWorldMapCellKey(cell.cell) === cellKey)
  );

  return {
    ...state,
    selectedCellKey,
    selectedRouteId,
    selectedAreaCellKeys,
    selectedTerritoryLoreId: selectedCell?.territoryWikiId ?? "",
    selectedRegionLoreId: selectedCell?.regionWikiId ?? ""
  };
}

function withHistory(state: MapEditorHistoryState, nextPresent: MapEditorState): MapEditorHistoryState {
  const normalizedPresent = normalizeSelectionState(nextPresent);
  if (normalizedPresent === state.present) return state;
  const past = state.past.length >= HISTORY_LIMIT
    ? [...state.past.slice(1), state.present]
    : [...state.past, state.present];
  return {
    past,
    present: normalizedPresent,
    future: []
  };
}

function withoutHistory(state: MapEditorHistoryState, nextPresent: MapEditorState): MapEditorHistoryState {
  const normalizedPresent = normalizeSelectionState(nextPresent);
  if (normalizedPresent === state.present) return state;
  return {
    ...state,
    present: normalizedPresent
  };
}

export function createMapEditorHistoryState(initialState: MapEditorState): MapEditorHistoryState {
  return {
    past: [],
    present: normalizeSelectionState(initialState),
    future: []
  };
}

export function mapEditorReducer(state: MapEditorHistoryState, action: MapEditorAction): MapEditorHistoryState {
  switch (action.type) {
    case "togglePanel":
      return withoutHistory(state, {
        ...state.present,
        openPanels: {
          ...state.present.openPanels,
          [action.panelId]: !state.present.openPanels[action.panelId]
        }
      });
    case "activateTool":
      return withoutHistory(state, {
        ...state.present,
        activeTool: action.toolId
      });
    case "setLayerVisibility":
      return withoutHistory(state, {
        ...state.present,
        layerVisibility: action.layerVisibility
      });
    case "setJsonBuffer":
      return withoutHistory(state, {
        ...state.present,
        jsonBuffer: action.value
      });
    case "setJsonError":
      return withoutHistory(state, {
        ...state.present,
        jsonError: action.value
      });
    case "setSelectedCell":
      return withHistory(state, {
        ...state.present,
        selectedCellKey: action.cellKey
      });
    case "setSelectedRoute":
      return withHistory(state, {
        ...state.present,
        selectedRouteId: action.routeId
      });
    case "toggleAreaCell":
      return withHistory(state, {
        ...state.present,
        selectedAreaCellKeys: state.present.selectedAreaCellKeys.includes(action.cellKey)
          ? state.present.selectedAreaCellKeys.filter(item => item !== action.cellKey)
          : [...state.present.selectedAreaCellKeys, action.cellKey]
      });
    case "clearAreaSelection":
      return withHistory(state, {
        ...state.present,
        selectedAreaCellKeys: []
      });
    case "setLoreField":
      return withoutHistory(state, {
        ...state.present,
        [action.field]: action.value
      } as MapEditorState);
    case "setDraftField":
      return withoutHistory(state, {
        ...state.present,
        [action.field]: action.value
      } as MapEditorState);
    case "setHexModalPosition":
      return withoutHistory(state, {
        ...state.present,
        hexModalPosition: action.position
      });
    case "setCustomGeographies":
      return withoutHistory(state, {
        ...state.present,
        customGeographies: action.value
      });
    case "setCustomTags":
      return withoutHistory(state, {
        ...state.present,
        customTags: action.value
      });
    case "setPendingGeography":
      return withoutHistory(state, {
        ...state.present,
        pendingGeographyId: action.value
      });
    case "setPendingTags":
      return withoutHistory(state, {
        ...state.present,
        pendingTagIds: action.value
      });
    case "setPersistenceState":
      return withoutHistory(state, {
        ...state.present,
        persistenceState: action.value
      });
    case "setLastSavedLayoutJson":
      return withoutHistory(state, {
        ...state.present,
        lastSavedLayoutJson: action.value
      });
    case "applyPendingTerrain": {
      const targetKeys = getTargetCellKeys(state.present.selectedAreaCellKeys, state.present.selectedCellKey);
      if (targetKeys.length === 0) return state;
      const layout = cloneLayout(state.present.layout);
      applyPendingTerrainToCells(
        layout,
        targetKeys,
        state.present.pendingGeographyId,
        state.present.pendingTagIds,
        action.allGeographyPresets,
        state.present.pendingReliefElevation
      );
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "setPendingReliefElevation":
      return withoutHistory(state, {
        ...state.present,
        pendingReliefElevation: action.value
      });
    case "setCliffBetweenCells": {
      const layout = cloneLayout(state.present.layout);
      const [highX, highY] = action.highCellKey.split(",").map(Number);
      const [lowX, lowY] = action.lowCellKey.split(",").map(Number);
      const highCell = ensureCell(layout, { x: highX, y: highY });
      const lowCell = ensureCell(layout, { x: lowX, y: lowY });
      upsertCliffSegment(layout, highCell.cell, lowCell.cell);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "removeCliffBetweenCells": {
      const layout = cloneLayout(state.present.layout);
      const [firstX, firstY] = action.firstCellKey.split(",").map(Number);
      const [secondX, secondY] = action.secondCellKey.split(",").map(Number);
      removeCliffSegment(layout, { x: firstX, y: firstY }, { x: secondX, y: secondY });
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "assignTerritoryToSelection": {
      const cellKeys = getTargetCellKeys(state.present.selectedAreaCellKeys, state.present.selectedCellKey);
      if (cellKeys.length === 0) return state;
      const layout = cloneLayout(state.present.layout);
      assignTerritoryToCells(layout, cellKeys, action.wikiEntityId, action.color);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "assignRegionToSelection": {
      const cellKeys = getTargetCellKeys(state.present.selectedAreaCellKeys, state.present.selectedCellKey);
      if (cellKeys.length === 0) return state;
      const layout = cloneLayout(state.present.layout);
      assignRegionToCells(layout, cellKeys, action.wikiEntityId, action.territoryWikiId, action.color);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "appendRoutePoint": {
      if (!state.present.selectedRouteId) return state;
      const layout = cloneLayout(state.present.layout);
      appendRoutePoint(layout, state.present.selectedRouteId, action.cell);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "createRoute": {
      const layout = cloneLayout(state.present.layout);
      createRoute(layout, action.routeId);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedRouteId: action.routeId
      });
    }
    case "deleteSelectedRoute": {
      if (!state.present.selectedRouteId) return state;
      const layout = cloneLayout(state.present.layout);
      layout.paths = layout.paths.filter(path => path.id !== state.present.selectedRouteId);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedRouteId: layout.paths[0]?.id ?? ""
      });
    }
    case "popSelectedRoutePoint": {
      if (!state.present.selectedRouteId) return state;
      const layout = cloneLayout(state.present.layout);
      const route = layout.paths.find(path => path.id === state.present.selectedRouteId);
      route?.cells.pop();
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "updateSelectedRouteField": {
      if (!state.present.selectedRouteId) return state;
      const layout = cloneLayout(state.present.layout);
      const route = layout.paths.find(path => path.id === state.present.selectedRouteId);
      if (!route) return state;
      if (action.field === "kind") {
        route.kind = action.value === "river" ? "river" : "road";
      } else {
        route.label = action.value;
      }
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "attachLoreCityToSelectedCell": {
      if (!state.present.selectedCellKey || !action.wikiEntityId) return state;
      const layout = cloneLayout(state.present.layout);
      const selectedCell = layout.cells.find(cell => getWorldMapCellKey(cell.cell) === state.present.selectedCellKey);
      if (!selectedCell) return state;
      attachLoreCityToCell(layout, selectedCell.cell, action.wikiEntityId);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedLoreCityId: action.wikiEntityId
      });
    }
    case "createDraftCityOnSelectedCell": {
      if (!state.present.selectedCellKey || !action.wikiEntityId) return state;
      const layout = cloneLayout(state.present.layout);
      const selectedCell = layout.cells.find(cell => getWorldMapCellKey(cell.cell) === state.present.selectedCellKey);
      if (!selectedCell) return state;
      createDraftCityOnCell(layout, selectedCell.cell, action.wikiEntityId);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedLoreCityId: action.wikiEntityId
      });
    }
    case "addLoreLocationToSelectedCell": {
      if (!state.present.selectedCellKey || !action.wikiEntityId) return state;
      const layout = cloneLayout(state.present.layout);
      const selectedCell = layout.cells.find(cell => getWorldMapCellKey(cell.cell) === state.present.selectedCellKey);
      if (!selectedCell) return state;
      addLocationToCell(layout, selectedCell.cell, action.wikiEntityId);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedLoreLocationId: action.wikiEntityId
      });
    }
    case "removeSelectedCity": {
      if (!state.present.selectedCellKey) return state;
      const layout = cloneLayout(state.present.layout);
      const selectedCity = layout.cities.find(city => getWorldMapCellKey(city.cell) === state.present.selectedCellKey);
      if (!selectedCity) return state;
      removeCityFromSelectedCell(layout, selectedCity, state.present.selectedCellKey);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "updateSelectedCityField": {
      if (!state.present.selectedCellKey) return state;
      const layout = cloneLayout(state.present.layout);
      const selectedCity = layout.cities.find(city => getWorldMapCellKey(city.cell) === state.present.selectedCellKey);
      if (!selectedCity) return state;
      updateCityFieldOnLayout(layout, selectedCity, action.field, action.value);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "replaceLayout":
      return action.resetHistory
        ? {
            past: [],
            future: [],
            present: normalizeSelectionState({
              ...state.present,
              ...action.nextState
            })
          }
        : withoutHistory(state, {
            ...state.present,
            ...action.nextState
          });
    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: normalizeSelectionState(previous),
        future: [state.present, ...state.future]
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return {
        past: [...state.past, state.present],
        present: normalizeSelectionState(next),
        future: rest
      };
    }
    default:
      return state;
  }
}
