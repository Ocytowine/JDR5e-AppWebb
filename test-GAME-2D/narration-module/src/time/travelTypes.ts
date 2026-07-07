import type { CampaignId, GameSecond, JsonObject } from "../core/contracts/types";
import type { TimeAdvanceProposalV1 } from "./types";

export type TravelProcessStatusV1 =
  | "PLANNED"
  | "ACTIVE"
  | "INTERRUPTED"
  | "ARRIVED"
  | "CANCELLED"
  | "FAILED_WITHOUT_COMMIT";

export type TravelModeV1 = "WALK" | "RIDE" | "CART" | "BOAT" | "SPECIAL";

export type TravelEncounterCategoryV1 =
  | "HOSTILE"
  | "SOCIAL"
  | "STRANGE"
  | "OPPORTUNITY"
  | "NONE";

export interface TravelRouteStepV1 {
  stepId: string;
  fromLocationId: string;
  toLocationId: string;
  distanceUnits: number;
  estimatedSeconds: number;
  dangerLevel: number;
  environmentTags: string[];
}

export interface TravelPlanV1 {
  schemaVersion: 1;
  planId: string;
  campaignId: CampaignId;
  characterId: string;
  originLocationId: string;
  destinationLocationId: string;
  mode: TravelModeV1;
  route: TravelRouteStepV1[];
  totalEstimatedSeconds: number;
  createdAtGameSecond: GameSecond;
  source: {
    kind: "PLAYER_INTENT" | "RULE" | "SYSTEM";
    id: string;
    version: number;
  };
}

export interface TravelSegmentV1 {
  schemaVersion: 1;
  segmentId: string;
  stepId: string;
  fromLocationId: string;
  toLocationId: string;
  startsAtGameSecond: GameSecond;
  plannedEndGameSecond: GameSecond;
  durationSeconds: number;
  distanceUnits: number;
  dangerLevel: number;
  environmentTags: string[];
  worldBoundaryGameSecond: GameSecond | null;
}

export interface TravelEncounterSeedV1 {
  schemaVersion: 1;
  processId: string;
  segmentId: string;
  campaignId: CampaignId;
  locationId: string;
  startsAtGameSecond: GameSecond;
  contentPackageId: string;
  contentPackageVersion: number;
  rulesetId: string;
  rulesetVersion: number;
}

export interface TravelEncounterPressureV1 {
  schemaVersion: 1;
  pressure: number;
  dangerLevel: number;
  worldPressure: number;
  environmentTags: string[];
  reasons: string[];
}

export interface TravelEncounterDecisionV1 {
  schemaVersion: 1;
  decisionId: string;
  seedFingerprint: `sha256:${string}`;
  roll: number;
  threshold: number;
  triggered: boolean;
  category: TravelEncounterCategoryV1;
  candidateRef: {
    kind: "WORLD_SIGNAL" | "LORE_ENTITY" | "ENCOUNTER_ARCHETYPE";
    id: string;
  } | null;
  requiresPlayerDecision: boolean;
}

export interface TravelEncounterCandidateV1 {
  schemaVersion: 1;
  candidateId: string;
  category: Exclude<TravelEncounterCategoryV1, "NONE">;
  ref: {
    kind: "WORLD_SIGNAL" | "LORE_ENTITY" | "ENCOUNTER_ARCHETYPE";
    id: string;
  };
  weight: number;
  locationId: string | null;
  environmentTags: string[];
}

export interface TravelCheckpointV1 {
  schemaVersion: 1;
  checkpointId: string;
  processId: string;
  checkpointRevision: number;
  status: TravelProcessStatusV1;
  currentLocationId: string;
  nextLocationId: string | null;
  elapsedTravelSeconds: number;
  remainingTravelSeconds: number;
  completedStepIds: string[];
  activeSegment: TravelSegmentV1 | null;
  lastEncounterDecision: TravelEncounterDecisionV1 | null;
}

export interface TravelProcessStateV1 {
  schemaVersion: 1;
  processId: string;
  campaignId: CampaignId;
  status: TravelProcessStatusV1;
  plan: TravelPlanV1;
  checkpoint: TravelCheckpointV1;
}

export type TravelProcessV1 = TravelProcessStateV1;

export interface PrepareTravelSegmentInputV1 {
  process: TravelProcessStateV1;
  currentGameSecond: GameSecond;
  worldSimulatedThrough: GameSecond;
  secondsPerWorldBoundary: number;
  maxSegmentSeconds: number;
  contentPackageId: string;
  contentPackageVersion: number;
  rulesetId: string;
  rulesetVersion: number;
  encounterCandidates?: TravelEncounterCandidateV1[];
  worldPressure?: number;
  forceNoGameTime?: boolean;
  interruption?: {
    interruptAtGameSecond: GameSecond;
    reason: string;
  } | null;
}

export interface PreparedTravelSegmentV1 {
  schemaVersion: 1;
  timeProposal: TimeAdvanceProposalV1;
  nextProcess: TravelProcessStateV1;
  encounterPressure: TravelEncounterPressureV1;
  encounterDecision: TravelEncounterDecisionV1;
  stopReason: "NO_GAME_TIME" | "WORLD_BOUNDARY" | "ENCOUNTER" | "ARRIVAL" | "INTERRUPTION" | "SEGMENT_LIMIT";
  pendingDecision: JsonObject | null;
}
