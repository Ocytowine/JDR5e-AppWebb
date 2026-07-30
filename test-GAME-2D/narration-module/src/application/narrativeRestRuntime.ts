import {
  computeJsonFingerprint,
  computeRequestFingerprint,
  coreError,
  opaqueId,
  type AggregateId,
  type CampaignClockPayload,
  type CommitId,
  type CommandId,
  type EventId,
  type IdempotencyKey,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RequestId,
  type WriterId
} from "../core";
import {
  createRestSegmentTemporalBatchV1,
  HANDOFF_CONTRACT_VERSION,
  prepareNextRestSegmentV1,
  prepareRestSegmentCommitV1,
  prepareSegmentedRestStartCommitV1,
  restProcessAggregateId,
  type RestSegmentActivityV1,
  type RestProcessStateV1,
  type RestSeedV1
} from "../handoff";
import { SCENE_SOCIAL_UI_CONTRACT_VERSION_V1, type DisplayPacketV1 } from "../scene";
import type {
  NarrativeRestRuntimeV1,
  NarrativeTurnControllerOutputV1
} from "./NarrativeTurnController";
import { createInitialReferenceSceneStateV1 } from "./referenceSceneState";
import {
  prepareNarrativeRestV1,
  type NarrativeRestRulesPolicyV1
} from "./restPreparation";

export interface NarrativeRestAuthorizationV1 {
  allowed: boolean;
  reason: string;
  locationRef: { kind: string; id: string };
  safetyProfile: JsonObject;
}

export function createNarrativeRestRuntimeV1(options: {
  rules: NarrativeRestRulesPolicyV1;
  authorize: (input: {
    scene: Parameters<NarrativeRestRuntimeV1["execute"]>[0]["activeScene"];
    restKind: "SHORT_REST" | "LONG_REST";
  }) =>
    NarrativeRestAuthorizationV1 | Promise<NarrativeRestAuthorizationV1>;
}): NarrativeRestRuntimeV1 {
  return {
    async execute(input) {
      const preparation = prepareNarrativeRestV1({
        interpretation: input.interpretation,
        rules: options.rules
      });
      if (preparation.status === "NEEDS_PLAYER_CHOICES") {
        return {
          ok: true,
          value: {
            commit: null,
            output: buildRestOutput({
              input,
              noCommit: true,
              noGameTime: true,
              resultKind: "CLARIFICATION_REQUIRED",
              narration: preparation.missingChoices[0]?.prompt ?? "Quel repos souhaites-tu prendre ?",
              systemText: "Le repos n’a pas commencé : le type de repos reste à choisir.",
              commitId: null,
              safetyNotes: ["Aucun temps ni état n'est modifié tant qu'un choix requis manque."]
            })
          }
        };
      }
      const authorization = await options.authorize({
        scene: input.activeScene,
        restKind: preparation.restKind!
      });
      if (!authorization.allowed) {
        return {
          ok: true,
          value: {
            commit: null,
            output: buildRestOutput({
              input,
              noCommit: true,
              noGameTime: true,
              resultKind: "NO_COMMIT_RESPONSE",
              narration: authorization.reason,
              systemText: "Le repos n’a pas commencé : le lieu ou la situation actuelle ne l’autorise pas.",
              commitId: null,
              safetyNotes: ["Le refus vient de la politique du lieu, pas d'une déduction du renderer."]
            })
          }
        };
      }
      const preparing = await input.repository.transitionOperation(
        input.operation.operationId,
        "RECEIVED",
        "PREPARING"
      );
      if (!preparing.ok) return preparing;
      const ready = await input.repository.transitionOperation(
        input.operation.operationId,
        "PREPARING",
        "READY_TO_COMMIT"
      );
      if (!ready.ok) return ready;
      const campaign = await input.repository.getCampaign(input.campaignId);
      if (!campaign.ok) return campaign;
      const clockAggregate = await input.repository.getAggregate(
        input.campaignId,
        "world.clock",
        campaign.value.clockAggregateId
      );
      if (!clockAggregate.ok) return clockAggregate;
      const elapsedGameSeconds = (clockAggregate.value.payload as CampaignClockPayload).elapsedGameSeconds;
      const processId = `${input.operation.operationId}:rest`;
      const seedBase = {
        schemaVersion: 1 as const,
        contractVersion: HANDOFF_CONTRACT_VERSION,
        seedId: `${processId}:seed`,
        processId,
        campaignId: input.campaignId,
        sceneId: input.activeScene.sceneId,
        locationRef: authorization.locationRef,
        restKind: preparation.restKind!,
        startedAtGameSecond: elapsedGameSeconds,
        targetDurationSeconds: preparation.targetDurationSeconds!,
        rulesetRef: { kind: "ruleset", id: campaign.value.dependencies.rulesetId },
        participants: [],
        safetyProfile: authorization.safetyProfile,
        availableSupplies: [],
        availableActivities: [],
        watchPlan: { watches: [] },
        riskSources: [],
        nearbyWorldEvents: [],
        requiredQuestions: [],
        sourceAggregateRefs: [{ kind: "scene", id: input.activeScene.sceneId }],
        version: 1 as const
      };
      const seed: RestSeedV1 = {
        ...seedBase,
        seedFingerprint: await computeJsonFingerprint(seedBase)
      };
      const lease = await input.repository.acquireWriterLease(
        input.campaignId,
        opaqueId<WriterId>(`${input.operation.operationId}:rest-writer`),
        5_000
      );
      if (!lease.ok) return lease;
      try {
        const request = await prepareSegmentedRestStartCommitV1({
          campaign: campaign.value,
          operation: ready.value,
          writerLease: lease.value,
          seed,
          segmentSeconds: preparation.segmentSeconds,
          processIdempotencyKey: `${input.operation.idempotencyKey}:rest`,
          commitId: opaqueId<CommitId>(`${input.operation.operationId}:rest-commit`),
          commandId: opaqueId<CommandId>(`${input.operation.operationId}:rest-command`),
          eventId: opaqueId<EventId>(`${input.operation.operationId}:rest-started`)
        });
        const committed = await input.repository.commit(request);
        if (!committed.ok) return committed;
        const checkpoint = await input.repository.getAggregate(
          input.campaignId,
          "rest.process",
          restProcessAggregateId(processId)
        );
        if (!checkpoint.ok) return checkpoint;
        return {
          ok: true,
          value: {
            commit: committed.value,
            output: buildRestOutput({
              input,
              noCommit: false,
              noGameTime: true,
              resultKind: "COMMIT_APPLIED",
              narration: preparation.restKind === "LONG_REST"
                ? "Tu prépares un repos long et t’installes pour laisser retomber la tension des heures écoulées."
                : "Tu t’accordes un repos court, assez longtemps pour reprendre ton souffle sans abandonner complètement ta vigilance.",
              systemText: "Repos commencé. Aucun bénéfice n’est encore accordé ; le temps avancera par segments validés.",
              commitId: committed.value.commitId,
              safetyNotes: ["Le démarrage et le checkpoint du repos ont été committés atomiquement."],
              activeRestProcess: checkpoint.value.payload as RestProcessStateV1
            })
          }
        };
      } finally {
        await input.repository.releaseWriterLease(lease.value);
      }
    },
    advance: advanceNarrativeRestSegmentV1,
    restoreActive: restoreActiveNarrativeRestV1
  };
}

async function restoreActiveNarrativeRestV1(
  input: Parameters<NarrativeRestRuntimeV1["restoreActive"]>[0]
) {
  const events = await input.repository.listEvents(input.campaignId, null, 500);
  if (!events.ok) return events;
  const processIds = [...events.value]
    .reverse()
    .filter(event => event.eventType === "rest_started")
    .map(event => typeof event.payload.processId === "string" ? event.payload.processId : null)
    .filter((processId): processId is string => processId !== null);
  for (const processId of processIds) {
    const aggregate = await input.repository.getAggregate(
      input.campaignId,
      "rest.process",
      restProcessAggregateId(processId)
    );
    if (!aggregate.ok && aggregate.error.code === "NOT_FOUND") continue;
    if (!aggregate.ok) return aggregate;
    const process = aggregate.value.payload as RestProcessStateV1;
    if (process.status === "ACTIVE") return { ok: true as const, value: process };
  }
  return { ok: true as const, value: null };
}

async function advanceNarrativeRestSegmentV1(
  input: Parameters<NarrativeRestRuntimeV1["advance"]>[0]
) {
  const stableSuffix = normalizeIdPart(input.clientRequestId);
  const operationId = opaqueId<OperationId>(`rest-segment-op-${stableSuffix}`);
  const existing = await input.repository.getOperation(operationId);
  if (existing.ok && existing.value.phase === "COMPLETED" && existing.value.resultPayload !== null) {
    return {
      ok: true as const,
      value: {
        operation: existing.value,
        output: existing.value.resultPayload as NarrativeTurnControllerOutputV1
      }
    };
  }
  if (!existing.ok && existing.error.code !== "NOT_FOUND") return existing;
  if (existing.ok) {
    return { ok: false as const, error: coreError("CAMPAIGN_BUSY", "narrative.rest.segment-operation-incomplete", { operationId }) };
  }

  const campaign = await input.repository.getCampaign(input.campaignId);
  if (!campaign.ok) return campaign;
  const processAggregate = await input.repository.getAggregate(
    input.campaignId,
    "rest.process",
    restProcessAggregateId(input.processId)
  );
  if (!processAggregate.ok) return processAggregate;
  const process = processAggregate.value.payload as RestProcessStateV1;
  if (process.status !== "ACTIVE") {
    return { ok: false as const, error: coreError("VALIDATION_FAILED", "narrative.rest.process-not-active", { processId: input.processId, status: process.status }) };
  }
  const clockAggregate = await input.repository.getAggregate(
    input.campaignId,
    "world.clock",
    campaign.value.clockAggregateId
  );
  if (!clockAggregate.ok) return clockAggregate;
  const currentGameSecond = (clockAggregate.value.payload as CampaignClockPayload).elapsedGameSeconds;
  const segment = await prepareNextRestSegmentV1({
    process,
    currentGameSecond,
    deterministicSeed: `${input.processId}:segments`,
    allowInterruption: true,
    activity: input.activity ?? null
  });
  const batch = await createRestSegmentTemporalBatchV1({
    batchId: `${operationId}:batch`,
    taskId: `${operationId}:boundary`,
    segment
  });
  const operation = await createRestSegmentOperationV1({
    campaignId: input.campaignId,
    campaignRevision: campaign.value.campaignRevision,
    operationId,
    clientRequestId: input.clientRequestId,
    batchFingerprint: batch.batchFingerprint,
    processId: input.processId,
    activity: segment.activity,
    createdAt: input.createdAt
  });
  const received = await input.repository.receiveOperation(operation);
  if (!received.ok) return received;
  const preparing = await input.repository.transitionOperation(operationId, "RECEIVED", "PREPARING");
  if (!preparing.ok) return preparing;
  const ready = await input.repository.transitionOperation(operationId, "PREPARING", "READY_TO_COMMIT");
  if (!ready.ok) return ready;
  const lease = await input.repository.acquireWriterLease(
    input.campaignId,
    opaqueId<WriterId>(`${operationId}:writer`),
    120_000
  );
  if (!lease.ok) return lease;
  try {
    const scheduleAggregateId = opaqueId<AggregateId>(`agg_rest_schedule_${input.processId}`);
    const cursorAggregateId = opaqueId<AggregateId>(`agg_rest_cursor_${input.processId}`);
    const scheduleResult = await input.repository.getAggregate(
      input.campaignId,
      "world.schedule",
      scheduleAggregateId
    );
    if (!scheduleResult.ok && scheduleResult.error.code !== "NOT_FOUND") return scheduleResult;
    const cursorResult = await input.repository.getAggregate(
      input.campaignId,
      "world.simulation-cursor",
      cursorAggregateId
    );
    if (!cursorResult.ok && cursorResult.error.code !== "NOT_FOUND") return cursorResult;
    const prepared = await prepareRestSegmentCommitV1({
      campaign: campaign.value,
      operation: ready.value,
      writerLease: lease.value,
      clockAggregate: clockAggregate.value,
      scheduleAggregate: scheduleResult.ok ? scheduleResult.value : null,
      scheduleAggregateId,
      simulationCursorAggregate: cursorResult.ok ? cursorResult.value : null,
      simulationCursorAggregateId: cursorAggregateId,
      restProcessAggregateId: restProcessAggregateId(input.processId),
      restProcessExpectedRevision: processAggregate.value.aggregateRevision,
      segment,
      batch,
      eventId: opaqueId<EventId>(`${operationId}:event`),
      commitId: opaqueId<CommitId>(`${operationId}:commit`),
      commandId: opaqueId<CommandId>(`${operationId}:command`)
    });
    if (!prepared.ok) {
      return {
        ok: false as const,
        error: coreError("VALIDATION_FAILED", "narrative.rest.segment-invalid", {
          diagnostics: prepared.diagnostics.map(diagnostic => ({
            code: diagnostic.code,
            path: diagnostic.path,
            details: diagnostic.details
          }))
        })
      };
    }
    const committed = await input.repository.commit(prepared.value);
    if (!committed.ok) return committed;
    const source = await loadRestSourceOutputV1(input.repository, input.campaignId, input.processId);
    if (!source.ok) return source;
    const output = buildRestOutput({
      input: {
        repository: input.repository,
        campaignId: input.campaignId,
        operation: ready.value,
        rawInput: "Continuer le repos",
        interpretation: source.value.interpretation,
        domainCommand: source.value.domainCommand,
        activeScene: input.activeScene,
        createdAt: input.createdAt,
        aiTelemetry: []
      },
      noCommit: false,
      noGameTime: false,
      resultKind: "COMMIT_APPLIED",
      narration: narrationForSegment(segment),
      systemText: systemTextForSegment(segment),
      commitId: committed.value.commitId,
      safetyNotes: ["La narration est produite après le commit atomique du segment et de l'horloge."],
      activeRestProcess: segment.nextProcess.status === "ACTIVE" ? segment.nextProcess : null
    });
    const completed = await input.repository.completePresentation(
      operationId,
      "COMMITTED_RENDERED",
      1,
      output
    );
    if (!completed.ok) return completed;
    return { ok: true as const, value: { operation: completed.value, output } };
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

async function createRestSegmentOperationV1(input: {
  campaignId: Parameters<NarrativeRestRuntimeV1["advance"]>[0]["campaignId"];
  campaignRevision: number;
  operationId: OperationId;
  clientRequestId: string;
  batchFingerprint: string;
  processId: string;
  activity: RestSegmentActivityV1;
  createdAt: string;
}): Promise<OperationRecord> {
  const requestPayload = {
    batchFingerprint: input.batchFingerprint,
    processId: input.processId,
    activity: input.activity
  };
  return {
    schemaVersion: 1,
    operationId: input.operationId,
    campaignId: input.campaignId,
    clientRequestId: opaqueId<RequestId>(input.clientRequestId),
    idempotencyKey: opaqueId<IdempotencyKey>(`rest-segment-idem-${normalizeIdPart(input.clientRequestId)}`),
    requestFingerprint: await computeRequestFingerprint("time.segment", 1, requestPayload),
    operationKind: "time.segment",
    requestPayloadSchemaVersion: 1,
    requestPayload,
    phase: "RECEIVED",
    observedCampaignRevision: input.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: input.createdAt,
    updatedAt: input.createdAt
  };
}

async function loadRestSourceOutputV1(
  repository: Parameters<NarrativeRestRuntimeV1["advance"]>[0]["repository"],
  campaignId: Parameters<NarrativeRestRuntimeV1["advance"]>[0]["campaignId"],
  processId: string
) {
  const handoff = await repository.getAggregate(
    campaignId,
    "process.handoff",
    opaqueId<AggregateId>(`agg_handoff_${processId}`)
  );
  if (!handoff.ok) return handoff;
  const sourceOperationId = handoff.value.payload.sourceOperationId;
  if (typeof sourceOperationId !== "string") {
    return { ok: false as const, error: coreError("CAMPAIGN_INTEGRITY_FAILURE", "narrative.rest.source-operation-missing", { processId }) };
  }
  const source = await repository.getOperation(opaqueId<OperationId>(sourceOperationId));
  if (!source.ok) return source;
  if (source.value.resultPayload === null) {
    return { ok: false as const, error: coreError("CAMPAIGN_INTEGRITY_FAILURE", "narrative.rest.source-output-missing", { processId, sourceOperationId }) };
  }
  return { ok: true as const, value: source.value.resultPayload as NarrativeTurnControllerOutputV1 };
}

function narrationForSegment(
  segment: Awaited<ReturnType<typeof prepareNextRestSegmentV1>>
): string {
  const process = segment.nextProcess;
  const durationSeconds = segment.durationSeconds;
  const hours = durationSeconds / 3_600;
  if (process.status === "INTERRUPTED") {
    return "Un bruit soudain brise le calme et te tire du repos avant que tu puisses aller plus loin.";
  }
  if (process.status === "COMPLETED_PENDING_BENEFITS") {
    return segment.activity.activityKind === "CHARACTER_PROGRESSION"
      ? "Au terme de ce temps de repos, tu as pris la mesure du chemin parcouru. Ton évolution attend désormais tes choix avant de prendre une forme définitive."
      : "Le temps nécessaire s’est écoulé. Tu arrives au terme du repos, tandis que ses effets restent encore à confirmer.";
  }
  if (segment.activity.activityKind === "CHARACTER_PROGRESSION") {
    return "Pendant ce temps de calme, tu prends du recul sur le chemin parcouru et consacres ce moment à ton évolution.";
  }
  return `${hours === 1 ? "Une heure s’écoule" : `${hours} heures s’écoulent`} dans un calme relatif. Ton repos se poursuit.`;
}

function systemTextForSegment(
  segment: Awaited<ReturnType<typeof prepareNextRestSegmentV1>>
): string {
  const process = segment.nextProcess;
  const durationSeconds = segment.durationSeconds;
  if (process.status === "INTERRUPTED") {
    return `Repos interrompu après ${durationSeconds} secondes supplémentaires. Aucun bénéfice non validé n’est accordé.`;
  }
  if (process.status === "COMPLETED_PENDING_BENEFITS") {
    return segment.activity.activityKind === "CHARACTER_PROGRESSION"
      ? "Segment de progression committé et durée du repos atteinte. Le niveau reste en attente des choix et de la validation personnage."
      : "Durée du repos atteinte. Les bénéfices restent en attente des autorités personnage et inventaire.";
  }
  if (segment.activity.activityKind === "CHARACTER_PROGRESSION") {
    return "Segment de progression committé. Aucun niveau n’est encore appliqué : les choix et la validation personnage restent requis.";
  }
  return `Segment de ${durationSeconds} secondes committé avec l’horloge. Aucun bénéfice final n’est encore accordé.`;
}

function normalizeIdPart(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized.slice(0, 96) : "request";
}

function buildRestOutput(input: {
  input: Parameters<NarrativeRestRuntimeV1["execute"]>[0];
  noCommit: boolean;
  noGameTime: boolean;
  resultKind: "CLARIFICATION_REQUIRED" | "NO_COMMIT_RESPONSE" | "COMMIT_APPLIED";
  narration: string;
  systemText: string;
  commitId: string | null;
  safetyNotes: string[];
  activeRestProcess?: RestProcessStateV1 | null;
}): NarrativeTurnControllerOutputV1 {
  const operationId = input.input.operation.operationId;
  const displayPacket: DisplayPacketV1 & JsonObject = {
    schemaVersion: 1,
    contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
    operationId,
    sceneId: input.input.activeScene.sceneId,
    displayBlocks: [{
      blockId: `${operationId}:raw`,
      kind: "RAW_INPUT",
      speaker: { speakerId: "speaker-player", kind: "PLAYER_CHARACTER", displayName: "Joueur", roleLabel: "Entrée joueur", ariaLabel: "Entrée libre du joueur", visualToken: "speaker-player" },
      text: input.input.rawInput,
      ariaLabel: "Entrée libre du joueur",
      roleLabel: "Entrée joueur",
      visualStyleToken: "speaker-player",
      sourceRefs: [`operation:${operationId}:raw`],
      isDegradedFallback: false
    }, {
      blockId: `${operationId}:rest-narration`,
      kind: "GM_NARRATION",
      speaker: { speakerId: "speaker-gm", kind: "GM", displayName: "MJ", roleLabel: "Narration", ariaLabel: "Narration du maître du jeu", visualToken: "speaker-gm" },
      text: input.narration,
      ariaLabel: "Narration du repos",
      roleLabel: "Narration",
      visualStyleToken: "speaker-gm",
      sourceRefs: [`operation:${operationId}:rest`],
      isDegradedFallback: false
    }, {
      blockId: `${operationId}:rest-system`,
      kind: input.resultKind === "CLARIFICATION_REQUIRED" ? "CLARIFICATION" : "SYSTEM_NOTICE",
      speaker: { speakerId: "speaker-system", kind: "SYSTEM", displayName: "Système", roleLabel: "Notification système", ariaLabel: "Notification système", visualToken: "speaker-system" },
      text: input.systemText,
      ariaLabel: "État du processus de repos",
      roleLabel: "Notification système",
      visualStyleToken: "speaker-system",
      sourceRefs: [`operation:${operationId}:rest`],
      isDegradedFallback: false
    }],
    rawInputAccess: { available: true, operationId },
    rhythmDiagnostics: `narrative-rest:${input.resultKind}`,
    reconstructionRefs: [`operation:${operationId}:raw`, `operation:${operationId}:rest`],
    version: 1
  };
  return {
    schemaVersion: 1,
    contractVersion: "narrative-turn-controller/1",
    operationId,
    clientRequestId: input.input.operation.clientRequestId,
    noCommit: input.noCommit,
    noGameTime: input.noGameTime,
    interpretation: input.input.interpretation as typeof input.input.interpretation & JsonObject,
    domainCommand: input.input.domainCommand,
    mjPlan: null,
    mjPlannerFailure: null,
    npcPerformance: null,
    npcPerformanceFailure: null,
    suspendedIntent: null,
    pendingSkillCheck: null,
    resolution: {
      schemaVersion: 1,
      contractVersion: "narrative-resolution/1",
      resolutionId: `${operationId}:resolution:rest`,
      operationId,
      resultKind: input.resultKind,
      interpretation: input.input.interpretation as typeof input.input.interpretation & JsonObject,
      domainCommand: input.input.domainCommand,
      characterExpression: null,
      preparedEffects: [],
      handoff: null,
      commitId: input.commitId,
      noGameTime: input.noGameTime,
      safetyNotes: input.safetyNotes,
      actionAdjudication: null,
      perception: null
    },
    sceneState: createInitialReferenceSceneStateV1(),
    sceneArrival: null,
    activeScene: input.input.activeScene,
    displayPacket,
    stageTimings: null,
    aiTelemetry: input.input.aiTelemetry,
    activeRestProcess: input.activeRestProcess ?? null
  };
}
