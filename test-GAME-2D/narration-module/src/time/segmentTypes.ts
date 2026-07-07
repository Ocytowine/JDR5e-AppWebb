import type {
  AggregateId,
  AggregateRecord,
  CampaignRecord,
  CommandId,
  CommitId,
  CommitRequest,
  EventId,
  EventOrigin,
  EventVisibility,
  AggregateWrite,
  JsonObject,
  OperationRecord,
  WriterLease
} from "../core/contracts/types";
import type { ProcessStatePayloadV1 } from "./persistenceTypes";
import type { ScheduledEffectV1, TemporalBatchV1, TemporalResultV1 } from "./types";
import type { WorldSimulationResultV1 } from "./worldSimulationTypes";

export interface TemporalTaskResolutionV1 {
  taskId: string;
  outcome: "RESOLVED" | "CANCELLED" | "EXPIRED";
  eventId: EventId;
  eventType: string;
  origin: EventOrigin;
  visibility: EventVisibility;
  payload: JsonObject;
}

export interface PrepareTemporalSegmentInputV1 {
  campaign: CampaignRecord;
  operation: OperationRecord;
  writerLease: WriterLease;
  clockAggregate: AggregateRecord;
  scheduleAggregate: AggregateRecord | null;
  scheduleAggregateId: AggregateId;
  simulationCursorAggregate: AggregateRecord | null;
  simulationCursorAggregateId: AggregateId;
  worldStateAggregate?: AggregateRecord | null;
  worldStateAggregateId?: AggregateId | null;
  initialWorldState?: JsonObject | null;
  simulationResult?: WorldSimulationResultV1 | null;
  processAggregate: AggregateRecord | null;
  processAggregateId: AggregateId | null;
  nextProcess: ProcessStatePayloadV1 | null;
  batch: TemporalBatchV1;
  resolutions: TemporalTaskResolutionV1[];
  newEffects: ScheduledEffectV1[];
  additionalAggregateWrites?: AggregateWrite[];
  commitId: CommitId;
  commandId: CommandId;
}

export type PrepareTemporalSegmentResultV1 = TemporalResultV1<CommitRequest>;
