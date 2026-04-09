import { WORLD_MAP_LAYOUT, getWorldMapCellKey } from "../data/worldMapLayout";
function toTitleCase(input) {
    return input
        .split(/[_-]/g)
        .filter(Boolean)
        .map(part => part.slice(0, 1).toUpperCase() + part.slice(1))
        .join(" ");
}
function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
}
function countMatches(values, matchers) {
    if (!values?.length)
        return 0;
    return values.filter(value => matchers.includes(value)).length;
}
function hasAny(values, matchers) {
    return countMatches(values, matchers) > 0;
}
function collectCityCells(layout, city) {
    const cityCellKey = getWorldMapCellKey(city.cell);
    return layout.cells.filter(cell => {
        const distance = Math.abs(cell.cell.x - city.cell.x) + Math.abs(cell.cell.y - city.cell.y);
        return cell.cityWikiId === city.wikiEntityId || getWorldMapCellKey(cell.cell) === cityCellKey || distance <= 2;
    });
}
function collectRouteIdsForCity(layout, city) {
    return layout.paths
        .filter(path => path.kind === "road" && path.cells.some(cell => cell.x === city.cell.x && cell.y === city.cell.y))
        .map(path => path.id);
}
function inferDominantActivities(cells) {
    const tags = cells.flatMap(cell => cell.tags ?? []);
    const activities = new Set();
    if (hasAny(tags, ["commerce", "maritime"]))
        activities.add("trade");
    if (hasAny(tags, ["agricole"]))
        activities.add("food");
    if (hasAny(tags, ["minier"]))
        activities.add("extraction");
    if (hasAny(tags, ["forestier"]))
        activities.add("wood");
    if (hasAny(tags, ["sacre"]))
        activities.add("religion");
    if (hasAny(tags, ["urbain"]))
        activities.add("civic");
    if (activities.size === 0)
        activities.add("local");
    return [...activities];
}
function inferDistrictProfiles(city, cityCells) {
    const profiles = [
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
function getDistrictOverridesById(layout) {
    return new Map((layout.simulation?.districtOverrides ?? []).map(override => [override.id, override]));
}
function getNativeDistrictsByCityId(layout) {
    const cellsByKey = new Map(layout.cells.map(cell => [getWorldMapCellKey(cell.cell), cell]));
    const byCityId = new Map();
    (layout.simulation?.districts ?? []).forEach(district => {
        const entry = {
            id: district.id,
            name: district.name,
            tags: district.tags,
            cells: district.cellKeys
                .map(cellKey => cellsByKey.get(cellKey))
                .filter((cell) => Boolean(cell)),
            dominantActivities: district.dominantActivities,
            importantPlaces: district.importantPlaces,
            populationProfile: district.populationProfile
        };
        const current = byCityId.get(district.cityId);
        if (current)
            current.push(entry);
        else
            byCityId.set(district.cityId, [entry]);
    });
    return byCityId;
}
function statFromCells(cells, kind) {
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
function inferFactionInfluence(cells) {
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
function inferStructuralPlaces(city, cells) {
    const places = new Set([city.wikiEntityId]);
    cells.forEach(cell => {
        (cell.locationWikiIds ?? []).forEach(locationId => places.add(locationId));
    });
    return [...places];
}
function inferRouteStats(pathCells, routeIdsTouching, roadType) {
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
function inferRegionTags(layout, regionId) {
    const tags = new Set();
    layout.cells.forEach(cell => {
        if (cell.governanceRegionId === regionId) {
            (cell.tags ?? []).forEach(tag => tags.add(tag));
        }
    });
    return [...tags];
}
function mergeRecord(base, patches) {
    if (!patches)
        return base;
    return Object.fromEntries(Object.entries(base).map(([id, entry]) => [id, { ...entry, ...(patches[id] ?? {}) }]));
}
function getCellDistance(left, right) {
    return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}
function getRuntimeRefForRouteEndpoint(layout, routeId, cell) {
    const city = layout.cities.find(entry => entry.cell.x === cell.x && entry.cell.y === cell.y);
    if (city) {
        return { kind: "city", id: city.id };
    }
    const region = (layout.governanceRegions ?? []).find(entry => {
        if (entry.labelCell.x === cell.x && entry.labelCell.y === cell.y)
            return true;
        if (!entry.principalCityId)
            return false;
        const principalCity = layout.cities.find(cityEntry => cityEntry.id === entry.principalCityId);
        return Boolean(principalCity && principalCity.cell.x === cell.x && principalCity.cell.y === cell.y);
    });
    if (region) {
        return { kind: "region", id: region.id };
    }
    return { kind: "route", id: routeId };
}
export function resolveMapCellToRuntimeRef(layout, cell) {
    const city = layout.cities.find(entry => entry.cell.x === cell.x && entry.cell.y === cell.y);
    if (city) {
        return { kind: "city", id: city.id };
    }
    const region = (layout.governanceRegions ?? []).find(entry => {
        if (entry.labelCell.x === cell.x && entry.labelCell.y === cell.y)
            return true;
        if (!entry.principalCityId)
            return false;
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
function getRouteCellPlacement(layout, cell) {
    const matchingPlacements = layout.paths
        .filter(path => path.kind === "road" && path.cells.length > 1)
        .flatMap(path => path.cells
        .map((routeCell, index) => ({ routeCell, index }))
        .filter(entry => entry.routeCell.x === cell.x && entry.routeCell.y === cell.y)
        .map(entry => {
        const routeLength = path.cells.length - 1;
        const progressRatio = routeLength > 0 ? entry.index / routeLength : 0;
        const routeCost = path.roadType === "major_road" ? 2 : path.roadType === "road" ? 3 : 4;
        const originEndpointId = getRuntimeRefForRouteEndpoint(layout, path.id, path.cells[0]).id;
        const destinationEndpointId = getRuntimeRefForRouteEndpoint(layout, path.id, path.cells[path.cells.length - 1]).id;
        return {
            routeId: path.id,
            routeIndex: entry.index,
            routeLength,
            routeCost,
            originEndpointId,
            destinationEndpointId,
            absoluteProgress: progressRatio * routeCost
        };
    }));
    return matchingPlacements
        .slice()
        .sort((left, right) => {
        const leftCentrality = Math.abs(left.routeIndex - left.routeLength / 2);
        const rightCentrality = Math.abs(right.routeIndex - right.routeLength / 2);
        return leftCentrality - rightCentrality;
    })[0];
}
function inferRouteTargetId(layout, placement, destination) {
    const route = layout.paths.find(path => path.id === placement.routeId && path.kind === "road");
    if (!route || route.cells.length === 0)
        return undefined;
    const startCell = route.cells[0];
    const endCell = route.cells[route.cells.length - 1];
    const originRef = getRuntimeRefForRouteEndpoint(layout, placement.routeId, startCell);
    const destinationRef = getRuntimeRefForRouteEndpoint(layout, placement.routeId, endCell);
    if (destination?.id && destination.id === originRef.id)
        return originRef.id;
    if (destination?.id && destination.id === destinationRef.id)
        return destinationRef.id;
    const destinationCell = destination?.kind === "city"
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
function syncRouteMobileActorIds(routes, mobileActors) {
    Object.values(routes).forEach(route => {
        route.mobileActorIds = [];
    });
    Object.values(mobileActors).forEach(actor => {
        const routeId = actor.position.kind === "route"
            ? actor.position.id
            : actor.itinerary[0];
        if (!routeId)
            return;
        const route = routes[routeId];
        if (!route)
            return;
        if (!route.mobileActorIds.includes(actor.id)) {
            route.mobileActorIds.push(actor.id);
        }
    });
}
function deriveRuntimeFactionsFromLayout(layout) {
    const cityPopulationById = new Map(layout.cities.map(city => [city.id, city.populationProfile]));
    const knownDistrictIds = new Set(Object.keys(createSimulationSeedFromMapLayout(layout).districts));
    return Object.fromEntries((layout.simulation?.factions ?? []).map(faction => {
        const type = String(faction.type || "faction").trim().toLowerCase();
        const runtimeId = `faction:map:${faction.id}`;
        const controlledZoneIds = Array.from(new Set(faction.controlledZoneIds ?? []));
        const influencedZoneIds = Array.from(new Set(faction.influencedZoneIds ?? []));
        const interestZoneIds = Array.from(new Set(faction.interestZoneIds ?? []));
        const avoidedZoneIds = Array.from(new Set(faction.avoidedZoneIds ?? []));
        const localAnchors = (faction.localAnchors ?? []).map(anchor => {
            const target = anchor.targetKind === "city" && anchor.targetId
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
                tags: anchor.tags ?? [],
                notes: anchor.notes ?? ""
            };
        });
        return [
            runtimeId,
            {
                id: runtimeId,
                name: faction.label,
                type: faction.type,
                tags: Array.from(new Set([
                    ...faction.tags,
                    type.includes("culte") ? "religious" : "",
                    type.includes("milice") || type.includes("garde") ? "military" : "",
                    type.includes("guilde") || type.includes("marchand") ? "trade" : "",
                    type.includes("crime") || type.includes("contrebande") ? "criminal" : ""
                ].filter(Boolean))),
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
                    chevauxTotal: Math.max(0, Math.round(faction.power * 0.25 + (type.includes("milice") || type.includes("garde") || type.includes("marchand") ? 8 : 2))),
                    chevauxDisponibles: Math.max(0, Math.round(faction.power * 0.25 + (type.includes("milice") || type.includes("garde") || type.includes("marchand") ? 8 : 2))),
                    bateauxTotal: Math.max(0, Math.round(faction.influence * 0.05 + ((faction.tags ?? []).includes("maritime") ? 2 : 0))),
                    bateauxDisponibles: Math.max(0, Math.round(faction.influence * 0.05 + ((faction.tags ?? []).includes("maritime") ? 2 : 0))),
                    effectifsTotal: Math.max(0, Math.round(faction.power * 0.7 + faction.cohesion * 0.3)),
                    effectifsDisponibles: Math.max(0, Math.round(faction.power * 0.7 + faction.cohesion * 0.3))
                },
                objectives: faction.objectiveHints.map((_, index) => ({
                    objectiveId: `objective:map:${faction.id}:${index}`,
                    priority: clamp(45 + index * 10, 0, 100)
                })),
                relations: faction.relations.map(relation => ({
                    otherFactionId: `faction:map:${relation.targetFactionId}`,
                    status: relation.status,
                    trust: relation.trust,
                    hostility: relation.hostility
                })),
                recentHistory: [],
                cooldowns: {}
            }
        ];
    }));
}
function deriveObjectivesFromLayout(layout) {
    const explicitObjectives = layout.simulation?.specialObjectives ?? [];
    if (explicitObjectives.length > 0) {
        return Object.fromEntries(explicitObjectives.map(objective => [
            `objective:map:${objective.id}`,
            {
                id: `objective:map:${objective.id}`,
                category: objective.category,
                owner: { kind: "faction", id: `faction:map:${objective.ownerFactionId}` },
                target: objective.targetKind && objective.targetId
                    ? {
                        kind: objective.targetKind === "place" ? "district" : objective.targetKind,
                        id: objective.targetId
                    }
                    : undefined,
                priority: clamp(objective.priority),
                state: objective.state,
                progress: clamp(objective.progress),
                zoneIds: objective.zoneIds,
                phases: objective.phases,
                currentPhaseIndex: objective.currentPhaseIndex,
                obstacles: objective.obstacleHints,
                compatibleActionIds: objective.compatibleActionIds.length > 0
                    ? objective.compatibleActionIds
                    : objective.category === "open_route"
                        ? ["secure_route", "escort_convoy", "patrol"]
                        : objective.category === "protect_secret"
                            ? ["sanctify_site", "patrol", "investigate"]
                            : objective.category === "search_object"
                                ? ["investigate", "sanctify_site", "search_clue", "question_source"]
                                : ["recruit", "patrol", "investigate"],
                requiredAnchorId: objective.requiredAnchorId,
                requiredAnchorType: objective.requiredAnchorType,
                onSuccess: objective.onSuccess ?? [],
                onFailure: objective.onFailure ?? [],
                tags: objective.tags
            }
        ]));
    }
    return Object.fromEntries((layout.simulation?.factions ?? []).flatMap(faction => faction.objectiveHints.map((objectiveHint, index) => {
        const normalizedHint = objectiveHint.trim().toLowerCase();
        const category = normalizedHint.includes("route")
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
        const target = faction.homeCityId
            ? { kind: "city", id: faction.homeCityId }
            : faction.homeRegionId
                ? { kind: "region", id: faction.homeRegionId }
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
                obstacles: [],
                compatibleActionIds: category === "open_route"
                    ? ["secure_route", "escort_convoy", "patrol"]
                    : category === "protect_secret"
                        ? ["sanctify_site", "patrol", "investigate"]
                        : category === "search_object"
                            ? ["investigate", "sanctify_site", "search_clue", "question_source"]
                            : ["recruit", "patrol", "investigate"],
                requiredAnchorId: undefined,
                requiredAnchorType: undefined,
                onSuccess: [],
                onFailure: [],
                tags: faction.tags
            }
        ];
    })));
}
function deriveMobileActorsFromLayout(layout) {
    return Object.fromEntries((layout.simulation?.mobileActors ?? []).map(actor => {
        const runtimeId = `mobile:map:${actor.id}`;
        const destination = actor.destinationKind === "cell" && actor.destinationCell
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
        const position = routeCellPlacement
            ? { kind: "route", id: routeCellPlacement.routeId }
            : actor.positionKind === "cell" && actor.positionCell
                ? resolveMapCellToRuntimeRef(layout, actor.positionCell)
                : actor.positionKind === "city" || actor.positionKind === "route" || actor.positionKind === "region"
                    ? { kind: actor.positionKind, id: actor.positionId ?? runtimeId }
                    : undefined;
        const routeProgress = routeCellPlacement && inferredRouteTargetId
            ? inferredRouteTargetId === routeCellPlacement.originEndpointId
                ? routeCellPlacement.routeCost - routeCellPlacement.absoluteProgress
                : routeCellPlacement.absoluteProgress
            : 0;
        const destinationRoutePlacement = actor.destinationKind === "cell" && actor.destinationCell
            ? getRouteCellPlacement(layout, actor.destinationCell)
            : undefined;
        const modeTransport = actor.travelMode === "river" || actor.travelMode === "sea"
            ? "bateau"
            : actor.travelMode === "foot"
                ? "pied"
                : actor.speed >= 4 && actor.headcount <= 24
                    ? "cheval"
                    : "pied";
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
                destinationRouteProgress: destination?.kind === "route" && destinationRoutePlacement?.routeId === destination.id
                    ? destinationRoutePlacement.absoluteProgress
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
            }
        ];
    }));
}
export function createSimulationSeedFromMapLayout(layout, overrides = {}) {
    const cityRegionMap = new Map();
    (layout.governanceRegions ?? []).forEach(region => {
        if (region.principalCityId) {
            cityRegionMap.set(region.principalCityId, region.id);
        }
    });
    const cityCellsById = new Map();
    layout.cities.forEach(city => cityCellsById.set(city.id, collectCityCells(layout, city)));
    const districtOverridesById = getDistrictOverridesById(layout);
    const nativeDistrictsByCityId = getNativeDistrictsByCityId(layout);
    const citiesBase = Object.fromEntries(layout.cities.map(city => {
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
            }
        ];
    }));
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
                    tags: districtOverride?.tags && districtOverride.tags.length > 0
                        ? districtOverride.tags
                        : profile.tags,
                    populationProfile: districtOverride?.populationProfile ?? profile.populationProfile ?? citiesBase[city.id].populationProfile,
                    state: statFromCells(profile.cells, "district"),
                    factionInfluence: inferFactionInfluence(profile.cells),
                    importantPlaces: districtOverride?.importantPlaces && districtOverride.importantPlaces.length > 0
                        ? districtOverride.importantPlaces
                        : profile.importantPlaces && profile.importantPlaces.length > 0
                            ? profile.importantPlaces
                            : [...new Set(profile.cells.flatMap(cell => cell.locationWikiIds ?? []))],
                    dominantActivities: districtOverride?.dominantActivities && districtOverride.dominantActivities.length > 0
                        ? districtOverride.dominantActivities
                        : profile.dominantActivities.length > 0
                            ? profile.dominantActivities
                            : inferDominantActivities(profile.cells),
                    activeTensionIds: [],
                    recentHistory: [],
                    ambientSignals: []
                };
            })()
        ]);
    });
    const districtsBase = Object.fromEntries(districtEntries);
    Object.values(districtsBase).forEach(district => {
        citiesBase[district.cityId]?.districtIds.push(district.id);
    });
    const cellByKey = new Map(layout.cells.map(cell => [getWorldMapCellKey(cell.cell), cell]));
    const routesBase = Object.fromEntries(layout.paths
        .filter(path => path.kind === "road")
        .map(path => {
        const matchingCities = layout.cities.filter(city => path.cells.some(cell => cell.x === city.cell.x && cell.y === city.cell.y));
        const pathCells = path.cells
            .map(cell => cellByKey.get(getWorldMapCellKey(cell)))
            .filter((cell) => Boolean(cell));
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
                mobileActorIds: []
            }
        ];
    }));
    const regionsBase = Object.fromEntries((layout.governanceRegions ?? []).map(region => {
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
                activeTensionIds: [],
                tags: regionTags
            }
        ];
    }));
    return {
        cities: mergeRecord(citiesBase, overrides.cityPatches),
        districts: mergeRecord(districtsBase, overrides.districtPatches),
        routes: mergeRecord(routesBase, overrides.routePatches),
        regions: mergeRecord(regionsBase, overrides.regionPatches)
    };
}
export function createWorldStateFromMapLayout(layout, overrides = {}) {
    const seed = createSimulationSeedFromMapLayout(layout, overrides);
    const derivedFactions = deriveRuntimeFactionsFromLayout(layout);
    const derivedObjectives = deriveObjectivesFromLayout(layout);
    const derivedMobileActors = deriveMobileActorsFromLayout(layout);
    const routes = seed.routes;
    const mobileActors = { ...derivedMobileActors, ...(overrides.mobileActors ?? {}) };
    Object.values(mobileActors).forEach(actor => {
        if (actor.populationProfile)
            return;
        const ownerId = actor.owner?.kind === "faction" ? actor.owner.id : undefined;
        if (!ownerId)
            return;
        actor.populationProfile = derivedFactions[ownerId]?.populationProfile;
    });
    syncRouteMobileActorIds(routes, mobileActors);
    return {
        clock: {
            tick: 0,
            microTick: 0,
            macroTick: 0,
            minutesPerMicroTick: 15,
            microPerMacro: 4,
            ...overrides.clock
        },
        cities: seed.cities,
        districts: seed.districts,
        routes,
        regions: seed.regions,
        factions: { ...derivedFactions, ...(overrides.factions ?? {}) },
        specialObjectives: { ...derivedObjectives, ...(overrides.objectives ?? {}) },
        mobileActors,
        tensions: overrides.tensions ?? {},
        pressures: {},
        pendingSignals: [],
        pendingRumors: [],
        pendingOpportunities: []
    };
}
export function createWorldStateFromCurrentMap(overrides = {}) {
    return createWorldStateFromMapLayout(WORLD_MAP_LAYOUT, overrides);
}
export function summarizeSimulationSeed(state) {
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
