import type {
  MapCell,
  MapCellData,
  WorldMapCity,
  WorldMapLayout
} from "../data/worldMapLayout";
import {
  WORLD_MAP_LAYOUT,
  getWorldMapCellKey
} from "../data/worldMapLayout";
import type {
  MobileActor,
  FactionActionAnchor,
  SpecialObjective,
  WorldFaction,
  WorldCity,
  WorldDistrict,
  WorldRegion,
  WorldRoute,
  WorldState,
  WorldTension,
  EntityId,
  EntityRef
} from "./types";
import { estimateTraversalHours } from "./travel";

export type MapSimulationSeedOverrides = {
  clock?: Partial<WorldState["clock"]>;
  factions?: Record<string, WorldFaction>;
  objectives?: Record<string, SpecialObjective>;
  mobileActors?: Record<string, MobileActor>;
  tensions?: Record<string, WorldTension>;
  cityPatches?: Record<string, Partial<WorldCity>>;
  districtPatches?: Record<string, Partial<WorldDistrict>>;
  routePatches?: Record<string, Partial<WorldRoute>>;
  regionPatches?: Record<string, Partial<WorldRegion>>;
};

type DistrictSeedProfile = {
  id: string;
  name: string;
  tags: string[];
  cells: MapCellData[];
  dominantActivities: string[];
  importantPlaces?: string[];
  populationProfile?: WorldDistrict["populationProfile"];
};

type DistrictOverrideSeed = NonNullable<NonNullable<WorldMapLayout["simulation"]>["districtOverrides"]>[number];
type RouteCellPlacement = {
  routeId: string;
  routeIndex: number;
  routeLength: number;
  progressRatio: number;
  originEndpointId: string;
  destinationEndpointId: string;
};

function toTitleCase(input: string): string {
  return input
    .split(/[_-]/g)
    .filter(Boolean)
    .map(part => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeTag(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const RUNTIME_TAG_ALIASES: Record<string, string> = {
  criminel: "criminal",
  crime: "criminal",
  contrebande: "criminal",
  bandit: "criminal",
  religieux: "religious",
  religion: "religious",
  sacre: "religious",
  culte: "religious",
  rituel: "religious",
  militaire: "military",
  milice: "military",
  garde: "military",
  armee: "military",
  marchand: "trade",
  marchande: "trade",
  commerce: "trade",
  commercial: "trade",
  logistique: "trade",
  civique: "civic",
  public: "civic",
  gouvernance: "civic",
  frontalier: "frontier",
  frontiere: "frontier"
};

function normalizeRuntimeTags(values: string[] | undefined, inferredValues: string[] = []): string[] {
  const tags = new Set<string>();
  [...(values ?? []), ...inferredValues]
    .map(normalizeTag)
    .filter(Boolean)
    .forEach(tag => {
      tags.add(tag);
      const alias = RUNTIME_TAG_ALIASES[tag];
      if (alias) tags.add(alias);
    });
  return [...tags];
}

function countMatches(values: string[] | undefined, matchers: string[]): number {
  if (!values?.length) return 0;
  const normalizedMatchers = matchers.map(normalizeTag);
  return values.filter(value => normalizedMatchers.includes(normalizeTag(value))).length;
}

function hasAny(values: string[] | undefined, matchers: string[]): boolean {
  return countMatches(values, matchers) > 0;
}

function collectCityCells(layout: WorldMapLayout, city: WorldMapCity): MapCellData[] {
  const cityCellKey = getWorldMapCellKey(city.cell);
  return layout.cells.filter(cell => {
    const distance = Math.abs(cell.cell.x - city.cell.x) + Math.abs(cell.cell.y - city.cell.y);
    return cell.cityWikiId === city.wikiEntityId || getWorldMapCellKey(cell.cell) === cityCellKey || distance <= 2;
  });
}

function collectRouteIdsForCity(layout: WorldMapLayout, city: WorldMapCity): string[] {
  return layout.paths
    .filter(path => path.kind === "road" && path.cells.some(cell => cell.x === city.cell.x && cell.y === city.cell.y))
    .map(path => path.id);
}

function inferDominantActivities(cells: MapCellData[]): string[] {
  const tags = cells.flatMap(cell => cell.tags ?? []);
  const activities = new Set<string>();
  if (hasAny(tags, ["commerce", "maritime"])) activities.add("trade");
  if (hasAny(tags, ["agricole"])) activities.add("food");
  if (hasAny(tags, ["minier"])) activities.add("extraction");
  if (hasAny(tags, ["forestier"])) activities.add("wood");
  if (hasAny(tags, ["sacre"])) activities.add("religion");
  if (hasAny(tags, ["urbain"])) activities.add("civic");
  if (activities.size === 0) activities.add("local");
  return [...activities];
}

function inferDistrictProfiles(city: WorldMapCity, cityCells: MapCellData[]): DistrictSeedProfile[] {
  const profiles: DistrictSeedProfile[] = [
    {
      id: `${city.id}:core`,
      name: `${toTitleCase(city.wikiEntityId)} Core`,
      tags: ["urban", city.kind],
      cells: cityCells.filter(cell => cell.cityWikiId === city.wikiEntityId || cell.cell.x === city.cell.x && cell.cell.y === city.cell.y),
      dominantActivities: ["civic", "trade"]
    }
  ];

  const maritimeCells = cityCells.filter(cell => hasAny(cell.tags, ["maritime"]) || cell.surface === "ocean");
  if (maritimeCells.length > 0) {
    profiles.push({
      id: `${city.id}:harbor`,
      name: `${toTitleCase(city.wikiEntityId)} Harbor`,
      tags: ["harbor", "maritime", city.kind],
      cells: maritimeCells,
      dominantActivities: ["trade", "shipping"]
    });
  }

  const sacredCells = cityCells.filter(cell => hasAny(cell.tags, ["sacre"]));
  if (sacredCells.length > 0) {
    profiles.push({
      id: `${city.id}:sanctuary`,
      name: `${toTitleCase(city.wikiEntityId)} Sanctuary`,
      tags: ["sacred", city.kind],
      cells: sacredCells,
      dominantActivities: ["religion", "pilgrimage"]
    });
  }

  const extractionCells = cityCells.filter(cell => hasAny(cell.tags, ["agricole", "minier", "forestier", "frontalier"]));
  if (extractionCells.length > 0) {
    profiles.push({
      id: `${city.id}:outskirts`,
      name: `${toTitleCase(city.wikiEntityId)} Outskirts`,
      tags: ["outer", city.kind, ...new Set(extractionCells.flatMap(cell => cell.tags ?? []).filter(tag => ["agricole", "minier", "forestier", "frontalier"].includes(tag)))],
      cells: extractionCells,
      dominantActivities: inferDominantActivities(extractionCells)
    });
  }

  return profiles.map(profile => ({
    ...profile,
    cells: profile.cells.length > 0 ? profile.cells : cityCells.slice(0, 1)
  }));
}

function getDistrictOverridesById(layout: WorldMapLayout): Map<string, DistrictOverrideSeed> {
  return new Map((layout.simulation?.districtOverrides ?? []).map(override => [override.id, override]));
}

function getNativeDistrictsByCityId(layout: WorldMapLayout): Map<string, DistrictSeedProfile[]> {
  const cellsByKey = new Map(layout.cells.map(cell => [getWorldMapCellKey(cell.cell), cell]));
  const byCityId = new Map<string, DistrictSeedProfile[]>();
  (layout.simulation?.districts ?? []).forEach(district => {
    const entry: DistrictSeedProfile = {
      id: district.id,
      name: district.name,
      tags: district.tags,
      cells: district.cellKeys
        .map(cellKey => cellsByKey.get(cellKey))
        .filter((cell): cell is MapCellData => Boolean(cell)),
      dominantActivities: district.dominantActivities,
      importantPlaces: district.importantPlaces,
      populationProfile: district.populationProfile
    };
    const current = byCityId.get(district.cityId);
    if (current) current.push(entry);
    else byCityId.set(district.cityId, [entry]);
  });
  return byCityId;
}

function statFromCells(cells: MapCellData[], kind: "city" | "district") {
  const tags = cells.flatMap(cell => cell.tags ?? []);
  const avgRisk = cells.reduce((sum, cell) => sum + (cell.riskLevel ?? 0), 0) / Math.max(cells.length, 1);
  const avgDifficulty = cells.reduce((sum, cell) => sum + (cell.terrainDifficulty ?? 5), 0) / Math.max(cells.length, 1);
  const commerceBoost = countMatches(tags, ["commerce", "maritime", "urbain"]) * 6;
  const dangerBoost = countMatches(tags, ["dangereux", "ruines", "frontalier"]) * 9;
  const sacredBoost = countMatches(tags, ["sacre"]) * 5;
  const resourceBoost = countMatches(tags, ["agricole", "minier", "forestier"]) * 7;
  const urbanBoost = countMatches(tags, ["urbain"]) * 8;

  if (kind === "city") {
    return {
      order: clamp(58 - dangerBoost * 0.35 + urbanBoost * 0.2),
      commerce: clamp(34 + commerceBoost + resourceBoost * 0.35),
      fear: clamp(10 + avgRisk * 9 + dangerBoost * 0.45),
      corruption: clamp(18 + commerceBoost * 0.22 + sacredBoost * 0.1),
      supply: clamp(40 + resourceBoost * 0.6 - avgDifficulty * 2),
      attractiveness: clamp(30 + commerceBoost * 0.3 + sacredBoost * 0.2 - dangerBoost * 0.2)
    };
  }

  return {
    danger: clamp(12 + avgRisk * 12 + dangerBoost * 0.55),
    wealth: clamp(26 + commerceBoost * 0.7 + resourceBoost * 0.4),
    surveillance: clamp(22 + urbanBoost * 0.45 + sacredBoost * 0.15 - dangerBoost * 0.2),
    agitation: clamp(16 + dangerBoost * 0.4 + avgRisk * 7),
    commerce: clamp(24 + commerceBoost * 0.85 + resourceBoost * 0.25),
    populationDensity: clamp(22 + urbanBoost * 0.9 + commerceBoost * 0.25),
    fear: clamp(8 + avgRisk * 10 + dangerBoost * 0.4)
  };
}

function inferFactionInfluence(cells: MapCellData[]): Record<string, number> {
  const tags = cells.flatMap(cell => cell.tags ?? []);
  const criminal = clamp(countMatches(tags, ["dangereux", "ruines", "frontalier"]) * 12);
  const trade = clamp(countMatches(tags, ["commerce", "maritime", "agricole", "minier", "forestier"]) * 10);
  const faith = clamp(countMatches(tags, ["sacre"]) * 16);
  return {
    "faction:auto:criminal": criminal,
    "faction:auto:trade": trade,
    "faction:auto:faith": faith
  };
}

function inferStructuralPlaces(city: WorldMapCity, cells: MapCellData[]): string[] {
  const places = new Set<string>([city.wikiEntityId]);
  cells.forEach(cell => {
    (cell.locationWikiIds ?? []).forEach(locationId => places.add(locationId));
  });
  return [...places];
}

function inferRouteStats(pathCells: MapCellData[], routeIdsTouching: number, roadType: WorldRoute["tags"][number]) {
  const tags = pathCells.flatMap(cell => cell.tags ?? []);
  const avgRisk = pathCells.reduce((sum, cell) => sum + (cell.riskLevel ?? 0), 0) / Math.max(pathCells.length, 1);
  const avgTerrainDifficulty = pathCells.reduce((sum, cell) => sum + (cell.terrainDifficulty ?? 5), 0) / Math.max(pathCells.length, 1);
  const materialBase = roadType === "major_road" ? 62 : roadType === "road" ? 54 : 46;
  return {
    security: clamp(56 - avgRisk * 10 - countMatches(tags, ["dangereux", "ruines"]) * 8),
    traffic: clamp(28 + routeIdsTouching * 8 + countMatches(tags, ["commerce", "maritime", "urbain"]) * 5),
    materialState: clamp(materialBase - countMatches(tags, ["marais", "montagne"]) * 6),
    control: clamp(34 + countMatches(tags, ["urbain", "commerce"]) * 4 - countMatches(tags, ["frontalier"]) * 7),
    ambushRisk: clamp(12 + avgRisk * 12 + countMatches(tags, ["dangereux", "frontalier", "forestier", "ruines"]) * 8),
    terrainDifficulty: clamp(avgTerrainDifficulty, 1, 12)
  };
}

function estimateLayoutPathTraversalCost(path: WorldMapLayout["paths"][number], pathCells: MapCellData[], actor?: Pick<MobileActor, "state" | "modeTransport" | "travelMode">): number {
  const avgTerrainDifficulty = pathCells.reduce((sum, cell) => sum + (cell.terrainDifficulty ?? 5), 0) / Math.max(pathCells.length, 1);
  const modeTransport =
    actor?.modeTransport ??
    (actor?.travelMode === "river" || actor?.travelMode === "sea"
      ? "bateau"
      : actor?.travelMode === "foot"
        ? "pied"
        : "cheval");
  return estimateTraversalHours({
    length: Math.max(path.cells.length, 1),
    travelCost: path.roadType === "major_road" ? 2 : path.roadType === "road" ? 3 : 4,
    terrainDifficulty: avgTerrainDifficulty,
    cargo: actor?.state?.cargo ?? 0,
    headcount: actor?.state?.headcount ?? 0,
    modeTransport
  });
}

function inferRegionTags(layout: WorldMapLayout, regionId: string): string[] {
  const tags = new Set<string>();
  layout.cells.forEach(cell => {
    if (cell.governanceRegionId === regionId) {
      (cell.tags ?? []).forEach(tag => tags.add(tag));
    }
  });
  return [...tags];
}

function mergeRecord<T extends { id: string }>(base: Record<string, T>, patches?: Record<string, Partial<T>>): Record<string, T> {
  if (!patches) return base;
  return Object.fromEntries(
    Object.entries(base).map(([id, entry]) => [id, { ...entry, ...(patches[id] ?? {}) }])
  );
}

function getCellDistance(left: MapCell, right: MapCell): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function getRuntimeRefForRouteEndpoint(layout: WorldMapLayout, routeId: string, cell: MapCell): EntityRef {
  const city = layout.cities.find(entry => entry.cell.x === cell.x && entry.cell.y === cell.y);
  if (city) {
    return { kind: "city", id: city.id };
  }
  const region = (layout.governanceRegions ?? []).find(entry => {
    if (entry.labelCell.x === cell.x && entry.labelCell.y === cell.y) return true;
    if (!entry.principalCityId) return false;
    const principalCity = layout.cities.find(cityEntry => cityEntry.id === entry.principalCityId);
    return Boolean(principalCity && principalCity.cell.x === cell.x && principalCity.cell.y === cell.y);
  });
  if (region) {
    return { kind: "region", id: region.id };
  }
  return { kind: "route", id: routeId };
}

export function resolveMapCellToRuntimeRef(layout: WorldMapLayout, cell: MapCell): EntityRef | undefined {
  const city = layout.cities.find(entry => entry.cell.x === cell.x && entry.cell.y === cell.y);
  if (city) {
    return { kind: "city", id: city.id };
  }

  const region = (layout.governanceRegions ?? []).find(entry => {
    if (entry.labelCell.x === cell.x && entry.labelCell.y === cell.y) return true;
    if (!entry.principalCityId) return false;
    const principalCity = layout.cities.find(cityEntry => cityEntry.id === entry.principalCityId);
    return Boolean(principalCity && principalCity.cell.x === cell.x && principalCity.cell.y === cell.y);
  });
  if (region) {
    return { kind: "region", id: region.id };
  }

  const routeEndpointCandidates = layout.paths
    .filter(path => path.kind === "road" && path.cells.length > 0)
    .flatMap(path => {
      const startCell = path.cells[0];
      const endCell = path.cells[path.cells.length - 1];
      return [
        { ref: getRuntimeRefForRouteEndpoint(layout, path.id, startCell), cell: startCell },
        { ref: getRuntimeRefForRouteEndpoint(layout, path.id, endCell), cell: endCell }
      ];
    });

  const nearestRouteEndpoint = routeEndpointCandidates
    .slice()
    .sort((left, right) => getCellDistance(cell, left.cell) - getCellDistance(cell, right.cell))[0];
  if (nearestRouteEndpoint) {
    return nearestRouteEndpoint.ref;
  }

  const nearestCity = layout.cities
    .slice()
    .sort((left, right) => getCellDistance(cell, left.cell) - getCellDistance(cell, right.cell))[0];
  if (nearestCity) {
    return { kind: "city", id: nearestCity.id };
  }

  const nearestRegion = (layout.governanceRegions ?? [])
    .slice()
    .sort((left, right) => getCellDistance(cell, left.labelCell) - getCellDistance(cell, right.labelCell))[0];
  if (nearestRegion) {
    return { kind: "region", id: nearestRegion.id };
  }

  return undefined;
}

function getRouteCellPlacement(layout: WorldMapLayout, cell: MapCell): RouteCellPlacement | undefined {
  const matchingPlacements = layout.paths
    .filter(path => path.kind === "road" && path.cells.length > 1)
    .flatMap(path =>
      path.cells
        .map((routeCell, index) => ({ routeCell, index }))
        .filter(entry => entry.routeCell.x === cell.x && entry.routeCell.y === cell.y)
        .map(entry => {
          const routeLength = path.cells.length - 1;
          const progressRatio = routeLength > 0 ? entry.index / routeLength : 0;
          const originEndpointId = getRuntimeRefForRouteEndpoint(layout, path.id, path.cells[0]).id;
          const destinationEndpointId = getRuntimeRefForRouteEndpoint(layout, path.id, path.cells[path.cells.length - 1]).id;
          return {
            routeId: path.id,
            routeIndex: entry.index,
            routeLength,
            progressRatio,
            originEndpointId,
            destinationEndpointId
          } satisfies RouteCellPlacement;
        })
    );

  return matchingPlacements
    .slice()
    .sort((left, right) => {
      const leftCentrality = Math.abs(left.routeIndex - left.routeLength / 2);
      const rightCentrality = Math.abs(right.routeIndex - right.routeLength / 2);
      return leftCentrality - rightCentrality;
    })[0];
}

function inferRouteTargetId(layout: WorldMapLayout, placement: RouteCellPlacement, destination?: EntityRef): EntityId | undefined {
  const route = layout.paths.find(path => path.id === placement.routeId && path.kind === "road");
  if (!route || route.cells.length === 0) return undefined;
  const startCell = route.cells[0];
  const endCell = route.cells[route.cells.length - 1];
  const originRef = getRuntimeRefForRouteEndpoint(layout, placement.routeId, startCell);
  const destinationRef = getRuntimeRefForRouteEndpoint(layout, placement.routeId, endCell);

  if (destination?.id && destination.id === originRef.id) return originRef.id;
  if (destination?.id && destination.id === destinationRef.id) return destinationRef.id;

  const destinationCell =
    destination?.kind === "city"
      ? layout.cities.find(entry => entry.id === destination.id)?.cell
      : destination?.kind === "region"
        ? (layout.governanceRegions ?? []).find(entry => entry.id === destination.id)?.labelCell
        : undefined;
  if (!destinationCell) {
    return placement.routeIndex <= placement.routeLength / 2 ? originRef.id : destinationRef.id;
  }

  const originDistance = getCellDistance(destinationCell, startCell);
  const destinationDistance = getCellDistance(destinationCell, endCell);
  return originDistance <= destinationDistance ? originRef.id : destinationRef.id;
}

function syncRouteMobileActorIds(routes: Record<string, WorldRoute>, mobileActors: Record<string, MobileActor>) {
  Object.values(routes).forEach(route => {
    route.mobileActorIds = [];
  });

  Object.values(mobileActors).forEach(actor => {
    const routeId =
      actor.position.kind === "route"
        ? actor.position.id
        : actor.itinerary[0];
    if (!routeId) return;
    const route = routes[routeId];
    if (!route) return;
    if (!route.mobileActorIds.includes(actor.id)) {
      route.mobileActorIds.push(actor.id);
    }
  });
}

function deriveRuntimeFactionsFromLayout(layout: WorldMapLayout): Record<string, WorldFaction> {
  const cityPopulationById = new Map(layout.cities.map(city => [city.id, city.populationProfile]));
  const knownDistrictIds = new Set(Object.keys(createSimulationSeedFromMapLayout(layout).districts));
  const explicitObjectivesByFactionId = new Map<string, Array<{ objectiveId: string; priority: number }>>();
  (layout.simulation?.specialObjectives ?? []).forEach(objective => {
    const current = explicitObjectivesByFactionId.get(objective.ownerFactionId) ?? [];
    current.push({
      objectiveId: `objective:map:${objective.id}`,
      priority: clamp(objective.priority, 0, 100)
    });
    explicitObjectivesByFactionId.set(objective.ownerFactionId, current);
  });
  return Object.fromEntries(
    (layout.simulation?.factions ?? []).map(faction => {
      const type = String(faction.type || "faction").trim().toLowerCase();
      const normalizedType = normalizeTag(type);
      const runtimeId = `faction:map:${faction.id}`;
      const controlledZoneIds = Array.from(new Set(faction.controlledZoneIds ?? []));
      const influencedZoneIds = Array.from(new Set(faction.influencedZoneIds ?? []));
      const interestZoneIds = Array.from(new Set(faction.interestZoneIds ?? []));
      const avoidedZoneIds = Array.from(new Set(faction.avoidedZoneIds ?? []));
      const localAnchors = (faction.localAnchors ?? []).map(anchor => {
        const target: FactionActionAnchor["target"] =
          anchor.targetKind === "city" && anchor.targetId
            ? { kind: "city", id: anchor.targetId }
            : anchor.targetKind === "district" && anchor.targetId && knownDistrictIds.has(anchor.targetId)
              ? { kind: "district", id: anchor.targetId }
              : anchor.targetKind === "route" && anchor.targetId
                ? { kind: "route", id: anchor.targetId }
                : anchor.targetKind === "region" && anchor.targetId
                  ? { kind: "region", id: anchor.targetId }
                  : undefined;
        return {
          id: anchor.id,
          label: anchor.label || anchor.id,
          type: anchor.type,
          target,
          cell: anchor.cell ? { ...anchor.cell } : undefined,
          level: anchor.level,
          tags: normalizeRuntimeTags(anchor.tags),
          notes: anchor.notes ?? ""
        } satisfies FactionActionAnchor;
      });
      return [
        runtimeId,
        {
          id: runtimeId,
          name: faction.label,
          type: faction.type,
          tags: normalizeRuntimeTags(faction.tags, [
            normalizedType.includes("culte") ? "religieux" : "",
            normalizedType.includes("milice") || normalizedType.includes("garde") || normalizedType.includes("armee") ? "militaire" : "",
            normalizedType.includes("guilde") || normalizedType.includes("marchand") ? "commerce" : "",
            normalizedType.includes("crime") || normalizedType.includes("criminel") || normalizedType.includes("contrebande") ? "criminel" : ""
          ]),
          populationProfile: faction.populationProfile ?? (faction.homeCityId ? cityPopulationById.get(faction.homeCityId) : undefined),
          controlledZoneIds,
          influencedZoneIds,
          interestZoneIds,
          avoidedZoneIds,
          localAnchors,
          influenceZoneIds: [
            ...controlledZoneIds,
            ...influencedZoneIds,
            ...interestZoneIds,
            ...(faction.homeCityId ? [faction.homeCityId] : []),
            ...(faction.homeRegionId ? [faction.homeRegionId] : []),
            ...faction.presenceCells.map(cell => `cell:${getWorldMapCellKey(cell)}`)
          ].filter((zoneId, index, zoneIds) => zoneIds.indexOf(zoneId) === index),
          state: {
            resources: faction.resources,
            power: faction.power,
            influence: faction.influence,
            cohesion: faction.cohesion,
            aggressiveness: faction.aggression,
            discretion: faction.secrecy,
            security: clamp((faction.power + faction.cohesion) / 2)
          },
          ressourcesTransport: {
            budgetTotal: faction.resources,
            budgetDisponible: faction.resources,
            chevauxTotal: Math.max(0, Math.round(faction.power * 0.25 + (normalizedType.includes("milice") || normalizedType.includes("garde") || normalizedType.includes("marchand") ? 8 : 2))),
            chevauxDisponibles: Math.max(0, Math.round(faction.power * 0.25 + (normalizedType.includes("milice") || normalizedType.includes("garde") || normalizedType.includes("marchand") ? 8 : 2))),
            bateauxTotal: Math.max(0, Math.round(faction.influence * 0.05 + (normalizeRuntimeTags(faction.tags).includes("maritime") ? 2 : 0))),
            bateauxDisponibles: Math.max(0, Math.round(faction.influence * 0.05 + (normalizeRuntimeTags(faction.tags).includes("maritime") ? 2 : 0))),
            effectifsTotal: Math.max(0, Math.round(faction.power * 0.7 + faction.cohesion * 0.3)),
            effectifsDisponibles: Math.max(0, Math.round(faction.power * 0.7 + faction.cohesion * 0.3))
          },
          objectives: (
            explicitObjectivesByFactionId.get(faction.id)?.length
              ? explicitObjectivesByFactionId.get(faction.id)
              : faction.objectiveHints.map((_, index) => ({
                  objectiveId: `objective:map:${faction.id}:${index}`,
                  priority: clamp(45 + index * 10, 0, 100)
                }))
          )!.slice().sort((left, right) => right.priority - left.priority),
          relations: faction.relations.map(relation => ({
            otherFactionId: `faction:map:${relation.targetFactionId}`,
            status: relation.status,
            trust: relation.trust,
            hostility: relation.hostility
          })),
          recentHistory: [],
          cooldowns: {}
        } satisfies WorldFaction
      ];
    })
  );
}

function findCityDistrictByTags(city: WorldCity, districts: Record<string, WorldDistrict>, tags: string[]): WorldDistrict | undefined {
  return city.districtIds
    .map(districtId => districts[districtId])
    .find(district => district && district.tags.some(tag => tags.includes(tag)));
}

function createSystemFactionState(source: WorldCity | WorldRegion, patch: Partial<WorldFaction["state"]>): WorldFaction["state"] {
  return {
    resources: patch.resources ?? source.state.supply ?? source.state.production ?? 45,
    power: patch.power ?? source.state.order ?? source.state.politicalControl ?? 45,
    influence: patch.influence ?? source.state.commerce ?? source.state.circulation ?? 45,
    cohesion: patch.cohesion ?? source.state.order ?? source.state.stability ?? 50,
    aggressiveness: patch.aggressiveness ?? 25,
    discretion: patch.discretion ?? 35,
    security: patch.security ?? source.state.order ?? source.state.stability ?? 50
  };
}

function deriveSystemRuntimeFactions(
  seed: Pick<WorldState, "cities" | "districts" | "routes" | "regions">
): Record<string, WorldFaction> {
  const systemFactions: Record<string, WorldFaction> = {};

  Object.values(seed.cities).forEach(city => {
    const anchorDistrict =
      findCityDistrictByTags(city, seed.districts, ["bastion", "controle", "administration"]) ??
      seed.districts[city.districtIds[0]];
    const commerceDistrict =
      findCityDistrictByTags(city, seed.districts, ["commerce", "taxes", "port", "market", "relais"]) ??
      anchorDistrict;
    const influenceZoneIds = Array.from(new Set([city.id, ...city.districtIds, ...city.routeIds]));

    const publicGuardId = `faction:system:guard:${city.id}`;
    systemFactions[publicGuardId] = {
      id: publicGuardId,
      name: `Garde locale de ${city.name}`,
      type: "public_guard",
      tags: ["system", "public", "civic", "military", "stabilizer"],
      populationProfile: city.populationProfile,
      controlledZoneIds: anchorDistrict ? [anchorDistrict.id] : [city.id],
      influencedZoneIds: city.routeIds,
      interestZoneIds: influenceZoneIds,
      localAnchors: anchorDistrict ? [{
        id: `${publicGuardId}:hq`,
        label: `Poste central de ${city.name}`,
        type: "outpost",
        target: { kind: "district", id: anchorDistrict.id },
        level: 3,
        tags: ["public_order", "checkpoint"],
        notes: "Faction systeme generee pour maintenir l'ordre local."
      }] : [],
      influenceZoneIds,
      state: createSystemFactionState(city, {
        power: Math.max(45, city.state.order ?? 45),
        cohesion: Math.max(48, city.state.order ?? 48),
        influence: 38,
        aggressiveness: 42,
        discretion: 24,
        security: Math.max(50, city.state.order ?? 50),
        resources: Math.max(38, city.state.supply ?? 38)
      }),
      objectives: [],
      relations: [],
      recentHistory: [],
      cooldowns: {}
    };

    const civicAuthorityId = `faction:system:civic:${city.id}`;
    systemFactions[civicAuthorityId] = {
      id: civicAuthorityId,
      name: `Autorite civique de ${city.name}`,
      type: "civic_authority",
      tags: ["system", "public", "civic", "stabilizer", "governance"],
      populationProfile: city.populationProfile,
      controlledZoneIds: [city.id],
      influencedZoneIds: city.districtIds,
      interestZoneIds: influenceZoneIds,
      localAnchors: commerceDistrict ? [{
        id: `${civicAuthorityId}:hall`,
        label: `Maison commune de ${city.name}`,
        type: "contact",
        target: { kind: "district", id: commerceDistrict.id },
        level: 2,
        tags: ["governance", "public_service"],
        notes: "Faction systeme generee pour absorber peur, agitation et rupture civique."
      }] : [],
      influenceZoneIds,
      state: createSystemFactionState(city, {
        power: 34,
        influence: Math.max(48, city.state.attractiveness ?? city.state.commerce ?? 48),
        cohesion: Math.max(50, city.state.order ?? 50),
        aggressiveness: 12,
        discretion: 38,
        security: Math.max(35, city.state.order ?? 35),
        resources: Math.max(42, city.state.supply ?? 42)
      }),
      objectives: [],
      relations: [],
      recentHistory: [],
      cooldowns: {}
    };

    const qualifiesForLogistics = city.routeIds.length >= 2 || city.tags.some(tag => ["trade_city", "maritime", "commerce"].includes(tag));
    if (qualifiesForLogistics) {
      const logisticsOfficeId = `faction:system:logistics:${city.id}`;
      systemFactions[logisticsOfficeId] = {
        id: logisticsOfficeId,
        name: `Office logistique de ${city.name}`,
        type: "logistics_office",
        tags: ["system", "public", "trade", "logistics", "stabilizer"],
        populationProfile: city.populationProfile,
        controlledZoneIds: commerceDistrict ? [commerceDistrict.id] : [city.id],
        influencedZoneIds: city.routeIds,
        interestZoneIds: influenceZoneIds,
        localAnchors: commerceDistrict ? [{
          id: `${logisticsOfficeId}:relay`,
          label: `Relais logistique de ${city.name}`,
          type: "warehouse",
          target: { kind: "district", id: commerceDistrict.id },
          level: 3,
          tags: ["supply", "dispatch"],
          notes: "Faction systeme generee pour maintenir trafic, stock et circulation."
        }] : [],
        influenceZoneIds,
        state: createSystemFactionState(city, {
          power: 28,
          influence: Math.max(54, city.state.commerce ?? 54),
          cohesion: 46,
          aggressiveness: 8,
          discretion: 32,
          security: 34,
          resources: Math.max(55, city.state.supply ?? 55)
        }),
        objectives: [],
        relations: [],
        recentHistory: [],
        cooldowns: {}
      };
    }
  });

  Object.values(seed.regions).forEach(region => {
    const shouldCreateRegionalPatrol =
      region.tags.some(tag => ["borderland", "frontalier", "dangerous", "dangereux"].includes(tag)) ||
      region.mainRouteIds.length >= 2;
    if (!shouldCreateRegionalPatrol) return;
    const regionalPatrolId = `faction:system:regional_patrol:${region.id}`;
    systemFactions[regionalPatrolId] = {
      id: regionalPatrolId,
      name: `Patrouille regionale de ${region.name}`,
      type: "regional_patrol",
      tags: ["system", "public", "military", "frontier", "stabilizer"],
      populationProfile: undefined,
      controlledZoneIds: [region.id],
      influencedZoneIds: region.mainRouteIds,
      interestZoneIds: [region.id, ...region.cityIds, ...region.mainRouteIds],
      localAnchors: region.mainRouteIds[0] ? [{
        id: `${regionalPatrolId}:relay`,
        label: `Relais regional de ${region.name}`,
        type: "outpost",
        target: { kind: "route", id: region.mainRouteIds[0] },
        level: 3,
        tags: ["frontier", "relay"],
        notes: "Faction systeme generee pour tenir les routes et frontieres regionales."
      }] : [],
      influenceZoneIds: [region.id, ...region.cityIds, ...region.mainRouteIds],
      state: createSystemFactionState(region, {
        power: Math.max(46, region.state.externalThreat ?? 46),
        influence: 30,
        cohesion: Math.max(48, region.state.stability ?? 48),
        aggressiveness: 38,
        discretion: 22,
        security: Math.max(46, region.state.stability ?? 46),
        resources: Math.max(40, region.state.production ?? 40)
      }),
      objectives: [],
      relations: [],
      recentHistory: [],
      cooldowns: {}
    };
  });

  return systemFactions;
}

function deriveObjectivesFromLayout(layout: WorldMapLayout): Record<string, SpecialObjective> {
  const explicitObjectives = layout.simulation?.specialObjectives ?? [];
  if (explicitObjectives.length > 0) {
    return Object.fromEntries(
      explicitObjectives.map(objective => [
        `objective:map:${objective.id}`,
        (() => {
          const phases = (objective.phases ?? []).map((phase, index) => ({
            id: `objective_phase:map:${objective.id}:${phase.id || index}`,
            label: phase.label,
            description: phase.description,
            state: phase.state ?? (index === objective.currentPhaseIndex ? "active" : index < objective.currentPhaseIndex ? "completed" : "planned"),
            localTarget:
              phase.localTargetKind && phase.localTargetId
                ? {
                    kind: phase.localTargetKind === "place" ? "district" : phase.localTargetKind,
                    id: phase.localTargetId
                  }
                : undefined,
            zoneIds: phase.zoneIds ?? [],
            compatibleActionIds: (phase.compatibleActionIds ?? []) as SpecialObjective["compatibleActionIds"],
            requiredAnchorId: phase.requiredAnchorId,
            requiredAnchorType: phase.requiredAnchorType,
            progress: clamp(phase.progress ?? 0),
            progressWeight: Math.max(0, Number(phase.progressWeight) || 1),
            completionMode: phase.completionMode,
            completionThreshold: Math.max(0, Number(phase.completionThreshold) || 0),
            actionCountById: phase.actionCountById as Partial<Record<SpecialObjective["compatibleActionIds"][number], number>> | undefined,
            requiredPresenceRef:
              phase.requiredPresenceTargetKind && phase.requiredPresenceTargetId
                ? {
                    kind: phase.requiredPresenceTargetKind === "place" ? "district" : phase.requiredPresenceTargetKind,
                    id: phase.requiredPresenceTargetId
                  }
                : undefined,
            failureScore: Math.max(0, Number(phase.failureScore) || 0),
            maxFailureScore: Math.max(0, Number(phase.maxFailureScore) || 100),
            failureMode: phase.failureMode ?? "score_threshold",
            fatalFailureConditions: phase.fatalFailureConditions ?? [],
            notes: phase.notes
          }));
          const currentPhase = phases[objective.currentPhaseIndex];
          return {
          id: `objective:map:${objective.id}`,
          category: objective.category,
          owner: { kind: "faction", id: `faction:map:${objective.ownerFactionId}` },
          target:
            objective.targetKind && objective.targetId
              ? {
                  kind: objective.targetKind === "place" ? "district" : objective.targetKind,
                  id: objective.targetId
                }
              : undefined,
            priority: clamp(objective.priority),
            state: objective.state,
            progress: clamp(objective.progress),
            zoneIds: objective.zoneIds,
            phases,
            currentPhaseIndex: objective.currentPhaseIndex,
            phaseHistory: currentPhase ? [{ phaseId: currentPhase.id, enteredAtTick: 0 }] : [],
            obstacles: objective.obstacleHints,
            compatibleActionIds: objective.compatibleActionIds.length > 0
              ? objective.compatibleActionIds as SpecialObjective["compatibleActionIds"]
              : objective.category === "open_route"
                ? ["secure_route", "escort_convoy", "patrol"]
                : objective.category === "protect_secret"
                  ? ["sanctify_site", "patrol", "investigate"]
                : objective.category === "search_object"
                  ? ["investigate", "sanctify_site", "search_clue", "question_source"]
                  : ["recruit", "patrol", "investigate"],
            requiredAnchorId: objective.requiredAnchorId,
            requiredAnchorType: objective.requiredAnchorType,
            failureScore: Math.max(0, Number(objective.failureScore) || 0),
            maxFailureScore: Math.max(0, Number(objective.maxFailureScore) || 100),
            fatalFailureConditions: objective.fatalFailureConditions ?? [],
            onSuccess: objective.onSuccess ?? [],
            onFailure: objective.onFailure ?? [],
            successConsequencesApplied: false,
            failureConsequencesApplied: false,
            tags: objective.tags
        } satisfies SpecialObjective;
        })()
      ])
    );
  }

  return Object.fromEntries(
    (layout.simulation?.factions ?? []).flatMap(faction =>
      faction.objectiveHints.map((objectiveHint, index) => {
        const normalizedHint = objectiveHint.trim().toLowerCase();
        const category =
          normalizedHint.includes("route")
            ? "open_route"
            : normalizedHint.includes("controle")
              ? "take_control_place"
              : normalizedHint.includes("secret") || normalizedHint.includes("culte") || normalizedHint.includes("rituel")
                ? "protect_secret"
              : normalizedHint.includes("influence")
                ? "extend_influence"
                : normalizedHint.includes("recrut")
                  ? "recruit_agents"
                  : normalizedHint.includes("objet")
                    ? "search_object"
                    : "extend_influence";
        const target =
          faction.homeCityId
            ? { kind: "city" as const, id: faction.homeCityId }
            : faction.homeRegionId
              ? { kind: "region" as const, id: faction.homeRegionId }
              : undefined;
        return [
          `objective:map:${faction.id}:${index}`,
          {
            id: `objective:map:${faction.id}:${index}`,
            category,
            owner: { kind: "faction", id: `faction:map:${faction.id}` },
            target,
              priority: clamp(45 + index * 10),
              state: "active",
              progress: 0,
              zoneIds: [
                ...(faction.homeCityId ? [faction.homeCityId] : []),
                ...(faction.homeRegionId ? [faction.homeRegionId] : [])
              ],
              phases: [],
              currentPhaseIndex: 0,
              phaseHistory: [],
              obstacles: [],
              compatibleActionIds:
                category === "open_route"
                  ? ["secure_route", "escort_convoy", "patrol"]
                  : category === "protect_secret"
                    ? ["sanctify_site", "patrol", "investigate"]
                  : category === "search_object"
                    ? ["investigate", "sanctify_site", "search_clue", "question_source"]
                    : ["recruit", "patrol", "investigate"],
              requiredAnchorId: undefined,
              requiredAnchorType: undefined,
              failureScore: 0,
              maxFailureScore: 100,
              fatalFailureConditions: [],
              onSuccess: [],
              onFailure: [],
              successConsequencesApplied: false,
              failureConsequencesApplied: false,
              tags: faction.tags
          } satisfies SpecialObjective
        ] as const;
      })
    )
  );
}

function deriveMobileActorsFromLayout(layout: WorldMapLayout): Record<string, MobileActor> {
  const routePathById = new Map(
    layout.paths
      .filter(path => path.kind === "road")
      .map(path => {
        const pathCells = path.cells
          .map(cell => layout.cells.find(entry => entry.cell.x === cell.x && entry.cell.y === cell.y) ?? null)
          .filter((cell): cell is MapCellData => Boolean(cell));
        return [path.id, { path, pathCells }] as const;
      })
  );
  return Object.fromEntries(
    (layout.simulation?.mobileActors ?? []).map(actor => {
      const runtimeId = `mobile:map:${actor.id}`;
      const destination =
        actor.destinationKind === "cell" && actor.destinationCell
          ? resolveMapCellToRuntimeRef(layout, actor.destinationCell)
          : actor.destinationKind && actor.destinationId
            ? actor.destinationKind === "city" || actor.destinationKind === "route" || actor.destinationKind === "region"
              ? { kind: actor.destinationKind, id: actor.destinationId }
              : undefined
            : undefined;
      const routeCellPlacement = actor.positionKind === "cell" && actor.positionCell
        ? getRouteCellPlacement(layout, actor.positionCell)
        : undefined;
      const inferredRouteTargetId = routeCellPlacement
        ? inferRouteTargetId(layout, routeCellPlacement, destination)
        : undefined;
      const position =
        routeCellPlacement
          ? { kind: "route" as const, id: routeCellPlacement.routeId }
          : actor.positionKind === "cell" && actor.positionCell
            ? resolveMapCellToRuntimeRef(layout, actor.positionCell)
            : actor.positionKind === "city" || actor.positionKind === "route" || actor.positionKind === "region"
              ? { kind: actor.positionKind, id: actor.positionId ?? runtimeId }
              : undefined;
      const destinationRoutePlacement = actor.destinationKind === "cell" && actor.destinationCell
        ? getRouteCellPlacement(layout, actor.destinationCell)
        : undefined;
      const modeTransport =
        actor.travelMode === "river" || actor.travelMode === "sea"
          ? "bateau"
          : actor.travelMode === "foot"
            ? "pied"
            : actor.speed >= 4 && actor.headcount <= 24
              ? "cheval"
              : "pied";
      const routePlacementCost =
        routeCellPlacement
          ? (() => {
              const routeEntry = routePathById.get(routeCellPlacement.routeId);
              return routeEntry
                ? estimateLayoutPathTraversalCost(routeEntry.path, routeEntry.pathCells, {
                    state: { cargo: actor.cargo, headcount: actor.headcount },
                    modeTransport,
                    travelMode: actor.travelMode
                  })
                : 0;
            })()
          : 0;
      const routeProgress =
        routeCellPlacement && inferredRouteTargetId
          ? inferredRouteTargetId === routeCellPlacement.originEndpointId
            ? routePlacementCost * (1 - routeCellPlacement.progressRatio)
            : routePlacementCost * routeCellPlacement.progressRatio
          : 0;
      return [
        runtimeId,
        {
          id: runtimeId,
          typeEntity: actor.type,
          mobile: true,
          owner: actor.ownerFactionId ? { kind: "faction", id: `faction:map:${actor.ownerFactionId}` } : undefined,
          populationProfile: actor.populationProfile,
          position: position ?? { kind: "route", id: actor.positionId ?? runtimeId },
          destination,
          itineraryMode: actor.itineraryMode ?? "auto",
          itinerary: actor.itineraryRouteIds,
          currentRouteTargetId: inferredRouteTargetId,
          destinationRouteProgress:
            destination?.kind === "route" && destinationRoutePlacement?.routeId === destination.id
              ? (() => {
                  const routeEntry = routePathById.get(destination.id);
                  if (!routeEntry) return undefined;
                  const traversalCost = estimateLayoutPathTraversalCost(routeEntry.path, routeEntry.pathCells, {
                    state: { cargo: actor.cargo, headcount: actor.headcount },
                    modeTransport,
                    travelMode: actor.travelMode
                  });
                  return traversalCost * destinationRoutePlacement.progressRatio;
                })()
              : undefined,
          modeTransport,
          travelMode: actor.travelMode,
          speed: actor.speed,
          routeProgress,
          state: {
            security: actor.security,
            fatigue: actor.fatigue,
            cargo: actor.cargo,
            headcount: actor.headcount,
            resources: actor.resources
          },
          objectives: actor.objectiveIds.map((objectiveId, index) => ({
            objectiveId: `objective:map:${objectiveId}`,
            priority: clamp(50 + index * 8)
          })),
          possibleInteractionTags: actor.interactionTags,
          recentHistory: [],
          simulationLevel: actor.simulationLevel,
          cooldowns: {}
        } satisfies MobileActor
      ];
    })
  );
}

export function createSimulationSeedFromMapLayout(layout: WorldMapLayout, overrides: MapSimulationSeedOverrides = {}): Pick<WorldState, "cities" | "districts" | "routes" | "regions"> {
  const cityRegionMap = new Map<string, string>();
  (layout.governanceRegions ?? []).forEach(region => {
    if (region.principalCityId) {
      cityRegionMap.set(region.principalCityId, region.id);
    }
  });

  const cityCellsById = new Map<string, MapCellData[]>();
  layout.cities.forEach(city => cityCellsById.set(city.id, collectCityCells(layout, city)));
  const districtOverridesById = getDistrictOverridesById(layout);
  const nativeDistrictsByCityId = getNativeDistrictsByCityId(layout);

  const citiesBase: Record<string, WorldCity> = Object.fromEntries(
    layout.cities.map(city => {
      const cityCells = cityCellsById.get(city.id) ?? [];
      const routeIds = collectRouteIdsForCity(layout, city);
      return [
        city.id,
        {
          id: city.id,
          name: toTitleCase(city.wikiEntityId),
          regionId: cityRegionMap.get(city.id),
          districtIds: [],
          routeIds,
          tags: [...new Set([city.kind, ...cityCells.flatMap(cell => cell.tags ?? []).filter(tag => ["maritime", "commerce", "sacre", "frontalier", "urbain"].includes(tag))])],
          populationProfile: city.populationProfile,
          state: statFromCells(cityCells, "city"),
          factionInfluence: inferFactionInfluence(cityCells),
          structuralPlaces: inferStructuralPlaces(city, cityCells),
          recentHistory: [],
          activeTensionIds: []
        } satisfies WorldCity
      ];
    })
  );

  const districtEntries = layout.cities.flatMap(city => {
    const cityCells = cityCellsById.get(city.id) ?? [];
    const districtProfiles = nativeDistrictsByCityId.get(city.id)?.filter(profile => profile.cells.length > 0) ?? inferDistrictProfiles(city, cityCells);
    return districtProfiles.map(profile => [
      profile.id,
      (() => {
        const districtOverride = districtOverridesById.get(profile.id);
        return {
          id: profile.id,
          name: districtOverride?.name?.trim() || profile.name,
          cityId: city.id,
          connectionIds: citiesBase[city.id].routeIds,
          tags:
            districtOverride?.tags && districtOverride.tags.length > 0
              ? districtOverride.tags
              : profile.tags,
          populationProfile: districtOverride?.populationProfile ?? profile.populationProfile ?? citiesBase[city.id].populationProfile,
          state: statFromCells(profile.cells, "district"),
          factionInfluence: inferFactionInfluence(profile.cells),
          importantPlaces:
            districtOverride?.importantPlaces && districtOverride.importantPlaces.length > 0
              ? districtOverride.importantPlaces
              : profile.importantPlaces && profile.importantPlaces.length > 0
                ? profile.importantPlaces
                : [...new Set(profile.cells.flatMap(cell => cell.locationWikiIds ?? []))],
          dominantActivities:
            districtOverride?.dominantActivities && districtOverride.dominantActivities.length > 0
              ? districtOverride.dominantActivities
              : profile.dominantActivities.length > 0
                ? profile.dominantActivities
                : inferDominantActivities(profile.cells),
          activeTensionIds: [],
          recentHistory: [],
          ambientSignals: []
        } satisfies WorldDistrict;
      })()
    ] as const);
  });

  const districtsBase: Record<string, WorldDistrict> = Object.fromEntries(districtEntries);
  Object.values(districtsBase).forEach(district => {
    citiesBase[district.cityId]?.districtIds.push(district.id);
  });

  const cellByKey = new Map(layout.cells.map(cell => [getWorldMapCellKey(cell.cell), cell]));
  const routesBase: Record<string, WorldRoute> = Object.fromEntries(
    layout.paths
      .filter(path => path.kind === "road")
      .map(path => {
        const matchingCities = layout.cities.filter(city =>
          path.cells.some(cell => cell.x === city.cell.x && cell.y === city.cell.y)
        );
        const pathCells = path.cells
          .map(cell => cellByKey.get(getWorldMapCellKey(cell)))
          .filter((cell): cell is MapCellData => Boolean(cell));
        const originId = matchingCities[0]?.id ?? path.id;
        const destinationId = matchingCities[1]?.id ?? originId;
        return [
          path.id,
          {
            id: path.id,
            originId,
            destinationId,
            travelCost: path.roadType === "major_road" ? 2 : path.roadType === "road" ? 3 : 4,
            length: Math.max(path.cells.length, 1),
            tags: [path.roadType ?? "road", ...new Set(pathCells.flatMap(cell => cell.tags ?? []).filter(tag => ["frontalier", "dangerous", "commerce", "maritime", "forestier"].includes(tag)))],
            state: inferRouteStats(pathCells, matchingCities.length, path.roadType ?? "road"),
            recentHistory: [],
            activeTensionIds: [],
            mobileActorIds: []
          } satisfies WorldRoute
        ];
      })
  );

  const regionsBase: Record<string, WorldRegion> = Object.fromEntries(
    (layout.governanceRegions ?? []).map(region => {
      const regionTags = inferRegionTags(layout, region.id);
      return [
        region.id,
        {
          id: region.id,
          name: toTitleCase(region.wikiEntityId),
          cityIds: Object.values(citiesBase)
            .filter(city => city.regionId === region.id)
            .map(city => city.id),
          mainRouteIds: Object.values(routesBase)
            .filter(route => route.originId === region.principalCityId || route.destinationId === region.principalCityId)
            .map(route => route.id),
          state: {
            stability: clamp(56 - countMatches(regionTags, ["frontalier", "dangereux"]) * 9),
            politicalControl: clamp(52 + countMatches(regionTags, ["urbain"]) * 6 - countMatches(regionTags, ["frontalier"]) * 8),
            production: clamp(36 + countMatches(regionTags, ["agricole", "minier", "forestier"]) * 10),
            circulation: clamp(34 + countMatches(regionTags, ["commerce", "maritime"]) * 9),
            externalThreat: clamp(14 + countMatches(regionTags, ["frontalier", "dangereux"]) * 12)
          },
          dominantWeather: "temperate",
          recentHistory: [],
          activeTensionIds: [],
          tags: regionTags
        } satisfies WorldRegion
      ];
    })
  );

  return {
    cities: mergeRecord(citiesBase, overrides.cityPatches),
    districts: mergeRecord(districtsBase, overrides.districtPatches),
    routes: mergeRecord(routesBase, overrides.routePatches),
    regions: mergeRecord(regionsBase, overrides.regionPatches)
  };
}

export function createWorldStateFromMapLayout(layout: WorldMapLayout, overrides: MapSimulationSeedOverrides = {}): WorldState {
  const seed = createSimulationSeedFromMapLayout(layout, overrides);
  const derivedFactions = deriveRuntimeFactionsFromLayout(layout);
  const systemFactions = deriveSystemRuntimeFactions(seed);
  const derivedObjectives = deriveObjectivesFromLayout(layout);
  const derivedMobileActors = deriveMobileActorsFromLayout(layout);
  const routes = seed.routes;
  const mobileActors = { ...derivedMobileActors, ...(overrides.mobileActors ?? {}) };
  Object.values(mobileActors).forEach(actor => {
    if (actor.populationProfile) return;
    const ownerId = actor.owner?.kind === "faction" ? actor.owner.id : undefined;
    if (!ownerId) return;
    actor.populationProfile = derivedFactions[ownerId]?.populationProfile;
  });
  syncRouteMobileActorIds(routes, mobileActors);
  return {
    clock: {
      tick: 0,
      microTick: 0,
      macroTick: 0,
      minutesPerMicroTick: 60,
      microPerMacro: 6,
      ...overrides.clock
    },
    cities: seed.cities,
    districts: seed.districts,
    routes,
    regions: seed.regions,
    factions: { ...derivedFactions, ...systemFactions, ...(overrides.factions ?? {}) },
    specialObjectives: { ...derivedObjectives, ...(overrides.objectives ?? {}) },
    mobileActors,
    tensions: overrides.tensions ?? {},
    pressures: {},
    pendingSignals: [],
    pendingRumors: [],
    pendingOpportunities: []
  };
}

export function createWorldStateFromCurrentMap(overrides: MapSimulationSeedOverrides = {}): WorldState {
  return createWorldStateFromMapLayout(WORLD_MAP_LAYOUT, overrides);
}

export function summarizeSimulationSeed(state: Pick<WorldState, "cities" | "districts" | "routes" | "regions" | "factions" | "specialObjectives" | "mobileActors">) {
  return {
    cityCount: Object.keys(state.cities).length,
    districtCount: Object.keys(state.districts).length,
    routeCount: Object.keys(state.routes).length,
    regionCount: Object.keys(state.regions).length,
    factionCount: Object.keys(state.factions).length,
    objectiveCount: Object.keys(state.specialObjectives).length,
    mobileActorCount: Object.keys(state.mobileActors).length,
    districtIdsByCity: Object.fromEntries(Object.values(state.cities).map(city => [city.id, city.districtIds])),
    routeIdsByCity: Object.fromEntries(Object.values(state.cities).map(city => [city.id, city.routeIds]))
  };
}
