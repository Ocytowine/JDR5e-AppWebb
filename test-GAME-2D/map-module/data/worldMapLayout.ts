import valmorinMapUrl from "../../src/data/world/Valmorin.png";
import worldMapLayoutJson from "./worldMapLayout.json";

export type MapCell = { x: number; y: number };
export type ReliefElevationLevel = "none" | "low_mountain" | "high_mountain";
export type CliffSegment = {
  a: MapCell;
  b: MapCell;
  high: MapCell;
  low: MapCell;
};

export type RoadType = "track" | "road" | "major_road";
export type RiverSourceType = "source" | "tributary" | "main";
export type SimulationObjectiveCategory =
  | "search_object"
  | "take_control_place"
  | "weaken_rival"
  | "extend_influence"
  | "protect_secret"
  | "recruit_agents"
  | "acquire_resource"
  | "open_route"
  | "eliminate_threat"
  | "recover_person";
export type SimulationObjectiveState = "planned" | "active" | "blocked" | "completed" | "failed";
export type SimulationObjectivePhaseState = "planned" | "active" | "blocked" | "completed" | "failed";
export type SimulationObjectiveTargetKind = "city" | "district" | "route" | "region" | "faction" | "place";
export type SimulationObjectivePhaseCompletionMode = "progress_threshold" | "action_count" | "presence" | "anchor_established";
export type SimulationObjectivePhaseFailureMode = "score_threshold" | "fatal_condition";
export type SimulationActorPositionKind = "city" | "route" | "region" | "cell";
export type SimulationAnchorTargetKind = "city" | "district" | "route" | "region" | "place" | "cell";
export type SimulationTravelMode = "road" | "river" | "sea" | "foot";
export type SimulationActorLevel = "active" | "summary" | "abstract";
export type SimulationMobileMissionPriority = "low" | "standard" | "high" | "critical";
export type SimulationMobileMissionStatus = "preparing" | "en_route" | "on_site" | "in_action" | "blocked" | "withdrawing" | "completed";
export type SimulationMobileItineraryMode = "auto" | "locked";
export type SimulationFactionRelationStatus = "ally" | "neutral" | "rival" | "war";
export type SimulationTensionType = "criminal" | "social" | "commercial" | "political" | "religious" | "scarcity" | "control_conflict" | "mobility_risk";
export type SimulationOpportunityKind = "escort_needed" | "weak_control" | "scarcity_trade" | "investigation_lead" | "political_opening";
export type SimulationSignalKind = "visual" | "auditory" | "institutional" | "market" | "religious" | "military";

export type MapLayerId =
  | "background"
  | "grid"
  | "landWater"
  | "territories"
  | "regions"
  | "geographicZones"
  | "cities"
  | "roads"
  | "rivers";

export type GovernanceModelId = "primacy" | "kingdom" | "duchy" | "republic" | "tribal" | "free_city" | "custom";

export type GovernanceCityRole = "capital" | "primary" | "secondary";

export type GeographicZoneKind = "natural" | "cultural" | "historical" | "religious" | "strategic" | "custom";
export type PopulationGroupRole = "dominant" | "minority" | "elite" | "servitor" | "outsider";

export type PopulationProfile = {
  dominantGroupId?: string;
  groups: Array<{
    groupId: string;
    weight: number;
    role?: PopulationGroupRole;
  }>;
  notes?: string[];
};

export type WorldMapCustomGeographyPreset = {
  id: string;
  label: string;
  geography: string;
  color: string;
  surface: "land" | "ocean";
  difficulty: number;
};

export type WorldMapCustomTagPreset = {
  id: string;
  label: string;
  color: string;
};

export type WorldMapGovernance = {
  id: string;
  wikiEntityId: string;
  label: string;
  model: GovernanceModelId;
  territoryId: string;
  capitalCityId?: string;
  color: string;
};

export type WorldMapGovernanceTerritory = {
  id: string;
  wikiEntityId: string;
  governanceId?: string;
  labelCell: MapCell;
  color: string;
};

export type WorldMapGovernanceRegion = {
  id: string;
  wikiEntityId: string;
  governanceId?: string;
  territoryId?: string;
  principalCityId?: string;
  labelCell: MapCell;
  color: string;
};

export type WorldMapGeographicZone = {
  id: string;
  wikiEntityId?: string;
  label: string;
  kind: GeographicZoneKind;
  labelCell: MapCell;
  color: string;
  borderColor?: string;
  borderWidth?: number;
  borderDashArray?: string;
};

export type WorldMapCity = {
  id: string;
  wikiEntityId: string;
  kind: "capital" | "secondary";
  cell: MapCell;
  markerColor?: string;
  governanceId?: string;
  governanceRole?: GovernanceCityRole;
  populationProfile?: PopulationProfile;
};

export type WorldMapSimulationFaction = {
  id: string;
  label: string;
  type: string;
  color: string;
  description: string;
  agenda: string;
  methods: string[];
  objectiveHints: string[];
  tags: string[];
  homeCityId?: string;
  homeRegionId?: string;
  baseCell?: MapCell;
  presenceCells: MapCell[];
  controlledZoneIds?: string[];
  influencedZoneIds?: string[];
  interestZoneIds?: string[];
  avoidedZoneIds?: string[];
  localAnchors?: WorldMapSimulationFactionAnchor[];
  populationProfile?: PopulationProfile;
  influence: number;
  power: number;
  cohesion: number;
  aggression: number;
  secrecy: number;
  resources: number;
  relations: WorldMapSimulationFactionRelation[];
};

export type WorldMapSimulationFactionRelation = {
  targetFactionId: string;
  status: SimulationFactionRelationStatus;
  trust: number;
  hostility: number;
  notes: string;
};

export type WorldMapSimulationFactionAnchor = {
  id: string;
  label: string;
  type: string;
  targetKind: SimulationAnchorTargetKind;
  targetId?: string;
  cell?: MapCell;
  level: number;
  tags: string[];
  notes: string;
};

export type WorldMapSimulationConsequence =
  | { type: "create_tension"; tensionType: SimulationTensionType; severity: number; tags: string[] }
  | { type: "open_opportunity"; kind: SimulationOpportunityKind; score: number; tags: string[] }
  | { type: "spawn_signal"; signalKind: SimulationSignalKind; intensity: number; tags: string[] };

export type WorldMapSimulationObjectivePhase = {
  id: string;
  label: string;
  description?: string;
  state?: SimulationObjectivePhaseState;
  localTargetKind?: SimulationObjectiveTargetKind;
  localTargetId?: string;
  zoneIds?: string[];
  compatibleActionIds: string[];
  requiredAnchorId?: string;
  requiredAnchorType?: string;
  progress?: number;
  progressWeight?: number;
  completionMode: SimulationObjectivePhaseCompletionMode;
  completionThreshold: number;
  actionCountById?: Partial<Record<string, number>>;
  requiredPresenceTargetKind?: SimulationObjectiveTargetKind;
  requiredPresenceTargetId?: string;
  failureScore?: number;
  maxFailureScore?: number;
  failureMode?: SimulationObjectivePhaseFailureMode;
  fatalFailureConditions?: string[];
  notes?: string[];
};

export type WorldMapSimulationObjective = {
  id: string;
  label: string;
  category: SimulationObjectiveCategory;
  ownerFactionId: string;
  description: string;
  whyItMatters: string;
  targetKind?: SimulationObjectiveTargetKind;
  targetId?: string;
  priority: number;
  progress: number;
  state: SimulationObjectiveState;
  phases: WorldMapSimulationObjectivePhase[];
  currentPhaseIndex: number;
  obstacleHints: string[];
  compatibleActionIds: string[];
  requiredAnchorId?: string;
  requiredAnchorType?: string;
  failureScore?: number;
  maxFailureScore?: number;
  fatalFailureConditions?: string[];
  onSuccess?: WorldMapSimulationConsequence[];
  onFailure?: WorldMapSimulationConsequence[];
  tags: string[];
  zoneIds: string[];
  anchorCell?: MapCell;
};

export type WorldMapSimulationDistrictOverride = {
  id: string;
  cityId: string;
  name?: string;
  tags?: string[];
  dominantActivities?: string[];
  importantPlaces?: string[];
  populationProfile?: PopulationProfile;
};

export type WorldMapSimulationDistrict = {
  id: string;
  cityId: string;
  name: string;
  tags: string[];
  cellKeys: string[];
  dominantActivities: string[];
  importantPlaces: string[];
  populationProfile?: PopulationProfile;
};

export type WorldMapSimulationMobileActor = {
  id: string;
  label: string;
  type: string;
  archetype?: string;
  color: string;
  ownerFactionId?: string;
  missionLabel?: string;
  missionTargetLabel?: string;
  missionPriority?: SimulationMobileMissionPriority;
  missionStatus?: SimulationMobileMissionStatus;
  positionKind: SimulationActorPositionKind;
  positionId?: string;
  positionCell?: MapCell;
  destinationKind?: SimulationActorPositionKind;
  destinationId?: string;
  destinationCell?: MapCell;
  populationProfile?: PopulationProfile;
  itineraryMode?: SimulationMobileItineraryMode;
  itineraryRouteIds: string[];
  travelMode: SimulationTravelMode;
  speed: number;
  security: number;
  fatigue: number;
  cargo: number;
  headcount: number;
  resources: number;
  objectiveIds: string[];
  interactionTags: string[];
  simulationLevel: SimulationActorLevel;
};

export type WorldMapSimulationData = {
  factions: WorldMapSimulationFaction[];
  specialObjectives: WorldMapSimulationObjective[];
  mobileActors: WorldMapSimulationMobileActor[];
  districts?: WorldMapSimulationDistrict[];
  districtOverrides?: WorldMapSimulationDistrictOverride[];
};

export type MapPath = {
  id: string;
  label: string;
  kind: "road" | "river";
  cells: MapCell[];
  roadType?: RoadType;
  sourceFlow?: number;
  sourceType?: RiverSourceType;
};

export type MapCellData = {
  cell: MapCell;
  surface: "land" | "ocean";
  geography: string;
  terrainDifficulty: number;
  riskLevel: number;
  reliefElevation: ReliefElevationLevel;
  cityWikiId?: string;
  locationWikiIds?: string[];
  tags?: string[];
  governanceTerritoryId?: string;
  governanceRegionId?: string;
  geographicZoneIds?: string[];
};

export type MapCellDataSource = Omit<MapCellData, "reliefElevation"> & {
  reliefElevation?: ReliefElevationLevel;
};

export type RawWorldMapLayoutSource = Omit<WorldMapLayoutSource, "cells"> & {
  cells: MapCellDataSource[];
};

export type WorldMapLayoutSource = {
  id: string;
  title: string;
  backgroundImageKey: string;
  grid: {
    cols: number;
    rows: number;
    tileSize: number;
    orientation: "pointy-top";
    offset: "odd-r";
  };
  defaultLayers: Record<MapLayerId, boolean>;
  governances?: WorldMapGovernance[];
  governanceTerritories?: WorldMapGovernanceTerritory[];
  governanceRegions?: WorldMapGovernanceRegion[];
  geographicZones?: WorldMapGeographicZone[];
  cities: WorldMapCity[];
  paths: MapPath[];
  cliffSegments: CliffSegment[];
  cells: MapCellData[];
  simulation?: WorldMapSimulationData;
  editorPresets?: {
    customGeographies?: WorldMapCustomGeographyPreset[];
    customTags?: WorldMapCustomTagPreset[];
  };
};

export type WorldMapLayout = Omit<WorldMapLayoutSource, "backgroundImageKey"> & {
  backgroundImageUrl: string;
};

const BACKGROUND_IMAGES: Record<string, string> = {
  valmorin: valmorinMapUrl
};

const DEFAULT_GEOGRAPHY_DIFFICULTY: Record<string, number> = {
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

const DEFAULT_LAYER_VISIBILITY: Record<MapLayerId, boolean> = {
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

function normalizePopulationProfile(profile: PopulationProfile | undefined): PopulationProfile | undefined {
  if (!profile || !Array.isArray(profile.groups)) return undefined;
  const groups = profile.groups
    .map(group => ({
      groupId: String(group.groupId ?? "").trim(),
      weight: Math.max(0, Number(group.weight) || 0),
      role: group.role
    }))
    .filter(group => group.groupId.length > 0);
  if (groups.length === 0) return undefined;
  const dominantGroupId =
    profile.dominantGroupId?.trim() ||
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

function slugifyPhaseId(value: string, fallback: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function normalizeObjectivePhase(
  phase: WorldMapSimulationObjectivePhase | string,
  index: number
): WorldMapSimulationObjectivePhase {
  if (typeof phase === "string") {
    const label = phase.trim() || `Phase ${index + 1}`;
    return {
      id: slugifyPhaseId(label, `phase_${index + 1}`),
      label,
      description: "",
      state: index === 0 ? "active" : "planned",
      zoneIds: [],
      compatibleActionIds: [],
      completionMode: "progress_threshold",
      completionThreshold: 100,
      progress: 0,
      progressWeight: 1,
      failureScore: 0,
      maxFailureScore: 100,
      failureMode: "score_threshold",
      fatalFailureConditions: [],
      notes: []
    };
  }
  const label = String(phase.label ?? "").trim() || `Phase ${index + 1}`;
  return {
    id: String(phase.id ?? "").trim() || slugifyPhaseId(label, `phase_${index + 1}`),
    label,
    description: phase.description ?? "",
    state: phase.state ?? (index === 0 ? "active" : "planned"),
    localTargetKind: phase.localTargetKind ?? undefined,
    localTargetId: phase.localTargetId ?? undefined,
    zoneIds: Array.isArray(phase.zoneIds) ? phase.zoneIds : [],
    compatibleActionIds: Array.isArray(phase.compatibleActionIds) ? phase.compatibleActionIds : [],
    requiredAnchorId: phase.requiredAnchorId ?? undefined,
    requiredAnchorType: phase.requiredAnchorType ?? undefined,
    progress: Math.max(0, Math.min(100, Number(phase.progress) || 0)),
    progressWeight: Math.max(0, Number(phase.progressWeight) || 1),
    completionMode: phase.completionMode ?? "progress_threshold",
    completionThreshold: Math.max(0, Number(phase.completionThreshold) || 0),
    actionCountById: phase.actionCountById ?? {},
    requiredPresenceTargetKind: phase.requiredPresenceTargetKind ?? undefined,
    requiredPresenceTargetId: phase.requiredPresenceTargetId ?? undefined,
    failureScore: Math.max(0, Number(phase.failureScore) || 0),
    maxFailureScore: Math.max(0, Number(phase.maxFailureScore) || 100),
    failureMode: phase.failureMode ?? "score_threshold",
    fatalFailureConditions: Array.isArray(phase.fatalFailureConditions) ? phase.fatalFailureConditions : [],
    notes: Array.isArray(phase.notes) ? phase.notes : []
  };
}

const source = worldMapLayoutJson as unknown as RawWorldMapLayoutSource;

export function createRuntimeWorldMapLayout(
  sourceLayout: WorldMapLayoutSource | RawWorldMapLayoutSource
): WorldMapLayout {
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
        phases: Array.isArray(objective.phases) ? objective.phases.map(normalizeObjectivePhase) : [],
        currentPhaseIndex: Math.max(0, Number(objective.currentPhaseIndex) || 0),
        obstacleHints: Array.isArray(objective.obstacleHints) ? objective.obstacleHints : [],
        compatibleActionIds: Array.isArray(objective.compatibleActionIds) ? objective.compatibleActionIds : [],
        requiredAnchorId: objective.requiredAnchorId ?? undefined,
        requiredAnchorType: objective.requiredAnchorType ?? undefined,
        failureScore: Math.max(0, Number(objective.failureScore) || 0),
        maxFailureScore: Math.max(0, Number(objective.maxFailureScore) || 100),
        fatalFailureConditions: Array.isArray(objective.fatalFailureConditions) ? objective.fatalFailureConditions : [],
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
    cells: sourceLayout.cells.map(
      (cell): MapCellData => ({
        ...cell,
        terrainDifficulty: DEFAULT_GEOGRAPHY_DIFFICULTY[cell.geography] ?? cell.terrainDifficulty ?? 5,
        riskLevel: cell.riskLevel ?? 1,
        reliefElevation: cell.reliefElevation ?? "none",
        geographicZoneIds: Array.isArray(cell.geographicZoneIds) ? cell.geographicZoneIds : []
      })
    ),
    editorPresets: {
      customGeographies: (sourceLayout.editorPresets?.customGeographies ?? []).map(entry => ({
        id: String(entry.id ?? "").trim(),
        label: String(entry.label ?? entry.id ?? "").trim(),
        geography: String(entry.geography ?? entry.id ?? "").trim(),
        color: String(entry.color ?? "#5a7d8f").trim() || "#5a7d8f",
        surface: (entry.surface === "ocean" ? "ocean" : "land") as "land" | "ocean",
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

export function serializeWorldMapLayout(layout: WorldMapLayout): WorldMapLayoutSource {
  const backgroundImageKey =
    Object.entries(BACKGROUND_IMAGES).find(([, url]) => url === layout.backgroundImageUrl)?.[0] ?? "valmorin";
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

export const WORLD_MAP_LAYOUT: WorldMapLayout = createRuntimeWorldMapLayout(source);

export function getWorldMapCellKey(cell: MapCell): string {
  return `${cell.x},${cell.y}`;
}
