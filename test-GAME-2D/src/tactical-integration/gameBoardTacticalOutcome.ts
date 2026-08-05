import {
  cloneJson,
  computeJsonFingerprint,
  coreError,
  type JsonObject,
  type Result
} from "../../narration-module/src/core";
import {
  HANDOFF_CONTRACT_VERSION,
  validateTacticalOutcomeV1,
  type TacticalOutcomeV1
} from "../../narration-module/src/handoff";
import {
  isAccessTacticalSessionSummaryV1,
  type BastionTacticalSessionV1
} from "../../narration-module/src/application";
import type { GameBoardEncounterInputV1 } from "./gameBoardEncounterAdapter";
import type { GameBoardTacticalStateV1 } from "./gameBoardTacticalState";

export const GAME_BOARD_TERMINAL_REPORT_V1 =
  "game-board-terminal-report/1" as const;

export interface GameBoardTerminalReportV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof GAME_BOARD_TERMINAL_REPORT_V1;
  processId: string;
  seedId: string;
  seedFingerprint: string;
  endCondition: string;
  checkpointId: string;
  state: GameBoardTacticalStateV1;
}

export function buildGameBoardTerminalReportV1(input: {
  encounter: GameBoardEncounterInputV1;
  state: GameBoardTacticalStateV1;
  endCondition: string;
  checkpointId: string;
}): Result<GameBoardTerminalReportV1> {
  const issues: string[] = [];
  if (
    input.state.processId !== input.encounter.processId
    || input.state.seedId !== input.encounter.seedId
    || input.state.seedFingerprint !== input.encounter.seedFingerprint
  ) issues.push("terminal state does not match the prepared encounter");
  if (!input.encounter.allowedEndConditions.includes(input.endCondition)) {
    issues.push("end condition is not authorized by the committed seed");
  }
  if (!nonEmpty(input.checkpointId)) issues.push("terminal checkpoint is required");
  const expectedActorIds = new Set([
    input.encounter.player.actorId,
    ...input.encounter.enemies.map(enemy => enemy.actorId)
  ]);
  const actualActorIds = [
    String(input.state.player.id ?? ""),
    ...input.state.enemies.map(enemy => String(enemy.id ?? ""))
  ];
  if (
    actualActorIds.length !== expectedActorIds.size
    || actualActorIds.some(actorId => !expectedActorIds.has(actorId))
  ) issues.push("terminal participants do not match the prepared encounter");
  return issues.length > 0
    ? {
        ok: false,
        error: coreError(
          "VALIDATION_FAILED",
          "game-board.terminal-report-invalid",
          { issues }
        )
      }
    : {
        ok: true,
        value: cloneJson({
          schemaVersion: 1,
          contractVersion: GAME_BOARD_TERMINAL_REPORT_V1,
          processId: input.encounter.processId,
          seedId: input.encounter.seedId,
          seedFingerprint: input.encounter.seedFingerprint,
          endCondition: input.endCondition,
          checkpointId: input.checkpointId,
          state: input.state
        })
      };
}

/**
 * Construit le constat terminal brut. Aucun delta métier n'est appliqué ici :
 * les entrées de consequenceCandidates doivent encore être relues par leurs
 * propriétaires avant l'intégration 7C-C.
 */
export async function buildPendingGameBoardTacticalOutcomeV1(input: {
  session: BastionTacticalSessionV1;
  encounter: GameBoardEncounterInputV1;
  report: GameBoardTerminalReportV1;
}): Promise<Result<TacticalOutcomeV1>> {
  const report = buildGameBoardTerminalReportV1({
    encounter: input.encounter,
    state: input.report.state,
    endCondition: input.report.endCondition,
    checkpointId: input.report.checkpointId
  });
  if (!report.ok) return report;
  if (
    input.session.process.processId !== report.value.processId
    || input.session.seed.seedId !== report.value.seedId
    || input.session.status !== "READY_FOR_TACTICAL"
  ) {
    return {
      ok: false,
      error: coreError(
        "VALIDATION_FAILED",
        "game-board.terminal-session-mismatch"
      )
    };
  }
  const state = report.value.state;
  const playerState = state.player;
  const finalActors = [state.player, ...state.enemies];
  const playerParticipant = input.session.seed.participants.find(
    participant => participant.actorId === input.encounter.player.actorId
  );
  const finalStateFingerprint = await computeJsonFingerprint({
    processId: report.value.processId,
    seedFingerprint: report.value.seedFingerprint,
    endCondition: report.value.endCondition,
    state
  });
  const outcomeToken = finalStateFingerprint
    .replace(/^sha256:/, "")
    .slice(0, 48);
  const outcomeId = `outcome:${outcomeToken}`;
  const elapsedGameSeconds =
    state.round * input.encounter.roundDurationSeconds;
  const initialPlayerHp = Number(
    input.encounter.player.character.pvActuels ?? playerState.maxHp ?? 0
  );
  const finalPlayerHp = Number(playerState.hp ?? 0);
  const journal = cloneJson(state.journal);
  const outcome: TacticalOutcomeV1 = {
    schemaVersion: 1,
    contractVersion: HANDOFF_CONTRACT_VERSION,
    processKind: "TACTICAL_ENCOUNTER",
    outcomeId,
    processId: report.value.processId,
    campaignId: input.session.process.campaignId,
    sourceOperationId: input.session.process.sourceOperationId,
    status: "COMPLETED",
    elapsedGameSeconds,
    domainDeltas: [],
    eventDrafts: [{
      eventType: "tactical_outcome_recorded_pending_integration",
      origin: "PROCESS",
      visibility: "PLAYER_VISIBLE",
      occurredAtGameSecond: input.session.seed.startedAtGameSecond,
      payloadSchemaVersion: 1,
      payload: {
        processId: report.value.processId,
        outcomeId,
        endCondition: report.value.endCondition,
        messageKey: "tactical.outcome-pending-integration"
      }
    }],
    narrativeProjection: {
      messageKey: "tactical.outcome-pending-integration",
      endCondition: report.value.endCondition
    },
    uiNotifications: [{
      kind: "tactical_outcome_pending_integration",
      endCondition: report.value.endCondition
    }],
    memoryCandidates: [],
    sourceRefs: [
      { kind: "process.handoff", id: report.value.processId },
      { kind: "tactical.seed", id: report.value.seedId },
      { kind: "process.checkpoint", id: report.value.checkpointId }
    ],
    finalStateFingerprint,
    integrationIdempotencyKey: `integrate:${outcomeToken}`,
    version: 1,
    turnJournal: journal,
    finalParticipantStates: finalActors.map(actor => ({
      actorId: String(actor.id),
      hp: Number(actor.hp ?? 0),
      maxHp: Number(actor.maxHp ?? 0),
      state: Number(actor.hp ?? 0) <= 0 ? "neutralized" : "active"
    })),
    casualtiesAndConditions: finalActors
      .filter(actor => Number(actor.hp ?? 0) <= 0)
      .map(actor => ({
        actorId: String(actor.id),
        condition: "neutralized"
      })),
    resourceChanges: [{
      actorId: input.encounter.player.actorId,
      resourceKind: "hit-points",
      before: initialPlayerHp,
      after: finalPlayerHp,
      delta: finalPlayerHp - initialPlayerHp
    }, ...Object.entries(state.playerResources).map(([resourceId, after]) => ({
      actorId: input.encounter.player.actorId,
      resourceKind: "combat-resource",
      resourceId,
      after
    }))],
    finalPositions: finalActors.map(actor => ({
      actorId: String(actor.id),
      x: Number(actor.x),
      y: Number(actor.y)
    })),
    endCondition: report.value.endCondition,
    placeDamage: [],
    engagedSpeechAndKnowledge: journal
      .filter(event => event.kind === "speech")
      .map(event => ({
        actorId: event.actorId,
        speech: event.data
      })),
    availableLoot: [],
    consequenceCandidates: [{
      candidateId: `candidate:character:${input.encounter.player.actorId}`,
      ownerDomain: "character",
      actorId: input.encounter.player.actorId,
      characterId: typeof playerParticipant?.characterId === "string"
        ? playerParticipant.characterId
        : input.encounter.player.actorId,
      characterAggregateId:
        typeof playerParticipant?.characterStateAggregateRef === "string"
          ? playerParticipant.characterStateAggregateRef
          : "",
      tacticalProjectionAggregateId:
        typeof playerParticipant?.tacticalProjectionAggregateRef === "string"
          ? playerParticipant.tacticalProjectionAggregateRef
          : typeof playerParticipant?.tacticalProjectionRef === "string"
            ? playerParticipant.tacticalProjectionRef
            : "",
      hpBefore: initialPlayerHp,
      hpAfter: finalPlayerHp,
      resourcesAfter: state.playerResources
    }, ownerConsequenceCandidate(input.session, report.value.endCondition)],
    checkpointRefs: [{
      kind: "process.checkpoint",
      id: report.value.checkpointId
    }]
  };
  const validation = validateTacticalOutcomeV1(outcome);
  return validation.valid
    ? { ok: true, value: outcome }
    : {
        ok: false,
        error: coreError(
          "CAMPAIGN_INTEGRITY_FAILURE",
          "game-board.tactical-outcome-invalid",
          { issues: validation.issues }
        )
      };
}

function ownerConsequenceCandidate(
  session: BastionTacticalSessionV1,
  endCondition: string
): JsonObject {
  if (isAccessTacticalSessionSummaryV1(session.summary)) {
    return {
      candidateId: `candidate:access:${session.summary.accessControlRef}`,
      ownerDomain: "access",
      accessControlRef: session.summary.accessControlRef,
      processId: session.process.processId,
      endCondition,
      resolutionPolicyRef: session.summary.resolutionPolicyRef
    };
  }
  return {
    candidateId: `candidate:bastion:${session.summary.bastionId}`,
    ownerDomain: "bastion",
    bastionId: session.summary.bastionId,
    incidentId: session.summary.incidentId,
    incidentDefinitionRef: session.summary.incidentDefinitionRef,
    processId: session.process.processId,
    endCondition
  };
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length > 0;
}
