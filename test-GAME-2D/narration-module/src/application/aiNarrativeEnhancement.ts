import { cloneJson, computeJsonFingerprint, type JsonObject } from "../core";
import type { ContractAiProviderV1 } from "../ai/FakeContractAiProvider";
import { runAiPipelineCallV1 } from "../ai/pipeline";
import type {
  AiIncidentRecordV1,
  AiCallTelemetryV1,
  AiModelRouteV1,
  AiRetryPolicyV1,
  CoherenceCriticPayloadV1,
  MjPlannerPayloadV1,
  PlayerExpressionPayloadV1,
  SceneWriterPayloadV1
} from "../ai/types";
import type { DisplayBlockV1, DisplayPacketV1 } from "../scene";
import type { NarrativeResolutionResultV1 } from "./narrativeResolution";
import {
  REFERENCE_PLAYABLE_SCENE_ID_V1
} from "./referenceScene";
import type { ReferenceSceneStateV1 } from "./referenceSceneState";
import { REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1, type PlayableSceneStateV1 } from "./playableScene";
import { buildActiveSceneContextPackV1, buildActiveSceneNarrativeBriefV1, validateActiveSceneNarrativeCandidateV1 } from "./activeSceneNarrative";

export const NARRATIVE_AI_RESOLUTION_CONTRACT_VERSION_V1 = "narrative-ai-resolution/1" as const;

export interface AiNarrativeEnhancementConfigV1 {
  provider: ContractAiProviderV1;
  expressionRoute: AiModelRouteV1;
  sceneWriterRoute: AiModelRouteV1;
  coherenceCriticRoute?: AiModelRouteV1;
  useRemoteExpressionAdapter?: boolean;
  retryPolicy: AiRetryPolicyV1;
}

export interface AiNarrativeEnhancementResultV1 {
  schemaVersion: 1;
  contractVersion: typeof NARRATIVE_AI_RESOLUTION_CONTRACT_VERSION_V1;
  enhanced: boolean;
  usedFallback: boolean;
  fallbackKind: "NONE" | "TECHNICAL_INCIDENT" | "RENDER_AUTHORITY_REJECTION";
  displayPacket: DisplayPacketV1 & JsonObject;
  incidents: AiIncidentRecordV1[];
  telemetry?: AiCallTelemetryV1[];
  safetyNotes: string[];
}

export async function enhanceNarrativeDisplayWithAiV1(input: {
  campaignId: string;
  operationId: string;
  displayPacket: DisplayPacketV1 & JsonObject;
  priorDisplayPackets?: DisplayPacketV1[];
  resolution: NarrativeResolutionResultV1;
  mjPlan?: (MjPlannerPayloadV1 & JsonObject) | null;
  sceneState?: ReferenceSceneStateV1;
  activeScene?: PlayableSceneStateV1;
  config: AiNarrativeEnhancementConfigV1;
}): Promise<AiNarrativeEnhancementResultV1> {
  const original = cloneJson(input.displayPacket) as DisplayPacketV1 & JsonObject;
  const enhanced = cloneJson(input.displayPacket) as DisplayPacketV1 & JsonObject;
  const incidents: AiIncidentRecordV1[] = [];
  const telemetry: AiCallTelemetryV1[] = [];
  const safetyNotes: string[] = [];
  let changed = false;
  let sceneWriterAttempted = false;
  let renderFallbackUsed = false;

  if (input.resolution.characterExpression !== null && input.config.useRemoteExpressionAdapter !== false) {
    const expressionContext = {
      schemaVersion: 1,
      intentId: input.resolution.interpretation.intentId,
      authority: "EXPRESSION_ONLY"
    } satisfies JsonObject;
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
        contextFingerprint: await computeJsonFingerprint(expressionContext) as `sha256:${string}`,
        idempotencyKey: `${input.operationId}:ai:expression`,
        input: {
          instructionsRef: "narrative-ai-resolution/player-expression-adapter/v1",
          roleContextPack: expressionContext,
          task: {
            rawPlayerText: input.resolution.characterExpression.rawPlayerText,
            deterministicExpression: input.resolution.characterExpression.expressionText,
            coreMeaning: input.resolution.interpretation.semanticIntent.playerGoal,
            forbidden: ["added_goal", "added_risk", "new_action", "new_knowledge"]
          }
        },
        limits: {
          inputTokenBudget: 800,
          outputTokenBudget: 800,
          timeoutMs: input.config.expressionRoute.timeoutMs
        }
      }
    });
    incidents.push(...expressionRun.incidents);
    telemetry.push(...expressionRun.telemetry);
    const payload = expressionRun.acceptedOutput?.payload as PlayerExpressionPayloadV1 | undefined;
    if (payload && payload.safeToUse === true && payload.addedMeaning.length === 0 && payload.renderedExpression.trim().length > 0) {
      let expressionAuthorized = true;
      if (input.config.coherenceCriticRoute) {
        const renderAuthority = buildPlayerExpressionRenderAuthorityV1(input.resolution, input.displayPacket);
        const criticContext = { renderAuthority } satisfies JsonObject;
        const criticRun = await runAiPipelineCallV1({
          provider: input.config.provider,
          route: input.config.coherenceCriticRoute,
          retryPolicy: { ...input.config.retryPolicy, role: "coherence_critic" },
          request: {
            schemaVersion: 1,
            callId: `${input.operationId}:ai:expression-critic:call`,
            operationId: input.operationId,
            attemptId: `${input.operationId}:ai:expression-critic:attempt:1`,
            campaignId: input.campaignId,
            snapshotId: `${input.operationId}:snapshot:display`,
            packId: `${input.operationId}:pack:expression:critic`,
            role: "coherence_critic",
            contractVersion: NARRATIVE_AI_RESOLUTION_CONTRACT_VERSION_V1,
            modelRouteId: input.config.coherenceCriticRoute.routeId,
            contextFingerprint: await computeJsonFingerprint(criticContext) as `sha256:${string}`,
            idempotencyKey: `${input.operationId}:ai:expression-critic`,
            input: {
              instructionsRef: "narrative-ai-resolution/coherence-critic/player-expression-authority/v1",
              roleContextPack: criticContext,
              task: {
                candidateNarration: [payload.renderedExpression],
                renderAuthority
              }
            },
            limits: {
              inputTokenBudget: 700,
              outputTokenBudget: Math.min(1_600, input.config.coherenceCriticRoute.outputTokenLimit),
              timeoutMs: input.config.coherenceCriticRoute.timeoutMs
            }
          }
        });
        incidents.push(...criticRun.incidents);
        telemetry.push(...criticRun.telemetry);
        const critic = criticRun.acceptedOutput?.payload as CoherenceCriticPayloadV1 | undefined;
        expressionAuthorized = Boolean(critic && critic.verdict === "PASS" && !critic.findings.some(finding => finding.severity === "BLOCKING"));
        if (!expressionAuthorized) {
          renderFallbackUsed = true;
          safetyNotes.push(`Expression PJ IA rejetée par le contrôle sémantique d'autorité: ${critic?.verdict ?? "NO_USABLE_VERDICT"}.`);
        } else {
          safetyNotes.push("Expression PJ IA validée par le contrôle sémantique non autoritaire.");
        }
      }
      const expressionBlock = enhanced.displayBlocks.find(block => block.kind === "PLAYER_EXPRESSION");
      if (expressionBlock && expressionAuthorized) {
        expressionBlock.text = payload.renderedExpression;
        expressionBlock.sourceRefs = [...expressionBlock.sourceRefs, `ai-output:${expressionRun.acceptedOutput?.outputId}`];
        changed = true;
        safetyNotes.push("Expression PJ enrichie par IA sans ajout de sens.");
      }
    }
  } else if (input.resolution.characterExpression !== null) {
    safetyNotes.push("Expression joueur locale conservée: le rendu déterministe est déjà fidèle et ne nécessite aucun appel distant.");
  }

  if (shouldCallSceneWriterV1(input.resolution, input.displayPacket)) {
    sceneWriterAttempted = true;
    const snapshotId = `${input.operationId}:snapshot:display`;
    const packId = `${input.operationId}:pack:scene-writer`;
    const activeScene = input.activeScene ?? REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1;
    const sceneTask = buildActiveSceneNarrativeBriefV1({
      rawInput: findRawInput(input.displayPacket),
      interpretation: input.resolution.interpretation,
      resolution: input.resolution,
      activeScene,
      priorDisplayPackets: input.priorDisplayPackets,
      displayPacket: input.displayPacket
    });
    const baseSceneContextPack = await buildActiveSceneContextPackV1({
      campaignId: input.campaignId,
      operationId: input.operationId,
      packId,
      snapshotId,
      activeScene,
      brief: sceneTask,
      priorDisplayPackets: input.priorDisplayPackets
    });
    const sceneContextPack = {
      ...baseSceneContextPack,
      mjPlan: input.mjPlan ?? null
    } as unknown as JsonObject;
    const sceneContextFingerprint =
      await computeJsonFingerprint(sceneContextPack) as `sha256:${string}`;
    const renderAuthority = buildNarrativeRenderAuthorityV1(input.resolution, input.displayPacket);
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
        contextFingerprint: sceneContextFingerprint,
        idempotencyKey: `${input.operationId}:ai:scene-writer`,
        input: {
          instructionsRef: "narrative-ai-resolution/scene-writer/active-scene/v1",
          roleContextPack: sceneContextPack,
          task: {
            ...sceneTask,
            mjPlan: input.mjPlan ?? null,
            renderAuthority
          }
        },
        limits: {
          inputTokenBudget: 900,
          outputTokenBudget: Math.min(1_500, input.config.sceneWriterRoute.outputTokenLimit),
          timeoutMs: input.config.sceneWriterRoute.timeoutMs
        }
      }
    });
    incidents.push(...sceneRun.incidents);
    telemetry.push(...sceneRun.telemetry);
    const scenePayload = sceneRun.acceptedOutput?.payload as SceneWriterPayloadV1 | undefined;
    const assessedBlocks = scenePayload?.narrationBlocks.map(block => {
      const assessed = assessSceneWriterBlock(block, sceneTask.allowedGrounding);
      const activeGate = input.activeScene === undefined
        ? { ok: true as const }
        : validateActiveSceneNarrativeCandidateV1({ brief: sceneTask, groundedIn: block.groundedIn, factDiscipline: block.factDiscipline });
      return activeGate.ok
        ? assessed
        : { ...assessed, usable: false, rejectionReasons: [...assessed.rejectionReasons, ...activeGate.issues] };
    }) ?? [];
    let narrativeBlocks = assessedBlocks
      .filter(result => result.usable)
      .map(result => result.block);
    const coverageRejectionReasons: string[] = [];
    if (
      sceneTask.requiredNarrativeGroundingAnyOf.length > 0 &&
      !narrativeBlocks.some(block => block.groundedIn.some(ref => sceneTask.requiredNarrativeGroundingAnyOf.includes(ref)))
    ) {
      narrativeBlocks = [];
      coverageRejectionReasons.push("required_narrative_coverage_missing");
      renderFallbackUsed = true;
    }
    if (
      narrativeBlocks.length > 0 &&
      sceneTask.requiredNarrativeMentionAnyOf.length > 0 &&
      !narrativeBlocks.some(block => sceneTask.requiredNarrativeMentionAnyOf.some(mention =>
        normalizeNarrativeCoverageText(block.content).includes(normalizeNarrativeCoverageText(mention))
      ))
    ) {
      narrativeBlocks = [];
      coverageRejectionReasons.push("required_narrative_mention_missing");
      renderFallbackUsed = true;
    }
    if (
      narrativeBlocks.length > 0 &&
      input.config.coherenceCriticRoute &&
      requiresNarrativeCoherenceCriticV1(renderAuthority)
    ) {
      const criticRun = await runAiPipelineCallV1({
        provider: input.config.provider,
        route: input.config.coherenceCriticRoute,
        retryPolicy: { ...input.config.retryPolicy, role: "coherence_critic" },
        request: {
          schemaVersion: 1,
          callId: `${input.operationId}:ai:coherence-critic:call`,
          operationId: input.operationId,
          attemptId: `${input.operationId}:ai:coherence-critic:attempt:1`,
          campaignId: input.campaignId,
          snapshotId,
          packId: `${packId}:critic`,
          role: "coherence_critic",
          contractVersion: NARRATIVE_AI_RESOLUTION_CONTRACT_VERSION_V1,
          modelRouteId: input.config.coherenceCriticRoute.routeId,
          contextFingerprint: sceneContextFingerprint,
          idempotencyKey: `${input.operationId}:ai:coherence-critic`,
          input: {
            instructionsRef: "narrative-ai-resolution/coherence-critic/render-authority/v1",
            roleContextPack: { renderAuthority },
            task: {
              candidateNarration: narrativeBlocks.map(block => block.content),
              renderAuthority
            }
          },
          limits: {
            inputTokenBudget: 900,
            outputTokenBudget: Math.min(1_600, input.config.coherenceCriticRoute.outputTokenLimit),
            timeoutMs: input.config.coherenceCriticRoute.timeoutMs
          }
        }
      });
      incidents.push(...criticRun.incidents);
      telemetry.push(...criticRun.telemetry);
      const critic = criticRun.acceptedOutput?.payload as CoherenceCriticPayloadV1 | undefined;
      if (!critic || critic.verdict !== "PASS" || critic.findings.some(finding => finding.severity === "BLOCKING")) {
        narrativeBlocks = [];
        renderFallbackUsed = true;
        safetyNotes.push(`Narration IA rejetée par le contrôle sémantique d'autorité: ${critic?.verdict ?? "NO_USABLE_VERDICT"}.`);
      } else {
        safetyNotes.push("Narration IA validée par le contrôle sémantique non autoritaire.");
      }
    }
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
        `playable-scene:${activeScene.sceneId}:${activeScene.version}`
      ];
      changed = true;
      safetyNotes.push(`Narration MJ ajoutée uniquement comme texture ancrée dans la scène active ${activeScene.sceneId}.`);
    } else {
      const reasons = [...new Set([
        ...assessedBlocks.flatMap(result => result.rejectionReasons),
        ...coverageRejectionReasons
      ])];
      safetyNotes.push(
        reasons.length > 0
          ? `Scene writer appelé, mais aucun bloc MJ utilisable n'a passé les garde-fous de rendu: ${reasons.join(", ")}.`
          : "Scene writer appelé, mais aucun bloc MJ utilisable n'a passé les garde-fous de rendu."
      );
    }
  } else if (isImmediateVisibleOrientationResolutionV1(input.resolution)) {
    safetyNotes.push("Scene writer non appelé: orientation immédiate vers une présence déjà visible; narration déterministe conservée.");
  } else {
    safetyNotes.push("Scene writer non appelé: aucune matière fictionnelle autorisée pour ce résultat sans commit.");
  }

  if (!changed) {
    return {
      schemaVersion: 1,
      contractVersion: NARRATIVE_AI_RESOLUTION_CONTRACT_VERSION_V1,
      enhanced: false,
      usedFallback: incidents.length > 0 || renderFallbackUsed,
      fallbackKind: incidents.length > 0
        ? "TECHNICAL_INCIDENT"
        : renderFallbackUsed
          ? "RENDER_AUTHORITY_REJECTION"
          : "NONE",
      displayPacket: original,
      incidents,
      telemetry,
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
    usedFallback: incidents.length > 0 || renderFallbackUsed,
    fallbackKind: incidents.length > 0
      ? "TECHNICAL_INCIDENT"
      : renderFallbackUsed
        ? "RENDER_AUTHORITY_REJECTION"
        : "NONE",
    displayPacket: enhanced,
    incidents,
    telemetry,
    safetyNotes
  };
}

/**
 * The critic is a targeted semantic defense, not a mandatory second writer.
 * Broad visible perception and reversible positioning beside a visible actor
 * already have a closed positive authority and no durable consequence.
 */
export function requiresNarrativeCoherenceCriticV1(authority: NarrativeRenderAuthorityV1): boolean {
  if (authority.mode === "OBSERVATION_RESULT") return authority.targetRef !== null;
  if (authority.mode === "ACTION_STAGING_ONLY") {
    return authority.targetRef === null || !authority.targetRef.startsWith("npc:");
  }
  return true;
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
  const firstGmIndex = input.packet.displayBlocks.findIndex(block => block.kind === "GM_NARRATION");
  const systemIndex = input.packet.displayBlocks.findIndex(block => block.kind === "SYSTEM_NOTICE" || block.kind === "CLARIFICATION");
  const insertionIndex = firstGmIndex >= 0
    ? firstGmIndex
    : systemIndex >= 0
      ? systemIndex
      : input.packet.displayBlocks.length;
  const replacedRefs = input.packet.displayBlocks
    .filter(block => block.kind === "GM_NARRATION")
    .flatMap(block => block.sourceRefs);
  const finalAiBlocks = aiBlocks.map(block => ({
    ...block,
    sourceRefs: [...new Set([...replacedRefs, ...block.sourceRefs])]
  }));
  input.packet.displayBlocks = input.packet.displayBlocks.filter(block => block.kind !== "GM_NARRATION");
  input.packet.displayBlocks.splice(insertionIndex, 0, ...finalAiBlocks);
}

export function shouldCallSceneWriterV1(
  resolution: NarrativeResolutionResultV1,
  displayPacket: DisplayPacketV1
): boolean {
  if (displayPacket.displayBlocks.some(block => block.kind === "NPC_SPEECH")) return false;
  if (isImmediateVisibleOrientationResolutionV1(resolution)) return false;
  if (resolution.resultKind === "NO_COMMIT_RESPONSE") return isNoCommitSceneContext(resolution, displayPacket);
  return resolution.commitId !== null
    || resolution.characterExpression !== null
    || resolution.handoff !== null
    || resolution.resultKind === "CLARIFICATION_REQUIRED";
}

export function isImmediateVisibleOrientationResolutionV1(
  resolution: NarrativeResolutionResultV1
): boolean {
  const semantic = resolution.interpretation.semanticIntent;
  const target = resolution.interpretation.referentResolution?.resolvedTarget ?? semantic.target ?? null;
  return semantic.kind === "observe_environment" &&
    semantic.composition?.orderedComponents.some(component => component.kind === "LOCATE_VISIBLE_TARGET") === true &&
    semantic.perception?.informationKind === "PRESENCE" &&
    semantic.perception.depth === "GLANCE" &&
    target?.ref !== null &&
    target?.ref !== undefined &&
    resolution.actionAdjudication?.disposition === "AUTOMATIC_SUCCESS" &&
    resolution.actionAdjudication.resolutionScope === "OBSERVATION_RESULT" &&
    resolution.perception?.status === "AUTOMATIC_RESULT" &&
    resolution.perception.checkProposal === null;
}

export interface NarrativeRenderAuthorityV1 extends JsonObject {
  schemaVersion: 1;
  renderPlanVersion: "narrative-render-plan/1";
  mode: "PLAYER_EXPRESSION_FIDELITY" | "OBSERVATION_RESULT" | "ACTION_STAGING_ONLY" | "SCENE_TRANSITION" | "CONFIRMED_OUTCOME" | "NPC_REACTION";
  semanticGoal: string;
  targetRef: string | null;
  perspective: "FIRST_PERSON_PLAYER" | "SECOND_PERSON_PLAYER" | "THIRD_PERSON_ACTOR";
  allowedClaims: NarrativeRenderClaimV1[];
  allowedActorReactionRefs: string[];
  texturePolicy: NarrativeEphemeralTexturePolicyV1;
  confirmedClaims: string[];
  unconfirmedClaims: string[];
  forbiddenClaims: string[];
  sourceRefs: string[];
}

export interface NarrativeRenderClaimV1 extends JsonObject {
  schemaVersion: 1;
  claimId: string;
  category: "SOURCE_FACT" | "CONFIRMED_RESULT" | "ATTRIBUTED_SPEECH";
  text: string;
  sourceRefs: string[];
}

export interface NarrativeEphemeralTexturePolicyV1 extends JsonObject {
  schemaVersion: 1;
  allowed: boolean;
  lifetime: "TURN_ONLY";
  reusableAsFact: false;
  persistToMemory: false;
  mayAffectRules: false;
  allowedUses: string[];
  forbiddenUses: string[];
}

export function buildPlayerExpressionRenderAuthorityV1(
  resolution: NarrativeResolutionResultV1,
  displayPacket: DisplayPacketV1
): NarrativeRenderAuthorityV1 {
  const semantic = resolution.interpretation.semanticIntent;
  const target = resolution.interpretation.referentResolution?.resolvedTarget ?? semantic.target;
  return {
    schemaVersion: 1,
    renderPlanVersion: "narrative-render-plan/1",
    mode: "PLAYER_EXPRESSION_FIDELITY",
    semanticGoal: semantic.playerGoal,
    targetRef: target?.ref ?? null,
    perspective: "FIRST_PERSON_PLAYER",
    allowedClaims: [{
      schemaVersion: 1,
      claimId: "player-expression-source",
      category: "SOURCE_FACT",
      text: findRawInput(displayPacket),
      sourceRefs: [`intent:${resolution.interpretation.intentId}`]
    }],
    allowedActorReactionRefs: [],
    texturePolicy: texturePolicy(false),
    confirmedClaims: [
      `Texte original du joueur: ${findRawInput(displayPacket)}`,
      `Intention canonique: ${semantic.kind}.`,
      `Engagement exprimé: ${semantic.commitment}.`,
      ...(semantic.perception === null ? [] : [`Profondeur perceptive: ${semantic.perception.depth}.`])
    ],
    unconfirmedClaims: [
      "Toute étape d'action, intensité, méthode ou condition préalable absente de l'intention.",
      "Le succès, l'échec ou le résultat fictionnel de l'action.",
      "Toute connaissance, émotion, promesse ou prise de risque non exprimée par le joueur."
    ],
    forbiddenClaims: [
      "Augmenter l'intensité ou l'engagement de l'intention.",
      "Ajouter une action comme déverrouiller, forcer, frapper, promettre ou accepter.",
      "Présenter comme accompli un résultat que le joueur demande seulement de tenter.",
      "Changer la cible ou le but sémantique."
    ],
    sourceRefs: [`resolution:${resolution.resolutionId}`, `intent:${resolution.interpretation.intentId}`]
  };
}

export function buildNarrativeRenderAuthorityV1(
  resolution: NarrativeResolutionResultV1,
  displayPacket: DisplayPacketV1
): NarrativeRenderAuthorityV1 {
  const semantic = resolution.interpretation.semanticIntent;
  const target = resolution.interpretation.referentResolution?.resolvedTarget ?? semantic.target;
  const sourceRefs = [`resolution:${resolution.resolutionId}`];
  const confirmedTransitionBlocks = semantic.kind === "traverse_visible_boundary"
    && resolution.commitId !== null
    ? displayPacket.displayBlocks.filter(block =>
        block.kind === "GM_NARRATION" && block.text.trim().length > 0
      )
    : [];
  if (confirmedTransitionBlocks.length > 0) {
    return {
      schemaVersion: 1,
      renderPlanVersion: "narrative-render-plan/1",
      mode: "SCENE_TRANSITION",
      semanticGoal: semantic.playerGoal,
      targetRef: target?.ref ?? null,
      perspective: "SECOND_PERSON_PLAYER",
      allowedClaims: confirmedTransitionBlocks.map((block, index) => ({
        schemaVersion: 1,
        claimId: `confirmed-transition-${index + 1}`,
        category: "CONFIRMED_RESULT" as const,
        text: block.text,
        sourceRefs: block.sourceRefs
      })),
      allowedActorReactionRefs: [],
      texturePolicy: texturePolicy(true),
      confirmedClaims: confirmedTransitionBlocks.map(block => block.text),
      unconfirmedClaims: [
        "Tout élément du trajet absent du cheminement déterministe confirmé.",
        "Tout contenu provenant de la scène précédente autre que son départ."
      ],
      forbiddenClaims: [
        "Omettre le départ ou le franchissement pour ne décrire que la destination.",
        "Inventer une étape intermédiaire, une rencontre, un obstacle ou une réaction."
      ],
      sourceRefs: [
        ...sourceRefs,
        ...confirmedTransitionBlocks.flatMap(block => block.sourceRefs)
      ]
    };
  }
  if (semantic.kind === "observe_environment") {
    const perception = resolution.perception;
    return {
      schemaVersion: 1,
      renderPlanVersion: "narrative-render-plan/1",
      mode: "OBSERVATION_RESULT",
      semanticGoal: semantic.playerGoal,
      targetRef: target?.ref ?? null,
      perspective: "SECOND_PERSON_PLAYER",
      allowedClaims: (perception?.revealedTexts.length
        ? perception.revealedTexts
        : ["Le personnage porte son attention sur la cible visible."]
      ).map((text, index) => ({
        schemaVersion: 1,
        claimId: `observation-source-${index + 1}`,
        category: "SOURCE_FACT" as const,
        text,
        sourceRefs: perception?.sourceRefs.length ? perception.sourceRefs : sourceRefs
      })),
      allowedActorReactionRefs: [],
      texturePolicy: texturePolicy(true),
      confirmedClaims: perception?.revealedTexts.length
        ? perception.revealedTexts
        : ["Le personnage porte son attention sur la cible visible."],
      unconfirmedClaims: [
        "Les pensées privées, motivations et certitudes mentales de la cible.",
        ...(perception?.withheldClueRefs.map(ref => `Indice non révélé: ${ref}.`) ?? [])
      ],
      forbiddenClaims: ["Révéler un fait caché ou une cause non confirmée.", "Présenter une déduction psychologique comme une certitude."],
      sourceRefs
    };
  }
  if (resolution.preparedEffects.some(effect => effect.effectType === "LOCAL_SCENE_ACTION_RECORDED")) {
    return {
      schemaVersion: 1,
      renderPlanVersion: "narrative-render-plan/1",
      mode: "ACTION_STAGING_ONLY",
      semanticGoal: semantic.playerGoal,
      targetRef: target?.ref ?? null,
      perspective: "SECOND_PERSON_PLAYER",
      allowedClaims: [{
        schemaVersion: 1,
        claimId: "action-staging-confirmed",
        category: "CONFIRMED_RESULT",
        text: "Le personnage engage le geste décrit par son intention sur la cible validée.",
        sourceRefs
      }],
      allowedActorReactionRefs: [],
      texturePolicy: texturePolicy(true),
      confirmedClaims: ["Le personnage engage le geste décrit par son intention sur la cible validée."],
      unconfirmedClaims: ["Le succès ou l'échec du geste.", "Toute modification de la cible.", "Tout contenu rendu visible par le geste.", "Toute réaction nouvelle d'un PNJ."],
      forbiddenClaims: ["Annoncer que l'action réussit ou échoue.", "Décrire une ouverture, une révélation, une entrée ou une conséquence non confirmée.", "Inventer une réaction de PNJ."],
      sourceRefs
    };
  }
  if (resolution.resultKind === "NO_COMMIT_RESPONSE") {
    const contextBlocks = displayPacket.displayBlocks.filter(block =>
      block.kind === "GM_NARRATION" &&
      block.text.trim().length > 0 &&
      block.sourceRefs.some(ref => ref.includes(":meta-answer"))
    );
    if (contextBlocks.length > 0) {
      const contextSourceRefs = [...new Set(contextBlocks.flatMap(block => block.sourceRefs))];
      return {
        schemaVersion: 1,
        renderPlanVersion: "narrative-render-plan/1",
        mode: "CONFIRMED_OUTCOME",
        semanticGoal: semantic.playerGoal,
        targetRef: target?.ref ?? null,
        perspective: "SECOND_PERSON_PLAYER",
        allowedClaims: contextBlocks.map((block, index) => ({
          schemaVersion: 1,
          claimId: `scene-context-${index + 1}`,
          category: "SOURCE_FACT" as const,
          text: block.text,
          sourceRefs: block.sourceRefs
        })),
        allowedActorReactionRefs: [],
        texturePolicy: texturePolicy(false),
        confirmedClaims: contextBlocks.map(block => block.text),
        unconfirmedClaims: ["Toute présence, propriété, ambiance ou circonstance absente de la réponse déterministe et de la scène active."],
        forbiddenClaims: ["Importer un lieu, un acteur, un événement ou une ambiance provenant d'une autre scène."],
        sourceRefs: [...sourceRefs, ...contextSourceRefs]
      };
    }
  }
  return {
    schemaVersion: 1,
    renderPlanVersion: "narrative-render-plan/1",
    mode: displayPacket.displayBlocks.some(block => block.kind === "NPC_SPEECH") ? "NPC_REACTION" : "CONFIRMED_OUTCOME",
    semanticGoal: semantic.playerGoal,
    targetRef: target?.ref ?? null,
    perspective: "SECOND_PERSON_PLAYER",
    allowedClaims: resolution.preparedEffects.map((effect, index) => ({
      schemaVersion: 1,
      claimId: `confirmed-effect-${index + 1}`,
      category: "CONFIRMED_RESULT" as const,
      text: effect.summary,
      sourceRefs
    })),
    allowedActorReactionRefs: displayPacket.displayBlocks
      .filter(block => block.kind === "NPC_SPEECH")
      .map(block => block.speaker.speakerId),
    texturePolicy: texturePolicy(true),
    confirmedClaims: resolution.preparedEffects.map(effect => `Effet confirmé: ${effect.effectType}.`),
    unconfirmedClaims: ["Tout résultat absent des effets et du commit confirmés."],
    forbiddenClaims: ["Ajouter un succès, un échec, une révélation, une mutation ou une réaction non sourcée."],
    sourceRefs
  };
}

function texturePolicy(allowed: boolean): NarrativeEphemeralTexturePolicyV1 {
  return {
    schemaVersion: 1,
    allowed,
    lifetime: "TURN_ONLY",
    reusableAsFact: false,
    persistToMemory: false,
    mayAffectRules: false,
    allowedUses: allowed
      ? [
        "Reformulation sensorielle d'une source déjà autorisée.",
        "Accentuation stylistique de la tension confirmée.",
        "Liaison atmosphérique sans nouvelle cause, présence, action ou propriété."
      ]
      : [],
    forbiddenUses: [
      "État mécanique, verrouillage, fonctionnement, solidité ou efficacité d'un objet.",
      "Histoire causale, usage antérieur, usure attribuée ou origine non sourcée.",
      "Nouvelle présence, nouvelle source sensorielle, nouvel événement ou nouvel objet.",
      "Réaction, action, pensée, émotion certaine ou connaissance d'un acteur non autorisé.",
      "Condition de lumière, terrain ou environnement susceptible d'affecter une règle.",
      "Fait mémorisable, indice, preuve, précondition ou élément réutilisable à un tour ultérieur."
    ]
  };
}

function isNoCommitSceneContext(resolution: NarrativeResolutionResultV1, displayPacket: DisplayPacketV1): boolean {
  return resolution.resultKind === "NO_COMMIT_RESPONSE" &&
    (resolution.interpretation.semanticIntent.kind === "meta_request" || resolution.interpretation.semanticIntent.kind === "context_question") &&
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
  return {
    usable: rejectionReasons.length === 0,
    block,
    rejectionReasons
  };
}

function hasAnyAllowedGrounding(groundedIn: string[], allowedGrounding: string[]): boolean {
  return groundedIn.length > 0 && groundedIn.some(ref => allowedGrounding.includes(ref));
}

function normalizeNarrativeCoverageText(value: string): string {
  return value
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/gu, "'")
    .replace(/\s+/gu, " ")
    .trim();
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
