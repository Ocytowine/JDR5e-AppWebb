import { getWorldMapCellKey, type GeographicZoneKind, type MapCell, type MapLayerId, type PopulationProfile, type ReliefElevationLevel, type SimulationActorLevel, type SimulationActorPositionKind, type SimulationFactionRelationStatus, type SimulationObjectiveCategory, type SimulationObjectiveState, type SimulationObjectiveTargetKind, type SimulationTravelMode, type WorldMapLayout, type WorldMapSimulationDistrict, type WorldMapSimulationFaction, type WorldMapSimulationFactionRelation, type WorldMapSimulationMobileActor, type WorldMapSimulationObjective } from "../../data/worldMapLayout";
import { cloneLayout, ensureCell } from "../mapShared";
import {
  addLocationToCell,
  addSimulationFactionPresence,
  attachLoreCityToCell,
  appendRoutePoint,
  applyPendingTerrainToCells,
  assignGeographicZoneToCells,
  assignGovernanceRegionToCells,
  assignGovernanceTerritoryToCells,
  createDraftCityOnCell,
  createRoute,
  deleteGeographicZone,
  deleteGovernanceRegion,
  deleteGovernanceTerritory,
  deleteSimulationFaction,
  deleteSimulationFactionAnchor,
  deleteSimulationFactionRelation,
  deleteSimulationDistrict,
  deleteSimulationDistrictOverride,
  deleteSimulationMobileActor,
  deleteSimulationObjective,
  getTargetCellKeys,
  hasCliffBetweenCells,
  removeGeographicZoneFromCells,
  removeCityFromSelectedCell,
  removeCliffSegment,
  removeGovernanceRegionFromCells,
  removeGovernanceTerritoryFromCells,
  removeSimulationFactionPresence,
  replaceGeographicZoneCells,
  replaceGovernanceRegionCells,
  replaceGovernanceTerritoryCells,
  replaceSimulationFactionPresence,
  replaceSimulationObjectiveZones,
  reversePathDirection,
  upsertGeographicZoneDefinition,
  upsertGovernanceRegionDefinition,
  upsertGovernanceTerritoryDefinition,
  upsertSimulationFaction,
  upsertSimulationFactionAnchor,
  upsertSimulationFactionRelation,
  upsertSimulationDistrict,
  upsertSimulationMobileActor,
  upsertSimulationObjective,
  upsertCliffSegment,
  updateGeographicZoneOnLayout,
  updateGovernanceRegionOnLayout,
  updateGovernanceTerritoryOnLayout,
  updatePathFieldOnLayout,
  updateSimulationFactionField,
  updateSimulationFactionAnchorCell,
  updateSimulationFactionAnchorField,
  updateSimulationFactionRelationField,
  updateSimulationDistrictField,
  updateSimulationDistrictOverrideField,
  updateSimulationMobileActorField,
  updateSimulationMobileActorCellField,
  updateSimulationObjectiveField,
  updateCityFieldOnLayout
} from "./mapEditorLayoutUtils";

export type EditorToolId = "inspect" | "terrain" | "places" | "zones" | "routes" | "simulation";
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
  routeDrawActive: boolean;
  selectedAreaCellKeys: string[];
  activeTool: EditorToolId;
  jsonBuffer: string;
  jsonError: string | null;
  openPanels: Record<PanelId, boolean>;
  selectedLoreCityId: string;
  selectedLoreLocationId: string;
  draftCityName: string;
  selectedGovernanceTerritoryId: string;
  selectedGovernanceRegionId: string;
  selectedGeographicZoneId: string;
  draftTerritoryId: string;
  draftTerritoryColor: string;
  draftRegionId: string;
  draftRegionColor: string;
  draftGovernanceId: string;
  draftGovernanceColor: string;
  draftGovernanceCapitalCityId: string;
  draftGeographicZoneId: string;
  draftGeographicZoneLabel: string;
  draftGeographicZoneColor: string;
  draftGeographicZoneBorderColor: string;
  draftGeographicZoneBorderWidth: string;
  draftGeographicZoneBorderDashArray: string;
  draftGeographicZoneKind: GeographicZoneKind;
  selectedGovernanceLoreId: string;
  selectedGeographicZoneLoreId: string;
  hexModalPosition: { x: number; y: number };
  customGeographies: CustomGeography[];
  customTags: CustomTag[];
  draftGeographyName: string;
  draftGeographyColor: string;
  draftGeographySurface: "land" | "ocean";
  draftGeographyDifficulty: string;
  draftTagName: string;
  draftTagColor: string;
  selectedSimulationFactionId: string;
  draftSimulationFactionId: string;
  draftSimulationFactionLabel: string;
  draftSimulationFactionType: string;
  draftSimulationFactionColor: string;
  draftSimulationRelationTargetFactionId: string;
  draftSimulationRelationStatus: SimulationFactionRelationStatus;
  selectedSimulationObjectiveId: string;
  draftSimulationObjectiveId: string;
  draftSimulationObjectiveLabel: string;
  draftSimulationObjectiveCategory: SimulationObjectiveCategory;
  selectedSimulationMobileActorId: string;
  draftSimulationMobileActorId: string;
  draftSimulationMobileActorLabel: string;
  draftSimulationMobileActorType: string;
  draftSimulationMobileActorArchetype: string;
  draftSimulationMobileActorColor: string;
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
  | "selectedGovernanceTerritoryId"
  | "selectedGovernanceRegionId"
  | "selectedGeographicZoneId"
  | "draftTerritoryId"
  | "draftTerritoryColor"
  | "draftRegionId"
  | "draftRegionColor"
  | "draftGovernanceId"
  | "draftGovernanceColor"
  | "draftGovernanceCapitalCityId"
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
  | "draftTagColor"
  | "draftSimulationFactionId"
  | "draftSimulationFactionLabel"
  | "draftSimulationFactionType"
  | "draftSimulationFactionColor"
  | "draftSimulationRelationTargetFactionId"
  | "draftSimulationRelationStatus"
  | "draftSimulationObjectiveId"
  | "draftSimulationObjectiveLabel"
  | "draftSimulationObjectiveCategory"
  | "draftSimulationMobileActorId"
  | "draftSimulationMobileActorLabel"
  | "draftSimulationMobileActorType"
  | "draftSimulationMobileActorArchetype"
  | "draftSimulationMobileActorColor";

type LoreField =
  | "selectedLoreCityId"
  | "selectedLoreLocationId"
  | "selectedGovernanceLoreId"
  | "selectedGeographicZoneLoreId";

export type MapEditorAction =
  | { type: "togglePanel"; panelId: PanelId }
  | { type: "activateTool"; toolId: EditorToolId }
  | { type: "setLayerVisibility"; layerVisibility: Record<MapLayerId, boolean> }
  | { type: "setJsonBuffer"; value: string }
  | { type: "setJsonError"; value: string | null }
  | { type: "setSelectedCell"; cellKey: string }
  | { type: "setSelectedRoute"; routeId: string }
  | { type: "setRouteDrawActive"; value: boolean }
  | { type: "toggleAreaCell"; cellKey: string }
  | { type: "setAreaSelection"; cellKeys: string[] }
  | { type: "clearAreaSelection" }
  | { type: "setLoreField"; field: LoreField; value: string }
  | { type: "setDraftField"; field: DraftField; value: string | "land" | "ocean" }
  | { type: "setHexModalPosition"; position: { x: number; y: number } }
  | { type: "setCustomGeographies"; value: CustomGeography[] }
  | { type: "setCustomTags"; value: CustomTag[] }
  | { type: "setSelectedSimulationFaction"; factionId: string }
  | { type: "setSelectedSimulationObjective"; objectiveId: string }
  | { type: "setSelectedSimulationMobileActor"; actorId: string }
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
  | { type: "createGovernanceTerritoryDefinition"; territoryId: string; wikiEntityId: string; governanceId: string; color: string; capitalCityId: string }
  | { type: "createGovernanceRegionDefinition"; regionId: string; wikiEntityId: string; territoryId: string; governanceId: string; principalCityId: string; color: string }
  | {
      type: "createGeographicZoneDefinition";
      zoneId: string;
      label: string;
      kind: GeographicZoneKind;
      color: string;
      wikiEntityId?: string;
      borderColor?: string;
      borderWidth?: number;
      borderDashArray?: string;
    }
  | { type: "assignGovernanceTerritoryToSelection"; territoryId: string; wikiEntityId: string; governanceId: string; color: string; capitalCityId: string }
  | {
      type: "assignGovernanceRegionToSelection";
      regionId: string;
      wikiEntityId: string;
      territoryId: string;
      governanceId: string;
      principalCityId: string;
      color: string;
    }
  | {
      type: "assignGeographicZoneToSelection";
      zoneId: string;
      label: string;
      kind: GeographicZoneKind;
      color: string;
      wikiEntityId?: string;
      borderColor?: string;
      borderWidth?: number;
      borderDashArray?: string;
    }
  | { type: "removeGovernanceTerritoryFromSelection"; territoryId: string }
  | { type: "removeGovernanceRegionFromSelection"; regionId: string }
  | { type: "removeGeographicZoneFromSelection"; zoneId: string }
  | { type: "replaceGovernanceTerritorySelection"; territoryId: string; cellKeys: string[] }
  | { type: "replaceGovernanceRegionSelection"; regionId: string; territoryId?: string; cellKeys: string[] }
  | { type: "replaceGeographicZoneSelection"; zoneId: string; cellKeys: string[] }
  | { type: "deleteSelectedGovernanceTerritory" }
  | { type: "deleteSelectedGovernanceRegion" }
  | { type: "deleteSelectedGeographicZone" }
  | { type: "updateSelectedGovernanceTerritoryField"; field: "id" | "wikiEntityId" | "governanceId" | "color" | "capitalCityId"; value: string }
  | { type: "updateSelectedGovernanceRegionField"; field: "id" | "wikiEntityId" | "governanceId" | "territoryId" | "principalCityId" | "color"; value: string }
  | {
      type: "updateSelectedGeographicZoneField";
      field: "id" | "wikiEntityId" | "label" | "kind" | "color" | "borderColor" | "borderWidth" | "borderDashArray";
      value: string;
    }
  | { type: "appendRoutePoint"; cell: { x: number; y: number } }
  | { type: "createRoute"; routeId: string; kind?: "road" | "river" }
  | { type: "deleteSelectedRoute" }
  | { type: "popSelectedRoutePoint" }
  | { type: "updateSelectedRouteField"; field: "label" | "kind" | "roadType" | "sourceFlow" | "sourceType"; value: string }
  | { type: "reverseSelectedRoute" }
  | { type: "attachLoreCityToSelectedCell"; wikiEntityId: string }
  | { type: "createDraftCityOnSelectedCell"; wikiEntityId: string }
  | { type: "addLoreLocationToSelectedCell"; wikiEntityId: string }
  | { type: "removeSelectedCity" }
  | { type: "updateSelectedCityField"; field: "wikiEntityId" | "kind" | "markerColor" | "populationProfile"; value: string }
  | { type: "createSimulationFaction"; faction: WorldMapSimulationFaction }
  | {
      type: "updateSelectedSimulationFactionField";
      field:
        | "id"
        | "label"
        | "type"
        | "color"
        | "description"
        | "agenda"
        | "methods"
        | "objectiveHints"
        | "tags"
        | "controlledZoneIds"
        | "influencedZoneIds"
        | "interestZoneIds"
        | "avoidedZoneIds"
        | "homeCityId"
        | "homeRegionId"
        | "populationProfile"
        | "influence"
        | "power"
        | "cohesion"
        | "aggression"
        | "secrecy"
        | "resources";
      value: string;
    }
  | { type: "replaceSelectedSimulationFactionPresence"; cellKeys: string[] }
  | { type: "addSelectedSimulationFactionPresence"; cellKeys: string[] }
  | { type: "removeSelectedSimulationFactionPresence"; cellKeys: string[] }
  | {
      type: "createSimulationFactionAnchor";
      anchor: {
        id: string;
        label: string;
        type: string;
        targetKind: "city" | "district" | "route" | "region" | "place" | "cell";
        targetId?: string;
        cell?: MapCell;
        level: number;
        tags: string[];
        notes: string;
      };
    }
  | {
      type: "updateSelectedSimulationFactionAnchorField";
      anchorId: string;
      field: "label" | "type" | "targetKind" | "targetId" | "level" | "tags" | "notes";
      value: string;
    }
  | { type: "setSelectedSimulationFactionAnchorCell"; anchorId: string; cell?: MapCell }
  | { type: "deleteSelectedSimulationFactionAnchor"; anchorId: string }
  | { type: "deleteSelectedSimulationFaction" }
  | { type: "createSimulationFactionRelation"; relation: WorldMapSimulationFactionRelation }
  | {
      type: "updateSelectedSimulationFactionRelationField";
      targetFactionId: string;
      field: "targetFactionId" | "status" | "trust" | "hostility" | "notes";
      value: string;
    }
  | { type: "deleteSelectedSimulationFactionRelation"; targetFactionId: string }
  | { type: "createSimulationObjective"; objective: WorldMapSimulationObjective }
  | {
      type: "updateSelectedSimulationObjectiveField";
      field:
        | "id"
        | "label"
        | "category"
        | "ownerFactionId"
        | "description"
        | "whyItMatters"
        | "targetKind"
        | "targetId"
        | "priority"
        | "progress"
        | "state"
        | "phases"
        | "currentPhaseIndex"
        | "obstacleHints"
        | "compatibleActionIds"
        | "requiredAnchorId"
        | "requiredAnchorType"
        | "onSuccess"
        | "onFailure"
        | "tags";
      value: string;
    }
  | { type: "replaceSelectedSimulationObjectiveZones"; zoneIds: string[]; anchorCellKey?: string }
  | { type: "deleteSelectedSimulationObjective" }
  | { type: "createSimulationDistrict"; district: WorldMapSimulationDistrict }
  | {
      type: "updateSimulationDistrictField";
      districtId: string;
      field: "name" | "tags" | "cellKeys" | "dominantActivities" | "importantPlaces" | "populationProfile";
      value: string;
    }
  | { type: "deleteSimulationDistrict"; districtId: string }
  | {
      type: "updateSimulationDistrictOverrideField";
      districtId: string;
      cityId: string;
      field: "name" | "tags" | "dominantActivities" | "importantPlaces" | "populationProfile";
      value: string;
    }
  | { type: "deleteSimulationDistrictOverride"; districtId: string }
  | { type: "createSimulationMobileActor"; actor: WorldMapSimulationMobileActor }
  | {
      type: "updateSelectedSimulationMobileActorField";
      field:
        | "id"
        | "label"
        | "type"
        | "archetype"
        | "color"
        | "ownerFactionId"
        | "missionLabel"
        | "missionTargetLabel"
        | "missionPriority"
        | "missionStatus"
        | "positionKind"
        | "positionId"
        | "destinationKind"
        | "destinationId"
        | "populationProfile"
        | "itineraryMode"
        | "itineraryRouteIds"
        | "travelMode"
        | "speed"
        | "security"
        | "fatigue"
        | "cargo"
        | "headcount"
        | "resources"
        | "objectiveIds"
        | "interactionTags"
        | "simulationLevel";
      value: string;
    }
  | { type: "setSelectedSimulationMobileActorCellField"; field: "positionCell" | "destinationCell"; cell?: MapCell }
  | { type: "deleteSelectedSimulationMobileActor" }
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
  const selectedGovernanceTerritoryId =
    (state.layout.governanceTerritories ?? []).some(entry => entry.id === state.selectedGovernanceTerritoryId)
      ? state.selectedGovernanceTerritoryId
      : selectedCell?.governanceTerritoryId ?? (state.layout.governanceTerritories?.[0]?.id ?? "");
  const selectedGovernanceRegionId =
    (state.layout.governanceRegions ?? []).some(entry => entry.id === state.selectedGovernanceRegionId)
      ? state.selectedGovernanceRegionId
      : selectedCell?.governanceRegionId ?? (state.layout.governanceRegions?.[0]?.id ?? "");
  const selectedGeographicZoneId =
    (state.layout.geographicZones ?? []).some(entry => entry.id === state.selectedGeographicZoneId)
      ? state.selectedGeographicZoneId
      : selectedCell?.geographicZoneIds?.[0] ?? (state.layout.geographicZones?.[0]?.id ?? "");
  const selectedSimulationFactionId =
    (state.layout.simulation?.factions ?? []).some(entry => entry.id === state.selectedSimulationFactionId)
      ? state.selectedSimulationFactionId
      : (state.layout.simulation?.factions?.[0]?.id ?? "");
  const selectedSimulationObjectiveId =
    (state.layout.simulation?.specialObjectives ?? []).some(entry => entry.id === state.selectedSimulationObjectiveId)
      ? state.selectedSimulationObjectiveId
      : (state.layout.simulation?.specialObjectives?.[0]?.id ?? "");
  const selectedSimulationMobileActorId =
    (state.layout.simulation?.mobileActors ?? []).some(entry => entry.id === state.selectedSimulationMobileActorId)
      ? state.selectedSimulationMobileActorId
      : (state.layout.simulation?.mobileActors?.[0]?.id ?? "");

  return {
    ...state,
    selectedCellKey,
    selectedRouteId,
    selectedAreaCellKeys,
    selectedGovernanceTerritoryId,
    selectedGovernanceRegionId,
    selectedGeographicZoneId,
    selectedSimulationFactionId,
    selectedSimulationObjectiveId,
    selectedSimulationMobileActorId
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
      return withoutHistory(state, {
        ...state.present,
        selectedCellKey: action.cellKey
      });
    case "setSelectedRoute":
      return withoutHistory(state, {
        ...state.present,
        selectedRouteId: action.routeId,
        routeDrawActive: false
      });
    case "setRouteDrawActive":
      return withoutHistory(state, {
        ...state.present,
        routeDrawActive: action.value
      });
    case "toggleAreaCell":
      return withoutHistory(state, {
        ...state.present,
        selectedAreaCellKeys: state.present.selectedAreaCellKeys.includes(action.cellKey)
          ? state.present.selectedAreaCellKeys.filter(item => item !== action.cellKey)
          : [...state.present.selectedAreaCellKeys, action.cellKey]
      });
    case "setAreaSelection":
      return withoutHistory(state, {
        ...state.present,
        selectedAreaCellKeys: action.cellKeys
      });
    case "clearAreaSelection":
      return withoutHistory(state, {
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
    case "setSelectedSimulationFaction":
      return withoutHistory(state, {
        ...state.present,
        selectedSimulationFactionId: action.factionId
      });
    case "setSelectedSimulationObjective":
      return withoutHistory(state, {
        ...state.present,
        selectedSimulationObjectiveId: action.objectiveId
      });
    case "setSelectedSimulationMobileActor":
      return withoutHistory(state, {
        ...state.present,
        selectedSimulationMobileActorId: action.actorId
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
    case "createGovernanceTerritoryDefinition": {
      const layout = cloneLayout(state.present.layout);
      const anchor = state.present.selectedCellKey
        ? (() => {
            const [x, y] = state.present.selectedCellKey.split(",").map(Number);
            return { x, y };
          })()
        : { x: 0, y: 0 };
      upsertGovernanceTerritoryDefinition(layout, action.territoryId, action.wikiEntityId, action.governanceId, action.color, action.capitalCityId, anchor);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedGovernanceTerritoryId: action.territoryId
      });
    }
    case "createGovernanceRegionDefinition": {
      const layout = cloneLayout(state.present.layout);
      const anchor = state.present.selectedCellKey
        ? (() => {
            const [x, y] = state.present.selectedCellKey.split(",").map(Number);
            return { x, y };
          })()
        : { x: 0, y: 0 };
      upsertGovernanceRegionDefinition(
        layout,
        action.regionId,
        action.wikiEntityId,
        action.territoryId,
        action.governanceId,
        action.principalCityId,
        action.color,
        anchor
      );
      return withHistory(state, {
        ...state.present,
        layout,
        selectedGovernanceRegionId: action.regionId
      });
    }
    case "createGeographicZoneDefinition": {
      const layout = cloneLayout(state.present.layout);
      const anchor = state.present.selectedCellKey
        ? (() => {
            const [x, y] = state.present.selectedCellKey.split(",").map(Number);
            return { x, y };
          })()
        : { x: 0, y: 0 };
      upsertGeographicZoneDefinition(
        layout,
        action.zoneId,
        action.wikiEntityId,
        action.label,
        action.kind,
        action.color,
        action.borderColor,
        action.borderWidth,
        action.borderDashArray,
        anchor
      );
      return withHistory(state, {
        ...state.present,
        layout,
        selectedGeographicZoneId: action.zoneId
      });
    }
    case "assignGovernanceTerritoryToSelection": {
      const cellKeys = getTargetCellKeys(state.present.selectedAreaCellKeys, state.present.selectedCellKey);
      if (cellKeys.length === 0) return state;
      const layout = cloneLayout(state.present.layout);
      upsertGovernanceTerritoryDefinition(
        layout,
        action.territoryId,
        action.wikiEntityId,
        action.governanceId,
        action.color,
        action.capitalCityId,
        (() => {
          const [x, y] = cellKeys[0].split(",").map(Number);
          return { x, y };
        })()
      );
      assignGovernanceTerritoryToCells(layout, cellKeys, action.territoryId, action.wikiEntityId, action.governanceId, action.color);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedGovernanceTerritoryId: action.territoryId
      });
    }
    case "assignGovernanceRegionToSelection": {
      const cellKeys = getTargetCellKeys(state.present.selectedAreaCellKeys, state.present.selectedCellKey);
      if (cellKeys.length === 0) return state;
      const layout = cloneLayout(state.present.layout);
      assignGovernanceRegionToCells(
        layout,
        cellKeys,
        action.regionId,
        action.wikiEntityId,
        action.territoryId,
        action.governanceId,
        action.principalCityId,
        action.color
      );
      return withHistory(state, {
        ...state.present,
        layout,
        selectedGovernanceRegionId: action.regionId
      });
    }
    case "assignGeographicZoneToSelection": {
      const cellKeys = getTargetCellKeys(state.present.selectedAreaCellKeys, state.present.selectedCellKey);
      if (cellKeys.length === 0) return state;
      const layout = cloneLayout(state.present.layout);
      assignGeographicZoneToCells(
        layout,
        cellKeys,
        action.zoneId,
        action.label,
        action.kind,
        action.color,
        action.wikiEntityId,
        action.borderColor,
        action.borderWidth,
        action.borderDashArray
      );
      return withHistory(state, {
        ...state.present,
        layout,
        selectedGeographicZoneId: action.zoneId
      });
    }
    case "removeGovernanceTerritoryFromSelection": {
      const cellKeys = getTargetCellKeys(state.present.selectedAreaCellKeys, state.present.selectedCellKey);
      if (cellKeys.length === 0) return state;
      const layout = cloneLayout(state.present.layout);
      removeGovernanceTerritoryFromCells(layout, cellKeys, action.territoryId);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "removeGovernanceRegionFromSelection": {
      const cellKeys = getTargetCellKeys(state.present.selectedAreaCellKeys, state.present.selectedCellKey);
      if (cellKeys.length === 0) return state;
      const layout = cloneLayout(state.present.layout);
      removeGovernanceRegionFromCells(layout, cellKeys, action.regionId);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "removeGeographicZoneFromSelection": {
      const cellKeys = getTargetCellKeys(state.present.selectedAreaCellKeys, state.present.selectedCellKey);
      if (cellKeys.length === 0) return state;
      const layout = cloneLayout(state.present.layout);
      removeGeographicZoneFromCells(layout, cellKeys, action.zoneId);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "replaceGovernanceTerritorySelection": {
      const layout = cloneLayout(state.present.layout);
      replaceGovernanceTerritoryCells(layout, action.territoryId, action.cellKeys);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedAreaCellKeys: action.cellKeys
      });
    }
    case "replaceGovernanceRegionSelection": {
      const layout = cloneLayout(state.present.layout);
      replaceGovernanceRegionCells(layout, action.regionId, action.cellKeys, action.territoryId);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedAreaCellKeys: action.cellKeys
      });
    }
    case "replaceGeographicZoneSelection": {
      const layout = cloneLayout(state.present.layout);
      replaceGeographicZoneCells(layout, action.zoneId, action.cellKeys);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedAreaCellKeys: action.cellKeys
      });
    }
    case "deleteSelectedGovernanceTerritory": {
      if (!state.present.selectedGovernanceTerritoryId) return state;
      const layout = cloneLayout(state.present.layout);
      deleteGovernanceTerritory(layout, state.present.selectedGovernanceTerritoryId);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedGovernanceTerritoryId: ""
      });
    }
    case "deleteSelectedGovernanceRegion": {
      if (!state.present.selectedGovernanceRegionId) return state;
      const layout = cloneLayout(state.present.layout);
      deleteGovernanceRegion(layout, state.present.selectedGovernanceRegionId);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedGovernanceRegionId: ""
      });
    }
    case "deleteSelectedGeographicZone": {
      if (!state.present.selectedGeographicZoneId) return state;
      const layout = cloneLayout(state.present.layout);
      deleteGeographicZone(layout, state.present.selectedGeographicZoneId);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedGeographicZoneId: ""
      });
    }
    case "updateSelectedGovernanceTerritoryField": {
      if (!state.present.selectedGovernanceTerritoryId) return state;
      const layout = cloneLayout(state.present.layout);
      updateGovernanceTerritoryOnLayout(layout, state.present.selectedGovernanceTerritoryId, action.field, action.value);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedGovernanceTerritoryId: action.field === "id" ? action.value.trim() : state.present.selectedGovernanceTerritoryId
      });
    }
    case "updateSelectedGovernanceRegionField": {
      if (!state.present.selectedGovernanceRegionId) return state;
      const layout = cloneLayout(state.present.layout);
      updateGovernanceRegionOnLayout(layout, state.present.selectedGovernanceRegionId, action.field, action.value);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedGovernanceRegionId: action.field === "id" ? action.value.trim() : state.present.selectedGovernanceRegionId
      });
    }
    case "updateSelectedGeographicZoneField": {
      if (!state.present.selectedGeographicZoneId) return state;
      const layout = cloneLayout(state.present.layout);
      updateGeographicZoneOnLayout(layout, state.present.selectedGeographicZoneId, action.field, action.value);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedGeographicZoneId: action.field === "id" ? action.value.trim() : state.present.selectedGeographicZoneId
      });
    }
    case "appendRoutePoint": {
      if (!state.present.selectedRouteId) return state;
      const layout = cloneLayout(state.present.layout);
      const route = layout.paths.find(path => path.id === state.present.selectedRouteId);
      const lastCell = route?.cells.length ? route.cells[route.cells.length - 1] : null;
      if (route?.kind === "road" && lastCell && hasCliffBetweenCells(layout, lastCell, action.cell)) {
        return withoutHistory(state, {
          ...state.present,
          jsonError: "Route bloquee: une falaise coupe le passage entre ces deux cases."
        });
      }
      appendRoutePoint(layout, state.present.selectedRouteId, action.cell);
      return withHistory(state, {
        ...state.present,
        jsonError: null,
        layout
      });
    }
    case "createRoute": {
      const layout = cloneLayout(state.present.layout);
      createRoute(layout, action.routeId, action.kind ?? "road");
      return withHistory(state, {
        ...state.present,
        layout,
        selectedRouteId: action.routeId,
        routeDrawActive: true
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
      updatePathFieldOnLayout(layout, state.present.selectedRouteId, action.field, action.value);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "reverseSelectedRoute": {
      if (!state.present.selectedRouteId) return state;
      const layout = cloneLayout(state.present.layout);
      reversePathDirection(layout, state.present.selectedRouteId);
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
    case "createSimulationFaction": {
      const layout = cloneLayout(state.present.layout);
      upsertSimulationFaction(layout, action.faction);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedSimulationFactionId: action.faction.id
      });
    }
    case "updateSelectedSimulationFactionField": {
      if (!state.present.selectedSimulationFactionId) return state;
      const layout = cloneLayout(state.present.layout);
      updateSimulationFactionField(layout, state.present.selectedSimulationFactionId, action.field, action.value);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedSimulationFactionId: action.field === "id" ? action.value.trim() : state.present.selectedSimulationFactionId
      });
    }
    case "replaceSelectedSimulationFactionPresence": {
      if (!state.present.selectedSimulationFactionId) return state;
      const layout = cloneLayout(state.present.layout);
      replaceSimulationFactionPresence(layout, state.present.selectedSimulationFactionId, action.cellKeys);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedAreaCellKeys: action.cellKeys
      });
    }
    case "addSelectedSimulationFactionPresence": {
      if (!state.present.selectedSimulationFactionId) return state;
      const layout = cloneLayout(state.present.layout);
      addSimulationFactionPresence(layout, state.present.selectedSimulationFactionId, action.cellKeys);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "removeSelectedSimulationFactionPresence": {
      if (!state.present.selectedSimulationFactionId) return state;
      const layout = cloneLayout(state.present.layout);
      removeSimulationFactionPresence(layout, state.present.selectedSimulationFactionId, action.cellKeys);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "createSimulationFactionAnchor": {
      if (!state.present.selectedSimulationFactionId) return state;
      const layout = cloneLayout(state.present.layout);
      upsertSimulationFactionAnchor(layout, state.present.selectedSimulationFactionId, action.anchor);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "updateSelectedSimulationFactionAnchorField": {
      if (!state.present.selectedSimulationFactionId) return state;
      const layout = cloneLayout(state.present.layout);
      updateSimulationFactionAnchorField(
        layout,
        state.present.selectedSimulationFactionId,
        action.anchorId,
        action.field,
        action.value
      );
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "setSelectedSimulationFactionAnchorCell": {
      if (!state.present.selectedSimulationFactionId) return state;
      const layout = cloneLayout(state.present.layout);
      updateSimulationFactionAnchorCell(layout, state.present.selectedSimulationFactionId, action.anchorId, action.cell);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "deleteSelectedSimulationFactionAnchor": {
      if (!state.present.selectedSimulationFactionId) return state;
      const layout = cloneLayout(state.present.layout);
      deleteSimulationFactionAnchor(layout, state.present.selectedSimulationFactionId, action.anchorId);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "deleteSelectedSimulationFaction": {
      if (!state.present.selectedSimulationFactionId) return state;
      const layout = cloneLayout(state.present.layout);
      deleteSimulationFaction(layout, state.present.selectedSimulationFactionId);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedSimulationFactionId: ""
      });
    }
    case "createSimulationFactionRelation": {
      if (!state.present.selectedSimulationFactionId) return state;
      const layout = cloneLayout(state.present.layout);
      upsertSimulationFactionRelation(layout, state.present.selectedSimulationFactionId, action.relation);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "updateSelectedSimulationFactionRelationField": {
      if (!state.present.selectedSimulationFactionId) return state;
      const layout = cloneLayout(state.present.layout);
      updateSimulationFactionRelationField(layout, state.present.selectedSimulationFactionId, action.targetFactionId, action.field, action.value);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "deleteSelectedSimulationFactionRelation": {
      if (!state.present.selectedSimulationFactionId) return state;
      const layout = cloneLayout(state.present.layout);
      deleteSimulationFactionRelation(layout, state.present.selectedSimulationFactionId, action.targetFactionId);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "createSimulationObjective": {
      const layout = cloneLayout(state.present.layout);
      upsertSimulationObjective(layout, action.objective);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedSimulationObjectiveId: action.objective.id
      });
    }
    case "updateSelectedSimulationObjectiveField": {
      if (!state.present.selectedSimulationObjectiveId) return state;
      const layout = cloneLayout(state.present.layout);
      updateSimulationObjectiveField(layout, state.present.selectedSimulationObjectiveId, action.field, action.value);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedSimulationObjectiveId: action.field === "id" ? action.value.trim() : state.present.selectedSimulationObjectiveId
      });
    }
    case "replaceSelectedSimulationObjectiveZones": {
      if (!state.present.selectedSimulationObjectiveId) return state;
      const layout = cloneLayout(state.present.layout);
      const anchorCell = action.anchorCellKey
        ? (() => {
            const [x, y] = action.anchorCellKey.split(",").map(Number);
            return { x, y };
          })()
        : undefined;
      replaceSimulationObjectiveZones(layout, state.present.selectedSimulationObjectiveId, action.zoneIds, anchorCell);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "deleteSelectedSimulationObjective": {
      if (!state.present.selectedSimulationObjectiveId) return state;
      const layout = cloneLayout(state.present.layout);
      deleteSimulationObjective(layout, state.present.selectedSimulationObjectiveId);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedSimulationObjectiveId: ""
      });
    }
    case "createSimulationDistrict": {
      const layout = cloneLayout(state.present.layout);
      upsertSimulationDistrict(layout, action.district);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "updateSimulationDistrictField": {
      const layout = cloneLayout(state.present.layout);
      updateSimulationDistrictField(layout, action.districtId, action.field, action.value);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "deleteSimulationDistrict": {
      const layout = cloneLayout(state.present.layout);
      deleteSimulationDistrict(layout, action.districtId);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "updateSimulationDistrictOverrideField": {
      const layout = cloneLayout(state.present.layout);
      updateSimulationDistrictOverrideField(layout, action.districtId, action.cityId, action.field, action.value);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "deleteSimulationDistrictOverride": {
      const layout = cloneLayout(state.present.layout);
      deleteSimulationDistrictOverride(layout, action.districtId);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "createSimulationMobileActor": {
      const layout = cloneLayout(state.present.layout);
      upsertSimulationMobileActor(layout, action.actor);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedSimulationMobileActorId: action.actor.id
      });
    }
    case "updateSelectedSimulationMobileActorField": {
      if (!state.present.selectedSimulationMobileActorId) return state;
      const layout = cloneLayout(state.present.layout);
      updateSimulationMobileActorField(layout, state.present.selectedSimulationMobileActorId, action.field, action.value);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedSimulationMobileActorId: action.field === "id" ? action.value.trim() : state.present.selectedSimulationMobileActorId
      });
    }
    case "setSelectedSimulationMobileActorCellField": {
      if (!state.present.selectedSimulationMobileActorId) return state;
      const layout = cloneLayout(state.present.layout);
      updateSimulationMobileActorCellField(layout, state.present.selectedSimulationMobileActorId, action.field, action.cell);
      return withHistory(state, {
        ...state.present,
        layout
      });
    }
    case "deleteSelectedSimulationMobileActor": {
      if (!state.present.selectedSimulationMobileActorId) return state;
      const layout = cloneLayout(state.present.layout);
      deleteSimulationMobileActor(layout, state.present.selectedSimulationMobileActorId);
      return withHistory(state, {
        ...state.present,
        layout,
        selectedSimulationMobileActorId: ""
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
