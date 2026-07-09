import { cloneJson, type JsonObject } from "../core";
import type { ContractAiProviderV1 } from "../ai/FakeContractAiProvider";
import { runAiPipelineCallV1 } from "../ai/pipeline";
import type {
  AiIncidentRecordV1,
  AiModelRouteV1,
  AiRetryPolicyV1,
  PlayerExpressionPayloadV1,
  SceneWriterPayloadV1
} from "../ai/types";
import type { DisplayBlockV1, DisplayPacketV1 } from "../scene";
import type { NarrativeResolutionResultV1 } from "./narrativeResolution";
import {
  buildReferenceSceneWriterContextPackV1,
  buildReferenceSceneWriterTaskV1,
  REFERENCE_PLAYABLE_SCENE_ID_V1
} from "./referenceScene";
import type { ReferenceSceneStateV1 } from "./referenceSceneState";

export const NARRATIVE_AI_RESOLUTION_CONTRACT_VERSION_V1 = "narrative-ai-resolution/1" as const;

export interface AiNarrativeEnhancementConfigV1 {
  provider: ContractAiProviderV1;
  expressionRoute: AiModelRouteV1;
  sceneWriterRoute: AiModelRouteV1;
  retryPolicy: AiRetryPolicyV1;
}

export interface AiNarrativeEnhancementResultV1 {
  schemaVersion: 1;
  contractVersion: typeof NARRATIVE_AI_RESOLUTION_CONTRACT_VERSION_V1;
  enhanced: boolean;
  usedFallback: boolean;
  displayPacket: DisplayPacketV1 & JsonObject;
  incidents: AiIncidentRecordV1[];
  safetyNotes: string[];
}

export async function enhanceNarrativeDisplayWithAiV1(input: {
  campaignId: string;
  operationId: string;
  displayPacket: DisplayPacketV1 & JsonObject;
  priorDisplayPackets?: DisplayPacketV1[];
  resolution: NarrativeResolutionResultV1;
  sceneState?: ReferenceSceneStateV1;
  config: AiNarrativeEnhancementConfigV1;
}): Promise<AiNarrativeEnhancementResultV1> {
  const original = cloneJson(input.displayPacket) as DisplayPacketV1 & JsonObject;
  const enhanced = cloneJson(input.displayPacket) as DisplayPacketV1 & JsonObject;
  const incidents: AiIncidentRecordV1[] = [];
  const safetyNotes: string[] = [];
  let changed = false;
  let sceneWriterAttempted = false;

  if (input.resolution.characterExpression !== null) {
    const expressionRun = await runAiPipelineCallV1({
      provider: input.config.provider,
      route: input.config.expressionRoute,
      retryPolicy: input.config.retryPolicy,
      request: {
        schemaVersion: 1,
        callId: `${input.operationId}:ai:expression:call`,
        operationId: input.operationId,
        attemptId: `${input.operationId}:ai:expression:attempt:1`,
        campaignId: input.campaignId,
        snapshotId: `${input.operationId}:snapshot:display`,
        packId: `${input.operationId}:pack:expression`,
        role: "player_expression_adapter",
        contractVersion: NARRATIVE_AI_RESOLUTION_CONTRACT_VERSION_V1,
        modelRouteId: input.config.expressionRoute.routeId,
        contextFingerprint: "sha256:narrative-ai-expression-fixture",
        idempotencyKey: `${input.operationId}:ai:expression`,
        input: {
          instructionsRef: "narrative-ai-resolution/player-expression-adapter/v1",
          roleContextPack: {},
          task: {
            rawPlayerText: input.resolution.characterExpression.rawPlayerText,
            deterministicExpression: input.resolution.characterExpression.expressionText,
            coreMeaning: input.resolution.interpretation.coreMeaning,
            forbidden: ["added_goal", "added_risk", "new_action", "new_knowledge"]
          }
        },
        limits: {
          inputTokenBudget: 800,
          outputTokenBudget: 400,
          timeoutMs: input.config.expressionRoute.timeoutMs
        }
      }
    });
    incidents.push(...expressionRun.incidents);
    const payload = expressionRun.acceptedOutput?.payload as PlayerExpressionPayloadV1 | undefined;
    if (payload && payload.safeToUse === true && payload.addedMeaning.length === 0 && payload.renderedExpression.trim().length > 0) {
      const expressionBlock = enhanced.displayBlocks.find(block => block.kind === "PLAYER_EXPRESSION");
      if (expressionBlock) {
        expressionBlock.text = payload.renderedExpression;
        expressionBlock.sourceRefs = [...expressionBlock.sourceRefs, `ai-output:${expressionRun.acceptedOutput?.outputId}`];
        changed = true;
        safetyNotes.push("Expression PJ enrichie par IA sans ajout de sens.");
      }
    }
  }

  if (shouldCallSceneWriter(input.resolution, input.displayPacket)) {
    sceneWriterAttempted = true;
    const snapshotId = `${input.operationId}:snapshot:display`;
    const packId = `${input.operationId}:pack:scene-writer`;
    const sceneContextPack = await buildReferenceSceneWriterContextPackV1({
      campaignId: input.campaignId,
      operationId: input.operationId,
      packId,
      snapshotId,
      rawInput: findRawInput(input.displayPacket),
      interpretation: input.resolution.interpretation,
      resolution: input.resolution,
      sceneState: input.sceneState,
      priorDisplayPackets: input.priorDisplayPackets
    });
    const sceneTask = buildReferenceSceneWriterTaskV1({
      rawInput: findRawInput(input.displayPacket),
      interpretation: input.resolution.interpretation,
      resolution: input.resolution
    });
    const sceneRun = await runAiPipelineCallV1({
      provider: input.config.provider,
      route: input.config.sceneWriterRoute,
      retryPolicy: input.config.retryPolicy,
      request: {
        schemaVersion: 1,
        callId: `${input.operationId}:ai:scene-writer:call`,
        operationId: input.operationId,
        attemptId: `${input.operationId}:ai:scene-writer:attempt:1`,
        campaignId: input.campaignId,
        snapshotId,
        packId,
        role: "scene_writer",
        contractVersion: NARRATIVE_AI_RESOLUTION_CONTRACT_VERSION_V1,
        modelRouteId: input.config.sceneWriterRoute.routeId,
        contextFingerprint: sceneContextPack.packFingerprint,
        idempotencyKey: `${input.operationId}:ai:scene-writer`,
        input: {
          instructionsRef: "narrative-ai-resolution/scene-writer/reference-scene/v1",
          roleContextPack: sceneContextPack,
          task: sceneTask
        },
        limits: {
          inputTokenBudget: 900,
          outputTokenBudget: 1_200,
          timeoutMs: input.config.sceneWriterRoute.timeoutMs
        }
      }
    });
    incidents.push(...sceneRun.incidents);
    const scenePayload = sceneRun.acceptedOutput?.payload as SceneWriterPayloadV1 | undefined;
    const assessedBlocks = scenePayload?.narrationBlocks.map(block => assessSceneWriterBlock(block, sceneTask.allowedGrounding)) ?? [];
    const narrativeBlocks = assessedBlocks
      .filter(result => result.usable)
      .map(result => result.block);
    if (narrativeBlocks.length > 0) {
      applySceneWriterNarration({
        packet: enhanced,
        resolution: input.resolution,
        blocks: narrativeBlocks,
        outputId: sceneRun.acceptedOutput?.outputId ?? "unknown"
      });
      enhanced.rhythmDiagnostics = `${enhanced.rhythmDiagnostics ?? "none"}|ai-scene-writer`;
      enhanced.reconstructionRefs = [
        ...enhanced.reconstructionRefs,
        `ai-output:${sceneRun.acceptedOutput?.outputId ?? "unknown"}`,
        `ai-context:${sceneContextPack.packId}`,
        `reference-scene:${REFERENCE_PLAYABLE_SCENE_ID_V1}`
      ];
      changed = true;
      safetyNotes.push("Narration MJ ajoutée uniquement comme texture ancrée dans la scène de référence.");
    } else {
      const reasons = [...new Set(assessedBlocks.flatMap(result => result.rejectionReasons))];
      safetyNotes.push(
        reasons.length > 0
          ? `Scene writer appelé, mais aucun bloc MJ utilisable n'a passé les garde-fous de rendu: ${reasons.join(", ")}.`
          : "Scene writer appelé, mais aucun bloc MJ utilisable n'a passé les garde-fous de rendu."
      );
    }
  } else {
    safetyNotes.push("Scene writer non appelé: aucune matière fictionnelle autorisée pour ce résultat sans commit.");
  }

  if (!changed) {
    return {
      schemaVersion: 1,
      contractVersion: NARRATIVE_AI_RESOLUTION_CONTRACT_VERSION_V1,
      enhanced: false,
      usedFallback: incidents.length > 0,
      displayPacket: original,
      incidents,
      safetyNotes: incidents.length > 0
        ? [
          "Fallback déterministe conservé.",
          ...(sceneWriterAttempted ? ["Scene writer appelé avant fallback."] : [])
        ]
        : safetyNotes
    };
  }

  return {
    schemaVersion: 1,
    contractVersion: NARRATIVE_AI_RESOLUTION_CONTRACT_VERSION_V1,
    enhanced: true,
    usedFallback: false,
    displayPacket: enhanced,
    incidents,
    safetyNotes
  };
}

function aiNarrationBlock(operationId: string, text: string, outputId: string, index: number): DisplayBlockV1 {
  return {
    blockId: `${operationId}:ai-narration:${index + 1}`,
    kind: "GM_NARRATION",
    speaker: {
      speakerId: "speaker-gm",
      kind: "GM",
      displayName: "MJ",
      roleLabel: "Narration",
      ariaLabel: "Narration du maître de jeu",
      visualToken: "speaker-gm"
    },
    text,
    ariaLabel: "MJ: GM_NARRATION",
    roleLabel: "Narration",
    visualStyleToken: "speaker-gm",
    sourceRefs: [`ai-output:${outputId}`],
    isDegradedFallback: false
  };
}

function applySceneWriterNarration(input: {
  packet: DisplayPacketV1 & JsonObject;
  resolution: NarrativeResolutionResultV1;
  blocks: Array<{ content: string }>;
  outputId: string;
}): void {
  const aiBlocks = input.blocks.map((block, index) =>
    aiNarrationBlock(input.resolution.operationId, block.content, input.outputId, index)
  );
  if (isNoCommitSceneContext(input.resolution, input.packet)) {
    let replacementIndex = 0;
    input.packet.displayBlocks = input.packet.displayBlocks.map(block => {
      if (
        block.kind === "GM_NARRATION" &&
        block.sourceRefs.some(ref => ref.includes(":meta-answer")) &&
        replacementIndex < aiBlocks.length
      ) {
        const aiBlock = aiBlocks[replacementIndex];
        replacementIndex += 1;
        return {
          ...block,
          text: aiBlock.text,
          sourceRefs: [...new Set([...block.sourceRefs, ...aiBlock.sourceRefs])]
        };
      }
      return block;
    });
    if (replacementIndex < aiBlocks.length) input.packet.displayBlocks.push(...aiBlocks.slice(replacementIndex));
    return;
  }
  input.packet.displayBlocks.push(...aiBlocks);
}

function shouldCallSceneWriter(resolution: NarrativeResolutionResultV1, displayPacket: DisplayPacketV1): boolean {
  if (resolution.resultKind === "NO_COMMIT_RESPONSE") return isNoCommitSceneContext(resolution, displayPacket);
  return resolution.commitId !== null
    || resolution.characterExpression !== null
    || resolution.handoff !== null
    || resolution.resultKind === "CLARIFICATION_REQUIRED";
}

function isNoCommitSceneContext(resolution: NarrativeResolutionResultV1, displayPacket: DisplayPacketV1): boolean {
  return resolution.resultKind === "NO_COMMIT_RESPONSE" &&
    resolution.interpretation.intentType === "meta_question" &&
    resolution.noGameTime === true &&
    displayPacket.displayBlocks.some(block =>
      block.kind === "GM_NARRATION" &&
      block.sourceRefs.some(ref => ref.includes(":meta-answer"))
    );
}

function findRawInput(displayPacket: DisplayPacketV1): string {
  return displayPacket.displayBlocks.find(block => block.kind === "RAW_INPUT")?.text ?? "";
}

function assessSceneWriterBlock(
  block: SceneWriterPayloadV1["narrationBlocks"][number],
  allowedGrounding: string[]
): {
  usable: boolean;
  block: SceneWriterPayloadV1["narrationBlocks"][number];
  rejectionReasons: string[];
} {
  const rejectionReasons: string[] = [];
  if (block.blockKind !== "MJ_NARRATION") rejectionReasons.push(`blockKind=${block.blockKind}`);
  if (block.content.trim().length === 0) rejectionReasons.push("content_empty");
  if (!hasAnyAllowedGrounding(block.groundedIn, allowedGrounding)) rejectionReasons.push("grounding_missing_allowed_ref");
  rejectionReasons.push(...factDisciplineRejectionReasons(block.factDiscipline));
  rejectionReasons.push(...forbiddenNarrativeClaimReasons(block.content));
  return {
    usable: rejectionReasons.length === 0,
    block,
    rejectionReasons
  };
}

function hasAnyAllowedGrounding(groundedIn: string[], allowedGrounding: string[]): boolean {
  return groundedIn.length > 0 && groundedIn.some(ref => allowedGrounding.includes(ref));
}

function factDisciplineRejectionReasons(
  factDiscipline: SceneWriterPayloadV1["narrationBlocks"][number]["factDiscipline"]
): string[] {
  if (!factDiscipline) return [];
  const reasons: string[] = [];
  if (factDiscipline.addedUnsupportedFacts.length > 0) reasons.push("fact_discipline_added_unsupported_facts");
  if (factDiscipline.usesOnlyProvidedVisibleEntities !== true) reasons.push("fact_discipline_unknown_visible_entity");
  if (factDiscipline.noNewEvents !== true) reasons.push("fact_discipline_new_event");
  if (factDiscipline.noHiddenPresence !== true) reasons.push("fact_discipline_hidden_presence");
  return reasons;
}

function forbiddenNarrativeClaimReasons(text: string): string[] {
  const normalized = text.toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’`´]/gu, "'");
  const reasons: string[] = [];
  if (/\b(tu reussis|tu echoues|il est mort|combat termine|tu prends|tu voles|dans ton inventaire)\b/u.test(normalized)) {
    reasons.push("forbidden_resolution_claim");
  }
  if (/\b(porte d entree|porte d'entree|porte principale|porte de l auberge)\b.{0,120}\b(s ouvre|s'ouvre|s entrouvre|s'entrouvre|grince|claque)\b/u.test(normalized)) {
    reasons.push("forbidden_unsourced_dynamic_event");
  }
  if (/\b(absents de la piece|discretement dissimules|discretement dissimulees|dissimules|dissimulees|caches|cachees|tapies|tapis dans l ombre)\b/u.test(normalized)) {
    reasons.push("forbidden_unsourced_hidden_presence");
  }
  if (/\b(quelqu un entre|quelqu'un entre|un inconnu entre|des silhouettes entrent|la porte s ouvre)\b/u.test(normalized)) {
    reasons.push("forbidden_unsourced_arrival");
  }
  return [...new Set(reasons)];
}
