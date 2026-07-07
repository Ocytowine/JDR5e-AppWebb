import type { JsonObject } from "../core/contracts/types";
import type { WorldSimulationCursorPayloadV1 } from "./persistenceTypes";
import type { TemporalResultV1 } from "./types";

export interface WorldSimulationRequestV1 {
  schemaVersion: 1;
  simulationId: string;
  currentGameSecond: number;
  targetGameSecond: number;
  hoursToProcess: number;
  cursor: WorldSimulationCursorPayloadV1;
  worldStateFingerprint: `sha256:${string}`;
  worldState: JsonObject;
}

export interface WorldSimulationResultV1 {
  schemaVersion: 1;
  simulationId: string;
  previousWorldSimulatedThrough: number;
  worldSimulatedThrough: number;
  hoursProcessed: number;
  previousWorldStateFingerprint: `sha256:${string}`;
  worldStateFingerprint: `sha256:${string}`;
  resultFingerprint: `sha256:${string}`;
  cursor: WorldSimulationCursorPayloadV1;
  worldState: JsonObject;
  tickOutput: JsonObject;
}

export interface WorldSimulationPortV1 {
  simulate(request: WorldSimulationRequestV1): Promise<TemporalResultV1<WorldSimulationResultV1>>;
}
