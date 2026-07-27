import {
  computeRequestFingerprint,
  coreError,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRepository,
  type CommandId,
  type CommitId,
  type CommitRecord,
  type EventId,
  type IdempotencyKey,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RequestId,
  type Result,
  type WriterId
} from "../core";
import {
  planNextTemporalBatchV1,
  prepareTemporalSegmentCommitV1,
  type TemporalTaskV1
} from "../time";
import { SCENE_SOCIAL_UI_CONTRACT_VERSION_V1, type DisplayPacketV1 } from "../scene";
import type { PendingNarrativeSkillCheckV1 } from "./NarrativeTurnController";
import type { PlayableSceneStateV1 } from "./playableScene";
import {
  PROTOTYPE_CURSOR_AGGREGATE_ID_V1,
  PROTOTYPE_PROCESS_AGGREGATE_ID_V1,
  PROTOTYPE_SCHEDULE_AGGREGATE_ID_V1,
  readOptionalPrototypeAggregateV1
} from "./prototypeSceneTransitionRuntime";
import {
  buildPerceptionSkillCheckOutcomePolicyV1,
  buildPerceptionSkillCheckOwnerResultV1
} from "./perceptionSkillCheckOutcome";
import {
  CryptoD20SourceV1,
  persistSkillCheckDiceRollV1,
  type D20SourceV1,
  type DiceRollRecordV1
} from "./diceRollRecord";
import { prepareSkillCheckOutcomeV1, type PreparedSkillCheckOutcomeV1 } from "./skillCheckOutcomePreparation";
import { augmentTemporalCommitWithSkillCheckOutcomeV1 } from "./skillCheckOutcomeCommit";

export interface ResumePendingSkillCheckCommandV1 {
  schemaVersion: 1;
  clientRequestId: string;
  sourceOperationId: string;
  pendingCheckId: string;
}

export interface ResumePendingSkillCheckResultV1 {
  roll: DiceRollRecordV1;
  prepared: PreparedSkillCheckOutcomeV1;
  commit: CommitRecord;
  displayPacket: DisplayPacketV1;
  replayed: boolean;
}

export async function resumePendingPerceptionSkillCheckV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: ResumePendingSkillCheckCommandV1;
  pending: PendingNarrativeSkillCheckV1;
  scene: PlayableSceneStateV1;
  d20Source?: D20SourceV1;
}): Promise<Result<ResumePendingSkillCheckResultV1>> {
  const { command, pending } = input;
  if (
    command.schemaVersion !== 1 ||
    command.sourceOperationId !== pending.sourceOperationId ||
    command.pendingCheckId !== pending.pendingCheckId ||
    pending.status !== "AWAITING_SKILL_ROLL" ||
    pending.sceneId !== input.scene.sceneId
  ) return failure("narrative.skill-check.resume-command-invalid");
  if (
    pending.proposal.difficulty.status !== "RULE_RESOLVED" ||
    pending.proposal.characterContext === null
  ) return failure("narrative.skill-check.pending-proposal-not-roll-ready");

  const sourceOperation = await input.repository.getOperation(opaqueId<OperationId>(pending.sourceOperationId));
  if (!sourceOperation.ok) return sourceOperation;
  if (sourceOperation.value.phase !== "COMPLETED" || sourceOperation.value.resultPayload === null) {
    return failure("narrative.skill-check.source-turn-not-completed");
  }
  const persistedPending = (sourceOperation.value.resultPayload as {
    pendingSkillCheck?: PendingNarrativeSkillCheckV1 | null;
  }).pendingSkillCheck;
  if (
    persistedPending?.pendingCheckId !== pending.pendingCheckId ||
    persistedPending.proposal.checkId !== pending.proposal.checkId
  ) return failure("narrative.skill-check.pending-state-not-persisted");

  const diceOperation = await receiveOperation(input.repository, input.campaignId, {
    operationId: `skill-roll:${normalize(command.clientRequestId)}`,
    clientRequestId: `${normalize(command.clientRequestId)}:roll`,
    idempotencyKey: `skill-roll:${normalize(command.clientRequestId)}`,
    operationKind: "rules.skill-check.roll",
    payload: { checkId: pending.proposal.checkId, sourceOperationId: pending.sourceOperationId }
  });
  if (!diceOperation.ok) return diceOperation;
  const rolled = await persistSkillCheckDiceRollV1({
    repository: input.repository,
    campaignId: input.campaignId,
    operation: diceOperation.value,
    proposal: pending.proposal,
    d20Source: input.d20Source ?? new CryptoD20SourceV1()
  });
  if (!rolled.ok) return rolled;

  const campaignAfterRoll = await input.repository.getCampaign(input.campaignId);
  if (!campaignAfterRoll.ok) return campaignAfterRoll;
  const clock = await input.repository.getAggregate(
    input.campaignId,
    "world.clock",
    campaignAfterRoll.value.clockAggregateId
  );
  if (!clock.ok) return clock;
  const currentGameSecond = Number(clock.value.payload.elapsedGameSeconds);
  const policy = buildPerceptionSkillCheckOutcomePolicyV1({
    proposal: pending.proposal,
    scene: input.scene
  });
  if (!policy.ok) return failure("narrative.skill-check.perception-policy-invalid", { issues: policy.issues });
  const prepared = await prepareSkillCheckOutcomeV1({
    campaignId: input.campaignId,
    proposal: pending.proposal,
    rollRecord: rolled.value.record,
    policy: policy.value,
    observedAtGameSecond: currentGameSecond
  });
  if (!prepared.ok) return failure("narrative.skill-check.outcome-preparation-invalid", {
    code: prepared.code,
    issues: prepared.issues
  });
  const ownerAggregateId = opaqueId<AggregateId>(`perception-outcome:${pending.proposal.checkId}`);
  const ownerAggregate = await optionalAggregate(
    input.repository,
    input.campaignId,
    "perception.check-outcome",
    ownerAggregateId
  );
  if (!ownerAggregate.ok) return ownerAggregate;
  const ownerResult = buildPerceptionSkillCheckOwnerResultV1({
    prepared: prepared.value,
    scene: input.scene,
    currentAggregate: ownerAggregate.value
  });
  if (!ownerResult.ok) return failure("narrative.skill-check.owner-result-invalid", { issues: ownerResult.issues });

  const outcomeOperation = await receiveOperation(input.repository, input.campaignId, {
    operationId: `skill-outcome:${normalize(command.clientRequestId)}`,
    clientRequestId: `${normalize(command.clientRequestId)}:outcome`,
    idempotencyKey: `skill-outcome:${normalize(command.clientRequestId)}`,
    operationKind: "rules.skill-check.commit-outcome",
    payload: {
      checkId: pending.proposal.checkId,
      rollId: rolled.value.record.rollId,
      preparationId: prepared.value.preparationId
    }
  });
  if (!outcomeOperation.ok) return outcomeOperation;
  if (outcomeOperation.value.phase === "COMPLETED") {
    const existing = await input.repository.getCommitByIdempotencyKey(
      input.campaignId,
      outcomeOperation.value.idempotencyKey
    );
    if (!existing.ok) return existing;
    const persistedPrepared = (outcomeOperation.value.resultPayload as {
      prepared?: PreparedSkillCheckOutcomeV1;
      displayPacket?: DisplayPacketV1;
    } | null)?.prepared;
    const persistedDisplayPacket = (outcomeOperation.value.resultPayload as {
      displayPacket?: DisplayPacketV1;
    } | null)?.displayPacket;
    if (persistedPrepared === undefined || persistedDisplayPacket === undefined) {
      return failure("narrative.skill-check.completed-outcome-missing-preparation");
    }
    return {
      ok: true,
      value: {
        roll: rolled.value.record,
        prepared: persistedPrepared,
        commit: existing.value,
        displayPacket: persistedDisplayPacket,
        replayed: true
      }
    };
  }
  let operation = outcomeOperation.value;
  if (operation.phase === "RECEIVED") {
    const preparing = await input.repository.transitionOperation(operation.operationId, "RECEIVED", "PREPARING");
    if (!preparing.ok) return preparing;
    operation = preparing.value;
  }
  if (operation.phase === "PREPARING") {
    const ready = await input.repository.transitionOperation(operation.operationId, "PREPARING", "READY_TO_COMMIT");
    if (!ready.ok) return ready;
    operation = ready.value;
  }
  if (operation.phase !== "READY_TO_COMMIT") return failure("narrative.skill-check.outcome-operation-phase-invalid");

  const durationSeconds = prepared.value.narrativeResume.durationSeconds;
  const task: TemporalTaskV1 = {
    schemaVersion: 1,
    taskId: `${operation.operationId}:activity:skill-check`,
    taskKind: "ACTIVITY_COMPLETION",
    dueAtGameSecond: currentGameSecond + durationSeconds,
    boundaryPolicy: "SIMULTANEOUS",
    dependsOnTaskIds: [],
    payload: { checkId: pending.proposal.checkId }
  };
  const batch = await planNextTemporalBatchV1({
    batchId: `${operation.operationId}:temporal-batch`,
    currentGameSecond,
    requestedTargetGameSecond: currentGameSecond + durationSeconds,
    tasks: [task]
  });
  if (!batch.ok || batch.value === null) {
    return failure("narrative.skill-check.temporal-plan-invalid", {
      diagnostics: batch.ok ? [] : batch.diagnostics.map(value => ({
        code: value.code,
        path: value.path,
        details: value.details
      }))
    });
  }
  const [schedule, cursor] = await Promise.all([
    readOptionalPrototypeAggregateV1(input.repository, input.campaignId, "world.schedule", PROTOTYPE_SCHEDULE_AGGREGATE_ID_V1),
    readOptionalPrototypeAggregateV1(input.repository, input.campaignId, "world.simulation-cursor", PROTOTYPE_CURSOR_AGGREGATE_ID_V1)
  ]);
  if (!schedule.ok) return schedule;
  if (!cursor.ok) return cursor;
  const lease = await input.repository.acquireWriterLease(
    input.campaignId,
    opaqueId<WriterId>(`${operation.operationId}:writer`),
    120_000
  );
  if (!lease.ok) return lease;
  try {
    const temporal = await prepareTemporalSegmentCommitV1({
      campaign: campaignAfterRoll.value,
      operation,
      writerLease: lease.value,
      clockAggregate: clock.value,
      scheduleAggregate: schedule.value,
      scheduleAggregateId: PROTOTYPE_SCHEDULE_AGGREGATE_ID_V1,
      simulationCursorAggregate: cursor.value,
      simulationCursorAggregateId: PROTOTYPE_CURSOR_AGGREGATE_ID_V1,
      processAggregate: null,
      processAggregateId: PROTOTYPE_PROCESS_AGGREGATE_ID_V1,
      nextProcess: null,
      batch: batch.value,
      operationBinding: {
        mode: "COMPOSITE_DOMAIN_COMMIT",
        domainCommandId: opaqueId<CommandId>(ownerResult.value.commandId),
        batchFingerprint: batch.value.batchFingerprint
      },
      resolutions: [{
        taskId: task.taskId,
        outcome: "RESOLVED",
        eventId: opaqueId<EventId>(`${operation.operationId}:event:time`),
        eventType: "rules.skill-check.time-resolved",
        origin: "PLAYER_INTENT",
        visibility: { scope: "SYSTEM", actorIds: [] },
        payload: { checkId: pending.proposal.checkId, durationSeconds }
      }],
      newEffects: [],
      commitId: opaqueId<CommitId>(`${operation.operationId}:commit`),
      commandId: opaqueId<CommandId>(`${operation.operationId}:command:time`)
    });
    if (!temporal.ok) return failure("narrative.skill-check.temporal-commit-invalid", {
      diagnostics: temporal.diagnostics.map(value => ({
        code: value.code,
        path: value.path,
        details: value.details
      }))
    });
    const atomic = augmentTemporalCommitWithSkillCheckOutcomeV1({
      temporalCommit: temporal.value,
      prepared: prepared.value,
      ownerResult: ownerResult.value,
      currentTargetAggregate: ownerAggregate.value
    });
    if (!atomic.ok) return failure("narrative.skill-check.atomic-commit-invalid", { issues: atomic.issues });
    const committed = await input.repository.commit(atomic.value);
    if (!committed.ok) return committed;
    const displayPacket = buildSkillCheckResultDisplayPacketV1({
      operationId: operation.operationId,
      sceneId: input.scene.sceneId,
      roll: rolled.value.record,
      prepared: prepared.value,
      commitId: committed.value.commitId
    });
    const completed = await input.repository.completePresentation(
      operation.operationId,
      "COMMITTED_RENDERED",
      1,
      {
        checkId: pending.proposal.checkId,
        rollId: rolled.value.record.rollId,
        outcome: prepared.value.outcome,
        commitId: committed.value.commitId,
        prepared: prepared.value as unknown as JsonObject,
        displayPacket: displayPacket as unknown as JsonObject
      }
    );
    if (!completed.ok) return completed;
    return {
      ok: true,
      value: {
        roll: rolled.value.record,
        prepared: prepared.value,
        commit: committed.value,
        displayPacket,
        replayed: rolled.value.replayed
      }
    };
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

export function buildSkillCheckResultDisplayPacketV1(input: {
  operationId: string;
  sceneId: string;
  roll: DiceRollRecordV1;
  prepared: PreparedSkillCheckOutcomeV1;
  commitId: string;
}): DisplayPacketV1 {
  const resolution = input.roll.resolution;
  const verdict = input.prepared.outcome === "SUCCESS" ? "Réussite" : "Échec";
  return {
    schemaVersion: 1,
    contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
    operationId: input.operationId,
    sceneId: input.sceneId,
    displayBlocks: [{
      blockId: `${input.operationId}:skill-check-narration`,
      kind: "GM_NARRATION",
      speaker: {
        speakerId: "speaker-gm",
        kind: "GM",
        displayName: "MJ",
        roleLabel: "Maître du jeu",
        ariaLabel: "Maître du jeu",
        visualToken: "speaker-gm"
      },
      text: input.prepared.narrativeResume.publicSummary,
      ariaLabel: `Résultat narratif du test: ${verdict}`,
      roleLabel: "Résultat du test",
      visualStyleToken: "speaker-gm",
      sourceRefs: [...input.prepared.narrativeResume.allowedSourceRefs],
      isDegradedFallback: false
    }, {
      blockId: `${input.operationId}:skill-check-system`,
      kind: "SYSTEM_NOTICE",
      speaker: {
        speakerId: "speaker-system",
        kind: "SYSTEM",
        displayName: "Système",
        roleLabel: "Résolution mécanique",
        ariaLabel: "Résolution mécanique du test",
        visualToken: "speaker-system"
      },
      text: `${verdict} — d20=${resolution.dieRoll}; modificateur=${formatSigned(resolution.totalModifier)}; total=${resolution.total}; DD=${resolution.dc}; marge=${formatSigned(resolution.margin)}; temps=${input.prepared.narrativeResume.durationSeconds} s.`,
      ariaLabel: `${verdict}. Jet ${resolution.dieRoll}, total ${resolution.total}, difficulté ${resolution.dc}.`,
      roleLabel: "Résolution mécanique",
      visualStyleToken: "speaker-system",
      sourceRefs: [
        `roll:${input.roll.rollId}`,
        `commit:${input.commitId}`,
        ...input.prepared.consequence.ruleRefs
      ],
      isDegradedFallback: false
    }],
    rawInputAccess: { available: false, operationId: input.operationId },
    rhythmDiagnostics: "skill-check-result-committed",
    reconstructionRefs: [`roll:${input.roll.rollId}`, `commit:${input.commitId}`],
    version: 1
  };
}

async function receiveOperation(
  repository: CampaignRepository,
  campaignId: CampaignId,
  input: {
    operationId: string;
    clientRequestId: string;
    idempotencyKey: string;
    operationKind: string;
    payload: JsonObject;
  }
): Promise<Result<OperationRecord>> {
  const campaign = await repository.getCampaign(campaignId);
  if (!campaign.ok) return campaign;
  const requestFingerprint = await computeRequestFingerprint(input.operationKind, 1, input.payload);
  const now = new Date().toISOString();
  return repository.receiveOperation({
    schemaVersion: 1,
    operationId: opaqueId<OperationId>(input.operationId),
    campaignId,
    clientRequestId: opaqueId<RequestId>(input.clientRequestId),
    idempotencyKey: opaqueId<IdempotencyKey>(input.idempotencyKey),
    requestFingerprint,
    operationKind: input.operationKind,
    requestPayloadSchemaVersion: 1,
    requestPayload: input.payload,
    phase: "RECEIVED",
    observedCampaignRevision: campaign.value.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: now,
    updatedAt: now
  });
}

async function optionalAggregate(
  repository: CampaignRepository,
  campaignId: CampaignId,
  aggregateType: string,
  aggregateId: AggregateId
) {
  const result = await repository.getAggregate(campaignId, aggregateType, aggregateId);
  return result.ok
    ? { ok: true as const, value: result.value }
    : result.error.code === "NOT_FOUND"
      ? { ok: true as const, value: null }
      : result;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9.:-]/gu, "-").slice(0, 96);
}

function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function failure(messageKey: string, details: JsonObject = {}): Result<never> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey, details) };
}
