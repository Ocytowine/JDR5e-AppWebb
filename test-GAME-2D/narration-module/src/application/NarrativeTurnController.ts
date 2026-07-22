import {
  computeRequestFingerprint,
  coreError,
  IndexedDbCampaignRepository,
  MemoryCampaignRepository,
  opaqueId,
  type AggregateId,
  type CommitRecord,
  type CampaignClockPayload,
  type CampaignId,
  type CampaignRecord,
  type CampaignRepository,
  type IdempotencyKey,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RepositoryClock,
  type RequestId,
  type Result
} from "../core";
import type { DisplayPacketV1 } from "../scene";
import { SCENE_SOCIAL_UI_CONTRACT_VERSION_V1 } from "../scene";
import {
  createSuspendedIntentRecordV1,
  interpretNarrativeInputV1,
  upgradeLegacyNarrativeIntentInterpretationV1,
  type NarrativeIntentInterpretationV1,
  type SuspendedIntentRecordV1
} from "./intentClarification";
import {
  createDefaultAiIntentInterpreterConfigV1,
  interpretNarrativeInputWithAiV1,
  type AiIntentInterpreterConfigV1,
  type LocalReferentHintV1,
  type RecentSemanticTurnV1
} from "./aiIntentInterpretation";
import { REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1, type PlayableSceneStateV1 } from "./playableScene";
import {
  createDefaultMjPlannerConfigV1,
  planNarrativeTurnWithMjV1,
  type MjPlannerConfigV1,
  type MjPlanningFailureV1
} from "./mjPlanning";
import {
  applyNpcPerformanceToDisplayPacketV1,
  createDefaultNpcPerformerConfigV1,
  performNpcTurnV1,
  type NpcPerformanceFailureV1,
  type NpcPerformerConfigV1
} from "./npcPerforming";
import type { AiCallTelemetryV1, MjPlannerPayloadV1, NpcPerformerPayloadV1 } from "../ai/types";
import {
  resolveNarrativeTurnV1,
  type NarrativeResolutionResultV1
} from "./narrativeResolution";
import {
  recordNarrativeRenderedProjectionV1,
  restoreNarrativeRenderedThreadV1,
  type NarrativeRenderProjectionInputV1,
  type NarrativeRenderProjectionRecordResultV1,
  type RestoredNarrativeThreadV1
} from "./narrativeRenderProjection";
import { createInitialReferenceSceneStateV1, type ReferenceSceneStateV1 } from "./referenceSceneState";
import { buildNarrativeDomainCommandV1, type NarrativeDomainCommandV1 } from "./domainCommands";
import type { SceneArrivalStateV1 } from "./sceneArrival";
import {
  createPrototypeInnSceneTransitionRuntimeV1,
  ensurePrototypeInnSceneTransitionStateV1,
  resolvePrototypeInnActiveSceneV1
} from "./prototypeSceneTransitionRuntime";

export interface NarrativeActiveSceneResolverV1 {
  resolve(input: { repository: CampaignRepository; campaignId: CampaignId }): Promise<Result<PlayableSceneStateV1>>;
}

export interface NarrativeSceneTransitionRuntimeV1 {
  execute(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    operation: OperationRecord;
    rawInput: string;
    interpretation: NarrativeIntentInterpretationV1;
    domainCommand: NarrativeDomainCommandV1;
  }): Promise<Result<{
    commit: CommitRecord;
    arrival: SceneArrivalStateV1;
    displayPacket: DisplayPacketV1 & JsonObject;
    characterExpression: string;
    durationSeconds: number;
  }>>;
}

export interface NarrativeDynamicPlaceRuntimeV1 {
  canHandle(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    interpretation: NarrativeIntentInterpretationV1;
    domainCommand: NarrativeDomainCommandV1 | null;
    activeScene: PlayableSceneStateV1;
  }): Promise<boolean> | boolean;
  execute(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    operation: OperationRecord;
    rawInput: string;
    interpretation: NarrativeIntentInterpretationV1;
    domainCommand: NarrativeDomainCommandV1 | null;
    activeScene: PlayableSceneStateV1;
  }): Promise<Result<Awaited<ReturnType<NarrativeSceneTransitionRuntimeV1["execute"]>> extends Result<infer T> ? T : never>>;
}

export interface NarrativeTurnInputV1 {
  schemaVersion: 1;
  clientRequestId: string;
  rawInput: string;
}

export interface NarrativeTurnControllerOutputV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: "narrative-turn-controller/1";
  operationId: string;
  clientRequestId: string;
  noCommit: boolean;
  noGameTime: boolean;
  interpretation: NarrativeIntentInterpretationV1 & JsonObject;
  domainCommand: NarrativeDomainCommandV1 | null;
  mjPlan: (MjPlannerPayloadV1 & JsonObject) | null;
  mjPlannerFailure: (MjPlanningFailureV1 & JsonObject) | null;
  npcPerformance: (NpcPerformerPayloadV1 & JsonObject) | null;
  npcPerformanceFailure: (NpcPerformanceFailureV1 & JsonObject) | null;
  suspendedIntent: (SuspendedIntentRecordV1 & JsonObject) | null;
  resolution: NarrativeResolutionResultV1;
  sceneState: ReferenceSceneStateV1;
  sceneArrival: SceneArrivalStateV1 | null;
  activeScene: PlayableSceneStateV1;
  displayPacket: DisplayPacketV1 & JsonObject;
  stageTimings: NarrativeControllerStageTimingsV1 | null;
  aiTelemetry: AiCallTelemetryV1[];
}

export interface NarrativeControllerStageTimingsV1 extends JsonObject {
  interpretationMs: number;
  planningMs: number;
  resolutionMs: number;
  npcPerformanceMs: number;
  resolvedOutputMs: number;
}

export interface NarrativeTurnControllerResultV1 {
  operation: OperationRecord;
  output: NarrativeTurnControllerOutputV1;
}

export interface NarrativeTurnControllerOptions {
  repository: CampaignRepository;
  campaignId: CampaignId;
  clock?: RepositoryClock;
  idPrefix?: string;
  intentInterpreterConfig?: AiIntentInterpreterConfigV1 | null;
  mjPlannerConfig?: MjPlannerConfigV1 | null;
  npcPerformerConfig?: NpcPerformerConfigV1 | null;
  sceneTransitionRuntime?: NarrativeSceneTransitionRuntimeV1 | null;
  dynamicPlaceRuntime?: NarrativeDynamicPlaceRuntimeV1 | null;
  activeSceneResolver?: NarrativeActiveSceneResolverV1 | null;
}

const DEFAULT_CAMPAIGN_ID = opaqueId<CampaignId>("cmp-narrative-prototype");
const DEFAULT_CLOCK_ID = opaqueId<AggregateId>("agg-narrative-prototype-clock");
const systemClock: RepositoryClock = { now: () => new Date() };

export class NarrativeTurnControllerV1 {
  private readonly repository: CampaignRepository;
  private readonly campaignId: CampaignId;
  private readonly clock: RepositoryClock;
  private readonly idPrefix: string;
  private readonly intentInterpreterConfig: AiIntentInterpreterConfigV1 | null;
  private readonly mjPlannerConfig: MjPlannerConfigV1 | null;
  private readonly npcPerformerConfig: NpcPerformerConfigV1 | null;
  private readonly sceneTransitionRuntime: NarrativeSceneTransitionRuntimeV1 | null;
  private readonly dynamicPlaceRuntime: NarrativeDynamicPlaceRuntimeV1 | null;
  private readonly activeSceneResolver: NarrativeActiveSceneResolverV1 | null;
  private recentLocalReferents: LocalReferentHintV1[] = [];
  private recentSemanticTurns: RecentSemanticTurnV1[] = [];

  constructor(options: NarrativeTurnControllerOptions) {
    this.repository = options.repository;
    this.campaignId = options.campaignId;
    this.clock = options.clock ?? systemClock;
    this.idPrefix = options.idPrefix ?? "nar";
    this.intentInterpreterConfig = options.intentInterpreterConfig === undefined
      ? createDefaultAiIntentInterpreterConfigV1()
      : options.intentInterpreterConfig;
    this.mjPlannerConfig = options.mjPlannerConfig === undefined
      ? createDefaultMjPlannerConfigV1()
      : options.mjPlannerConfig;
    this.npcPerformerConfig = options.npcPerformerConfig === undefined
      ? createDefaultNpcPerformerConfigV1()
      : options.npcPerformerConfig;
    this.sceneTransitionRuntime = options.sceneTransitionRuntime ?? null;
    this.dynamicPlaceRuntime = options.dynamicPlaceRuntime ?? null;
    this.activeSceneResolver = options.activeSceneResolver ?? null;
  }

  async submit(input: NarrativeTurnInputV1): Promise<Result<NarrativeTurnControllerResultV1>> {
    const validation = validateInput(input);
    if (!validation.ok) return { ok: false, error: coreError("VALIDATION_FAILED", "narrative.turn.invalid-input", { issues: validation.issues }) };

    const campaignResult = await this.repository.getCampaign(this.campaignId);
    if (!campaignResult.ok) return { ok: false, error: campaignResult.error };
    const activeSceneResult = this.activeSceneResolver === null
      ? { ok: true as const, value: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1 }
      : await this.activeSceneResolver.resolve({ repository: this.repository, campaignId: this.campaignId });
    if (!activeSceneResult.ok) return activeSceneResult;
    const activeScene = activeSceneResult.value;

    const requestPayload = buildRequestPayload(input);
    const operationKind = "narrative.turn.input";
    const requestPayloadSchemaVersion = 1;
    const requestFingerprint = await computeRequestFingerprint(operationKind, requestPayloadSchemaVersion, requestPayload);
    const now = this.clock.now().toISOString();
    const stableSuffix = normalizeClientRequestId(input.clientRequestId);
    const operation: OperationRecord = {
      schemaVersion: 1,
      operationId: opaqueId<OperationId>(`${this.idPrefix}-op-${stableSuffix}`),
      campaignId: this.campaignId,
      clientRequestId: opaqueId<RequestId>(input.clientRequestId),
      idempotencyKey: opaqueId<IdempotencyKey>(`${this.idPrefix}-idem-${stableSuffix}`),
      requestFingerprint,
      operationKind,
      requestPayloadSchemaVersion,
      requestPayload,
      phase: "RECEIVED",
      observedCampaignRevision: campaignResult.value.campaignRevision,
      commitId: null,
      completionMode: null,
      resultPayloadSchemaVersion: null,
      resultPayload: null,
      failure: null,
      receivedAt: now,
      updatedAt: now
    };

    const received = await this.repository.receiveOperation(operation);
    if (!received.ok) return received;
    if (received.value.phase === "COMPLETED" && received.value.resultPayload !== null) {
      const restoredOutput = upgradeLegacyControllerOutput(received.value.resultPayload as NarrativeTurnControllerOutputV1);
      this.rememberLocalReferent(restoredOutput, activeScene);
      this.rememberSemanticTurn(restoredOutput);
      return {
        ok: true,
        value: {
          operation: received.value,
          output: restoredOutput
        }
      };
    }

    const output = await buildResolvedOutput({
      repository: this.repository,
      campaignId: this.campaignId,
      operation: received.value,
      input,
      createdAt: this.clock.now().toISOString(),
      intentInterpreterConfig: this.intentInterpreterConfig,
      mjPlannerConfig: this.mjPlannerConfig,
      npcPerformerConfig: this.npcPerformerConfig,
      localReferentHints: this.recentLocalReferents.filter(hint => hint.sceneId === activeScene.sceneId && hint.sceneVersion === activeScene.version),
      recentSemanticTurns: this.recentSemanticTurns,
      sceneTransitionRuntime: this.sceneTransitionRuntime,
      dynamicPlaceRuntime: this.dynamicPlaceRuntime,
      activeScene
    });
    if (!output.ok) {
      await cancelUncommittedOperationAfterFailure(this.repository, received.value.operationId);
      return output;
    }

    const completed = output.value.commit === null
      ? await this.repository.completeWithoutCommit(received.value.operationId, 1, output.value.output)
      : await this.repository.completePresentation(received.value.operationId, "COMMITTED_RENDERED", 1, output.value.output);
    if (!completed.ok) return completed;
    this.rememberLocalReferent(output.value.output, activeScene);
    this.rememberSemanticTurn(output.value.output);

    return {
      ok: true,
      value: {
        operation: completed.value,
        output: output.value.output
      }
    };
  }

  async recordRenderedProjection(
    request: NarrativeRenderProjectionInputV1
  ): Promise<Result<NarrativeRenderProjectionRecordResultV1>> {
    return recordNarrativeRenderedProjectionV1({
      repository: this.repository,
      campaignId: this.campaignId,
      clock: this.clock,
      idPrefix: this.idPrefix,
      request
    });
  }

  async restoreRenderedThread(limit = 100): Promise<Result<RestoredNarrativeThreadV1>> {
    return restoreNarrativeRenderedThreadV1({
      repository: this.repository,
      campaignId: this.campaignId,
      limit
    });
  }

  private rememberLocalReferent(output: NarrativeTurnControllerOutputV1, activeScene: PlayableSceneStateV1): void {
    const target = output.interpretation.referentResolution?.resolvedTarget ?? output.interpretation.semanticIntent.target ?? null;
    if (target === null || target.ref === null || target.kind === "unknown" || target.kind === "self") return;
    const hint: LocalReferentHintV1 = {
      schemaVersion: 1,
      sceneId: activeScene.sceneId,
      sceneVersion: activeScene.version,
      target,
      sourceOperationId: output.operationId,
      sourceText: output.interpretation.semanticIntent.playerGoal,
      confidence: output.interpretation.referentResolution?.confidence ?? "medium"
    };
    this.recentLocalReferents = [
      hint,
      ...this.recentLocalReferents.filter(entry => entry.target.ref !== target.ref)
    ].slice(0, 5);
  }

  private rememberSemanticTurn(output: NarrativeTurnControllerOutputV1): void {
    if (output.interpretation.runtimeDecision.status === "AI_INTERPRETATION_FAILED") return;
    const turn: RecentSemanticTurnV1 = {
      schemaVersion: 1,
      operationId: output.operationId,
      semanticKind: output.interpretation.semanticIntent.kind,
      playerGoal: output.interpretation.semanticIntent.playerGoal,
      primaryTarget: output.interpretation.referentResolution?.resolvedTarget ?? output.interpretation.semanticIntent.target,
      topic: typeof output.interpretation.topic === "string" ? output.interpretation.topic : null,
      commitment: output.interpretation.semanticIntent.commitment
    };
    this.recentSemanticTurns = [
      turn,
      ...this.recentSemanticTurns.filter(entry => entry.operationId !== turn.operationId)
    ].slice(0, 5);
  }
}

async function cancelUncommittedOperationAfterFailure(repository: CampaignRepository, operationId: OperationId): Promise<void> {
  const current = await repository.getOperation(operationId);
  if (!current.ok || !["RECEIVED", "PREPARING", "SUSPENDED", "READY_TO_COMMIT"].includes(current.value.phase)) return;
  await repository.transitionOperation(operationId, current.value.phase as "RECEIVED" | "PREPARING" | "SUSPENDED" | "READY_TO_COMMIT", "CANCELLED");
}

function upgradeLegacyControllerOutput(output: NarrativeTurnControllerOutputV1): NarrativeTurnControllerOutputV1 {
  const interpretation = upgradeLegacyNarrativeIntentInterpretationV1(output.interpretation);
  if (interpretation === null) return output;
  const domainCommand = output.domainCommand ?? buildNarrativeDomainCommandV1(interpretation);
  const resolutionInterpretation = upgradeLegacyNarrativeIntentInterpretationV1(output.resolution?.interpretation) ?? interpretation;
  const knownInterpretation = output.suspendedIntent === null
    ? null
    : upgradeLegacyNarrativeIntentInterpretationV1(output.suspendedIntent.knownInterpretation);
  return {
    ...output,
    sceneArrival: output.sceneArrival ?? null,
    activeScene: output.activeScene ?? REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
    stageTimings: output.stageTimings ?? null,
    aiTelemetry: Array.isArray(output.aiTelemetry) ? output.aiTelemetry : [],
    interpretation: interpretation as NarrativeIntentInterpretationV1 & JsonObject,
    domainCommand,
    resolution: {
      ...output.resolution,
      interpretation: resolutionInterpretation as NarrativeIntentInterpretationV1 & JsonObject,
      domainCommand: output.resolution.domainCommand ?? domainCommand
    },
    suspendedIntent: output.suspendedIntent === null || knownInterpretation === null
      ? output.suspendedIntent
      : {
        ...output.suspendedIntent,
        knownInterpretation: knownInterpretation as NarrativeIntentInterpretationV1 & JsonObject
      }
  };
}

export async function createPrototypeNarrativeTurnControllerV1(options: {
  clock?: RepositoryClock;
  intentInterpreterConfig?: AiIntentInterpreterConfigV1 | null;
  mjPlannerConfig?: MjPlannerConfigV1 | null;
  npcPerformerConfig?: NpcPerformerConfigV1 | null;
  sceneTransitionRuntime?: NarrativeSceneTransitionRuntimeV1 | null;
  dynamicPlaceRuntime?: NarrativeDynamicPlaceRuntimeV1 | null;
  activeSceneResolver?: NarrativeActiveSceneResolverV1 | null;
  initialScene?: { scene: PlayableSceneStateV1; locationRef: string };
  initializeRepository?: (repository: CampaignRepository, campaignId: CampaignId, clock: RepositoryClock) => Promise<void>;
} = {}): Promise<NarrativeTurnControllerV1> {
  const clock = options.clock ?? systemClock;
  const repository = new MemoryCampaignRepository({ clock });
  await ensurePrototypeCampaign(repository, clock);
  await ensurePrototypeInnSceneTransitionStateV1(repository, DEFAULT_CAMPAIGN_ID, clock, options.initialScene);
  await options.initializeRepository?.(repository, DEFAULT_CAMPAIGN_ID, clock);
  return new NarrativeTurnControllerV1({
    repository,
    campaignId: DEFAULT_CAMPAIGN_ID,
    clock,
    intentInterpreterConfig: options.intentInterpreterConfig,
    mjPlannerConfig: options.mjPlannerConfig,
    npcPerformerConfig: options.npcPerformerConfig,
    sceneTransitionRuntime: options.sceneTransitionRuntime === undefined
      ? createPrototypeInnSceneTransitionRuntimeV1()
      : options.sceneTransitionRuntime,
    dynamicPlaceRuntime: options.dynamicPlaceRuntime,
    activeSceneResolver: options.activeSceneResolver === undefined
      ? { resolve: resolvePrototypeInnActiveSceneV1 }
      : options.activeSceneResolver
  });
}

export async function createBrowserPersistentNarrativeTurnControllerV1(options: {
  clock?: RepositoryClock;
  databaseName?: string;
  intentInterpreterConfig?: AiIntentInterpreterConfigV1 | null;
  mjPlannerConfig?: MjPlannerConfigV1 | null;
  npcPerformerConfig?: NpcPerformerConfigV1 | null;
  sceneTransitionRuntime?: NarrativeSceneTransitionRuntimeV1 | null;
  dynamicPlaceRuntime?: NarrativeDynamicPlaceRuntimeV1 | null;
  activeSceneResolver?: NarrativeActiveSceneResolverV1 | null;
  initialScene?: { scene: PlayableSceneStateV1; locationRef: string };
  initializeRepository?: (repository: CampaignRepository, campaignId: CampaignId, clock: RepositoryClock) => Promise<void>;
} = {}): Promise<NarrativeTurnControllerV1> {
  const clock = options.clock ?? systemClock;
  if (!globalThis.indexedDB) return createPrototypeNarrativeTurnControllerV1({
    clock,
    intentInterpreterConfig: options.intentInterpreterConfig,
    mjPlannerConfig: options.mjPlannerConfig,
    npcPerformerConfig: options.npcPerformerConfig,
    sceneTransitionRuntime: options.sceneTransitionRuntime,
    dynamicPlaceRuntime: options.dynamicPlaceRuntime,
    activeSceneResolver: options.activeSceneResolver,
    initialScene: options.initialScene,
    initializeRepository: options.initializeRepository
  });
  const repository = await IndexedDbCampaignRepository.open({
    clock,
    databaseName: options.databaseName ?? "jdr5e-narration-prototype"
  });
  await ensurePrototypeCampaign(repository, clock);
  await ensurePrototypeInnSceneTransitionStateV1(repository, DEFAULT_CAMPAIGN_ID, clock, options.initialScene);
  await options.initializeRepository?.(repository, DEFAULT_CAMPAIGN_ID, clock);
  return new NarrativeTurnControllerV1({
    repository,
    campaignId: DEFAULT_CAMPAIGN_ID,
    clock,
    intentInterpreterConfig: options.intentInterpreterConfig,
    mjPlannerConfig: options.mjPlannerConfig,
    npcPerformerConfig: options.npcPerformerConfig,
    sceneTransitionRuntime: options.sceneTransitionRuntime === undefined
      ? createPrototypeInnSceneTransitionRuntimeV1()
      : options.sceneTransitionRuntime,
    dynamicPlaceRuntime: options.dynamicPlaceRuntime,
    activeSceneResolver: options.activeSceneResolver === undefined
      ? { resolve: resolvePrototypeInnActiveSceneV1 }
      : options.activeSceneResolver
  });
}

async function ensurePrototypeCampaign(
  repository: CampaignRepository,
  clock: RepositoryClock
): Promise<void> {
  const now = clock.now().toISOString();
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId: DEFAULT_CAMPAIGN_ID,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: DEFAULT_CLOCK_ID,
    dependencies: {
      contentPackageId: "prototype.narration",
      contentPackageVersion: 1,
      rulesetId: "prototype.rules",
      rulesetVersion: 1,
      calendarId: "prototype.calendar",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: now,
    updatedAt: now
  };
  const initialClock: CampaignClockPayload = {
    elapsedGameSeconds: 0,
    calendarId: "prototype.calendar",
    calendarVersion: 1
  };
  const created = await repository.createCampaign(campaign, initialClock);
  if (!created.ok) {
    const existing = await repository.getCampaign(campaign.campaignId);
    if (!existing.ok) {
      throw new Error(`Failed to create prototype narrative campaign: ${created.error.messageKey}`);
    }
  }
}

export function buildNoCommitOutput(
  operation: OperationRecord,
  input: NarrativeTurnInputV1,
  createdAt = new Date().toISOString()
): NarrativeTurnControllerOutputV1 {
  const interpretation = interpretNarrativeInputV1({
    intentId: `${operation.operationId}:intent:1`,
    rawInput: input.rawInput
  }) as NarrativeIntentInterpretationV1 & JsonObject;
  const suspendedIntent = interpretation.requiresClarification
    ? createSuspendedIntentRecordV1({
      suspendedIntentId: `${operation.operationId}:suspended:1`,
      operationId: operation.operationId,
      rawInput: input.rawInput,
      interpretation,
      createdAt
    }) as SuspendedIntentRecordV1 & JsonObject
    : null;
  const responseBlock = buildResponseBlock(operation.operationId, interpretation, suspendedIntent);
  const displayPacket: DisplayPacketV1 & JsonObject = {
    schemaVersion: 1,
    contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
    operationId: operation.operationId,
    sceneId: "prototype-narration-surface",
    displayBlocks: [
      {
        blockId: `${operation.operationId}:raw`,
        kind: "RAW_INPUT",
        speaker: {
          speakerId: "speaker-player",
          kind: "PLAYER_CHARACTER",
          displayName: "Joueur",
          roleLabel: "Entrée joueur",
          ariaLabel: "Entrée libre du joueur",
          visualToken: "speaker-player"
        },
        text: input.rawInput,
        ariaLabel: "Entrée libre du joueur: RAW_INPUT",
        roleLabel: "Entrée joueur",
        visualStyleToken: "speaker-player",
        sourceRefs: [`operation:${operation.operationId}:raw`],
        isDegradedFallback: false
      },
      {
        blockId: `${operation.operationId}:notice`,
        kind: responseBlock.kind,
        speaker: {
          speakerId: "speaker-system",
          kind: "SYSTEM",
          displayName: "Système",
          roleLabel: "Notification système",
          ariaLabel: "Notification système",
          visualToken: "speaker-system"
        },
        text: responseBlock.text,
        ariaLabel: responseBlock.ariaLabel,
        roleLabel: "Notification système",
        visualStyleToken: "speaker-system",
        sourceRefs: [`operation:${operation.operationId}:raw`],
        isDegradedFallback: false
      }
    ],
    rawInputAccess: {
      available: true,
      operationId: operation.operationId
    },
    rhythmDiagnostics: "no-commit-prototype",
    reconstructionRefs: [`operation:${operation.operationId}:raw`],
    version: 1
  };

  return {
    schemaVersion: 1,
    contractVersion: "narrative-turn-controller/1",
    operationId: operation.operationId,
    clientRequestId: input.clientRequestId,
    noCommit: true,
    noGameTime: true,
    interpretation,
    domainCommand: buildNarrativeDomainCommandV1(interpretation),
    mjPlan: null,
    mjPlannerFailure: null,
    npcPerformance: null,
    npcPerformanceFailure: null,
    suspendedIntent,
    resolution: {
      schemaVersion: 1,
      contractVersion: "narrative-resolution/1",
      resolutionId: `${operation.operationId}:legacy-resolution:1`,
      operationId: operation.operationId,
      resultKind: "NO_COMMIT_RESPONSE",
      interpretation,
      domainCommand: buildNarrativeDomainCommandV1(interpretation),
      characterExpression: null,
      preparedEffects: [],
      handoff: null,
      commitId: null,
      noGameTime: true,
      safetyNotes: ["Sortie legacy conservée pour compatibilité de test."],
      perception: null
    },
    sceneState: createInitialReferenceSceneStateV1(),
    sceneArrival: null,
    activeScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
    displayPacket,
    stageTimings: null,
    aiTelemetry: []
  };
}

async function buildResolvedOutput(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operation: OperationRecord;
  input: NarrativeTurnInputV1;
  createdAt: string;
  intentInterpreterConfig: AiIntentInterpreterConfigV1 | null;
  mjPlannerConfig: MjPlannerConfigV1 | null;
  npcPerformerConfig: NpcPerformerConfigV1 | null;
  localReferentHints?: LocalReferentHintV1[];
  recentSemanticTurns?: RecentSemanticTurnV1[];
  sceneTransitionRuntime: NarrativeSceneTransitionRuntimeV1 | null;
  dynamicPlaceRuntime: NarrativeDynamicPlaceRuntimeV1 | null;
  activeScene: PlayableSceneStateV1;
}): Promise<Result<{ output: NarrativeTurnControllerOutputV1; commit: unknown | null }>> {
  const resolvedOutputStartedAt = Date.now();
  const intentId = `${input.operation.operationId}:intent:1`;
  const interpretationStartedAt = Date.now();
  const interpretationResult = input.intentInterpreterConfig === null
    ? null
    : await interpretNarrativeInputWithAiV1({
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      intentId,
      rawInput: input.input.rawInput,
      config: input.intentInterpreterConfig,
      localReferentHints: input.localReferentHints ?? [],
      recentSemanticTurns: input.recentSemanticTurns ?? [],
      playableScene: input.activeScene
    });
  const interpretation = interpretationResult === null
    ? interpretNarrativeInputV1({
      intentId,
      rawInput: input.input.rawInput
    }) as NarrativeIntentInterpretationV1 & JsonObject
    : interpretationResult.interpretation as NarrativeIntentInterpretationV1 & JsonObject;
  const interpretationMs = Date.now() - interpretationStartedAt;
  const planningStartedAt = Date.now();
  const planning = input.mjPlannerConfig === null
    ? null
    : await planNarrativeTurnWithMjV1({
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      rawInput: input.input.rawInput,
      interpretation,
      domainCommand: buildNarrativeDomainCommandV1(interpretation),
      config: input.mjPlannerConfig
    });
  const planningMs = Date.now() - planningStartedAt;
  const suspendedIntent = interpretation.requiresClarification
    ? createSuspendedIntentRecordV1({
      suspendedIntentId: `${input.operation.operationId}:suspended:1`,
      operationId: input.operation.operationId,
      rawInput: input.input.rawInput,
      interpretation,
      createdAt: input.createdAt
    }) as SuspendedIntentRecordV1 & JsonObject
    : null;
  const domainCommand = buildNarrativeDomainCommandV1(interpretation);
  const resolutionStartedAt = Date.now();
  if (
    input.dynamicPlaceRuntime !== null &&
    await input.dynamicPlaceRuntime.canHandle({ repository: input.repository, campaignId: input.campaignId, interpretation, domainCommand, activeScene: input.activeScene })
  ) {
    const creation = await input.dynamicPlaceRuntime.execute({
      repository: input.repository,
      campaignId: input.campaignId,
      operation: input.operation,
      rawInput: input.input.rawInput,
      interpretation,
      domainCommand,
      activeScene: input.activeScene
    });
    if (!creation.ok) return creation;
    return buildSceneChangeControllerResult({
      input,
      interpretation,
      domainCommand,
      planning,
      interpretationResult,
      interpretationMs,
      planningMs,
      resolutionStartedAt,
      resolvedOutputStartedAt,
      change: creation.value,
      safetyNote: "Lieu dynamique créé par la capacité dédiée et rendu après commit confirmé."
    });
  }
  if (
    input.sceneTransitionRuntime !== null &&
    domainCommand !== null &&
    interpretation.semanticIntent.kind === "traverse_visible_boundary" &&
    interpretation.runtimeDecision.requiredDomain === "world"
  ) {
    const transition = await input.sceneTransitionRuntime.execute({
      repository: input.repository,
      campaignId: input.campaignId,
      operation: input.operation,
      rawInput: input.input.rawInput,
      interpretation,
      domainCommand
    });
    if (!transition.ok) return transition;
    const transitionResolution: NarrativeResolutionResultV1 = {
      schemaVersion: 1,
      contractVersion: "narrative-resolution/1",
      resolutionId: `${input.operation.operationId}:resolution:scene-transition`,
      operationId: input.operation.operationId,
      resultKind: "COMMIT_APPLIED",
      interpretation,
      domainCommand,
      characterExpression: {
        schemaVersion: 1,
        rawPlayerText: input.input.rawInput,
        interpretedIntentId: interpretation.intentId,
        expressionText: transition.value.characterExpression,
        fidelity: "STYLE_NORMALIZED",
        addedCommitments: [],
        preservedMeaning: true
      },
      preparedEffects: [],
      handoff: null,
      commitId: transition.value.commit.commitId,
      noGameTime: false,
      safetyNotes: ["Transition de scène résolue par le domaine monde et rendue après commit confirmé."],
      perception: null
    };
    return {
      ok: true,
      value: {
        commit: transition.value.commit,
        output: {
          schemaVersion: 1,
          contractVersion: "narrative-turn-controller/1",
          operationId: input.operation.operationId,
          clientRequestId: input.input.clientRequestId,
          noCommit: false,
          noGameTime: false,
          interpretation,
          domainCommand,
          mjPlan: planning?.plan ?? null,
          mjPlannerFailure: planning?.planningFailure as (MjPlanningFailureV1 & JsonObject) | null ?? null,
          npcPerformance: null,
          npcPerformanceFailure: null,
          suspendedIntent: null,
          resolution: transitionResolution,
          sceneState: createInitialReferenceSceneStateV1(),
          sceneArrival: transition.value.arrival,
          activeScene: transition.value.arrival.scene,
          displayPacket: transition.value.displayPacket,
          stageTimings: {
            interpretationMs,
            planningMs,
            resolutionMs: Date.now() - resolutionStartedAt,
            npcPerformanceMs: 0,
            resolvedOutputMs: Date.now() - resolvedOutputStartedAt
          },
          aiTelemetry: [...(interpretationResult?.telemetry ?? [])]
        }
      }
    };
  }
  const resolution = await resolveNarrativeTurnV1({
    repository: input.repository,
    campaignId: input.campaignId,
    operation: input.operation,
    rawInput: input.input.rawInput,
    interpretation,
    domainCommand,
    suspendedIntent,
    playableScene: input.activeScene
  });
  if (!resolution.ok) return resolution;
  const resolutionMs = Date.now() - resolutionStartedAt;
  const npcPerformanceStartedAt = Date.now();
  const npcPerformance = input.npcPerformerConfig === null
    ? null
    : await performNpcTurnV1({
      repository: input.repository,
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      rawInput: input.input.rawInput,
      interpretation,
      mjPlan: planning?.plan ?? null,
      resolution: resolution.value.result,
      sceneState: resolution.value.sceneState,
      config: input.npcPerformerConfig
    });
  const npcPerformanceMs = Date.now() - npcPerformanceStartedAt;
  const displayPacket = applyNpcPerformanceToDisplayPacketV1({
    displayPacket: resolution.value.displayPacket,
    performance: npcPerformance?.performance ?? null,
    performanceFailure: npcPerformance?.performanceFailure as (NpcPerformanceFailureV1 & JsonObject) | null ?? null
  });

  return {
    ok: true,
    value: {
      commit: resolution.value.commit,
      output: {
        schemaVersion: 1,
        contractVersion: "narrative-turn-controller/1",
        operationId: input.operation.operationId,
        clientRequestId: input.input.clientRequestId,
        noCommit: resolution.value.commit === null,
        noGameTime: resolution.value.result.noGameTime,
        interpretation,
        domainCommand,
        mjPlan: planning?.plan ?? null,
        mjPlannerFailure: planning?.planningFailure as (MjPlanningFailureV1 & JsonObject) | null ?? null,
        npcPerformance: npcPerformance?.performance ?? null,
        npcPerformanceFailure: npcPerformance?.performanceFailure as (NpcPerformanceFailureV1 & JsonObject) | null ?? null,
        suspendedIntent,
        resolution: resolution.value.result,
        sceneState: resolution.value.sceneState,
        sceneArrival: null,
        activeScene: input.activeScene,
        displayPacket,
        stageTimings: {
          interpretationMs,
          planningMs,
          resolutionMs,
          npcPerformanceMs,
          resolvedOutputMs: Date.now() - resolvedOutputStartedAt
        },
        aiTelemetry: [...(interpretationResult?.telemetry ?? []), ...(npcPerformance?.telemetry ?? [])]
      }
    }
  };
}

function buildSceneChangeControllerResult(input: {
  input: Parameters<typeof buildResolvedOutput>[0];
  interpretation: NarrativeIntentInterpretationV1 & JsonObject;
  domainCommand: NarrativeDomainCommandV1 | null;
  planning: { plan: (MjPlannerPayloadV1 & JsonObject) | null; planningFailure: MjPlanningFailureV1 | null } | null;
  interpretationResult: { telemetry: AiCallTelemetryV1[] } | null;
  interpretationMs: number;
  planningMs: number;
  resolutionStartedAt: number;
  resolvedOutputStartedAt: number;
  change: {
    commit: CommitRecord;
    arrival: SceneArrivalStateV1;
    displayPacket: DisplayPacketV1 & JsonObject;
    characterExpression: string;
    durationSeconds: number;
  };
  safetyNote: string;
}): Result<{ output: NarrativeTurnControllerOutputV1; commit: unknown | null }> {
  const resolution: NarrativeResolutionResultV1 = {
    schemaVersion: 1,
    contractVersion: "narrative-resolution/1",
    resolutionId: `${input.input.operation.operationId}:resolution:scene-change`,
    operationId: input.input.operation.operationId,
    resultKind: "COMMIT_APPLIED",
    interpretation: input.interpretation,
    domainCommand: input.domainCommand,
    characterExpression: {
      schemaVersion: 1,
      rawPlayerText: input.input.input.rawInput,
      interpretedIntentId: input.interpretation.intentId,
      expressionText: input.change.characterExpression,
      fidelity: "STYLE_NORMALIZED",
      addedCommitments: [],
      preservedMeaning: true
    },
    preparedEffects: [],
    handoff: null,
    commitId: input.change.commit.commitId,
    noGameTime: input.change.durationSeconds === 0,
    safetyNotes: [input.safetyNote],
    perception: null
  };
  return {
    ok: true,
    value: {
      commit: input.change.commit,
      output: {
        schemaVersion: 1,
        contractVersion: "narrative-turn-controller/1",
        operationId: input.input.operation.operationId,
        clientRequestId: input.input.input.clientRequestId,
        noCommit: false,
        noGameTime: input.change.durationSeconds === 0,
        interpretation: input.interpretation,
        domainCommand: input.domainCommand,
        mjPlan: input.planning?.plan ?? null,
        mjPlannerFailure: input.planning?.planningFailure as (MjPlanningFailureV1 & JsonObject) | null ?? null,
        npcPerformance: null,
        npcPerformanceFailure: null,
        suspendedIntent: null,
        resolution,
        sceneState: createInitialReferenceSceneStateV1(),
        sceneArrival: input.change.arrival,
        activeScene: input.change.arrival.scene,
        displayPacket: input.change.displayPacket,
        stageTimings: {
          interpretationMs: input.interpretationMs,
          planningMs: input.planningMs,
          resolutionMs: Date.now() - input.resolutionStartedAt,
          npcPerformanceMs: 0,
          resolvedOutputMs: Date.now() - input.resolvedOutputStartedAt
        },
        aiTelemetry: [...(input.interpretationResult?.telemetry ?? [])]
      }
    }
  };
}

function buildRequestPayload(input: NarrativeTurnInputV1): JsonObject {
  return {
    schemaVersion: 1,
    rawInput: input.rawInput,
    clientRequestId: input.clientRequestId,
    noGameTime: true,
    prototypeOnly: true
  };
}

function validateInput(input: NarrativeTurnInputV1): { ok: true } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  if (input.schemaVersion !== 1) issues.push("schemaVersion must be 1.");
  if (!/^[a-z][a-z0-9._:-]{2,127}$/u.test(input.clientRequestId)) {
    issues.push("clientRequestId must be a core-compatible opaque id.");
  }
  if (typeof input.rawInput !== "string" || input.rawInput.trim().length === 0) {
    issues.push("rawInput must be a non-empty string.");
  }
  if (input.rawInput.length > 10_000) issues.push("rawInput exceeds prototype limit.");
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

function normalizeClientRequestId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9.:-]/gu, "-").slice(0, 96);
}

function buildResponseBlock(
  operationId: string,
  interpretation: NarrativeIntentInterpretationV1,
  suspendedIntent: SuspendedIntentRecordV1 | null
): { kind: "SYSTEM_NOTICE" | "CLARIFICATION"; text: string; ariaLabel: string } {
  if (suspendedIntent) {
    return {
      kind: "CLARIFICATION",
      text: suspendedIntent.question,
      ariaLabel: `Clarification pour ${operationId}: CLARIFICATION`
    };
  }
  if (interpretation.intentType === "meta_question") {
    return {
      kind: "SYSTEM_NOTICE",
      text: "Question méta reçue. Aucun temps de jeu, commit métier ou appel IA n'a été déclenché.",
      ariaLabel: `Notification méta pour ${operationId}: SYSTEM_NOTICE`
    };
  }
  if (interpretation.intentType === "possibility_query") {
    return {
      kind: "SYSTEM_NOTICE",
      text: "Question de possibilité reçue. L'action évoquée n'a pas été exécutée.",
      ariaLabel: `Notification possibilité pour ${operationId}: SYSTEM_NOTICE`
    };
  }
  return {
    kind: "SYSTEM_NOTICE",
    text: `Intention détectée (${interpretation.intentType}), mais la résolution réelle est hors périmètre I-06E. Aucun temps de jeu ni commit métier n'a été déclenché.`,
    ariaLabel: `Notification limite I-06E pour ${operationId}: SYSTEM_NOTICE`
  };
}
