import {
  cloneJson,
  coreError,
  type JsonObject,
  type Result
} from "../../narration-module/src/core";
import {
  TACTICAL_CHECKPOINT_OWNER_CONTRACT_V1
} from "../../narration-module/src/application";

export interface GameBoardTacticalStateV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof TACTICAL_CHECKPOINT_OWNER_CONTRACT_V1;
  processId: string;
  seedId: string;
  seedFingerprint: string;
  turnBoundaryId: string;
  round: number;
  phase: "player" | "enemies";
  player: JsonObject;
  enemies: JsonObject[];
  turnOrder: JsonObject[];
  currentTurnIndex: number;
  playerResources: JsonObject;
  map: JsonObject;
  journal: JsonObject[];
}

export function buildGameBoardTacticalStateV1(
  input: Omit<
    GameBoardTacticalStateV1,
    "schemaVersion" | "contractVersion"
  >
): GameBoardTacticalStateV1 {
  return cloneJson({
    schemaVersion: 1,
    contractVersion: TACTICAL_CHECKPOINT_OWNER_CONTRACT_V1,
    ...input
  } as GameBoardTacticalStateV1);
}

export function readGameBoardTacticalStateV1(input: {
  value: JsonObject;
  processId: string;
  seedId: string;
  seedFingerprint: string;
}): Result<GameBoardTacticalStateV1> {
  const value = input.value as Partial<GameBoardTacticalStateV1>;
  const issues: string[] = [];
  if (
    value.schemaVersion !== 1
    || value.contractVersion !== TACTICAL_CHECKPOINT_OWNER_CONTRACT_V1
  ) issues.push("checkpoint owner contract is invalid");
  if (value.processId !== input.processId) issues.push("processId mismatch");
  if (value.seedId !== input.seedId) issues.push("seedId mismatch");
  if (value.seedFingerprint !== input.seedFingerprint) {
    issues.push("seedFingerprint mismatch");
  }
  if (!nonEmpty(value.turnBoundaryId)) issues.push("turnBoundaryId is required");
  if (!positiveInteger(value.round)) issues.push("round must be positive");
  if (!["player", "enemies"].includes(String(value.phase))) {
    issues.push("phase is invalid");
  }
  if (!object(value.player)) issues.push("player state is required");
  if (!objectArray(value.enemies)) issues.push("enemy states are required");
  if (!objectArray(value.turnOrder)) issues.push("turn order is required");
  if (!nonNegativeInteger(value.currentTurnIndex)) {
    issues.push("currentTurnIndex must be non-negative");
  }
  if (!object(value.playerResources)) issues.push("player resources are required");
  if (!object(value.map)) issues.push("map state is required");
  if (!objectArray(value.journal)) issues.push("combat journal is required");
  if (object(value.player)) issues.push(...tokenIssues(value.player, "player"));
  if (objectArray(value.enemies)) {
    value.enemies.forEach((enemy, index) =>
      issues.push(...tokenIssues(enemy, `enemies[${index}]`))
    );
  }
  if (
    objectArray(value.turnOrder)
    && nonNegativeInteger(value.currentTurnIndex)
    && value.turnOrder.length > 0
    && value.currentTurnIndex >= value.turnOrder.length
  ) issues.push("currentTurnIndex exceeds turn order");
  if (object(value.map)) issues.push(...mapIssues(value.map));
  return issues.length > 0
    ? {
        ok: false,
        error: coreError(
          "CAMPAIGN_INTEGRITY_FAILURE",
          "game-board.checkpoint.invalid",
          { issues }
        )
      }
    : { ok: true, value: cloneJson(value as GameBoardTacticalStateV1) };
}

function object(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function objectArray(value: unknown): value is JsonObject[] {
  return Array.isArray(value) && value.every(object);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length > 0;
}

function positiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function tokenIssues(value: JsonObject, label: string): string[] {
  const issues: string[] = [];
  if (!nonEmpty(value.id)) issues.push(`${label}.id is required`);
  if (!["player", "enemy"].includes(String(value.type))) {
    issues.push(`${label}.type is invalid`);
  }
  for (const field of ["x", "y", "hp", "maxHp"]) {
    if (!Number.isFinite(value[field])) issues.push(`${label}.${field} is invalid`);
  }
  return issues;
}

function mapIssues(value: JsonObject): string[] {
  const issues: string[] = [];
  if (
    !object(value.grid)
    || !positiveInteger(value.grid.cols)
    || !positiveInteger(value.grid.rows)
  ) issues.push("map.grid is invalid");
  for (const field of [
    "obstacles",
    "wallSegments",
    "playableCells",
    "terrain",
    "height",
    "light",
    "roofOpenCells",
    "decorations",
    "effects"
  ]) {
    if (!Array.isArray(value[field])) issues.push(`map.${field} must be an array`);
  }
  return issues;
}
