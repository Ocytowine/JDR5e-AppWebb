import type {
  AggregateId,
  CampaignId,
  GameSecond,
  JsonObject,
  OperationId,
  Revision
} from "../core/index";

export const HANDOFF_CONTRACT_VERSION = "tactical-rest-handoff/1" as const;
export const HANDOFF_PAYLOAD_SCHEMA_VERSION = 1 as const;

export type HandoffContractVersion = typeof HANDOFF_CONTRACT_VERSION;
export type ProcessKindV1 = "TACTICAL_ENCOUNTER" | "REST";
export type ProcessStatusV1 =
  | "PROPOSED"
  | "ACTIVE"
  | "SUSPENDED"
  | "COMPLETED_PENDING_INTEGRATION"
  | "INTEGRATED"
  | "FAILED";
export type ProcessOutcomeStatusV1 = "COMPLETED" | "ABORTED" | "INTERRUPTED" | "FAILED" | "PARTIAL";
export type RestOutcomeStatusV1 = "COMPLETED" | "PARTIAL" | "INTERRUPTED" | "FAILED";
export type RestKindV1 = "SHORT_REST" | "LONG_REST" | string;

export interface SourceRefV1 extends JsonObject {
  kind: string;
  id: string;
}

export interface ProcessHandoffV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: HandoffContractVersion;
  processId: string;
  campaignId: CampaignId;
  sourceOperationId: OperationId;
  sourceSceneId: string;
  processKind: ProcessKindV1;
  status: ProcessStatusV1;
  createdAtGameSecond: GameSecond;
  sourceRefs: SourceRefV1[];
  idempotencyKey: string;
  version: 1;
  integratedOutcomeId: string | null;
  updatedAtGameSecond: GameSecond | null;
}

export interface ProcessCheckpointV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: HandoffContractVersion;
  checkpointId: string;
  processId: string;
  lastAppliedEventOrTurnId: string;
  ownerState: JsonObject;
  stateFingerprint: string;
  technicalTimestamp: string;
  sourceRefs: SourceRefV1[];
  version: 1;
}

export interface HandoffDomainDeltaV1 extends JsonObject {
  deltaId: string;
  aggregateType: string;
  aggregateId: AggregateId;
  expectedAggregateRevision: Revision | null;
  payloadSchemaVersion: number;
  payload: JsonObject;
  summary: string;
}

export interface HandoffOutcomeEventDraftV1 extends JsonObject {
  eventType: string;
  origin: "PROCESS" | "RULE" | "WORLD_SIMULATION" | "SYSTEM" | "AI_PROPOSAL";
  visibility: "SYSTEM" | "MJ_PRIVATE" | "PLAYER_VISIBLE";
  occurredAtGameSecond: GameSecond;
  payloadSchemaVersion: number;
  payload: JsonObject;
}

export interface ProcessOutcomeV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: HandoffContractVersion;
  outcomeId: string;
  processId: string;
  campaignId: CampaignId;
  sourceOperationId: OperationId;
  status: ProcessOutcomeStatusV1;
  elapsedGameSeconds: GameSecond;
  domainDeltas: HandoffDomainDeltaV1[];
  eventDrafts: HandoffOutcomeEventDraftV1[];
  narrativeProjection: JsonObject;
  uiNotifications: JsonObject[];
  memoryCandidates: JsonObject[];
  sourceRefs: SourceRefV1[];
  finalStateFingerprint: string;
  integrationIdempotencyKey: string;
  version: 1;
}

export interface TacticalEncounterSeedV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: HandoffContractVersion;
  seedId: string;
  processId: string;
  campaignId: CampaignId;
  sceneId: string;
  locationRef: SourceRefV1;
  startedAtGameSecond: GameSecond;
  rulesetRef: SourceRefV1;
  cause: JsonObject;
  stakes: JsonObject;
  objectives: JsonObject[];
  participants: JsonObject[];
  teams: JsonObject[];
  tacticalMapRef: SourceRefV1 | null;
  mapGenerationRequest: JsonObject | null;
  entryZones: JsonObject[];
  exitZones: JsonObject[];
  knownTerrain: JsonObject[];
  lightingAndVisibility: JsonObject;
  weatherAndHazards: JsonObject[];
  initialPositions: JsonObject[];
  surpriseState: JsonObject;
  allowedEndConditions: string[];
  sourceAggregateRefs: SourceRefV1[];
  seedFingerprint: string;
  version: 1;
}

export interface TacticalOutcomeV1 extends ProcessOutcomeV1 {
  processKind: "TACTICAL_ENCOUNTER";
  turnJournal: JsonObject[];
  finalParticipantStates: JsonObject[];
  casualtiesAndConditions: JsonObject[];
  resourceChanges: JsonObject[];
  finalPositions: JsonObject[];
  endCondition: string;
  placeDamage: JsonObject[];
  engagedSpeechAndKnowledge: JsonObject[];
  availableLoot: JsonObject[];
  consequenceCandidates: JsonObject[];
  checkpointRefs: SourceRefV1[];
}

export interface RestSeedV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: HandoffContractVersion;
  seedId: string;
  processId: string;
  campaignId: CampaignId;
  sceneId: string;
  locationRef: SourceRefV1;
  restKind: RestKindV1;
  startedAtGameSecond: GameSecond;
  targetDurationSeconds: GameSecond;
  rulesetRef: SourceRefV1;
  participants: JsonObject[];
  safetyProfile: JsonObject;
  availableSupplies: JsonObject[];
  availableActivities: JsonObject[];
  watchPlan: JsonObject;
  riskSources: JsonObject[];
  nearbyWorldEvents: JsonObject[];
  requiredQuestions: JsonObject[];
  sourceAggregateRefs: SourceRefV1[];
  seedFingerprint: string;
  version: 1;
}

export interface RestOutcomeV1 extends ProcessOutcomeV1 {
  processKind: "REST";
  status: RestOutcomeStatusV1;
  acquiredBenefits: JsonObject[];
  refusedBenefits: JsonObject[];
  remainingPossibleBenefits: JsonObject[];
  healthFatigueConditionChanges: JsonObject[];
  resourceChanges: JsonObject[];
  consumptions: JsonObject[];
  completedActivities: JsonObject[];
  hygieneAndPresentationChanges: JsonObject[];
  livedEventsAndConversations: JsonObject[];
  worldConsequences: JsonObject[];
  interruptionReason: string | null;
  appliedRuleRefs: SourceRefV1[];
}
