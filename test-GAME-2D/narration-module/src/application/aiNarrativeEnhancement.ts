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
  resolution: NarrativeResolutionResultV1;
  config: AiNarrativeEnhancementConfigV1;
}): Promise<AiNarrativeEnhancementResultV1> {
  const original = cloneJson(input.displayPacket) as DisplayPacketV1 & JsonObject;
  const enhanced = cloneJson(input.displayPacket) as DisplayPacketV1 & JsonObject;
  const incidents: AiIncidentRecordV1[] = [];
  const safetyNotes: string[] = [];
  let changed = false;

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

  if (shouldCallSceneWriter(input.resolution)) {
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
        snapshotId: `${input.operationId}:snapshot:display`,
        packId: `${input.operationId}:pack:scene-writer`,
        role: "scene_writer",
        contractVersion: NARRATIVE_AI_RESOLUTION_CONTRACT_VERSION_V1,
        modelRouteId: input.config.sceneWriterRoute.routeId,
        contextFingerprint: "sha256:narrative-ai-scene-writer-fixture",
        idempotencyKey: `${input.operationId}:ai:scene-writer`,
        input: {
          instructionsRef: "narrative-ai-resolution/scene-writer/v1",
          roleContextPack: {},
          task: {
            resultKind: input.resolution.resultKind,
            handoff: input.resolution.handoff,
            committed: input.resolution.commitId !== null,
            allowedGrounding: [`resolution:${input.resolution.resolutionId}`],
            forbidden: ["success_without_commit", "combat_resolution", "inventory_mutation", "secret_reveal"]
          }
        },
        limits: {
          inputTokenBudget: 900,
          outputTokenBudget: 500,
          timeoutMs: input.config.sceneWriterRoute.timeoutMs
        }
      }
    });
    incidents.push(...sceneRun.incidents);
    const scenePayload = sceneRun.acceptedOutput?.payload as SceneWriterPayloadV1 | undefined;
    const narrativeBlocks = scenePayload?.narrationBlocks.filter(block => {
      return block.blockKind === "MJ_NARRATION"
        && block.content.trim().length > 0
        && block.groundedIn.includes(`resolution:${input.resolution.resolutionId}`)
        && !forbiddenNarrativeClaim(block.content);
    }) ?? [];
    if (narrativeBlocks.length > 0) {
      enhanced.displayBlocks.push(...narrativeBlocks.map((block, index) => aiNarrationBlock(input.operationId, block.content, sceneRun.acceptedOutput?.outputId ?? "unknown", index)));
      enhanced.rhythmDiagnostics = `${enhanced.rhythmDiagnostics ?? "none"}|ai-scene-writer`;
      enhanced.reconstructionRefs = [...enhanced.reconstructionRefs, `ai-output:${sceneRun.acceptedOutput?.outputId ?? "unknown"}`];
      changed = true;
      safetyNotes.push("Narration MJ ajoutée uniquement comme texture ancrée.");
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
      safetyNotes: incidents.length > 0 ? ["Fallback déterministe conservé."] : safetyNotes
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

function shouldCallSceneWriter(resolution: NarrativeResolutionResultV1): boolean {
  if (resolution.resultKind === "NO_COMMIT_RESPONSE") return false;
  return resolution.commitId !== null
    || resolution.characterExpression !== null
    || resolution.handoff !== null
    || resolution.resultKind === "CLARIFICATION_REQUIRED";
}

function forbiddenNarrativeClaim(text: string): boolean {
  return /\b(tu reussis|tu réussis|tu echoues|tu échoues|il est mort|combat termine|combat terminé|tu prends|tu voles|dans ton inventaire)\b/iu.test(text);
}
