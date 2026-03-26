import {
  getWorldMapCellKey,
  type CliffSegment,
  type GeographicZoneKind,
  type MapCell,
  type MapPath,
  type ReliefElevationLevel,
  type RiverSourceType,
  type RoadType,
  type SimulationObjectiveCategory,
  type SimulationObjectiveState,
  type SimulationObjectiveTargetKind,
  type SimulationActorLevel,
  type SimulationActorPositionKind,
  type SimulationAnchorTargetKind,
  type SimulationFactionRelationStatus,
  type SimulationOpportunityKind,
  type SimulationSignalKind,
  type SimulationTensionType,
  type SimulationTravelMode,
  type PopulationGroupRole,
  type WorldMapCity,
  type WorldMapSimulationConsequence,
  type WorldMapSimulationFactionAnchor,
  type WorldMapSimulationFactionRelation,
  type WorldMapSimulationMobileActor,
  type WorldMapSimulationObjective,
  type WorldMapSimulationFaction,
  type WorldMapSimulationDistrict,
  type WorldMapSimulationDistrictOverride,
  type WorldMapLayout
} from "../../data/worldMapLayout";
import { createCityId, ensureCell } from "../mapShared";
import { validateRouteAppend } from "../mapPathRules";

type GeographyPreset = {
  id: string;
  label: string;
  geography: string;
  color: string;
  surface: "land" | "ocean";
  difficulty: number;
};

function parsePopulationProfileInput(value: string) {
  const groups = value
    .split(",")
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      const [groupIdRaw, weightRaw, roleRaw] = entry.split(":").map(part => part.trim());
      return {
        groupId: groupIdRaw,
        weight: Math.max(0, Number(weightRaw) || 0),
        role: (roleRaw || undefined) as PopulationGroupRole | undefined
      };
    })
    .filter(entry => entry.groupId);
  if (groups.length === 0) return undefined;
  const dominantGroupId = groups.slice().sort((left, right) => right.weight - left.weight)[0]?.groupId;
  return {
    dominantGroupId,
    groups
  };
}

function parseSimulationConsequencesInput(value: string): WorldMapSimulationConsequence[] {
  return value
    .split("\n")
    .map(entry => entry.trim())
    .filter(Boolean)
    .reduce<WorldMapSimulationConsequence[]>((accumulator, entry) => {
      const [type, subtype, amountRaw, tagsRaw] = entry.split(":").map(part => part.trim());
      const tags = (tagsRaw ?? "")
        .split("|")
        .map(tag => tag.trim())
        .filter(Boolean);
      if (type === "create_tension" && subtype) {
        accumulator.push({
          type,
          tensionType: subtype as SimulationTensionType,
          severity: Math.max(0, Number(amountRaw) || 0),
          tags
        });
        return accumulator;
      }
      if (type === "open_opportunity" && subtype) {
        accumulator.push({
          type,
          kind: subtype as SimulationOpportunityKind,
          score: Math.max(0, Number(amountRaw) || 0),
          tags
        });
        return accumulator;
      }
      if (type === "spawn_signal" && subtype) {
        accumulator.push({
          type,
          signalKind: subtype as SimulationSignalKind,
          intensity: Math.max(0, Number(amountRaw) || 0),
          tags
        });
        return accumulator;
      }
      return accumulator;
    }, []);
}

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
  const validation = validateRouteAppend(layout, route, cell);
  if (!validation.ok) return;
  route.cells.push(cell);
}

export function updateCityFieldOnLayout(
  layout: WorldMapLayout,
  selectedCity: WorldMapCity,
  field: "wikiEntityId" | "kind" | "markerColor" | "populationProfile",
  value: string
): void {
  const city = layout.cities.find(entry => entry.id === selectedCity.id);
  if (!city) return;
  if (field === "populationProfile") {
    city.populationProfile = parsePopulationProfileInput(value);
    return;
  }
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

function ensureSimulation(layout: WorldMapLayout) {
  layout.simulation ??= { factions: [], specialObjectives: [], mobileActors: [], districts: [], districtOverrides: [] };
  layout.simulation.factions ??= [];
  layout.simulation.specialObjectives ??= [];
  layout.simulation.mobileActors ??= [];
  layout.simulation.districts ??= [];
  layout.simulation.districtOverrides ??= [];
  return layout.simulation;
}

export function upsertSimulationDistrict(
  layout: WorldMapLayout,
  district: WorldMapSimulationDistrict
): void {
  const simulation = ensureSimulation(layout);
  const districts = simulation.districts ?? (simulation.districts = []);
  const existingIndex = districts.findIndex(entry => entry.id === district.id);
  const normalized: WorldMapSimulationDistrict = {
    ...district,
    name: district.name?.trim() || district.id,
    tags: Array.from(new Set(district.tags ?? [])),
    cellKeys: Array.from(new Set(district.cellKeys ?? [])),
    dominantActivities: Array.from(new Set(district.dominantActivities ?? [])),
    importantPlaces: Array.from(new Set(district.importantPlaces ?? []))
  };
  if (existingIndex >= 0) {
    districts[existingIndex] = normalized;
    return;
  }
  districts.push(normalized);
}

export function deleteSimulationDistrict(layout: WorldMapLayout, districtId: string): void {
  const simulation = ensureSimulation(layout);
  const districts = simulation.districts ?? (simulation.districts = []);
  simulation.districts = districts.filter(entry => entry.id !== districtId);
}

export function updateSimulationDistrictField(
  layout: WorldMapLayout,
  districtId: string,
  field: "name" | "tags" | "cellKeys" | "dominantActivities" | "importantPlaces" | "populationProfile",
  value: string
): void {
  const simulation = ensureSimulation(layout);
  const districts = simulation.districts ?? (simulation.districts = []);
  const existing = districts.find(entry => entry.id === districtId);
  if (!existing) return;
  const nextDistrict: WorldMapSimulationDistrict = { ...existing };
  if (field === "populationProfile") {
    nextDistrict.populationProfile = parsePopulationProfileInput(value);
    upsertSimulationDistrict(layout, nextDistrict);
    return;
  }
  if (field === "tags" || field === "cellKeys" || field === "dominantActivities" || field === "importantPlaces") {
    nextDistrict[field] = value.split(",").map(item => item.trim()).filter(Boolean);
    upsertSimulationDistrict(layout, nextDistrict);
    return;
  }
  nextDistrict.name = value.trim() || existing.id;
  upsertSimulationDistrict(layout, nextDistrict);
}

export function upsertSimulationFaction(layout: WorldMapLayout, faction: WorldMapSimulationFaction): void {
  const simulation = ensureSimulation(layout);
  const existingIndex = simulation.factions.findIndex(entry => entry.id === faction.id);
  const normalized: WorldMapSimulationFaction = {
    ...faction,
    description: faction.description ?? "",
    agenda: faction.agenda ?? "",
    methods: Array.from(new Set(faction.methods ?? [])),
    objectiveHints: Array.from(new Set(faction.objectiveHints ?? [])),
    tags: Array.from(new Set(faction.tags ?? [])),
    presenceCells: Array.from(new Map((faction.presenceCells ?? []).map(cell => [getWorldMapCellKey(cell), cell])).values()),
    controlledZoneIds: Array.from(new Set(faction.controlledZoneIds ?? [])),
    influencedZoneIds: Array.from(new Set(faction.influencedZoneIds ?? [])),
    interestZoneIds: Array.from(new Set(faction.interestZoneIds ?? [])),
    avoidedZoneIds: Array.from(new Set(faction.avoidedZoneIds ?? [])),
    localAnchors: (faction.localAnchors ?? []).map(anchor => ({
      id: anchor.id,
      label: anchor.label ?? "",
      type: anchor.type ?? "safehouse",
      targetKind: anchor.targetKind ?? "cell",
      targetId: anchor.targetId ?? undefined,
      cell: anchor.cell ? { ...anchor.cell } : undefined,
      level: Math.max(1, Math.min(5, Number(anchor.level) || 1)),
      tags: Array.from(new Set(anchor.tags ?? [])),
      notes: anchor.notes ?? ""
    })),
    influence: Math.max(0, Math.min(100, Number(faction.influence) || 0)),
    power: Math.max(0, Math.min(100, Number(faction.power) || 0)),
    cohesion: Math.max(0, Math.min(100, Number(faction.cohesion) || 0)),
    aggression: Math.max(0, Math.min(100, Number(faction.aggression) || 0)),
    secrecy: Math.max(0, Math.min(100, Number(faction.secrecy) || 0)),
    resources: Math.max(0, Math.min(100, Number(faction.resources) || 0)),
    relations: (faction.relations ?? []).map(relation => ({
      targetFactionId: relation.targetFactionId,
      status: relation.status ?? "neutral",
      trust: Math.max(0, Math.min(100, Number(relation.trust) || 0)),
      hostility: Math.max(0, Math.min(100, Number(relation.hostility) || 0)),
      notes: relation.notes ?? ""
    }))
  };
  if (existingIndex >= 0) {
    simulation.factions[existingIndex] = normalized;
    return;
  }
  simulation.factions.push(normalized);
}

export function deleteSimulationFaction(layout: WorldMapLayout, factionId: string): void {
  const simulation = ensureSimulation(layout);
  simulation.factions = simulation.factions.filter(entry => entry.id !== factionId);
}

export function updateSimulationFactionField(
  layout: WorldMapLayout,
  factionId: string,
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
    | "resources",
  value: string
): void {
  const simulation = ensureSimulation(layout);
  const faction = simulation.factions.find(entry => entry.id === factionId);
  if (!faction) return;
  if (field === "populationProfile") {
    faction.populationProfile = parsePopulationProfileInput(value);
    return;
  }
  if (
    field === "methods" ||
    field === "objectiveHints" ||
    field === "tags" ||
    field === "controlledZoneIds" ||
    field === "influencedZoneIds" ||
    field === "interestZoneIds" ||
    field === "avoidedZoneIds"
  ) {
    faction[field] = value
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);
    return;
  }
  if (field === "influence" || field === "power" || field === "cohesion" || field === "aggression" || field === "secrecy" || field === "resources") {
    faction[field] = Math.max(0, Math.min(100, Number(value) || 0));
    return;
  }
  faction[field] = value;
}

export function upsertSimulationFactionRelation(
  layout: WorldMapLayout,
  factionId: string,
  relation: WorldMapSimulationFactionRelation
): void {
  const simulation = ensureSimulation(layout);
  const faction = simulation.factions.find(entry => entry.id === factionId);
  if (!faction) return;
  const normalized: WorldMapSimulationFactionRelation = {
    targetFactionId: relation.targetFactionId,
    status: relation.status ?? "neutral",
    trust: Math.max(0, Math.min(100, Number(relation.trust) || 0)),
    hostility: Math.max(0, Math.min(100, Number(relation.hostility) || 0)),
    notes: relation.notes ?? ""
  };
  const existingIndex = faction.relations.findIndex(entry => entry.targetFactionId === relation.targetFactionId);
  if (existingIndex >= 0) {
    faction.relations[existingIndex] = normalized;
    return;
  }
  faction.relations.push(normalized);
}

export function updateSimulationFactionRelationField(
  layout: WorldMapLayout,
  factionId: string,
  targetFactionId: string,
  field: "targetFactionId" | "status" | "trust" | "hostility" | "notes",
  value: string
): void {
  const simulation = ensureSimulation(layout);
  const faction = simulation.factions.find(entry => entry.id === factionId);
  if (!faction) return;
  const relation = faction.relations.find(entry => entry.targetFactionId === targetFactionId);
  if (!relation) return;
  if (field === "trust" || field === "hostility") {
    relation[field] = Math.max(0, Math.min(100, Number(value) || 0));
    return;
  }
  if (field === "status") {
    relation.status = value as SimulationFactionRelationStatus;
    return;
  }
  if (field === "notes") {
    relation.notes = value;
    return;
  }
  relation.targetFactionId = value;
}

export function deleteSimulationFactionRelation(layout: WorldMapLayout, factionId: string, targetFactionId: string): void {
  const simulation = ensureSimulation(layout);
  const faction = simulation.factions.find(entry => entry.id === factionId);
  if (!faction) return;
  faction.relations = faction.relations.filter(entry => entry.targetFactionId !== targetFactionId);
}

export function replaceSimulationFactionPresence(layout: WorldMapLayout, factionId: string, cellKeys: string[]): void {
  const simulation = ensureSimulation(layout);
  const faction = simulation.factions.find(entry => entry.id === factionId);
  if (!faction) return;
  faction.presenceCells = cellKeys.map(cellKey => {
    const [x, y] = cellKey.split(",").map(Number);
    return { x, y };
  });
}

export function addSimulationFactionPresence(layout: WorldMapLayout, factionId: string, cellKeys: string[]): void {
  const simulation = ensureSimulation(layout);
  const faction = simulation.factions.find(entry => entry.id === factionId);
  if (!faction) return;
  const merged = new Map(faction.presenceCells.map(cell => [getWorldMapCellKey(cell), cell]));
  cellKeys.forEach(cellKey => {
    const [x, y] = cellKey.split(",").map(Number);
    merged.set(cellKey, { x, y });
  });
  faction.presenceCells = Array.from(merged.values());
}

export function removeSimulationFactionPresence(layout: WorldMapLayout, factionId: string, cellKeys: string[]): void {
  const simulation = ensureSimulation(layout);
  const faction = simulation.factions.find(entry => entry.id === factionId);
  if (!faction) return;
  const removed = new Set(cellKeys);
  faction.presenceCells = faction.presenceCells.filter(cell => !removed.has(getWorldMapCellKey(cell)));
}

export function upsertSimulationFactionAnchor(
  layout: WorldMapLayout,
  factionId: string,
  anchor: WorldMapSimulationFactionAnchor
): void {
  const simulation = ensureSimulation(layout);
  const faction = simulation.factions.find(entry => entry.id === factionId);
  if (!faction) return;
  faction.localAnchors ??= [];
  const normalized: WorldMapSimulationFactionAnchor = {
    id: anchor.id,
    label: anchor.label ?? "",
    type: anchor.type ?? "safehouse",
    targetKind: anchor.targetKind ?? "cell",
    targetId: anchor.targetId ?? undefined,
    cell: anchor.cell ? { ...anchor.cell } : undefined,
    level: Math.max(1, Math.min(5, Number(anchor.level) || 1)),
    tags: Array.from(new Set(anchor.tags ?? [])),
    notes: anchor.notes ?? ""
  };
  const existingIndex = faction.localAnchors.findIndex(entry => entry.id === anchor.id);
  if (existingIndex >= 0) {
    faction.localAnchors[existingIndex] = normalized;
    return;
  }
  faction.localAnchors.push(normalized);
}

export function deleteSimulationFactionAnchor(layout: WorldMapLayout, factionId: string, anchorId: string): void {
  const simulation = ensureSimulation(layout);
  const faction = simulation.factions.find(entry => entry.id === factionId);
  if (!faction?.localAnchors) return;
  faction.localAnchors = faction.localAnchors.filter(entry => entry.id !== anchorId);
}

export function updateSimulationFactionAnchorField(
  layout: WorldMapLayout,
  factionId: string,
  anchorId: string,
  field: "label" | "type" | "targetKind" | "targetId" | "level" | "tags" | "notes",
  value: string
): void {
  const simulation = ensureSimulation(layout);
  const faction = simulation.factions.find(entry => entry.id === factionId);
  if (!faction?.localAnchors) return;
  const anchor = faction.localAnchors.find(entry => entry.id === anchorId);
  if (!anchor) return;
  if (field === "tags") {
    anchor.tags = value.split(",").map(item => item.trim()).filter(Boolean);
    return;
  }
  if (field === "level") {
    anchor.level = Math.max(1, Math.min(5, Number(value) || 1));
    return;
  }
  if (field === "targetKind") {
    anchor.targetKind = value as SimulationAnchorTargetKind;
    if (anchor.targetKind === "cell") {
      anchor.targetId = undefined;
    } else {
      anchor.cell = undefined;
    }
    return;
  }
  if (field === "targetId") {
    anchor.targetId = value || undefined;
    return;
  }
  anchor[field] = value;
}

export function updateSimulationFactionAnchorCell(
  layout: WorldMapLayout,
  factionId: string,
  anchorId: string,
  cell?: MapCell
): void {
  const simulation = ensureSimulation(layout);
  const faction = simulation.factions.find(entry => entry.id === factionId);
  if (!faction?.localAnchors) return;
  const anchor = faction.localAnchors.find(entry => entry.id === anchorId);
  if (!anchor) return;
  anchor.cell = cell ? { ...cell } : undefined;
  if (cell) {
    anchor.targetKind = "cell";
    anchor.targetId = undefined;
  }
}

export function upsertSimulationObjective(layout: WorldMapLayout, objective: WorldMapSimulationObjective): void {
  const simulation = ensureSimulation(layout);
  const existingIndex = simulation.specialObjectives.findIndex(entry => entry.id === objective.id);
  const normalized: WorldMapSimulationObjective = {
    ...objective,
    description: objective.description ?? "",
    whyItMatters: objective.whyItMatters ?? "",
    phases: Array.from(new Set(objective.phases ?? [])),
    currentPhaseIndex: Math.max(0, Number(objective.currentPhaseIndex) || 0),
    obstacleHints: Array.from(new Set(objective.obstacleHints ?? [])),
      compatibleActionIds: Array.from(new Set(objective.compatibleActionIds ?? [])),
      requiredAnchorId: objective.requiredAnchorId ?? undefined,
      requiredAnchorType: objective.requiredAnchorType ?? undefined,
      onSuccess: Array.isArray(objective.onSuccess) ? objective.onSuccess : [],
      onFailure: Array.isArray(objective.onFailure) ? objective.onFailure : [],
      tags: Array.from(new Set(objective.tags ?? [])),
    zoneIds: Array.from(new Set(objective.zoneIds ?? [])),
    priority: Math.max(0, Math.min(100, Number(objective.priority) || 0)),
    progress: Math.max(0, Math.min(100, Number(objective.progress) || 0)),
    state: objective.state ?? "planned"
  };
  if (existingIndex >= 0) {
    simulation.specialObjectives[existingIndex] = normalized;
    return;
  }
  simulation.specialObjectives.push(normalized);
}

export function deleteSimulationObjective(layout: WorldMapLayout, objectiveId: string): void {
  const simulation = ensureSimulation(layout);
  simulation.specialObjectives = simulation.specialObjectives.filter(entry => entry.id !== objectiveId);
}

export function updateSimulationObjectiveField(
  layout: WorldMapLayout,
  objectiveId: string,
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
        | "tags",
  value: string
): void {
  const simulation = ensureSimulation(layout);
  const objective = simulation.specialObjectives.find(entry => entry.id === objectiveId);
  if (!objective) return;
  if (field === "onSuccess" || field === "onFailure") {
    objective[field] = parseSimulationConsequencesInput(value);
    return;
  }
  if (field === "phases" || field === "obstacleHints" || field === "compatibleActionIds" || field === "tags") {
    objective[field] = value.split(",").map(item => item.trim()).filter(Boolean);
    return;
  }
  if (field === "priority" || field === "progress" || field === "currentPhaseIndex") {
    objective[field] = Math.max(0, Math.min(100, Number(value) || 0));
    return;
  }
  switch (field) {
    case "id":
      objective.id = value;
      return;
    case "label":
      objective.label = value;
      return;
    case "category":
      objective.category = value as SimulationObjectiveCategory;
      return;
    case "ownerFactionId":
      objective.ownerFactionId = value;
      return;
    case "description":
      objective.description = value;
      return;
    case "whyItMatters":
      objective.whyItMatters = value;
      return;
    case "targetKind":
      objective.targetKind = (value || undefined) as SimulationObjectiveTargetKind | undefined;
      return;
    case "targetId":
      objective.targetId = value || undefined;
      return;
    case "state":
      objective.state = value as SimulationObjectiveState;
      return;
    case "requiredAnchorId":
      objective.requiredAnchorId = value || undefined;
      return;
    case "requiredAnchorType":
      objective.requiredAnchorType = value || undefined;
      return;
    default:
      return;
  }
}

export function replaceSimulationObjectiveZones(layout: WorldMapLayout, objectiveId: string, zoneIds: string[], anchorCell?: MapCell): void {
  const simulation = ensureSimulation(layout);
  const objective = simulation.specialObjectives.find(entry => entry.id === objectiveId);
  if (!objective) return;
  objective.zoneIds = Array.from(new Set(zoneIds));
  objective.anchorCell = anchorCell ? { ...anchorCell } : objective.anchorCell;
}

export function upsertSimulationMobileActor(layout: WorldMapLayout, actor: WorldMapSimulationMobileActor): void {
  const simulation = ensureSimulation(layout);
  const existingIndex = simulation.mobileActors.findIndex(entry => entry.id === actor.id);
  const normalized: WorldMapSimulationMobileActor = {
    ...actor,
    itineraryRouteIds: Array.from(new Set(actor.itineraryRouteIds ?? [])),
    objectiveIds: Array.from(new Set(actor.objectiveIds ?? [])),
    interactionTags: Array.from(new Set(actor.interactionTags ?? [])),
    travelMode: actor.travelMode ?? "road",
    simulationLevel: actor.simulationLevel ?? "active",
    speed: Math.max(0, Math.min(100, Number(actor.speed) || 0)),
    security: Math.max(0, Math.min(100, Number(actor.security) || 0)),
    fatigue: Math.max(0, Math.min(100, Number(actor.fatigue) || 0)),
    cargo: Math.max(0, Math.min(100, Number(actor.cargo) || 0)),
    headcount: Math.max(0, Math.min(100, Number(actor.headcount) || 0)),
    resources: Math.max(0, Math.min(100, Number(actor.resources) || 0))
  };
  if (existingIndex >= 0) {
    simulation.mobileActors[existingIndex] = normalized;
    return;
  }
  simulation.mobileActors.push(normalized);
}

export function deleteSimulationMobileActor(layout: WorldMapLayout, actorId: string): void {
  const simulation = ensureSimulation(layout);
  simulation.mobileActors = simulation.mobileActors.filter(entry => entry.id !== actorId);
}

export function updateSimulationMobileActorField(
  layout: WorldMapLayout,
  actorId: string,
  field:
    | "id"
    | "label"
    | "type"
    | "color"
    | "ownerFactionId"
    | "positionKind"
    | "positionId"
    | "destinationKind"
    | "destinationId"
    | "populationProfile"
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
    | "simulationLevel",
  value: string
): void {
  const simulation = ensureSimulation(layout);
  const actor = simulation.mobileActors.find(entry => entry.id === actorId);
  if (!actor) return;
  if (field === "populationProfile") {
    actor.populationProfile = parsePopulationProfileInput(value);
    return;
  }
  if (field === "itineraryRouteIds" || field === "objectiveIds" || field === "interactionTags") {
    actor[field] = value.split(",").map(item => item.trim()).filter(Boolean);
    return;
  }
  if (field === "speed" || field === "security" || field === "fatigue" || field === "cargo" || field === "headcount" || field === "resources") {
    actor[field] = Math.max(0, Math.min(100, Number(value) || 0));
    return;
  }
  switch (field) {
    case "id":
      actor.id = value;
      return;
    case "label":
      actor.label = value;
      return;
    case "type":
      actor.type = value;
      return;
    case "color":
      actor.color = value;
      return;
    case "ownerFactionId":
      actor.ownerFactionId = value || undefined;
      return;
    case "positionKind":
      actor.positionKind = value as SimulationActorPositionKind;
      if (actor.positionKind === "cell") {
        actor.positionId = undefined;
      } else {
        actor.positionCell = undefined;
      }
      return;
    case "positionId":
      actor.positionId = value || undefined;
      return;
    case "destinationKind":
      actor.destinationKind = (value || undefined) as SimulationActorPositionKind | undefined;
      if (actor.destinationKind === "cell") {
        actor.destinationId = undefined;
      } else {
        actor.destinationCell = undefined;
      }
      return;
    case "destinationId":
      actor.destinationId = value || undefined;
      return;
    case "travelMode":
      actor.travelMode = value as SimulationTravelMode;
      return;
    case "simulationLevel":
      actor.simulationLevel = value as SimulationActorLevel;
      return;
    default:
      return;
  }
}

export function updateSimulationMobileActorCellField(
  layout: WorldMapLayout,
  actorId: string,
  field: "positionCell" | "destinationCell",
  cell?: MapCell
): void {
  const simulation = ensureSimulation(layout);
  const actor = simulation.mobileActors.find(entry => entry.id === actorId);
  if (!actor) return;
  actor[field] = cell ? { ...cell } : undefined;
  if (field === "positionCell" && cell) {
    actor.positionKind = "cell";
    actor.positionId = undefined;
  }
  if (field === "destinationCell" && cell) {
    actor.destinationKind = "cell";
    actor.destinationId = undefined;
  }
}

export function upsertSimulationDistrictOverride(
  layout: WorldMapLayout,
  districtOverride: WorldMapSimulationDistrictOverride
): void {
  const simulation = ensureSimulation(layout);
  const districtOverrides = simulation.districtOverrides ?? (simulation.districtOverrides = []);
  const existingIndex = districtOverrides.findIndex(entry => entry.id === districtOverride.id);
  const normalized: WorldMapSimulationDistrictOverride = {
    ...districtOverride,
    tags: Array.from(new Set(districtOverride.tags ?? [])),
    dominantActivities: Array.from(new Set(districtOverride.dominantActivities ?? [])),
    importantPlaces: Array.from(new Set(districtOverride.importantPlaces ?? []))
  };
  if (existingIndex >= 0) {
    districtOverrides[existingIndex] = normalized;
    return;
  }
  districtOverrides.push(normalized);
}

export function deleteSimulationDistrictOverride(layout: WorldMapLayout, districtId: string): void {
  const simulation = ensureSimulation(layout);
  const districtOverrides = simulation.districtOverrides ?? (simulation.districtOverrides = []);
  simulation.districtOverrides = districtOverrides.filter(entry => entry.id !== districtId);
}

export function updateSimulationDistrictOverrideField(
  layout: WorldMapLayout,
  districtId: string,
  cityId: string,
  field: "name" | "tags" | "dominantActivities" | "importantPlaces" | "populationProfile",
  value: string
): void {
  const simulation = ensureSimulation(layout);
  const districtOverrides = simulation.districtOverrides ?? (simulation.districtOverrides = []);
  const existing = districtOverrides.find(entry => entry.id === districtId);
  const districtOverride: WorldMapSimulationDistrictOverride = existing ?? {
    id: districtId,
    cityId,
    tags: [],
    dominantActivities: [],
    importantPlaces: []
  };
  if (field === "populationProfile") {
    districtOverride.populationProfile = parsePopulationProfileInput(value);
    upsertSimulationDistrictOverride(layout, districtOverride);
    return;
  }
  if (field === "tags" || field === "dominantActivities" || field === "importantPlaces") {
    districtOverride[field] = value.split(",").map(item => item.trim()).filter(Boolean);
    upsertSimulationDistrictOverride(layout, districtOverride);
    return;
  }
  districtOverride.name = value || undefined;
  upsertSimulationDistrictOverride(layout, districtOverride);
}
