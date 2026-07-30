import {
  cloneJson,
  computeJsonFingerprint,
  coreError,
  type JsonObject,
  type Result
} from "../../narration-module/src/core";
import type { BastionTacticalSessionV1 } from "../../narration-module/src/application";
import type { Personnage } from "../types";

export const GAME_BOARD_ACTOR_PROJECTION_V1 =
  "game-board-actor-projection/1" as const;
export const GAME_BOARD_MAP_PROJECTION_V1 =
  "game-board-map-projection/1" as const;
export const GAME_BOARD_ENCOUNTER_INPUT_V1 =
  "game-board-encounter-input/1" as const;

export interface GameBoardPlayerProjectionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof GAME_BOARD_ACTOR_PROJECTION_V1;
  actorId: string;
  teamId: string;
  side: "PLAYER";
  character: JsonObject;
}

export interface GameBoardEnemyProjectionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof GAME_BOARD_ACTOR_PROJECTION_V1;
  actorId: string;
  teamId: string;
  side: "ENEMY";
  enemyTypeId: string;
}

export type GameBoardActorProjectionV1 =
  | GameBoardPlayerProjectionV1
  | GameBoardEnemyProjectionV1;

export interface GameBoardMapProjectionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof GAME_BOARD_MAP_PROJECTION_V1;
  mapRef: string;
  prompt: string;
  grid: { cols: number; rows: number };
  roundDurationSeconds: number;
  representedEntryZoneIds: string[];
  representedExitZoneIds: string[];
  representedTerrainIds: string[];
  representedHazardIds: string[];
  lightingAndVisibility: JsonObject;
  terminalConditions: {
    allEnemiesNeutralized: string;
    playerDefeated: string;
  };
}

export interface GameBoardTacticalProjectionResolverV1 {
  readonly resolverRef: string;
  resolve(input: {
    participant: JsonObject;
    session: BastionTacticalSessionV1;
  }):
    | GameBoardActorProjectionV1
    | null
    | Promise<GameBoardActorProjectionV1 | null>;
}

export interface GameBoardMapResolverV1 {
  readonly resolverRef: string;
  resolve(input: {
    session: BastionTacticalSessionV1;
  }):
    | GameBoardMapProjectionV1
    | null
    | Promise<GameBoardMapProjectionV1 | null>;
}

export interface GameBoardEncounterActorV1 {
  actorId: string;
  position: { x: number; y: number };
}

export interface GameBoardEncounterPlayerV1 extends GameBoardEncounterActorV1 {
  character: Personnage;
}

export interface GameBoardEncounterEnemyV1 extends GameBoardEncounterActorV1 {
  enemyTypeId: string;
}

export interface GameBoardEncounterInputV1 {
  schemaVersion: 1;
  contractVersion: typeof GAME_BOARD_ENCOUNTER_INPUT_V1;
  processId: string;
  seedId: string;
  seedFingerprint: string;
  sourceSceneId: string;
  locationRef: string;
  player: GameBoardEncounterPlayerV1;
  enemies: GameBoardEncounterEnemyV1[];
  map: GameBoardMapProjectionV1;
  roundDurationSeconds: number;
  terminalConditions: GameBoardMapProjectionV1["terminalConditions"];
  allowedEndConditions: string[];
}

export async function prepareGameBoardEncounterV1(input: {
  session: BastionTacticalSessionV1;
  actorResolver: GameBoardTacticalProjectionResolverV1 | null;
  mapResolver: GameBoardMapResolverV1 | null;
}): Promise<Result<GameBoardEncounterInputV1>> {
  if (input.session.status !== "READY_FOR_TACTICAL") {
    return invalid("game-board.handoff-not-ready", [
      "tactical process must be ACTIVE before GameBoard initialization"
    ]);
  }
  if (
    input.actorResolver === null
    || !nonEmpty(input.actorResolver.resolverRef)
  ) return invalid("game-board.actor-resolver-required");
  if (
    input.mapResolver === null
    || !nonEmpty(input.mapResolver.resolverRef)
  ) return invalid("game-board.map-resolver-required");

  const participants = input.session.seed.participants;
  const projections: GameBoardActorProjectionV1[] = [];
  for (const participant of participants) {
    const projection = await input.actorResolver.resolve({
      participant,
      session: input.session
    });
    if (projection === null) {
      return invalid("game-board.actor-projection-missing", [
        `no GameBoard projection for ${actorIdOf(participant) ?? "unknown actor"}`
      ]);
    }
    const issues = validateActorProjection(projection);
    if (issues.length > 0) {
      return invalid("game-board.actor-projection-invalid", issues);
    }
    if (
      !participants.some(candidate => actorIdOf(candidate) === projection.actorId)
    ) return invalid("game-board.actor-projection-mismatch");
    projections.push(projection);
  }
  if (new Set(projections.map(value => value.actorId)).size !== participants.length) {
    return invalid("game-board.actor-projection-duplicate");
  }
  const teamIssues = validateTeamProjection(input.session, projections);
  if (teamIssues.length > 0) {
    return invalid("game-board.team-projection-invalid", teamIssues);
  }
  const players = projections.filter(
    (value): value is GameBoardPlayerProjectionV1 => value.side === "PLAYER"
  );
  const enemies = projections.filter(
    (value): value is GameBoardEnemyProjectionV1 => value.side === "ENEMY"
  );
  if (players.length !== 1) {
    return invalid("game-board.single-player-projection-required", [
      "7B supports exactly one player projection; companion allies are deferred"
    ]);
  }
  if (enemies.length === 0) {
    return invalid("game-board.enemy-projection-required");
  }

  const map = await input.mapResolver.resolve({ session: input.session });
  if (map === null) return invalid("game-board.map-projection-missing");
  const mapIssues = validateMapProjection(map);
  if (mapIssues.length > 0) {
    return invalid("game-board.map-projection-invalid", mapIssues);
  }
  const environmentIssues = await validateEnvironmentProjection(
    input.session,
    map
  );
  if (environmentIssues.length > 0) {
    return invalid(
      "game-board.environment-projection-incomplete",
      environmentIssues
    );
  }
  for (const endCondition of [
    map.terminalConditions.allEnemiesNeutralized,
    map.terminalConditions.playerDefeated
  ]) {
    if (!input.session.seed.allowedEndConditions.includes(endCondition)) {
      return invalid("game-board.terminal-condition-not-authorized");
    }
  }
  const positions = new Map<string, { x: number; y: number }>();
  const occupiedPositionKeys = new Set<string>();
  for (const candidate of input.session.seed.initialPositions) {
    if (
      !object(candidate)
      || !nonEmpty(candidate.actorId)
      || !integer(candidate.x)
      || !integer(candidate.y)
    ) return invalid("game-board.initial-position-invalid");
    if (
      candidate.x < 0
      || candidate.x >= map.grid.cols
      || candidate.y < 0
      || candidate.y >= map.grid.rows
    ) return invalid("game-board.initial-position-out-of-bounds");
    if (positions.has(candidate.actorId)) {
      return invalid("game-board.initial-position-duplicate");
    }
    const positionKey = `${candidate.x},${candidate.y}`;
    if (occupiedPositionKeys.has(positionKey)) {
      return invalid("game-board.initial-position-occupied");
    }
    occupiedPositionKeys.add(positionKey);
    positions.set(candidate.actorId, { x: candidate.x, y: candidate.y });
  }
  if (
    positions.size !== projections.length
    || projections.some(projection => !positions.has(projection.actorId))
  ) {
    return invalid("game-board.initial-position-missing");
  }
  const playerPosition = positions.get(players[0].actorId);
  if (playerPosition === undefined) return invalid("game-board.player-position-missing");
  const character = players[0].character;
  const characterIssues = validateCharacterProjection(character, players[0].actorId);
  if (characterIssues.length > 0) {
    return invalid("game-board.character-projection-invalid", characterIssues);
  }

  return {
    ok: true,
    value: {
      schemaVersion: 1,
      contractVersion: GAME_BOARD_ENCOUNTER_INPUT_V1,
      processId: input.session.process.processId,
      seedId: input.session.seed.seedId,
      seedFingerprint: input.session.seed.seedFingerprint,
      sourceSceneId: input.session.process.sourceSceneId,
      locationRef: input.session.seed.locationRef.id,
      player: {
        actorId: players[0].actorId,
        position: playerPosition,
        character: cloneJson(character) as Personnage
      },
      enemies: enemies.map(enemy => ({
        actorId: enemy.actorId,
        enemyTypeId: enemy.enemyTypeId,
        position: positions.get(enemy.actorId)!
      })),
      map: cloneJson(map),
      roundDurationSeconds: map.roundDurationSeconds,
      terminalConditions: cloneJson(map.terminalConditions),
      allowedEndConditions: [...input.session.seed.allowedEndConditions]
    }
  };
}

/**
 * Résolveur minimal pour une graine qui contient déjà une projection tactique
 * committée. Il ne consulte ni localStorage, ni fiche complète de campagne.
 */
export function createEmbeddedGameBoardActorResolverV1():
  GameBoardTacticalProjectionResolverV1 {
  return {
    resolverRef: "game-board-actor-resolver:embedded-v1",
    resolve({ participant }) {
      return object(participant.gameBoardProjection)
        ? participant.gameBoardProjection as unknown as GameBoardActorProjectionV1
        : null;
    }
  };
}

export function createEmbeddedGameBoardMapResolverV1(): GameBoardMapResolverV1 {
  return {
    resolverRef: "game-board-map-resolver:embedded-v1",
    resolve({ session }) {
      const request = session.seed.mapGenerationRequest;
      return object(request)
        && object(request.gameBoardProjection)
        ? request.gameBoardProjection as unknown as GameBoardMapProjectionV1
        : null;
    }
  };
}

function validateActorProjection(value: GameBoardActorProjectionV1): string[] {
  const issues: string[] = [];
  if (
    value.schemaVersion !== 1
    || value.contractVersion !== GAME_BOARD_ACTOR_PROJECTION_V1
  ) issues.push("actor projection contract is invalid");
  if (!nonEmpty(value.actorId)) issues.push("actorId is required");
  if (!nonEmpty(value.teamId)) issues.push("teamId is required");
  if (!["PLAYER", "ENEMY"].includes(value.side)) issues.push("side is invalid");
  if (value.side === "PLAYER" && !object(value.character)) {
    issues.push("player character projection is required");
  }
  if (value.side === "ENEMY" && !nonEmpty(value.enemyTypeId)) {
    issues.push("enemyTypeId is required");
  }
  return issues;
}

function validateMapProjection(value: GameBoardMapProjectionV1): string[] {
  const issues: string[] = [];
  if (
    value.schemaVersion !== 1
    || value.contractVersion !== GAME_BOARD_MAP_PROJECTION_V1
  ) issues.push("map projection contract is invalid");
  if (!nonEmpty(value.mapRef)) issues.push("mapRef is required");
  if (!nonEmpty(value.prompt)) issues.push("map prompt is required");
  if (!integer(value.roundDurationSeconds) || value.roundDurationSeconds <= 0) {
    issues.push("roundDurationSeconds must be a positive integer");
  }
  if (!stringArray(value.representedTerrainIds)) {
    issues.push("representedTerrainIds must contain valid identifiers");
  }
  if (!stringArray(value.representedEntryZoneIds)) {
    issues.push("representedEntryZoneIds must contain valid identifiers");
  }
  if (!stringArray(value.representedExitZoneIds)) {
    issues.push("representedExitZoneIds must contain valid identifiers");
  }
  if (!stringArray(value.representedHazardIds)) {
    issues.push("representedHazardIds must contain valid identifiers");
  }
  if (!object(value.lightingAndVisibility)) {
    issues.push("lightingAndVisibility projection is required");
  }
  if (
    !object(value.terminalConditions)
    || !nonEmpty(value.terminalConditions.allEnemiesNeutralized)
    || !nonEmpty(value.terminalConditions.playerDefeated)
  ) issues.push("terminalConditions projection is required");
  if (
    !object(value.grid)
    || !integer(value.grid.cols)
    || !integer(value.grid.rows)
    || value.grid.cols < 4
    || value.grid.cols > 64
    || value.grid.rows < 4
    || value.grid.rows > 64
  ) issues.push("map grid must be between 4 and 64 cells");
  return issues;
}

function validateTeamProjection(
  session: BastionTacticalSessionV1,
  projections: GameBoardActorProjectionV1[]
): string[] {
  const issues: string[] = [];
  const actorMembership = new Map<string, string>();
  const knownTeamIds = new Set<string>();
  for (const team of session.seed.teams) {
    if (!object(team) || !nonEmpty(team.teamId) || !stringArray(team.actors)) {
      issues.push("seed team must declare a teamId and actor identifiers");
      continue;
    }
    if (knownTeamIds.has(team.teamId)) {
      issues.push(`duplicate seed team ${team.teamId}`);
    }
    knownTeamIds.add(team.teamId);
    for (const actorId of team.actors) {
      if (actorMembership.has(actorId)) {
        issues.push(`actor ${actorId} belongs to multiple seed teams`);
      }
      actorMembership.set(actorId, team.teamId);
    }
  }
  for (const projection of projections) {
    if (actorMembership.get(projection.actorId) !== projection.teamId) {
      issues.push(
        `actor ${projection.actorId} is not committed in team ${projection.teamId}`
      );
    }
  }
  for (const participant of session.seed.participants) {
    const actorId = actorIdOf(participant);
    if (actorId !== null && !actorMembership.has(actorId)) {
      issues.push(`actor ${actorId} has no committed team`);
    }
  }
  for (const teamId of knownTeamIds) {
    const sides = new Set(
      projections
        .filter(projection => projection.teamId === teamId)
        .map(projection => projection.side)
    );
    if (sides.size > 1) {
      issues.push(`team ${teamId} mixes player and enemy sides`);
    }
  }
  return issues;
}

async function validateEnvironmentProjection(
  session: BastionTacticalSessionV1,
  map: GameBoardMapProjectionV1
): Promise<string[]> {
  const issues: string[] = [];
  const terrainIds = extractIdentifiers(
    session.seed.knownTerrain,
    "terrainId",
    issues
  );
  const hazardIds = extractIdentifiers(
    session.seed.weatherAndHazards,
    "hazardId",
    issues
  );
  const entryZoneIds = extractIdentifiers(
    session.seed.entryZones,
    "zoneId",
    issues
  );
  const exitZoneIds = extractIdentifiers(
    session.seed.exitZones,
    "zoneId",
    issues
  );
  for (const zoneId of entryZoneIds) {
    if (!map.representedEntryZoneIds.includes(zoneId)) {
      issues.push(`entry zone ${zoneId} is not represented by the tactical map`);
    }
  }
  for (const zoneId of exitZoneIds) {
    if (!map.representedExitZoneIds.includes(zoneId)) {
      issues.push(`exit zone ${zoneId} is not represented by the tactical map`);
    }
  }
  for (const terrainId of terrainIds) {
    if (!map.representedTerrainIds.includes(terrainId)) {
      issues.push(`terrain ${terrainId} is not represented by the tactical map`);
    }
  }
  for (const hazardId of hazardIds) {
    if (!map.representedHazardIds.includes(hazardId)) {
      issues.push(`hazard ${hazardId} is not represented by the tactical map`);
    }
  }
  if (
    await computeJsonFingerprint(session.seed.lightingAndVisibility)
    !== await computeJsonFingerprint(map.lightingAndVisibility)
  ) {
    issues.push("lighting and visibility do not match the committed seed");
  }
  const surprisedActors = object(session.seed.surpriseState)
    && Array.isArray(session.seed.surpriseState.surprisedActors)
    ? session.seed.surpriseState.surprisedActors
    : null;
  if (surprisedActors === null || !stringArray(surprisedActors)) {
    issues.push("surpriseState must declare valid surprised actor identifiers");
  } else if (surprisedActors.length > 0) {
    issues.push("GameBoard does not yet represent committed surprise states");
  }
  return issues;
}

function extractIdentifiers(
  values: JsonObject[],
  field: string,
  issues: string[]
): string[] {
  const result: string[] = [];
  for (const value of values) {
    if (!object(value) || !nonEmpty(value[field])) {
      issues.push(`${field} is required on every committed environment entry`);
      continue;
    }
    result.push(value[field]);
  }
  return result;
}

function validateCharacterProjection(value: JsonObject, actorId: string): string[] {
  const issues: string[] = [];
  if (!nonEmpty(value.id)) issues.push("character.id is required");
  if (value.id !== actorId) issues.push("character.id must match actorId");
  if (!object(value.nom) || !nonEmpty(value.nom.nomcomplet)) {
    issues.push("character.nom.nomcomplet is required");
  }
  if (!object(value.classe)) issues.push("character.classe is required");
  if (!object(value.caracs)) issues.push("character.caracs is required");
  if (!integer(value.pvActuels) || value.pvActuels < 0) {
    issues.push("character.pvActuels must be a non-negative integer");
  }
  return issues;
}

function actorIdOf(value: JsonObject): string | null {
  return nonEmpty(value.actorId) ? value.actorId : null;
}

function object(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0;
}

function integer(value: unknown): value is number {
  return Number.isInteger(value);
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.every(candidate => nonEmpty(candidate))
    && new Set(value).size === value.length;
}

function invalid(messageKey: string, issues: string[] = []): Result<never> {
  return {
    ok: false,
    error: coreError("VALIDATION_FAILED", messageKey, { issues })
  };
}
