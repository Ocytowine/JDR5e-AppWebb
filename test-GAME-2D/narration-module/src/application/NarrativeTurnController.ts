import {
  computeRequestFingerprint,
  coreError,
  IndexedDbCampaignRepository,
  MemoryCampaignRepository,
  opaqueId,
  type AggregateId,
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
  type NarrativeIntentInterpretationV1,
  type SuspendedIntentRecordV1
} from "./intentClarification";
import {
  createDefaultAiIntentInterpreterConfigV1,
  interpretNarrativeInputWithAiV1,
  type AiIntentInterpreterConfigV1
} from "./aiIntentInterpretation";
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
  suspendedIntent: (SuspendedIntentRecordV1 & JsonObject) | null;
  resolution: NarrativeResolutionResultV1;
  sceneState: ReferenceSceneStateV1;
  displayPacket: DisplayPacketV1 & JsonObject;
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

  constructor(options: NarrativeTurnControllerOptions) {
    this.repository = options.repository;
    this.campaignId = options.campaignId;
    this.clock = options.clock ?? systemClock;
    this.idPrefix = options.idPrefix ?? "nar";
    this.intentInterpreterConfig = options.intentInterpreterConfig === undefined
      ? createDefaultAiIntentInterpreterConfigV1()
      : options.intentInterpreterConfig;
  }

  async submit(input: NarrativeTurnInputV1): Promise<Result<NarrativeTurnControllerResultV1>> {
    const validation = validateInput(input);
    if (!validation.ok) return { ok: false, error: coreError("VALIDATION_FAILED", "narrative.turn.invalid-input", { issues: validation.issues }) };

    const campaignResult = await this.repository.getCampaign(this.campaignId);
    if (!campaignResult.ok) return { ok: false, error: campaignResult.error };

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
      return {
        ok: true,
        value: {
          operation: received.value,
          output: received.value.resultPayload as NarrativeTurnControllerOutputV1
        }
      };
    }

    const output = await buildResolvedOutput({
      repository: this.repository,
      campaignId: this.campaignId,
      operation: received.value,
      input,
      createdAt: this.clock.now().toISOString(),
      intentInterpreterConfig: this.intentInterpreterConfig
    });
    if (!output.ok) return output;

    const completed = output.value.commit === null
      ? await this.repository.completeWithoutCommit(received.value.operationId, 1, output.value.output)
      : await this.repository.completePresentation(received.value.operationId, "COMMITTED_RENDERED", 1, output.value.output);
    if (!completed.ok) return completed;

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
}

export async function createPrototypeNarrativeTurnControllerV1(options: {
  clock?: RepositoryClock;
} = {}): Promise<NarrativeTurnControllerV1> {
  const clock = options.clock ?? systemClock;
  const repository = new MemoryCampaignRepository({ clock });
  await ensurePrototypeCampaign(repository, clock);
  return new NarrativeTurnControllerV1({ repository, campaignId: DEFAULT_CAMPAIGN_ID, clock });
}

export async function createBrowserPersistentNarrativeTurnControllerV1(options: {
  clock?: RepositoryClock;
  databaseName?: string;
} = {}): Promise<NarrativeTurnControllerV1> {
  const clock = options.clock ?? systemClock;
  if (!globalThis.indexedDB) return createPrototypeNarrativeTurnControllerV1({ clock });
  const repository = await IndexedDbCampaignRepository.open({
    clock,
    databaseName: options.databaseName ?? "jdr5e-narration-prototype"
  });
  await ensurePrototypeCampaign(repository, clock);
  return new NarrativeTurnControllerV1({ repository, campaignId: DEFAULT_CAMPAIGN_ID, clock });
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
    suspendedIntent,
    resolution: {
      schemaVersion: 1,
      contractVersion: "narrative-resolution/1",
      resolutionId: `${operation.operationId}:legacy-resolution:1`,
      operationId: operation.operationId,
      resultKind: "NO_COMMIT_RESPONSE",
      interpretation,
      characterExpression: null,
      preparedEffects: [],
      handoff: null,
      commitId: null,
      noGameTime: true,
      safetyNotes: ["Sortie legacy conservée pour compatibilité de test."]
    },
    sceneState: createInitialReferenceSceneStateV1(),
    displayPacket
  };
}

async function buildResolvedOutput(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operation: OperationRecord;
  input: NarrativeTurnInputV1;
  createdAt: string;
  intentInterpreterConfig: AiIntentInterpreterConfigV1 | null;
}): Promise<Result<{ output: NarrativeTurnControllerOutputV1; commit: unknown | null }>> {
  const intentId = `${input.operation.operationId}:intent:1`;
  const interpretation = input.intentInterpreterConfig === null
    ? interpretNarrativeInputV1({
      intentId,
      rawInput: input.input.rawInput
    }) as NarrativeIntentInterpretationV1 & JsonObject
    : (await interpretNarrativeInputWithAiV1({
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      intentId,
      rawInput: input.input.rawInput,
      config: input.intentInterpreterConfig
    })).interpretation as NarrativeIntentInterpretationV1 & JsonObject;
  const suspendedIntent = interpretation.requiresClarification
    ? createSuspendedIntentRecordV1({
      suspendedIntentId: `${input.operation.operationId}:suspended:1`,
      operationId: input.operation.operationId,
      rawInput: input.input.rawInput,
      interpretation,
      createdAt: input.createdAt
    }) as SuspendedIntentRecordV1 & JsonObject
    : null;
  const resolution = await resolveNarrativeTurnV1({
    repository: input.repository,
    campaignId: input.campaignId,
    operation: input.operation,
    rawInput: input.input.rawInput,
    interpretation,
    suspendedIntent
  });
  if (!resolution.ok) return resolution;

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
        suspendedIntent,
        resolution: resolution.value.result,
        sceneState: resolution.value.sceneState,
        displayPacket: resolution.value.displayPacket
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
