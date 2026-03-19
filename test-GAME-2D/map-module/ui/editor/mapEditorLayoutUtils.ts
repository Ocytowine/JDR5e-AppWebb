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
    return;
  }
  layout.cities.push({
    id: createCityId(wikiEntityId),
    wikiEntityId,
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

export function upsertGovernanceTerritoryDefinition(
  layout: WorldMapLayout,
  territoryId: string,
  wikiEntityId: string,
  governanceId: string,
  color: string,
  capitalCityId: string,
  labelCell: MapCell
): void {
  layout.governanceTerritories ??= [];
  layout.governances ??= [];
  const existing = layout.governanceTerritories.find(entry => entry.id === territoryId);
  if (existing) {
    existing.wikiEntityId = wikiEntityId || territoryId;
    existing.governanceId = governanceId || existing.governanceId;
    existing.color = color;
    existing.labelCell = { ...labelCell };
  } else {
    layout.governanceTerritories.push({
      id: territoryId,
      wikiEntityId: wikiEntityId || territoryId,
      governanceId: governanceId || undefined,
      labelCell: { ...labelCell },
      color
    });
  }

  if (governanceId) {
    const governance = layout.governances.find(entry => entry.id === governanceId);
    if (governance) {
      governance.territoryId = territoryId;
      governance.color = governance.color || color;
      governance.capitalCityId = capitalCityId || governance.capitalCityId;
    } else {
      layout.governances.push({
        id: governanceId,
        wikiEntityId: governanceId,
        label: governanceId,
        model: "custom",
        territoryId,
        capitalCityId: capitalCityId || undefined,
        color
      });
    }
  }

  if (capitalCityId) {
    layout.cities.forEach(city => {
      if (city.id === capitalCityId) {
        city.governanceId = governanceId || city.governanceId;
        city.governanceRole = "capital";
      } else if (governanceId && city.governanceId === governanceId && city.governanceRole === "capital") {
        city.governanceRole = "secondary";
      }
    });
  }
}

export function upsertGovernanceRegionDefinition(
  layout: WorldMapLayout,
  regionId: string,
  wikiEntityId: string,
  territoryId: string,
  governanceId: string,
  principalCityId: string,
  color: string,
  labelCell: MapCell
): void {
  layout.governanceRegions ??= [];
  const existing = layout.governanceRegions.find(entry => entry.id === regionId);
  if (existing) {
    existing.wikiEntityId = wikiEntityId || regionId;
    existing.territoryId = territoryId || existing.territoryId;
    existing.governanceId = governanceId || existing.governanceId;
    existing.principalCityId = principalCityId || existing.principalCityId;
    existing.color = color;
    existing.labelCell = { ...labelCell };
  } else {
    layout.governanceRegions.push({
      id: regionId,
      wikiEntityId: wikiEntityId || regionId,
      territoryId: territoryId || undefined,
      governanceId: governanceId || undefined,
      principalCityId: principalCityId || undefined,
      labelCell: { ...labelCell },
      color
    });
  }
}

export function upsertGeographicZoneDefinition(
  layout: WorldMapLayout,
  zoneId: string,
  wikiEntityId: string | undefined,
  label: string,
  kind: GeographicZoneKind,
  color: string,
  borderColor: string | undefined,
  borderWidth: number | undefined,
  borderDashArray: string | undefined,
  labelCell: MapCell
): void {
  layout.geographicZones ??= [];
  const existing = layout.geographicZones.find(entry => entry.id === zoneId);
  if (existing) {
    existing.wikiEntityId = wikiEntityId ?? existing.wikiEntityId;
    existing.label = label;
    existing.kind = kind;
    existing.color = color;
    existing.borderColor = borderColor ?? existing.borderColor ?? color;
    existing.borderWidth = Math.max(1, Number(borderWidth) || existing.borderWidth || 1.6);
    existing.borderDashArray = borderDashArray ?? existing.borderDashArray ?? "5 4";
    existing.labelCell = { ...labelCell };
  } else {
    layout.geographicZones.push({
      id: zoneId,
      wikiEntityId,
      label,
      kind,
      labelCell: { ...labelCell },
      color,
      borderColor: borderColor ?? color,
      borderWidth: Math.max(1, Number(borderWidth) || 1.6),
      borderDashArray: borderDashArray ?? "5 4"
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
  const anchor = (() => {
    const anchorKey = cellKeys[0];
    return anchorKey ? layout.cells.find(cell => getWorldMapCellKey(cell.cell) === anchorKey)?.cell ?? { x: 0, y: 0 } : { x: 0, y: 0 };
  })();
  const capitalCityId = layout.governances?.find(entry => entry.id === governanceId)?.capitalCityId ?? "";
  upsertGovernanceTerritoryDefinition(layout, territoryId, wikiEntityId, governanceId, color, capitalCityId, anchor);
  cellKeys.forEach(cellKey => {
    const [x, y] = cellKey.split(",").map(Number);
    const cell = ensureCell(layout, { x, y });
    cell.governanceTerritoryId = territoryId;
  });
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
  const anchor = (() => {
    const anchorKey = cellKeys[0];
    return anchorKey ? layout.cells.find(cell => getWorldMapCellKey(cell.cell) === anchorKey)?.cell ?? { x: 0, y: 0 } : { x: 0, y: 0 };
  })();
  upsertGovernanceRegionDefinition(layout, regionId, wikiEntityId, territoryId, governanceId, principalCityId, color, anchor);
  cellKeys.forEach(cellKey => {
    const [x, y] = cellKey.split(",").map(Number);
    const cell = ensureCell(layout, { x, y });
    if (territoryId) cell.governanceTerritoryId = territoryId;
    cell.governanceRegionId = regionId;
  });
}

export function assignGeographicZoneToCells(
  layout: WorldMapLayout,
  cellKeys: string[],
  zoneId: string,
  label: string,
  kind: GeographicZoneKind,
  color: string,
  wikiEntityId?: string,
  borderColor?: string,
  borderWidth?: number,
  borderDashArray?: string
): void {
  const anchor = (() => {
    const anchorKey = cellKeys[0];
    return anchorKey ? layout.cells.find(cell => getWorldMapCellKey(cell.cell) === anchorKey)?.cell ?? { x: 0, y: 0 } : { x: 0, y: 0 };
  })();
  upsertGeographicZoneDefinition(layout, zoneId, wikiEntityId, label, kind, color, borderColor, borderWidth, borderDashArray, anchor);
  cellKeys.forEach(cellKey => {
    const [x, y] = cellKey.split(",").map(Number);
    const cell = ensureCell(layout, { x, y });
    cell.geographicZoneIds = Array.from(new Set([...(cell.geographicZoneIds ?? []), zoneId]));
  });
}

export function updateGovernanceTerritoryOnLayout(
  layout: WorldMapLayout,
  territoryId: string,
  field: "id" | "wikiEntityId" | "governanceId" | "color" | "capitalCityId",
  value: string
): void {
  const territory = layout.governanceTerritories?.find(entry => entry.id === territoryId);
  if (!territory) return;
  if (field === "id") {
    const nextId = value.trim();
    if (!nextId || nextId === territoryId) return;
    territory.id = nextId;
    layout.cells.forEach(cell => {
      if (cell.governanceTerritoryId === territoryId) {
        cell.governanceTerritoryId = nextId;
      }
    });
    (layout.governanceRegions ?? []).forEach(region => {
      if (region.territoryId === territoryId) {
        region.territoryId = nextId;
      }
    });
    (layout.governances ?? []).forEach(governance => {
      if (governance.territoryId === territoryId) {
        governance.territoryId = nextId;
      }
    });
    return;
  }
  if (field === "governanceId") {
    territory.governanceId = value || undefined;
    return;
  }
  if (field === "capitalCityId") {
    if (!territory.governanceId) return;
    const governance = layout.governances?.find(entry => entry.id === territory.governanceId);
    if (!governance) return;
    governance.capitalCityId = value || undefined;
    layout.cities.forEach(city => {
      if (city.id === value) {
        city.governanceId = territory.governanceId;
        city.governanceRole = "capital";
      } else if (city.governanceId === territory.governanceId && city.governanceRole === "capital") {
        city.governanceRole = "secondary";
      }
    });
    return;
  }
  if (field === "color") {
    territory.color = value;
    if (territory.governanceId) {
      const governance = layout.governances?.find(entry => entry.id === territory.governanceId);
      if (governance) {
        governance.color = value;
      }
    }
    return;
  }
  territory[field] = value;
}

export function updateGovernanceRegionOnLayout(
  layout: WorldMapLayout,
  regionId: string,
  field: "id" | "wikiEntityId" | "governanceId" | "territoryId" | "principalCityId" | "color",
  value: string
): void {
  const region = layout.governanceRegions?.find(entry => entry.id === regionId);
  if (!region) return;
  if (field === "id") {
    const nextId = value.trim();
    if (!nextId || nextId === regionId) return;
    region.id = nextId;
    layout.cells.forEach(cell => {
      if (cell.governanceRegionId === regionId) {
        cell.governanceRegionId = nextId;
      }
    });
    return;
  }
  if (field === "governanceId" || field === "territoryId" || field === "principalCityId") {
    region[field] = value || undefined;
    return;
  }
  region[field] = value;
}

export function updateGeographicZoneOnLayout(
  layout: WorldMapLayout,
  zoneId: string,
  field: "id" | "wikiEntityId" | "label" | "kind" | "color" | "borderColor" | "borderWidth" | "borderDashArray",
  value: string
): void {
  const zone = layout.geographicZones?.find(entry => entry.id === zoneId);
  if (!zone) return;
  if (field === "id") {
    const nextId = value.trim();
    if (!nextId || nextId === zoneId) return;
    zone.id = nextId;
    layout.cells.forEach(cell => {
      cell.geographicZoneIds = (cell.geographicZoneIds ?? []).map(id => (id === zoneId ? nextId : id));
    });
    return;
  }
  if (field === "wikiEntityId") {
    zone.wikiEntityId = value || undefined;
    return;
  }
  if (field === "kind") {
    zone.kind = value as GeographicZoneKind;
    return;
  }
  if (field === "borderWidth") {
    zone.borderWidth = Math.max(1, Number(value) || 1.6);
    return;
  }
  zone[field] = value;
}

export function removeGovernanceTerritoryFromCells(layout: WorldMapLayout, cellKeys: string[], territoryId: string): void {
  cellKeys.forEach(cellKey => {
    const [x, y] = cellKey.split(",").map(Number);
    const cell = ensureCell(layout, { x, y });
    if (cell.governanceTerritoryId !== territoryId) return;
    cell.governanceTerritoryId = undefined;
    if (
      cell.governanceRegionId &&
      layout.governanceRegions?.some(region => region.id === cell.governanceRegionId && region.territoryId === territoryId)
    ) {
      cell.governanceRegionId = undefined;
    }
  });
}

export function removeGovernanceRegionFromCells(layout: WorldMapLayout, cellKeys: string[], regionId: string): void {
  cellKeys.forEach(cellKey => {
    const [x, y] = cellKey.split(",").map(Number);
    const cell = ensureCell(layout, { x, y });
    if (cell.governanceRegionId === regionId) {
      cell.governanceRegionId = undefined;
    }
  });
}

export function removeGeographicZoneFromCells(layout: WorldMapLayout, cellKeys: string[], zoneId: string): void {
  cellKeys.forEach(cellKey => {
    const [x, y] = cellKey.split(",").map(Number);
    const cell = ensureCell(layout, { x, y });
    cell.geographicZoneIds = (cell.geographicZoneIds ?? []).filter(id => id !== zoneId);
  });
}

export function replaceGovernanceTerritoryCells(
  layout: WorldMapLayout,
  territoryId: string,
  cellKeys: string[]
): void {
  const nextCellKeySet = new Set(cellKeys);
  const linkedRegionIds = new Set(
    (layout.governanceRegions ?? []).filter(region => region.territoryId === territoryId).map(region => region.id)
  );
  layout.cells.forEach(cell => {
    const cellKey = getWorldMapCellKey(cell.cell);
    const removedFromTerritory = cell.governanceTerritoryId === territoryId && !nextCellKeySet.has(cellKey);
    if (removedFromTerritory) {
      cell.governanceTerritoryId = undefined;
    }
    if (removedFromTerritory && cell.governanceRegionId && linkedRegionIds.has(cell.governanceRegionId)) {
      cell.governanceRegionId = undefined;
    }
  });
  cellKeys.forEach(cellKey => {
    const [x, y] = cellKey.split(",").map(Number);
    const cell = ensureCell(layout, { x, y });
    cell.governanceTerritoryId = territoryId;
  });
}

export function replaceGovernanceRegionCells(layout: WorldMapLayout, regionId: string, cellKeys: string[], territoryId?: string): void {
  layout.cells.forEach(cell => {
    if (cell.governanceRegionId === regionId) {
      cell.governanceRegionId = undefined;
    }
  });
  cellKeys.forEach(cellKey => {
    const [x, y] = cellKey.split(",").map(Number);
    const cell = ensureCell(layout, { x, y });
    cell.governanceRegionId = regionId;
    if (territoryId) {
      cell.governanceTerritoryId = territoryId;
    }
  });
}

export function replaceGeographicZoneCells(layout: WorldMapLayout, zoneId: string, cellKeys: string[]): void {
  layout.cells.forEach(cell => {
    cell.geographicZoneIds = (cell.geographicZoneIds ?? []).filter(id => id !== zoneId);
  });
  cellKeys.forEach(cellKey => {
    const [x, y] = cellKey.split(",").map(Number);
    const cell = ensureCell(layout, { x, y });
    cell.geographicZoneIds = Array.from(new Set([...(cell.geographicZoneIds ?? []), zoneId]));
  });
}

export function deleteGovernanceTerritory(layout: WorldMapLayout, territoryId: string): void {
  const linkedRegionIds = new Set(
    (layout.governanceRegions ?? []).filter(region => region.territoryId === territoryId).map(region => region.id)
  );
  layout.governanceTerritories = (layout.governanceTerritories ?? []).filter(entry => entry.id !== territoryId);
  layout.governanceRegions = (layout.governanceRegions ?? []).filter(entry => entry.territoryId !== territoryId);
  layout.governances = (layout.governances ?? []).filter(entry => entry.territoryId !== territoryId);
  layout.cells.forEach(cell => {
    if (cell.governanceTerritoryId === territoryId) {
      cell.governanceTerritoryId = undefined;
    }
    if (cell.governanceRegionId && linkedRegionIds.has(cell.governanceRegionId)) {
      cell.governanceRegionId = undefined;
    }
  });
}

export function deleteGovernanceRegion(layout: WorldMapLayout, regionId: string): void {
  layout.governanceRegions = (layout.governanceRegions ?? []).filter(entry => entry.id !== regionId);
  layout.cells.forEach(cell => {
    if (cell.governanceRegionId === regionId) {
      cell.governanceRegionId = undefined;
    }
  });
}

export function deleteGeographicZone(layout: WorldMapLayout, zoneId: string): void {
  layout.geographicZones = (layout.geographicZones ?? []).filter(entry => entry.id !== zoneId);
  layout.cells.forEach(cell => {
    cell.geographicZoneIds = (cell.geographicZoneIds ?? []).filter(id => id !== zoneId);
  });
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
