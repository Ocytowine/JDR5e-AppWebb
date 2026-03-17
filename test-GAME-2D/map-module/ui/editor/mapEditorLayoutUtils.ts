import { getWorldMapCellKey, type CliffSegment, type MapCell, type MapPath, type ReliefElevationLevel, type WorldMapCity, type WorldMapLayout } from "../../data/worldMapLayout";
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
  if (key !== lastKey) route.cells.push(cell);
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

export function removeCityFromSelectedCell(layout: WorldMapLayout, selectedCity: WorldMapCity, selectedCellKey: string | null): void {
  layout.cities = layout.cities.filter(city => city.id !== selectedCity.id);
  const cell = layout.cells.find(entry => getWorldMapCellKey(entry.cell) === selectedCellKey);
  if (cell) cell.cityWikiId = undefined;
}

export function createRoute(layout: WorldMapLayout, id: string): MapPath {
  const created: MapPath = { id, label: "Nouvelle route", kind: "road", cells: [] };
  layout.paths.push(created);
  return created;
}
