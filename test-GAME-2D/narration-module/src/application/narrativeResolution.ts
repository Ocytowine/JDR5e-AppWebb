import {
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CommitId,
  type CommitRecord,
  type CommitRequest,
  type EventId,
  type IdempotencyKey,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RequestId,
  type Result,
  type WriterId,
  type CampaignRepository
} from "../core";
import type { DisplayPacketV1, RenderBlockKindV1 } from "../scene";
import { SCENE_SOCIAL_UI_CONTRACT_VERSION_V1 } from "../scene";
import type { NarrativeIntentInterpretationV1, SuspendedIntentRecordV1 } from "./intentClarification";
import {
  buildReferenceSceneBlocksV1,
  REFERENCE_PLAYABLE_SCENE_ID_V1
} from "./referenceScene";
import {
  applyReferenceSceneMutationV1,
  loadReferenceSceneStateV1,
  REFERENCE_SCENE_STATE_AGGREGATE_ID_V1,
  REFERENCE_SCENE_STATE_AGGREGATE_TYPE_V1,
  type LoadedReferenceSceneStateV1,
  type ReferenceSceneStateV1
} from "./referenceSceneState";

export const NARRATIVE_RESOLUTION_CONTRACT_VERSION_V1 = "narrative-resolution/1" as const;

export type NarrativeResolutionKindV1 =
  | "NO_COMMIT_RESPONSE"
  | "CLARIFICATION_REQUIRED"
  | "RESOLUTION_PROPOSED"
  | "COMMIT_PREPARED"
  | "COMMIT_APPLIED"
  | "HANDOFF_REQUIRED";

export type NarrativeHandoffTargetV1 =
  | "TACTICAL"
  | "REST"
  | "RULES"
  | "INVENTORY"
  | "WORLD"
  | "DYNAMIC_CREATION"
  | "UNOPENED_DOMAIN";

export interface CharacterExpressionV1 extends JsonObject {
  schemaVersion: 1;
  rawPlayerText: string;
  interpretedIntentId: string;
  expressionText: string;
  fidelity: "RAW_EQUIVALENT" | "STYLE_NORMALIZED" | "NOT_REWRITTEN";
  addedCommitments: string[];
  preservedMeaning: true;
}

export interface NarrativePreparedEffectV1 extends JsonObject {
  schemaVersion: 1;
  effectId: string;
  effectType: "SPEECH_ACT_RECORDED" | "OBSERVATION_ONLY" | "BLOCKED_UNOPENED_DOMAIN";
  targetRef: string;
  summary: string;
  commitEligible: boolean;
}

export interface NarrativeResolutionResultV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof NARRATIVE_RESOLUTION_CONTRACT_VERSION_V1;
  resolutionId: string;
  operationId: string;
  resultKind: NarrativeResolutionKindV1;
  interpretation: NarrativeIntentInterpretationV1 & JsonObject;
  characterExpression: CharacterExpressionV1 | null;
  preparedEffects: NarrativePreparedEffectV1[];
  handoff: {
    target: NarrativeHandoffTargetV1;
    reason: string;
    blockedCommit: true;
  } | null;
  commitId: string | null;
  noGameTime: boolean;
  safetyNotes: string[];
}

export interface NarrativeResolutionInputV1 {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operation: OperationRecord;
  rawInput: string;
  interpretation: NarrativeIntentInterpretationV1;
  suspendedIntent: SuspendedIntentRecordV1 | null;
}

export interface NarrativeResolutionOutputV1 {
  result: NarrativeResolutionResultV1;
  displayPacket: DisplayPacketV1 & JsonObject;
  commit: CommitRecord | null;
  sceneState: ReferenceSceneStateV1;
}

export async function resolveNarrativeTurnV1(input: NarrativeResolutionInputV1): Promise<Result<NarrativeResolutionOutputV1>> {
  const loadedSceneState = await loadReferenceSceneStateV1({
    repository: input.repository,
    campaignId: input.campaignId
  });
  if (!loadedSceneState.ok) return loadedSceneState;

  const deterministic = buildDeterministicResolution(input.operation, input.rawInput, input.interpretation, input.suspendedIntent);
  if (deterministic.resultKind !== "COMMIT_PREPARED") {
    return {
      ok: true,
      value: {
        result: deterministic,
        displayPacket: buildResolutionDisplayPacket(input.operation.operationId, input.rawInput, deterministic, loadedSceneState.value.state),
        commit: null,
        sceneState: loadedSceneState.value.state
      }
    };
  }

  const preparing = await input.repository.transitionOperation(input.operation.operationId, "RECEIVED", "PREPARING");
  if (!preparing.ok) return preparing;
  const ready = await input.repository.transitionOperation(input.operation.operationId, "PREPARING", "READY_TO_COMMIT");
  if (!ready.ok) return ready;

  const writerLease = await input.repository.acquireWriterLease(
    input.campaignId,
    opaqueId<WriterId>(`${input.operation.operationId}:writer`),
    120_000
  );
  if (!writerLease.ok) return writerLease;

  const currentCampaign = await input.repository.getCampaign(input.campaignId);
  if (!currentCampaign.ok) return currentCampaign;

  const commitRequest = buildSpeechCommitRequest({
    campaignId: input.campaignId,
    operation: ready.value,
    expectedCampaignRevision: currentCampaign.value.campaignRevision,
    writerLease: writerLease.value,
    resolution: deterministic,
    loadedSceneState: loadedSceneState.value
  });
  const commit = await input.repository.commit(commitRequest);
  const released = await input.repository.releaseWriterLease(writerLease.value);
  if (!released.ok && commit.ok) return released;
  if (!commit.ok) return commit;

  const nextSceneState = applyReferenceSceneMutationV1({
    current: loadedSceneState.value.state,
    operationId: input.operation.operationId,
    interpretation: input.interpretation,
    resolution: deterministic
  });
  const applied: NarrativeResolutionResultV1 = {
    ...deterministic,
    resultKind: "COMMIT_APPLIED",
    commitId: commit.value.commitId,
    safetyNotes: [
      ...deterministic.safetyNotes,
      "Commit appliqué avant rendu visible."
    ]
  };

  const displayPacket = buildResolutionDisplayPacket(input.operation.operationId, input.rawInput, applied, nextSceneState);
  return {
    ok: true,
    value: {
      result: applied,
      displayPacket,
      commit: commit.value,
      sceneState: nextSceneState
    }
  };
}

export function buildDeterministicResolution(
  operation: OperationRecord,
  rawInput: string,
  interpretation: NarrativeIntentInterpretationV1,
  suspendedIntent: SuspendedIntentRecordV1 | null
): NarrativeResolutionResultV1 {
  const base = {
    schemaVersion: 1 as const,
    contractVersion: NARRATIVE_RESOLUTION_CONTRACT_VERSION_V1,
    resolutionId: `${operation.operationId}:resolution:1`,
    operationId: operation.operationId,
    interpretation: interpretation as NarrativeIntentInterpretationV1 & JsonObject,
    characterExpression: null,
    preparedEffects: [],
    handoff: null,
    commitId: null,
    noGameTime: true,
    safetyNotes: [...interpretation.safetyNotes]
  };

  if (suspendedIntent) {
    return {
      ...base,
      resultKind: "CLARIFICATION_REQUIRED",
      safetyNotes: [...base.safetyNotes, "Intention suspendue sans mutation."]
    };
  }

  if (interpretation.intentType === "meta_question" || interpretation.intentType === "possibility_query") {
    return {
      ...base,
      resultKind: "NO_COMMIT_RESPONSE",
      safetyNotes: [...base.safetyNotes, "Réponse sans commit métier."]
    };
  }

  if (interpretation.intentType === "speech") {
    const expression = buildCharacterExpression(rawInput, interpretation);
    return {
      ...base,
      resultKind: "COMMIT_PREPARED",
      characterExpression: expression,
      preparedEffects: [{
        schemaVersion: 1,
        effectId: `${operation.operationId}:effect:speech:1`,
        effectType: "SPEECH_ACT_RECORDED",
        targetRef: "scene:prototype-narration-surface",
        summary: "Acte de parole joueur enregistré dans le journal social borné.",
        commitEligible: true
      }],
      safetyNotes: [...base.safetyNotes, "Parole explicite bornée: aucun effet social mécanique avancé."]
    };
  }

  const handoff = classifyHandoff(rawInput, interpretation);
  if (handoff !== null) {
    return {
      ...base,
      resultKind: "HANDOFF_REQUIRED",
      characterExpression: buildCharacterExpression(rawInput, interpretation),
      preparedEffects: [{
        schemaVersion: 1,
        effectId: `${operation.operationId}:effect:block:1`,
        effectType: "BLOCKED_UNOPENED_DOMAIN",
        targetRef: handoff.target,
        summary: handoff.reason,
        commitEligible: false
      }],
      handoff: {
        target: handoff.target,
        reason: handoff.reason,
        blockedCommit: true
      },
      safetyNotes: [...base.safetyNotes, "Domaine propriétaire non ouvert: aucun résultat inventé par la narration."]
    };
  }

  return {
    ...base,
    resultKind: "RESOLUTION_PROPOSED",
    characterExpression: buildCharacterExpression(rawInput, interpretation),
    preparedEffects: [{
      schemaVersion: 1,
      effectId: `${operation.operationId}:effect:observation:1`,
      effectType: "OBSERVATION_ONLY",
      targetRef: "scene:prototype-narration-surface",
      summary: "Observation locale proposée sans mutation durable.",
      commitEligible: false
    }],
    safetyNotes: [...base.safetyNotes, "Resolution proposée sans commit tant que le domaine scène complet n'est pas ouvert."]
  };
}

function buildSpeechCommitRequest(input: {
  campaignId: CampaignId;
  operation: OperationRecord;
  expectedCampaignRevision: number;
  writerLease: CommitRequest["writerLease"];
  resolution: NarrativeResolutionResultV1;
  loadedSceneState: LoadedReferenceSceneStateV1;
}): CommitRequest {
  const aggregateId = opaqueId<AggregateId>(`${input.operation.operationId}:speech-log`);
  const commandId = opaqueId<CommitRequest["acceptedCommands"][number]["commandId"]>(`${input.operation.operationId}:cmd:speech`);
  const eventId = opaqueId<EventId>(`${input.operation.operationId}:evt:speech`);
  const commitId = opaqueId<CommitId>(`${input.operation.operationId}:commit:speech`);
  const expression = input.resolution.characterExpression?.expressionText ?? "";
  const nextSceneState = applyReferenceSceneMutationV1({
    current: input.loadedSceneState.state,
    operationId: input.operation.operationId,
    interpretation: input.resolution.interpretation,
    resolution: input.resolution
  });
  const nextSceneRevision = input.loadedSceneState.aggregateRevision === null
    ? 0
    : input.loadedSceneState.aggregateRevision + 1;
  return {
    campaignId: input.campaignId,
    operationId: input.operation.operationId,
    commitId,
    idempotencyKey: input.operation.idempotencyKey as IdempotencyKey,
    requestFingerprint: input.operation.requestFingerprint,
    expectedCampaignRevision: input.expectedCampaignRevision,
    writerLease: input.writerLease,
    acceptedCommands: [{
      schemaVersion: 1,
      contractId: "narrative-resolution",
      contractVersion: 1,
      commandId,
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commandType: "social.speech-act.record",
      target: {
        aggregateType: "social.speech-act",
        aggregateId,
        expectedAggregateRevision: null
      },
      payloadSchemaVersion: 1,
      payload: {
        schemaVersion: 1,
        expression,
        source: "PLAYER_INTENT",
        noMechanicalSocialEffect: true
      },
      acceptedAtGameSecond: 0
    }],
    aggregateWrites: [{
      aggregateType: "social.speech-act",
      aggregateId,
      expectedAggregateRevision: null,
      payloadSchemaVersion: 1,
      payload: {
        schemaVersion: 1,
        operationId: input.operation.operationId,
        expression,
        semanticCommitments: [input.resolution.interpretation.coreMeaning],
        noMechanicalSocialEffect: true,
        version: 1
      }
    }, {
      aggregateType: REFERENCE_SCENE_STATE_AGGREGATE_TYPE_V1,
      aggregateId: REFERENCE_SCENE_STATE_AGGREGATE_ID_V1,
      expectedAggregateRevision: input.loadedSceneState.aggregateRevision,
      payloadSchemaVersion: 1,
      payload: nextSceneState
    }],
    events: [{
      schemaVersion: 1,
      eventId,
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      eventType: "social.speech-act.recorded",
      origin: "PLAYER_INTENT",
      causation: { kind: "COMMAND", id: commandId },
      aggregateRefs: [{
        aggregateType: "social.speech-act",
        aggregateId,
        aggregateRevision: 0
      }, {
        aggregateType: REFERENCE_SCENE_STATE_AGGREGATE_TYPE_V1,
        aggregateId: REFERENCE_SCENE_STATE_AGGREGATE_ID_V1,
        aggregateRevision: nextSceneRevision
      }],
      visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
      occurredAtGameSecond: 0,
      payloadSchemaVersion: 1,
      payload: {
        schemaVersion: 1,
        expression,
        noMechanicalSocialEffect: true
      }
    }, {
      schemaVersion: 1,
      eventId: opaqueId<EventId>(`${input.operation.operationId}:evt:scene-state`),
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      eventType: "scene.reference-state.updated",
      origin: "PLAYER_INTENT",
      causation: { kind: "COMMAND", id: commandId },
      aggregateRefs: [{
        aggregateType: REFERENCE_SCENE_STATE_AGGREGATE_TYPE_V1,
        aggregateId: REFERENCE_SCENE_STATE_AGGREGATE_ID_V1,
        aggregateRevision: nextSceneRevision
      }],
      visibility: { scope: "SYSTEM", actorIds: [] },
      occurredAtGameSecond: 0,
      payloadSchemaVersion: 1,
      payload: {
        schemaVersion: 1,
        sceneId: REFERENCE_PLAYABLE_SCENE_ID_V1,
        guardAddressed: nextSceneState.guardAddressed,
        backRoomDoorHighlighted: nextSceneState.backRoomDoorHighlighted,
        interactionCount: nextSceneState.interactionCount
      }
    }],
    outboxTasks: []
  };
}

function buildCharacterExpression(rawInput: string, interpretation: NarrativeIntentInterpretationV1): CharacterExpressionV1 {
  return {
    schemaVersion: 1,
    rawPlayerText: rawInput,
    interpretedIntentId: interpretation.intentId,
    expressionText: normalizeCharacterExpression(rawInput, interpretation.intentType),
    fidelity: "STYLE_NORMALIZED",
    addedCommitments: [],
    preservedMeaning: true
  };
}

function normalizeCharacterExpression(rawInput: string, intentType: NarrativeIntentInterpretationV1["intentType"]): string {
  const trimmed = rawInput.trim();
  const speechMatch = trimmed.match(/(?:je dis|je réponds|je reponds|je lui dis|je demande à|je demande a)\s*(?:que|:)?\s*(.+)$/iu);
  if (speechMatch?.[1]) {
    const content = speechMatch[1].replace(/^["«\s]+|["»\s]+$/gu, "").trim();
    if (content.length > 0) return `Je formule clairement : « ${content} »`;
  }
  if (intentType === "action") return `Je tente l'action décrite : ${trimmed}`;
  return trimmed;
}

function classifyHandoff(
  rawInput: string,
  interpretation: NarrativeIntentInterpretationV1
): { target: NarrativeHandoffTargetV1; reason: string } | null {
  const text = rawInput.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  if (/\b(attaque|attaquer|frappe|frapper|combat|tuer|poignarder)\b/u.test(text)) {
    return { target: "TACTICAL", reason: "Conflit violent potentiel: handoff tactique requis." };
  }
  if (/\b(repos|dormir|campement|se reposer)\b/u.test(text)) {
    return { target: "REST", reason: "Début de repos: moteur de repos requis." };
  }
  if (/\b(voler|vole|prendre|prends|ramasser|ramasse|acheter|achete|vendre|vends|donner|donne|equiper|équiper|equipe|équipe)\b/u.test(text)) {
    return { target: "INVENTORY", reason: "Mutation d'inventaire ou possession: domaine inventaire requis." };
  }
  if (/\b(creer|créer|nouveau pnj|nouveau lieu|intrigue|indice)\b/u.test(text)) {
    return { target: "DYNAMIC_CREATION", reason: "Création durable potentielle: promotion dédiée requise." };
  }
  if (interpretation.intentType === "mixed") {
    return { target: "UNOPENED_DOMAIN", reason: "Intention mixte: résolution complète différée." };
  }
  return null;
}

function buildResolutionDisplayPacket(
  operationId: OperationId,
  rawInput: string,
  resolution: NarrativeResolutionResultV1,
  sceneState?: ReferenceSceneStateV1
): DisplayPacketV1 & JsonObject {
  const blocks = [
    block(operationId, "raw", "RAW_INPUT", "Joueur", "PLAYER_CHARACTER", rawInput, [`operation:${operationId}:raw`])
  ];
  if (resolution.characterExpression !== null) {
    blocks.push(block(
      operationId,
      "expression",
      "PLAYER_EXPRESSION",
      "Personnage",
      "PLAYER_CHARACTER",
      resolution.characterExpression.expressionText,
      [`resolution:${resolution.resolutionId}:character-expression`]
    ));
  }
  blocks.push(...buildReferenceSceneBlocksV1({
    operationId,
    rawInput,
    interpretation: resolution.interpretation,
    resolution,
    sceneState
  }));
  blocks.push(block(
    operationId,
    "resolution",
    resolution.resultKind === "CLARIFICATION_REQUIRED" ? "CLARIFICATION" : "SYSTEM_NOTICE",
    "Système",
    "SYSTEM",
    resolutionNotice(resolution),
    [`resolution:${resolution.resolutionId}`]
  ));
  return {
    schemaVersion: 1,
    contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
    operationId,
    sceneId: REFERENCE_PLAYABLE_SCENE_ID_V1,
    displayBlocks: blocks,
    rawInputAccess: {
      available: true,
      operationId
    },
    rhythmDiagnostics: `narrative-resolution:${resolution.resultKind}|reference-scene:${REFERENCE_PLAYABLE_SCENE_ID_V1}`,
    reconstructionRefs: [`operation:${operationId}:raw`, `resolution:${resolution.resolutionId}`, `reference-scene:${REFERENCE_PLAYABLE_SCENE_ID_V1}`, `scene-state:${REFERENCE_PLAYABLE_SCENE_ID_V1}`],
    version: 1
  } as unknown as DisplayPacketV1 & JsonObject;
}

function block(
  operationId: OperationId,
  suffix: string,
  kind: RenderBlockKindV1,
  displayName: string,
  speakerKind: "PLAYER_CHARACTER" | "SYSTEM",
  text: string,
  sourceRefs: string[]
): DisplayPacketV1["displayBlocks"][number] {
  const speakerId = speakerKind === "SYSTEM" ? "speaker-system" : "speaker-player";
  return {
    blockId: `${operationId}:${suffix}`,
    kind,
    speaker: {
      speakerId,
      kind: speakerKind,
      displayName,
      roleLabel: speakerKind === "SYSTEM" ? "Notification système" : "Expression joueur",
      ariaLabel: speakerKind === "SYSTEM" ? "Notification système" : "Expression du personnage joueur",
      visualToken: speakerId
    },
    text,
    ariaLabel: `${displayName}: ${kind}`,
    roleLabel: speakerKind === "SYSTEM" ? "Notification système" : "Expression joueur",
    visualStyleToken: speakerId,
    sourceRefs,
    isDegradedFallback: false
  };
}

function resolutionNotice(resolution: NarrativeResolutionResultV1): string {
  if (resolution.resultKind === "CLARIFICATION_REQUIRED") {
    return "Clarification requise. Aucun temps de jeu ni commit métier n'a été déclenché.";
  }
  if (resolution.resultKind === "NO_COMMIT_RESPONSE") {
    return "Réponse sans commit métier. Aucune action n'a été exécutée.";
  }
  if (resolution.resultKind === "HANDOFF_REQUIRED") {
    return `${resolution.handoff?.reason ?? "Handoff requis."} Aucun résultat n'a été inventé par la narration.`;
  }
  if (resolution.resultKind === "COMMIT_APPLIED") {
    return "Parole enregistrée après commit métier borné. Aucun effet social mécanique supplémentaire n'a été ajouté.";
  }
  return "Résolution proposée sans commit métier.";
}
