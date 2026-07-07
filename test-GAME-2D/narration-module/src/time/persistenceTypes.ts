import type { JsonObject } from "../core/contracts/types";
import type { ScheduledEffectV1 } from "./types";

export interface WorldSchedulePayloadV1 {
  schemaVersion: 1;
  effects: ScheduledEffectV1[];
}

export interface WorldSimulationCursorPayloadV1 {
  schemaVersion: 1;
  worldSimulatedThrough: number;
  tick: number;
  microTick: number;
  macroTick: number;
  secondsPerMicroTick: number;
  microPerMacro: number;
}

export type ProcessStatusV1 =
  | "ACTIVE"
  | "SUSPENDED"
  | "COMPLETED_PENDING_INTEGRATION"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED_WITHOUT_COMMIT";

export interface ProcessStatePayloadV1 {
  schemaVersion: 1;
  processId: string;
  processType: string;
  ownerDomain: string;
  status: ProcessStatusV1;
  checkpointRevision: number;
  checkpointFingerprint: `sha256:${string}`;
  lastAppliedEventId: string | null;
  expectedCampaignRevision: number;
  stateSchemaVersion: number;
  state: JsonObject;
  pendingDecision: JsonObject | null;
}

export interface CreateProcessStateInputV1 {
  processId: string;
  processType: string;
  ownerDomain: string;
  status: ProcessStatusV1;
  checkpointRevision: number;
  lastAppliedEventId: string | null;
  expectedCampaignRevision: number;
  stateSchemaVersion: number;
  state: JsonObject;
  pendingDecision: JsonObject | null;
}
