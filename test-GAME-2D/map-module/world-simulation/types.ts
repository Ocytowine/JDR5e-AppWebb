import type { MapCell, PopulationProfile } from "../data/worldMapLayout";

export type EntityId = string;

export type SimulationLevel = "active" | "summary" | "abstract";
export type TickScale = "micro" | "macro";

export type ScalarStat =
  | "order"
  | "commerce"
  | "fear"
  | "corruption"
  | "supply"
  | "attractiveness"
  | "danger"
  | "wealth"
  | "surveillance"
  | "agitation"
  | "populationDensity"
  | "security"
  | "traffic"
  | "materialState"
  | "control"
  | "ambushRisk"
  | "stability"
  | "politicalControl"
  | "production"
  | "circulation"
  | "externalThreat"
  | "resources"
  | "power"
  | "influence"
  | "cohesion"
  | "aggressiveness"
  | "discretion"
  | "fatigue"
  | "cargo"
  | "headcount"
  | "terrainDifficulty";

export type PressureType =
  | "criminal"
  | "social"
  | "commercial"
  | "military"
  | "religious"
  | "political";

export type WorldEntityKind =
  | "city"
  | "district"
  | "route"
  | "region"
  | "faction"
  | "specialObjective"
  | "mobileActor";

export type ObjectiveCategory =
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

export type TransportMode = "pied" | "cheval" | "bateau";
export type MobilityIntent = "discret" | "rapide" | "charge" | "escorte" | "projection_force";

export type ObjectiveState = "planned" | "active" | "blocked" | "completed" | "failed";

export type WorldActionId =
  | "patrol"
  | "extort"
  | "recruit"
  | "investigate"
  | "escort_convoy"
  | "corrupt"
  | "tax"
  | "close_venue"
  | "spread_rumor"
  | "move_resources"
  | "search_clue"
  | "question_source"
  | "search_site"
  | "infiltrate"
  | "secure_route";

export type SignalKind = "visual" | "auditory" | "institutional" | "market" | "religious" | "military";

export type WorldEventType =
  | "action_resolved"
  | "route_secured"
  | "criminal_pressure_spike"
  | "faction_recruited"
  | "special_objective_progressed"
  | "mobile_actor_arrived"
  | "mobile_actor_delayed"
  | "rumor_spread";

export type EntityRef = {
  kind: WorldEntityKind;
  id: EntityId;
};

export type WorldHistoryEntry = {
  tick: number;
  type: string;
  summary: string;
  refs?: EntityRef[];
};

export type WorldTension = {
  id: EntityId;
  type: PressureType | "scarcity" | "control_conflict" | "mobility_risk";
  severity: number;
  sourceRefs: EntityRef[];
  targetRefs: EntityRef[];
  sinceTick: number;
  tags: string[];
};

export type PerceptibleSignal = {
  id: EntityId;
  kind: SignalKind;
  location: EntityRef;
  intensity: number;
  tags: string[];
  payload: Record<string, number | string | boolean | null>;
};

export type Rumor = {
  id: EntityId;
  sourceEventId: EntityId;
  origin: EntityRef;
  spreadTo: EntityRef[];
  credibility: number;
  tags: string[];
  payload: Record<string, number | string | boolean | null>;
};

export type Opportunity = {
  id: EntityId;
  kind: "escort_needed" | "weak_control" | "scarcity_trade" | "investigation_lead" | "political_opening";
  location: EntityRef;
  score: number;
  sourceRefs: EntityRef[];
  tags: string[];
};

export type DynamicStats = Partial<Record<ScalarStat, number>>;
export type InfluenceMap = Record<EntityId, number>;
export type PressureMap = Partial<Record<PressureType, number>>;

export type WorldCity = {
  id: EntityId;
  name: string;
  regionId?: EntityId;
  districtIds: EntityId[];
  routeIds: EntityId[];
  tags: string[];
  populationProfile?: PopulationProfile;
  state: DynamicStats;
  factionInfluence: InfluenceMap;
  structuralPlaces: string[];
  recentHistory: WorldHistoryEntry[];
  activeTensionIds: EntityId[];
};

export type WorldDistrict = {
  id: EntityId;
  name: string;
  cityId: EntityId;
  connectionIds: EntityId[];
  tags: string[];
  populationProfile?: PopulationProfile;
  state: DynamicStats;
  factionInfluence: InfluenceMap;
  importantPlaces: string[];
  dominantActivities: string[];
  activeTensionIds: EntityId[];
  recentHistory: WorldHistoryEntry[];
  ambientSignals: PerceptibleSignal[];
};

export type WorldRoute = {
  id: EntityId;
  originId: EntityId;
  destinationId: EntityId;
  travelCost: number;
  length: number;
  tags: string[];
  state: DynamicStats;
  recentHistory: WorldHistoryEntry[];
  mobileActorIds: EntityId[];
};

export type FactionActionAnchor = {
  id: EntityId;
  label: string;
  type: string;
  target?: EntityRef;
  cell?: MapCell;
  level: number;
  tags: string[];
  notes: string;
};

export type WorldRegion = {
  id: EntityId;
  name: string;
  cityIds: EntityId[];
  mainRouteIds: EntityId[];
  state: DynamicStats;
  dominantWeather?: string;
  activeTensionIds: EntityId[];
  tags: string[];
};

export type FactionRelation = {
  otherFactionId: EntityId;
  status: "ally" | "neutral" | "rival" | "war";
  trust: number;
  hostility: number;
};

export type GoalRef = {
  objectiveId: EntityId;
  priority: number;
};

export type WorldFaction = {
  id: EntityId;
  name: string;
  type: string;
  tags: string[];
  populationProfile?: PopulationProfile;
  controlledZoneIds?: EntityId[];
  influencedZoneIds?: EntityId[];
  interestZoneIds?: EntityId[];
  avoidedZoneIds?: EntityId[];
  localAnchors?: FactionActionAnchor[];
  influenceZoneIds: EntityId[];
  state: DynamicStats;
  ressourcesTransport?: FactionTransportResources;
  objectives: GoalRef[];
  relations: FactionRelation[];
  recentHistory: WorldHistoryEntry[];
  cooldowns: Partial<Record<WorldActionId, number>>;
};

export type SpecialObjective = {
  id: EntityId;
  category: ObjectiveCategory;
  owner: EntityRef;
  target?: EntityRef;
  priority: number;
  state: ObjectiveState;
  progress: number;
  zoneIds: EntityId[];
  phases?: string[];
  currentPhaseIndex?: number;
  obstacles: string[];
  compatibleActionIds: WorldActionId[];
  requiredAnchorId?: EntityId;
  requiredAnchorType?: string;
  onSuccess: ConsequenceTemplate[];
  onFailure: ConsequenceTemplate[];
  tags: string[];
};

export type MobileActor = {
  id: EntityId;
  typeEntity: string;
  mobile: true;
  owner?: EntityRef;
  populationProfile?: PopulationProfile;
  position: EntityRef;
  destination?: EntityRef;
  itinerary: EntityId[];
  currentRouteTargetId?: EntityId;
  modeTransport?: TransportMode;
  travelMode: "road" | "river" | "sea" | "foot";
  speed: number;
  routeProgress: number;
  state: DynamicStats;
  objectives: GoalRef[];
  possibleInteractionTags: string[];
  recentHistory: WorldHistoryEntry[];
  simulationLevel: SimulationLevel;
  cooldowns: Partial<Record<WorldActionId, number>>;
};

export type PressureDefinition = {
  id: string;
  pressureType: PressureType;
  entityKind: Extract<WorldEntityKind, "city" | "district" | "route" | "region">;
  terms: Array<{
    source:
      | { kind: "state"; key: ScalarStat }
      | { kind: "factionInfluence"; factionTag: string }
      | { kind: "routeLoad" }
      | { kind: "mobilePresence" };
    weight: number;
    invert?: boolean;
  }>;
  clamp?: [number, number];
};

export type ConditionOp = "gte" | "lte" | "eq";

export type ActionCondition =
  | {
      type: "self_state";
      key: ScalarStat;
      op: ConditionOp;
      value: number;
    }
  | {
      type: "target_pressure";
      pressure: PressureType;
      op: ConditionOp;
      value: number;
    }
  | {
      type: "objective_category";
      category: ObjectiveCategory;
    }
  | {
      type: "target_tag";
      tag: string;
    };

export type DeltaTarget =
  | { selector: "actor" }
  | { selector: "target" }
  | { selector: "objective" };

export type DeltaTemplate =
  | (DeltaTarget & {
      type: "state";
      key: ScalarStat;
      amount: number;
    })
  | (DeltaTarget & {
      type: "objective_progress";
      amount: number;
    })
  | (DeltaTarget & {
      type: "cooldown";
      actionId: WorldActionId;
      ticks: number;
    });

export type ConsequenceTemplate =
  | { type: "create_tension"; tensionType: WorldTension["type"]; severity: number; tags: string[] }
  | { type: "open_opportunity"; kind: Opportunity["kind"]; score: number; tags: string[] }
  | { type: "spawn_signal"; signalKind: SignalKind; intensity: number; tags: string[] };

export type WorldActionDefinition = {
  id: WorldActionId;
  label: string;
  actorKinds: Array<Extract<WorldEntityKind, "faction" | "mobileActor">>;
  targetKinds: Array<Extract<WorldEntityKind, "city" | "district" | "route" | "region">>;
  compatibleObjectives: ObjectiveCategory[];
  cooldown: number;
  basePriority: number;
  preconditions: ActionCondition[];
  costs: DeltaTemplate[];
  successEffects: DeltaTemplate[];
  failureEffects: DeltaTemplate[];
  risks: Array<{ kind: "delay" | "exposure" | "attrition"; threshold: number; severity: number }>;
  eventType: WorldEventType;
  diffusion: {
    signalKind: SignalKind;
    rumorTags: string[];
    signalIntensity: number;
  };
};

export type WorldEvent = {
  id: EntityId;
  type: WorldEventType;
  tick: number;
  actor: EntityRef;
  target?: EntityRef;
  objectiveId?: EntityId;
  success: boolean;
  deltas: StateDelta[];
  tags: string[];
  payload: Record<string, number | string | boolean | null>;
};

export type StateDelta = {
  target: EntityRef;
  key: ScalarStat | "objective_progress" | "cooldown";
  before?: number;
  after?: number;
  amount?: number;
  meta?: Record<string, number | string | boolean | null>;
};

export type TickOutput = {
  tick: number;
  scale: TickScale;
  events: WorldEvent[];
  deltas: StateDelta[];
  signals: PerceptibleSignal[];
  rumors: Rumor[];
  opportunities: Opportunity[];
  trace?: TickTrace;
};

export type WorldClock = {
  tick: number;
  microTick: number;
  macroTick: number;
  minutesPerMicroTick: number;
  microPerMacro: number;
};

export type WorldState = {
  clock: WorldClock;
  cities: Record<EntityId, WorldCity>;
  districts: Record<EntityId, WorldDistrict>;
  routes: Record<EntityId, WorldRoute>;
  regions: Record<EntityId, WorldRegion>;
  factions: Record<EntityId, WorldFaction>;
  specialObjectives: Record<EntityId, SpecialObjective>;
  mobileActors: Record<EntityId, MobileActor>;
  tensions: Record<EntityId, WorldTension>;
  pressures: Partial<Record<WorldEntityKind, Record<EntityId, PressureMap>>>;
  pendingSignals: PerceptibleSignal[];
  pendingRumors: Rumor[];
  pendingOpportunities: Opportunity[];
};

export type CandidateProposal =
  | {
      kind: "specialObjective";
      payload: SpecialObjective;
    }
  | {
      kind: "mobileActor";
      payload: MobileActor;
    }
  | {
      kind: "tension";
      payload: WorldTension;
    };

export type CandidateValidationResult =
  | { accepted: true; normalized: CandidateProposal }
  | { accepted: false; reasons: string[] };

export type TickContext = {
  state: WorldState;
  scale: TickScale;
  generatedEvents: WorldEvent[];
  generatedDeltas: StateDelta[];
  generatedSignals: PerceptibleSignal[];
  generatedRumors: Rumor[];
  generatedOpportunities: Opportunity[];
  trace: TickTrace;
};

export type FactionTransportResources = {
  budgetTotal: number;
  budgetDisponible: number;
  chevauxTotal: number;
  chevauxDisponibles: number;
  bateauxTotal: number;
  bateauxDisponibles: number;
  effectifsTotal: number;
  effectifsDisponibles: number;
};

export type MobilityRequirement = {
  objectifId: EntityId;
  factionId: EntityId;
  categorie: ObjectiveCategory;
  priorite: number;
  intention: MobilityIntent;
  cibleRef?: EntityRef;
  cibleExecutionRef?: EntityRef;
  besoinCharge: number;
  besoinEffectif: number;
  besoinDiscretion: number;
  besoinVitesse: number;
  besoinSecurite: number;
};

export type LogisticsPlanTrace = {
  objectifId: EntityId;
  factionId: EntityId;
  categorie: ObjectiveCategory;
  priorite: number;
  modeRetenu?: TransportMode;
  cibleExecutionRef?: EntityRef;
  routeIds: EntityId[];
  effectifPlanifie?: number;
  chargePlanifiee?: number;
  ticksEstimes?: number;
  coutEstime?: number;
  scoreRisque?: number;
  faisable: boolean;
  acteurAssigneId?: EntityId;
  notes: string[];
  raisonsBlocage: string[];
};

export type ObjectiveReadinessTrace = {
  objectiveId: EntityId;
  factionId?: EntityId;
  ready: boolean;
  objectiveStateBefore?: ObjectiveState;
  objectiveStateAfter?: ObjectiveState;
  requiredAnchorId?: EntityId;
  requiredAnchorType?: string;
  matchedAnchorId?: EntityId;
  matchedAnchorType?: string;
  executionTargetRef?: EntityRef;
  reasons: string[];
};

export type PressureTermTrace = {
  source: string;
  rawValue: number;
  adjustedValue: number;
  weight: number;
  contribution: number;
  inverted: boolean;
};

export type PressureEvaluationTrace = {
  definitionId: string;
  entityKind: Extract<WorldEntityKind, "city" | "district" | "route" | "region">;
  entityId: EntityId;
  pressureType: PressureType;
  terms: PressureTermTrace[];
  weightedValue: number;
  weightTotal: number;
  normalizedValue: number;
  clampedValue: number;
};

export type PressureTraceSnapshot = Partial<
  Record<
    Extract<WorldEntityKind, "city" | "district" | "route" | "region">,
    Record<EntityId, PressureEvaluationTrace[]>
  >
>;

export type ActorCandidateTrace = {
  actorRef: EntityRef;
  objectiveId?: EntityId;
  objectiveCategory?: ObjectiveCategory;
  priority?: number;
};

export type ActionConditionTrace = {
  type: ActionCondition["type"];
  label: string;
  passed: boolean;
};

export type ActionCandidateTrace = {
  actorRef: EntityRef;
  targetRef: EntityRef;
  objectiveId?: EntityId;
  actionId: WorldActionId;
  passed: boolean;
  score?: number;
  scoreBreakdown?: {
    basePriority: number;
    targetPressure: number;
    objectivePriorityBonus: number;
    objectivePriorityContribution: number;
    logisticsPlanBonus?: number;
  };
  rejectionReasons: string[];
  conditions: ActionConditionTrace[];
};

export type SelectedActionTrace = {
  actorRef: EntityRef;
  targetRef: EntityRef;
  objectiveId?: EntityId;
  actionId: WorldActionId;
  score: number;
  success: boolean;
  eventId: EntityId;
  deltaCount: number;
};

export type MobilityTraceEntry = {
  actorId: EntityId;
  routeId?: EntityId;
  outcome: "idle" | "progress" | "delayed" | "arrived" | "blocked" | "rerouted";
  beforeProgress: number;
  afterProgress: number;
  notes: string[];
};

export type TickTrace = {
  clockBefore: WorldClock;
  clockAfter: WorldClock;
  logisticsPlans: LogisticsPlanTrace[];
  objectiveReadiness?: ObjectiveReadinessTrace[];
  actorCandidates: ActorCandidateTrace[];
  actionCandidates: ActionCandidateTrace[];
  selectedActions: SelectedActionTrace[];
  mobility: MobilityTraceEntry[];
  pressureSnapshots: {
    before: PressureTraceSnapshot;
    after: PressureTraceSnapshot;
  };
};
