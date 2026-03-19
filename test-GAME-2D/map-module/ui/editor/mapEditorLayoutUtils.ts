import {
  getWorldMapCellKey,
  type CliffSegment,
  type GeographicZoneKind,
  type MapCell,
  type MapPath,
  type ReliefElevationLevel,
  type RiverSourceType,
  type RoadType,
  type WorldMapCity,
  type WorldMapLayout
} from "../../data/worldMapLayout";
import { createCityId, ensureCell } from "../mapShared";

type GeographyPreset = {
  id: string;
  label: string;
  geography: string;
  color: string;
  surface: "land" | "ocean";
  difficulty: number;
};

export function getTargetCellKeys(selectedAreaCellKeys: string[], selectedCellKey: string | null): string[] {
  if (selectedAreaCellKeys.length > 0) return selectedAreaCellKeys;
  return selectedCellKey ? [selectedCellKey] : [];
}

export function applyGeographyToCells(layout: WorldMapLayout, cellKeys: string[], geography: string): void {
  cellKeys.forEach(cellKey => {
    const [x, y] = cellKey.split(",").map(Number);
    const cell = ensureCell(layout, { x, y });
    cell.surface = geography === "ocean" ? "ocean" : "land";
    cell.geography = geography;
  });
}

export function applyPendingTerrainToCells(
  layout: WorldMapLayout,
  cellKeys: string[],
  pendingGeographyId: string,
  pendingTagIds: string[],
  allGeographyPresets: GeographyPreset[],
  pendingReliefElevation: "" | ReliefElevationLevel
): void {
  cellKeys.forEach(cellKey => {
    const [x, y] = cellKey.split(",").map(Number);
    const cell = ensureCell(layout, { x, y });
    if (pendingGeographyId) {
      const preset = allGeographyPresets.find(item => item.id === pendingGeographyId);
      if (preset) {
        cell.surface = preset.surface;
        cell.geography = preset.geography;
        cell.terrainDifficulty = preset.difficulty;
        cell.riskLevel = 1;
      }
    }
    if (pendingReliefElevation) {
      cell.reliefElevation = pendingReliefElevation;
    }
    if (pendingTagIds.length > 0) {
      cell.tags = Array.from(new Set([...(cell.tags ?? []), ...pendingTagIds]));
    }
  });
}

function normalizePair(a: MapCell, b: MapCell): { a: MapCell; b: MapCell } {
  const aKey = getWorldMapCellKey(a);
  const bKey = getWorldMapCellKey(b);
  return aKey <= bKey ? { a, b } : { a: b, b: a };
}

export function hasCliffBetweenCells(layout: WorldMapLayout, first: MapCell, second: MapCell): boolean {
  const pair = normalizePair(first, second);
  return layout.cliffSegments.some(segment => {
    const segmentPair = normalizePair(segment.a, segment.b);
    return getWorldMapCellKey(segmentPair.a) === getWorldMapCellKey(pair.a) && getWorldMapCellKey(segmentPair.b) === getWorldMapCellKey(pair.b);
  });
}

export function upsertCliffSegment(layout: WorldMapLayout, high: MapCell, low: MapCell): void {
  const pair = normalizePair(high, low);
  const existingIndex = layout.cliffSegments.findIndex(segment => {
    const segmentPair = normalizePair(segment.a, segment.b);
    return getWorldMapCellKey(segmentPair.a) === getWorldMapCellKey(pair.a) && getWorldMapCellKey(segmentPair.b) === getWorldMapCellKey(pair.b);
  });
  const nextSegment: CliffSegment = {
    a: pair.a,
    b: pair.b,
    high: { ...high },
    low: { ...low }
  };
  if (existingIndex >= 0) {
    layout.cliffSegments[existingIndex] = nextSegment;
    return;
  }
  layout.cliffSegments.push(nextSegment);
}

export function removeCliffSegment(layout: WorldMapLayout, first: MapCell, second: MapCell): void {
  const pair = normalizePair(first, second);
  layout.cliffSegments = layout.cliffSegments.filter(segment => {
    const segmentPair = normalizePair(segment.a, segment.b);
    return !(getWorldMapCellKey(segmentPair.a) === getWorldMapCellKey(pair.a) && getWorldMapCellKey(segmentPair.b) === getWorldMapCellKey(pair.b));
  });
}

export function appendRoutePoint(layout: WorldMapLayout, selectedRouteId: string, cell: MapCell): void {
  const route = layout.paths.find(path => path.id === selectedRouteId);
  if (!route) return;
  const key = getWorldMapCellKey(cell);
  const lastKey = route.cells.length ? getWorldMapCellKey(route.cells[route.cells.length - 1]) : null;
  if (key === lastKey) return;
  const lastCell = route.cells.length ? route.cells[route.cells.length - 1] : null;
  if (lastCell && route.kind === "road" && hasCliffBetweenCells(layout, lastCell, cell)) return;
  route.cells.push(cell);
}

export function updateCityFieldOnLayout(
  layout: WorldMapLayout,
  selectedCity: WorldMapCity,
  field: "wikiEntityId" | "kind" | "markerColor",
  value: string
): void {
  const city = layout.cities.find(entry => entry.id === selectedCity.id);
  if (!city) return;
  if (field === "kind") {
    city.kind = value === "capital" ? "capital" : "secondary";
    return;
  }
  city[field] = value;
}

export function attachLoreCityToCell(layout: WorldMapLayout, selectedCell: MapCell, wikiEntityId: string): void {
  const cell = ensureCell(layout, selectedCell);
  const existing = layout.cities.find(city => city.wikiEntityId === wikiEntityId);
  cell.cityWikiId = wikiEntityId;
  if (existing) {
    existing.cell = { ...cell.cell };
    existing.regionWikiId = cell.regionWikiId ?? existing.regionWikiId;
    existing.territoryWikiId = cell.territoryWikiId ?? existing.territoryWikiId;
    return;
  }
  layout.cities.push({
    id: createCityId(wikiEntityId),
    wikiEntityId,
    regionWikiId: cell.regionWikiId ?? "",
    territoryWikiId: cell.territoryWikiId ?? "",
    kind: "secondary",
    cell: { ...cell.cell },
    markerColor: "#f4c967"
  });
}

export function createDraftCityOnCell(layout: WorldMapLayout, selectedCell: MapCell, wikiEntityId: string): void {
  const cell = ensureCell(layout, selectedCell);
  cell.cityWikiId = wikiEntityId;
  const existing = layout.cities.find(city => city.wikiEntityId === wikiEntityId);
  if (existing) {
    existing.cell = { ...cell.cell };
    return;
  }
  layout.cities.push({
    id: createCityId(wikiEntityId),
    wikiEntityId,
    regionWikiId: cell.regionWikiId ?? "",
    territoryWikiId: cell.territoryWikiId ?? "",
    kind: "secondary",
    cell: { ...cell.cell },
    markerColor: "#f4c967"
  });
  cell.tags = Array.from(new Set([...(cell.tags ?? []), "ville-brouillon"]));
}

export function addLocationToCell(layout: WorldMapLayout, selectedCell: MapCell, wikiEntityId: string): void {
  const cell = ensureCell(layout, selectedCell);
  cell.locationWikiIds = Array.from(new Set([...(cell.locationWikiIds ?? []), wikiEntityId]));
}

export function assignTerritoryToCells(
  layout: WorldMapLayout,
  cellKeys: string[],
  wikiEntityId: string,
  color: string
): void {
  cellKeys.forEach(cellKey => {
    const [x, y] = cellKey.split(",").map(Number);
    const cell = ensureCell(layout, { x, y });
    cell.territoryWikiId = wikiEntityId;
  });
  const existing = layout.territories.find(entry => entry.wikiEntityId === wikiEntityId);
  const anchorKey = cellKeys[0];
  const anchor = anchorKey ? layout.cells.find(cell => getWorldMapCellKey(cell.cell) === anchorKey) ?? null : null;
  if (!existing && anchor) {
    layout.territories.push({
      wikiEntityId,
      labelCell: { ...anchor.cell },
      color
    });
  }
}

export function assignRegionToCells(
  layout: WorldMapLayout,
  cellKeys: string[],
  wikiEntityId: string,
  territoryWikiId: string,
  color: string
): void {
  cellKeys.forEach(cellKey => {
    const [x, y] = cellKey.split(",").map(Number);
    const cell = ensureCell(layout, { x, y });
    if (territoryWikiId) cell.territoryWikiId = territoryWikiId;
    cell.regionWikiId = wikiEntityId;
  });
  const existing = layout.regions.find(entry => entry.wikiEntityId === wikiEntityId);
  const anchorKey = cellKeys[0];
  const anchor = anchorKey ? layout.cells.find(cell => getWorldMapCellKey(cell.cell) === anchorKey) ?? null : null;
  if (!existing && anchor) {
    layout.regions.push({
      wikiEntityId,
      territoryWikiId,
      labelCell: { ...anchor.cell },
      color
    });
  }
}

export function assignGovernanceTerritoryToCells(
  layout: WorldMapLayout,
  cellKeys: string[],
  territoryId: string,
  wikiEntityId: string,
  governanceId: string,
  color: string
): void {
  layout.governanceTerritories ??= [];
  layout.governances ??= [];
  const legacyTerritoryWikiId = wikiEntityId || territoryId;
  assignTerritoryToCells(layout, cellKeys, legacyTerritoryWikiId, color);
  cellKeys.forEach(cellKey => {
    const [x, y] = cellKey.split(",").map(Number);
    const cell = ensureCell(layout, { x, y });
    cell.governanceTerritoryId = territoryId;
  });

  const existing = layout.governanceTerritories.find(entry => entry.id === territoryId);
  const anchorKey = cellKeys[0];
  const anchor = anchorKey ? layout.cells.find(cell => getWorldMapCellKey(cell.cell) === anchorKey) ?? null : null;
  if (existing) {
    existing.wikiEntityId = legacyTerritoryWikiId;
    existing.governanceId = governanceId || existing.governanceId;
    existing.color = color;
  } else if (anchor) {
    layout.governanceTerritories.push({
      id: territoryId,
      wikiEntityId: legacyTerritoryWikiId,
      governanceId: governanceId || undefined,
      labelCell: { ...anchor.cell },
      color
    });
  }

  if (governanceId) {
    const governance = layout.governances.find(entry => entry.id === governanceId);
    if (governance) {
      governance.territoryId = territoryId;
      governance.color = governance.color || color;
    } else {
      layout.governances.push({
        id: governanceId,
        wikiEntityId: governanceId,
        label: governanceId,
        model: "custom",
        territoryId,
        color
      });
    }
  }
}

export function assignGovernanceRegionToCells(
  layout: WorldMapLayout,
  cellKeys: string[],
  regionId: string,
  wikiEntityId: string,
  territoryId: string,
  governanceId: string,
  principalCityId: string,
  color: string
): void {
  layout.governanceTerritories ??= [];
  layout.governanceRegions ??= [];
  const governanceTerritory = territoryId ? layout.governanceTerritories.find(entry => entry.id === territoryId) ?? null : null;
  const legacyTerritoryWikiId = governanceTerritory?.wikiEntityId ?? territoryId;
  const legacyRegionWikiId = wikiEntityId || regionId;
  assignRegionToCells(layout, cellKeys, legacyRegionWikiId, legacyTerritoryWikiId, color);
  cellKeys.forEach(cellKey => {
    const [x, y] = cellKey.split(",").map(Number);
    const cell = ensureCell(layout, { x, y });
    if (territoryId) cell.governanceTerritoryId = territoryId;
    cell.governanceRegionId = regionId;
  });

  const existing = layout.governanceRegions.find(entry => entry.id === regionId);
  const anchorKey = cellKeys[0];
  const anchor = anchorKey ? layout.cells.find(cell => getWorldMapCellKey(cell.cell) === anchorKey) ?? null : null;
  if (existing) {
    existing.wikiEntityId = legacyRegionWikiId;
    existing.governanceId = governanceId || existing.governanceId;
    existing.territoryId = territoryId || existing.territoryId;
    existing.principalCityId = principalCityId || existing.principalCityId;
    existing.color = color;
  } else if (anchor) {
    layout.governanceRegions.push({
      id: regionId,
      wikiEntityId: legacyRegionWikiId,
      governanceId: governanceId || undefined,
      territoryId: territoryId || undefined,
      principalCityId: principalCityId || undefined,
      labelCell: { ...anchor.cell },
      color
    });
  }
}

export function assignGeographicZoneToCells(
  layout: WorldMapLayout,
  cellKeys: string[],
  zoneId: string,
  label: string,
  kind: GeographicZoneKind,
  color: string,
  wikiEntityId?: string
): void {
  layout.geographicZones ??= [];
  cellKeys.forEach(cellKey => {
    const [x, y] = cellKey.split(",").map(Number);
    const cell = ensureCell(layout, { x, y });
    cell.geographicZoneIds = Array.from(new Set([...(cell.geographicZoneIds ?? []), zoneId]));
  });

  const existing = layout.geographicZones.find(entry => entry.id === zoneId);
  const anchorKey = cellKeys[0];
  const anchor = anchorKey ? layout.cells.find(cell => getWorldMapCellKey(cell.cell) === anchorKey) ?? null : null;
  if (existing) {
    existing.label = label;
    existing.kind = kind;
    existing.color = color;
    existing.wikiEntityId = wikiEntityId ?? existing.wikiEntityId;
  } else if (anchor) {
    layout.geographicZones.push({
      id: zoneId,
      wikiEntityId,
      label,
      kind,
      labelCell: { ...anchor.cell },
      color
    });
  }
}

export function removeCityFromSelectedCell(layout: WorldMapLayout, selectedCity: WorldMapCity, selectedCellKey: string | null): void {
  layout.cities = layout.cities.filter(city => city.id !== selectedCity.id);
  const cell = layout.cells.find(entry => getWorldMapCellKey(entry.cell) === selectedCellKey);
  if (cell) cell.cityWikiId = undefined;
}

export function createRoute(
  layout: WorldMapLayout,
  id: string,
  kind: "road" | "river" = "road"
): MapPath {
  const created: MapPath =
    kind === "river"
      ? {
          id,
          label: "Nouveau cours d'eau",
          kind: "river",
          sourceFlow: 1,
          sourceType: "source",
          cells: []
        }
      : {
          id,
          label: "Nouvelle route",
          kind: "road",
          roadType: "road",
          cells: []
        };
  layout.paths.push(created);
  return created;
}

export function updatePathFieldOnLayout(
  layout: WorldMapLayout,
  pathId: string,
  field: "label" | "kind" | "roadType" | "sourceFlow" | "sourceType",
  value: string
): void {
  const path = layout.paths.find(entry => entry.id === pathId);
  if (!path) return;

  if (field === "kind") {
    path.kind = value === "river" ? "river" : "road";
    if (path.kind === "road") {
      path.roadType = path.roadType ?? "road";
      path.sourceFlow = undefined;
      path.sourceType = undefined;
    } else {
      path.sourceFlow = Math.max(1, Number(path.sourceFlow) || 1);
      path.sourceType = path.sourceType ?? "source";
      path.roadType = undefined;
    }
    return;
  }

  if (field === "roadType") {
    path.roadType = (value as RoadType) || "road";
    return;
  }

  if (field === "sourceType") {
    path.sourceType = (value as RiverSourceType) || "source";
    return;
  }

  if (field === "sourceFlow") {
    path.sourceFlow = Math.max(1, Number(value) || 1);
    return;
  }

  path.label = value;
}

export function reversePathDirection(layout: WorldMapLayout, pathId: string): void {
  const path = layout.paths.find(entry => entry.id === pathId);
  if (!path) return;
  path.cells = [...path.cells].reverse();
}
