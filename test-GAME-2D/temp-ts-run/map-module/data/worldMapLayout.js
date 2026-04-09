import valmorinMapUrl from "../../src/data/world/Valmorin.png";
import worldMapLayoutJson from "./worldMapLayout.json";
const BACKGROUND_IMAGES = {
    valmorin: valmorinMapUrl
};
const DEFAULT_GEOGRAPHY_DIFFICULTY = {
    terre: 5,
    plaine: 5,
    colline: 6,
    foret_claire: 6,
    foret_dense: 7,
    marais: 7,
    montagne: 8,
    desert: 6,
    cote: 5,
    toundra: 6,
    jungle: 7,
    urbain: 4,
    ocean: 9
};
const DEFAULT_LAYER_VISIBILITY = {
    background: true,
    grid: true,
    landWater: true,
    territories: true,
    regions: true,
    geographicZones: true,
    cities: true,
    roads: true,
    rivers: true
};
function normalizePopulationProfile(profile) {
    if (!profile || !Array.isArray(profile.groups))
        return undefined;
    const groups = profile.groups
        .map(group => ({
        groupId: String(group.groupId ?? "").trim(),
        weight: Math.max(0, Number(group.weight) || 0),
        role: group.role
    }))
        .filter(group => group.groupId.length > 0);
    if (groups.length === 0)
        return undefined;
    const dominantGroupId = profile.dominantGroupId?.trim() ||
        groups
            .slice()
            .sort((left, right) => right.weight - left.weight)[0]?.groupId;
    const notes = Array.isArray(profile.notes)
        ? profile.notes.map(note => String(note).trim()).filter(Boolean)
        : undefined;
    return {
        dominantGroupId,
        groups,
        notes
    };
}
const source = worldMapLayoutJson;
export function createRuntimeWorldMapLayout(sourceLayout) {
    return {
        ...sourceLayout,
        defaultLayers: {
            ...DEFAULT_LAYER_VISIBILITY,
            ...(sourceLayout.defaultLayers ?? {})
        },
        governances: sourceLayout.governances ?? [],
        governanceTerritories: sourceLayout.governanceTerritories ?? [],
        governanceRegions: sourceLayout.governanceRegions ?? [],
        geographicZones: (sourceLayout.geographicZones ?? []).map(zone => ({
            ...zone,
            borderColor: zone.borderColor ?? zone.color,
            borderWidth: Math.max(1, Number(zone.borderWidth) || 1.6),
            borderDashArray: zone.borderDashArray ?? "5 4"
        })),
        paths: sourceLayout.paths.map(path => ({
            ...path,
            roadType: path.kind === "road" ? path.roadType ?? "road" : undefined,
            sourceFlow: path.kind === "river" ? Math.max(1, Number(path.sourceFlow) || 1) : undefined,
            sourceType: path.kind === "river" ? path.sourceType ?? "source" : undefined
        })),
        cliffSegments: Array.isArray(sourceLayout.cliffSegments) ? sourceLayout.cliffSegments : [],
        simulation: {
            factions: (sourceLayout.simulation?.factions ?? []).map(faction => ({
                ...faction,
                description: faction.description ?? "",
                agenda: faction.agenda ?? "",
                methods: Array.isArray(faction.methods) ? faction.methods : [],
                objectiveHints: Array.isArray(faction.objectiveHints) ? faction.objectiveHints : [],
                tags: Array.isArray(faction.tags) ? faction.tags : [],
                presenceCells: Array.isArray(faction.presenceCells) ? faction.presenceCells : [],
                controlledZoneIds: Array.isArray(faction.controlledZoneIds) ? faction.controlledZoneIds : [],
                influencedZoneIds: Array.isArray(faction.influencedZoneIds) ? faction.influencedZoneIds : [],
                interestZoneIds: Array.isArray(faction.interestZoneIds) ? faction.interestZoneIds : [],
                avoidedZoneIds: Array.isArray(faction.avoidedZoneIds) ? faction.avoidedZoneIds : [],
                localAnchors: (faction.localAnchors ?? []).map(anchor => ({
                    ...anchor,
                    label: anchor.label ?? "",
                    type: anchor.type ?? "safehouse",
                    targetKind: anchor.targetKind ?? "cell",
                    targetId: anchor.targetId ?? undefined,
                    cell: anchor.cell ? { ...anchor.cell } : undefined,
                    level: Math.max(1, Math.min(5, Number(anchor.level) || 1)),
                    tags: Array.isArray(anchor.tags) ? anchor.tags : [],
                    notes: anchor.notes ?? ""
                })),
                populationProfile: normalizePopulationProfile(faction.populationProfile),
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
            })),
            specialObjectives: (sourceLayout.simulation?.specialObjectives ?? []).map(objective => ({
                ...objective,
                description: objective.description ?? "",
                whyItMatters: objective.whyItMatters ?? "",
                phases: Array.isArray(objective.phases) ? objective.phases : [],
                currentPhaseIndex: Math.max(0, Number(objective.currentPhaseIndex) || 0),
                obstacleHints: Array.isArray(objective.obstacleHints) ? objective.obstacleHints : [],
                compatibleActionIds: Array.isArray(objective.compatibleActionIds) ? objective.compatibleActionIds : [],
                requiredAnchorId: objective.requiredAnchorId ?? undefined,
                requiredAnchorType: objective.requiredAnchorType ?? undefined,
                onSuccess: Array.isArray(objective.onSuccess) ? objective.onSuccess : [],
                onFailure: Array.isArray(objective.onFailure) ? objective.onFailure : [],
                tags: Array.isArray(objective.tags) ? objective.tags : [],
                zoneIds: Array.isArray(objective.zoneIds) ? objective.zoneIds : [],
                priority: Math.max(0, Math.min(100, Number(objective.priority) || 0)),
                progress: Math.max(0, Math.min(100, Number(objective.progress) || 0)),
                state: objective.state ?? "planned"
            })),
            mobileActors: (sourceLayout.simulation?.mobileActors ?? []).map(actor => ({
                ...actor,
                archetype: actor.archetype ?? undefined,
                missionLabel: actor.missionLabel ?? undefined,
                missionTargetLabel: actor.missionTargetLabel ?? undefined,
                missionPriority: actor.missionPriority ?? "standard",
                missionStatus: actor.missionStatus ?? undefined,
                itineraryMode: actor.itineraryMode ?? "auto",
                itineraryRouteIds: Array.isArray(actor.itineraryRouteIds) ? actor.itineraryRouteIds : [],
                objectiveIds: Array.isArray(actor.objectiveIds) ? actor.objectiveIds : [],
                interactionTags: Array.isArray(actor.interactionTags) ? actor.interactionTags : [],
                positionCell: actor.positionCell ? { ...actor.positionCell } : undefined,
                destinationCell: actor.destinationCell ? { ...actor.destinationCell } : undefined,
                populationProfile: normalizePopulationProfile(actor.populationProfile),
                travelMode: actor.travelMode ?? "road",
                simulationLevel: actor.simulationLevel ?? "active",
                speed: Math.max(0, Math.min(100, Number(actor.speed) || 0)),
                security: Math.max(0, Math.min(100, Number(actor.security) || 0)),
                fatigue: Math.max(0, Math.min(100, Number(actor.fatigue) || 0)),
                cargo: Math.max(0, Math.min(100, Number(actor.cargo) || 0)),
                headcount: Math.max(0, Math.min(100, Number(actor.headcount) || 0)),
                resources: Math.max(0, Math.min(100, Number(actor.resources) || 0))
            })),
            districts: (sourceLayout.simulation?.districts ?? []).map(district => ({
                ...district,
                name: district.name ?? district.id,
                tags: Array.isArray(district.tags) ? district.tags : [],
                cellKeys: Array.isArray(district.cellKeys) ? district.cellKeys : [],
                dominantActivities: Array.isArray(district.dominantActivities) ? district.dominantActivities : [],
                importantPlaces: Array.isArray(district.importantPlaces) ? district.importantPlaces : [],
                populationProfile: normalizePopulationProfile(district.populationProfile)
            })),
            districtOverrides: (sourceLayout.simulation?.districtOverrides ?? []).map(override => ({
                ...override,
                tags: Array.isArray(override.tags) ? override.tags : [],
                dominantActivities: Array.isArray(override.dominantActivities) ? override.dominantActivities : [],
                importantPlaces: Array.isArray(override.importantPlaces) ? override.importantPlaces : [],
                populationProfile: normalizePopulationProfile(override.populationProfile)
            }))
        },
        cities: sourceLayout.cities.map(city => ({
            ...city,
            populationProfile: normalizePopulationProfile(city.populationProfile)
        })),
        cells: sourceLayout.cells.map((cell) => ({
            ...cell,
            terrainDifficulty: DEFAULT_GEOGRAPHY_DIFFICULTY[cell.geography] ?? cell.terrainDifficulty ?? 5,
            riskLevel: cell.riskLevel ?? 1,
            reliefElevation: cell.reliefElevation ?? "none",
            geographicZoneIds: Array.isArray(cell.geographicZoneIds) ? cell.geographicZoneIds : []
        })),
        editorPresets: {
            customGeographies: (sourceLayout.editorPresets?.customGeographies ?? []).map(entry => ({
                id: String(entry.id ?? "").trim(),
                label: String(entry.label ?? entry.id ?? "").trim(),
                geography: String(entry.geography ?? entry.id ?? "").trim(),
                color: String(entry.color ?? "#5a7d8f").trim() || "#5a7d8f",
                surface: (entry.surface === "ocean" ? "ocean" : "land"),
                difficulty: Math.max(1, Number(entry.difficulty) || 1)
            })).filter(entry => entry.id && entry.label && entry.geography),
            customTags: (sourceLayout.editorPresets?.customTags ?? []).map(entry => ({
                id: String(entry.id ?? "").trim(),
                label: String(entry.label ?? entry.id ?? "").trim(),
                color: String(entry.color ?? "#5fa8d3").trim() || "#5fa8d3"
            })).filter(entry => entry.id && entry.label)
        },
        backgroundImageUrl: BACKGROUND_IMAGES[sourceLayout.backgroundImageKey] ?? valmorinMapUrl
    };
}
export function serializeWorldMapLayout(layout) {
    const backgroundImageKey = Object.entries(BACKGROUND_IMAGES).find(([, url]) => url === layout.backgroundImageUrl)?.[0] ?? "valmorin";
    return {
        id: layout.id,
        title: layout.title,
        backgroundImageKey,
        grid: layout.grid,
        defaultLayers: layout.defaultLayers,
        governances: layout.governances ?? [],
        governanceTerritories: layout.governanceTerritories ?? [],
        governanceRegions: layout.governanceRegions ?? [],
        geographicZones: layout.geographicZones ?? [],
        cities: layout.cities,
        paths: layout.paths,
        cliffSegments: layout.cliffSegments,
        cells: layout.cells,
        simulation: {
            factions: layout.simulation?.factions ?? [],
            specialObjectives: layout.simulation?.specialObjectives ?? [],
            mobileActors: layout.simulation?.mobileActors ?? [],
            districts: layout.simulation?.districts ?? [],
            districtOverrides: layout.simulation?.districtOverrides ?? []
        },
        editorPresets: {
            customGeographies: layout.editorPresets?.customGeographies ?? [],
            customTags: layout.editorPresets?.customTags ?? []
        }
    };
}
export const WORLD_MAP_LAYOUT = createRuntimeWorldMapLayout(source);
export function getWorldMapCellKey(cell) {
    return `${cell.x},${cell.y}`;
}
