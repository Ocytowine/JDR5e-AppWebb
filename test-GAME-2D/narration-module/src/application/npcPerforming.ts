import { computeJsonFingerprint, type CampaignId, type CampaignRepository, type JsonObject } from "../core";
import type { ContractAiProviderV1 } from "../ai/FakeContractAiProvider";
import { runAiPipelineCallV1 } from "../ai/pipeline";
import type {
  AiCallRequestV1,
  AiCallTelemetryV1,
  AiIncidentRecordV1,
  AiModelRouteV1,
  AiRetryPolicyV1,
  AiRoleOutputEnvelopeV1,
  CoherenceCriticPayloadV1,
  MjPlannerPayloadV1,
  NpcEphemeralConversationProfileV1,
  NpcPerformerPayloadV1
} from "../ai/types";
import type { DisplayPacketV1 } from "../scene";
import { isNarrativeRuntimeDecisionV1, isNarrativeSemanticIntentV1, type NarrativeIntentInterpretationV1 } from "./intentClarification";
import type { NarrativeResolutionResultV1 } from "./narrativeResolution";
import type { ReferenceSceneStateV1 } from "./referenceSceneState";
import { reconstructRenderedNpcUtterancesV1 } from "./narrativeRenderProjection";
import { responseModeForDialogueActV1, validateNpcDialogueReactionV1 } from "./npcDialogueReactionValidation";
import { buildNpcDialogueFallbackV1, type NpcDialogueActKindV1 } from "./npcDialogueFallback";
import type { PlayableSceneStateV1 } from "./playableScene";
import { narrativeDesignationOfV1 } from "./narrativeDesignation";
import { normalizeNpcActorIdV1, npcSpeakerIdForActorV1 } from "./npcActorIdentity";
import {
  loadNpcAuthorizedKnowledgeContextV1,
  npcAuthorizedKnowledgeSourceRefsV1
} from "./npcKnowledgeContext";

export const NPC_PERFORMER_CONTRACT_VERSION_V1 = "npc-performer/1" as const;

export interface NpcPerformerConfigV1 {
  provider: ContractAiProviderV1;
  route: AiModelRouteV1;
  coherenceCriticRoute?: AiModelRouteV1;
  retryPolicy: AiRetryPolicyV1;
}

export interface NpcPerformanceFailureV1 extends JsonObject {
  schemaVersion: 1;
  stage: "NPC_PERFORMANCE";
  role: "npc_performer";
  status: "FAILED";
  actorId: string | null;
  issues: string[];
  noCommit: true;
  noGameTime: true;
}

export interface NpcPerformanceResultV1 {
  schemaVersion: 1;
  contractVersion: typeof NPC_PERFORMER_CONTRACT_VERSION_V1;
  calledPerformer: boolean;
  performance: (NpcPerformerPayloadV1 & JsonObject) | null;
  acceptedOutput: AiRoleOutputEnvelopeV1<NpcPerformerPayloadV1> | null;
  performanceFailure: NpcPerformanceFailureV1 | null;
  incidents: AiIncidentRecordV1[];
  telemetry: AiCallTelemetryV1[];
  safetyNotes: string[];
}

interface NpcConversationProfileContractV1 extends JsonObject {
  schemaVersion: 1;
  expectedProfileId: string;
  expectedRevision: number;
  expectedContinuitySource: "INITIALIZED" | "CONTINUED";
  outputProfileRef: string;
  priorProfile: (NpcEphemeralConversationProfileV1 & JsonObject) | null;
  authority: "EPHEMERAL_PRESENTATION_ONLY";
  durablePromotionAllowed: false;
}

export class LocalNpcPerformerProviderV1 implements ContractAiProviderV1 {
  async generate(request: AiCallRequestV1): Promise<unknown> {
    const task = request.input.task as {
      actorId?: unknown;
      interpretation?: unknown;
      dialogueAct?: { act?: unknown; contentGoal?: unknown } | null;
      intentId?: unknown;
      knowledgeEnvelope?: { visibleSituation?: { visibleActor?: { displayName?: unknown } | null } };
      conversationProfileContract?: NpcConversationProfileContractV1;
    };
    const actorId = typeof task.actorId === "string" ? task.actorId : "npc:npc-garde-blesse";
    const interpretation = isNarrativeIntentInterpretation(task.interpretation)
      ? task.interpretation
      : null;
    return {
      schemaVersion: 1,
      contractVersion: request.contractVersion,
      outputId: `output:${request.attemptId}`,
      callId: request.callId,
      attemptId: request.attemptId,
      packId: request.packId,
      snapshotId: request.snapshotId,
      role: request.role,
      status: "OK",
      payload: buildLocalNpcPerformancePayload(
        actorId,
        interpretation,
        null,
        typeof task.knowledgeEnvelope?.visibleSituation?.visibleActor?.displayName === "string"
          ? task.knowledgeEnvelope.visibleSituation.visibleActor.displayName
          : null,
        typeof task.dialogueAct?.act === "string" ? task.dialogueAct.act as NpcDialogueActKindV1 : null,
        typeof task.dialogueAct?.contentGoal === "string" ? task.dialogueAct.contentGoal : null,
        typeof task.intentId === "string" ? task.intentId : null,
        task.conversationProfileContract
      ),
      diagnostics: [],
      supersedesOutputId: null
    } satisfies AiRoleOutputEnvelopeV1<NpcPerformerPayloadV1>;
  }
}

export function createDefaultNpcPerformerConfigV1(): NpcPerformerConfigV1 {
  return {
    provider: new LocalNpcPerformerProviderV1(),
    route: {
      schemaVersion: 1,
      routeId: "i06zj-local-npc-performer",
      role: "npc_performer",
      providerKind: "FAKE_CONTRACT",
      providerId: "local-i06zj",
      modelId: "local-i06zj-npc-performer-fixture",
      modelConfigVersion: "i06zj",
      certified: true,
      allowedContractVersions: [NPC_PERFORMER_CONTRACT_VERSION_V1],
      inputTokenLimit: 2_000,
      outputTokenLimit: 1_000,
      timeoutMs: 1_000,
      fallbackRouteIds: []
    },
    retryPolicy: {
      schemaVersion: 1,
      role: "npc_performer",
      maxTechnicalRetries: 0,
      maxTargetedCorrections: 0,
      maxFullRegenerations: 0,
      allowFallback: false
    }
  };
}

export function findNpcPerformerActorIdV1(plan: MjPlannerPayloadV1 | null): string | null {
  const assignment = plan?.actorAssignments.find(entry =>
    entry.role === "npc_performer" &&
    typeof entry.actorId === "string" &&
    entry.actorId.trim().length > 0
  );
  return assignment?.actorId ?? null;
}

export function shouldCallNpcPerformerV1(input: {
  interpretation: NarrativeIntentInterpretationV1;
  mjPlan: MjPlannerPayloadV1 | null;
  resolution: NarrativeResolutionResultV1;
}): boolean {
  if (input.resolution.resultKind !== "COMMIT_APPLIED") return false;
  if (input.interpretation.semanticIntent.kind !== "address_visible_actor") return false;
  if (input.interpretation.requiresClarification) return false;
  return findNpcPerformerActorIdV1(input.mjPlan) !== null;
}

export async function performNpcTurnV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operationId: string;
  rawInput: string;
  interpretation: NarrativeIntentInterpretationV1;
  mjPlan: MjPlannerPayloadV1 | null;
  resolution: NarrativeResolutionResultV1;
  sceneState: ReferenceSceneStateV1;
  activeScene: PlayableSceneStateV1;
  config: NpcPerformerConfigV1;
}): Promise<NpcPerformanceResultV1> {
  if (!shouldCallNpcPerformerV1(input)) {
    return {
      schemaVersion: 1,
      contractVersion: NPC_PERFORMER_CONTRACT_VERSION_V1,
      calledPerformer: false,
      performance: null,
      acceptedOutput: null,
      performanceFailure: null,
      incidents: [],
      telemetry: [],
      safetyNotes: ["npc_performer non appelé: aucun acteur PNJ assigné par le MJ planner."]
    };
  }

  const actorId = findNpcPerformerActorIdV1(input.mjPlan);
  const request = await buildNpcPerformerRequestV1({ ...input, actorId: actorId ?? "npc:unknown" });
  const run = await runAiPipelineCallV1({
    provider: input.config.provider,
    route: input.config.route,
    retryPolicy: input.config.retryPolicy,
    request
  });
  const acceptedOutput = run.acceptedOutput as AiRoleOutputEnvelopeV1<NpcPerformerPayloadV1> | null;
  if (acceptedOutput !== null) {
    const dialogueAct = input.interpretation.semanticIntent.dialogueAct;
    const reactionIssues = dialogueAct === null || dialogueAct === undefined
      ? ["npc_performer requires a structured dialogueAct."]
      : validateNpcDialogueReactionV1({
        expectedActorId: actorId ?? "npc:unknown",
        dialogueAct,
        performance: acceptedOutput.payload
      });
    if (reactionIssues.length > 0) {
      return rejectedNpcPerformance(actorId, reactionIssues, run.incidents, "cadre de réaction incompatible avec l'intention structurée", run.telemetry);
    }
    const localContextIssues = validateNpcPerformanceAgainstVisibleSceneV1(acceptedOutput.payload, input.sceneState);
    if (localContextIssues.length > 0) {
      return rejectedNpcPerformance(actorId, localContextIssues, run.incidents, "prose incompatible avec le contexte spatial visible", run.telemetry);
    }
    const critic = input.config.coherenceCriticRoute === undefined || !shouldCritiqueNpcPerformanceV1(request, acceptedOutput.payload)
      ? null
      : await validateNpcPerformanceSemanticsV1({
        input,
        request,
        performance: acceptedOutput.payload,
        route: input.config.coherenceCriticRoute
      });
    if (critic !== null && !critic.accepted) {
      return rejectedNpcPerformance(actorId, critic.issues, [...run.incidents, ...critic.incidents], "prose incohérente avec l'acte de dialogue", [...run.telemetry, ...critic.telemetry]);
    }
    return {
      schemaVersion: 1,
      contractVersion: NPC_PERFORMER_CONTRACT_VERSION_V1,
      calledPerformer: true,
      performance: acceptedOutput.payload as NpcPerformerPayloadV1 & JsonObject,
      acceptedOutput,
      performanceFailure: null,
      incidents: [...run.incidents, ...(critic?.incidents ?? [])],
      telemetry: [...run.telemetry, ...(critic?.telemetry ?? [])],
      safetyNotes: ["Réaction PNJ structurée acceptée sans autorité de commit."]
    };
  }

  return {
    schemaVersion: 1,
    contractVersion: NPC_PERFORMER_CONTRACT_VERSION_V1,
    calledPerformer: true,
    performance: null,
    acceptedOutput: null,
    performanceFailure: {
      schemaVersion: 1,
      stage: "NPC_PERFORMANCE",
      role: "npc_performer",
      status: "FAILED",
      actorId,
      issues: run.validation.issues,
      noCommit: true,
      noGameTime: true
    },
    incidents: run.incidents,
    telemetry: run.telemetry,
    safetyNotes: ["Échec npc_performer diagnostiqué sans réaction PNJ de remplacement."]
  };
}

export function validateNpcPerformanceAgainstVisibleSceneV1(
  performance: NpcPerformerPayloadV1,
  sceneState: ReferenceSceneStateV1
): string[] {
  if (sceneState.sceneId !== "reference-inn-rain-001") return [];
  const prose = performance.utterances.map(utterance => utterance.text).join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase();
  const invitesPlayerToEnter = /\b(entrez|entre donc|venez a l'interieur|mettez-vous a l'abri|rentrez)\b/u.test(prose);
  return invitesPlayerToEnter
    ? ["payload.utterances: contradiction spatiale: le joueur est déjà dans la salle commune; le PNJ ne peut pas l'inviter à entrer ou à se mettre à l'abri."]
    : [];
}

function rejectedNpcPerformance(
  actorId: string | null,
  issues: string[],
  incidents: AiIncidentRecordV1[],
  reason: string,
  telemetry: AiCallTelemetryV1[] = []
): NpcPerformanceResultV1 {
  return {
    schemaVersion: 1,
    contractVersion: NPC_PERFORMER_CONTRACT_VERSION_V1,
    calledPerformer: true,
    performance: null,
    acceptedOutput: null,
    performanceFailure: {
      schemaVersion: 1,
      stage: "NPC_PERFORMANCE",
      role: "npc_performer",
      status: "FAILED",
      actorId,
      issues,
      noCommit: true,
      noGameTime: true
    },
    incidents,
    telemetry,
    safetyNotes: [`Réplique npc_performer rejetée: ${reason}; fallback déterministe conservé.`]
  };
}

async function validateNpcPerformanceSemanticsV1(input: {
  input: Parameters<typeof performNpcTurnV1>[0];
  request: AiCallRequestV1;
  performance: NpcPerformerPayloadV1;
  route: AiModelRouteV1;
}): Promise<{ accepted: boolean; issues: string[]; incidents: AiIncidentRecordV1[]; telemetry: AiCallTelemetryV1[] }> {
  const dialogueAct = input.input.interpretation.semanticIntent.dialogueAct ?? null;
  const candidateNarration = input.performance.utterances.map(utterance => utterance.text);
  const performerTask = input.request.input.task as {
    knowledgeEnvelope?: {
      priorNpcUtterances?: Array<{ text?: string }>;
      dialogueHistory?: Array<{ operationId?: string; playerIntentSummary?: string; npcUtterances?: string[] }>;
    };
    conversationProfileContract?: NpcConversationProfileContractV1;
  };
  const priorNpcUtterances = performerTask.knowledgeEnvelope?.priorNpcUtterances
    ?.map(utterance => utterance.text)
    .filter((text): text is string => typeof text === "string" && text.trim().length > 0) ?? [];
  const dialogueHistory = performerTask.knowledgeEnvelope?.dialogueHistory ?? [];
  const criticContext = {
    schemaVersion: 1,
    authority: "NPC_DIALOGUE_ACT_FIDELITY",
    actorId: input.performance.actorId,
    dialogueAct,
    candidateNarration,
    rawInput: input.input.rawInput,
    priorNpcUtterances,
    dialogueHistory,
    priorConversationProfile: performerTask.conversationProfileContract?.priorProfile ?? null,
    candidateConversationProfile: input.performance.conversationProfile
  };
  const criticRun = await runAiPipelineCallV1({
    provider: input.input.config.provider,
    route: input.route,
    retryPolicy: { ...input.input.config.retryPolicy, role: "coherence_critic" },
    request: {
      schemaVersion: 1,
      callId: `${input.input.operationId}:ai:npc-performer-critic:call`,
      operationId: input.input.operationId,
      attemptId: `${input.input.operationId}:ai:npc-performer-critic:attempt:1`,
      campaignId: input.input.campaignId,
      snapshotId: input.request.snapshotId,
      packId: `${input.request.packId}:critic`,
      role: "coherence_critic",
      contractVersion: "narrative-ai-resolution/1",
      modelRouteId: input.route.routeId,
      contextFingerprint: await computeJsonFingerprint(criticContext) as `sha256:${string}`,
      idempotencyKey: `${input.input.operationId}:npc-performer-critic`,
      input: {
        instructionsRef: "narrative-ai-resolution/coherence-critic/npc-dialogue-act/v1",
        roleContextPack: criticContext,
        task: {
          candidateNarration,
          dialogueAct,
          actorId: input.performance.actorId,
          rawInput: input.input.rawInput,
          priorNpcUtterances,
          dialogueHistory,
          priorConversationProfile: performerTask.conversationProfileContract?.priorProfile ?? null,
          candidateConversationProfile: input.performance.conversationProfile
        }
      },
      limits: {
        inputTokenBudget: 700,
        outputTokenBudget: Math.min(1_600, input.route.outputTokenLimit),
        timeoutMs: input.route.timeoutMs
      }
    }
  });
  const payload = criticRun.acceptedOutput?.payload as CoherenceCriticPayloadV1 | undefined;
  const accepted = Boolean(payload && payload.verdict === "PASS" && !payload.findings.some(finding => finding.severity === "BLOCKING"));
  return {
    accepted,
    issues: accepted ? [] : [
      `npc_performer dialogueAct=${dialogueAct?.act ?? "none"} rejected by coherence critic: ${payload?.verdict ?? "NO_USABLE_VERDICT"}.`,
      ...(payload?.findings.map(finding => finding.explanation) ?? [])
    ],
    incidents: criticRun.incidents,
    telemetry: criticRun.telemetry
  };
}

function shouldCritiqueNpcPerformanceV1(request: AiCallRequestV1, performance: NpcPerformerPayloadV1): boolean {
  const task = request.input.task as {
    dialogueAct?: { act?: string } | null;
    knowledgeEnvelope?: { dialogueHistory?: unknown[] };
  };
  if (task.dialogueAct?.act === "OTHER") return true;
  if ((task.knowledgeEnvelope?.dialogueHistory?.length ?? 0) > 0) return true;
  if (performance.utterances.length > 1) return true;
  return performance.utterances.some(utterance => utterance.speechActs.length > 1);
}

export function applyNpcPerformanceToDisplayPacketV1(input: {
  displayPacket: DisplayPacketV1 & JsonObject;
  performance: (NpcPerformerPayloadV1 & JsonObject) | null;
  performanceFailure?: (NpcPerformanceFailureV1 & JsonObject) | null;
  activeScene: PlayableSceneStateV1;
}): DisplayPacketV1 & JsonObject {
  const performance = input.performance;
  const utterance = performance?.utterances[0] ?? null;
  if (performance === null || utterance === null) {
    if (input.performanceFailure === null || input.performanceFailure === undefined) return input.displayPacket;
    let annotated = false;
    return {
      ...input.displayPacket,
      displayBlocks: input.displayPacket.displayBlocks.map(block => {
        if (annotated || block.kind !== "SYSTEM_NOTICE") return block;
        annotated = true;
        return {
          ...block,
          text: `${block.text}\nRéaction PNJ IA rejetée — fallback borné fondé sur l'acte de dialogue appliqué. Motif: ${input.performanceFailure?.issues.join(" | ") ?? "sortie inutilisable"}`
        };
      })
    } as DisplayPacketV1 & JsonObject;
  }
  let replaced = false;
  return {
    ...input.displayPacket,
    displayBlocks: input.displayPacket.displayBlocks.map(block => {
      if (replaced || block.kind !== "NPC_SPEECH") return block;
      replaced = true;
      const speaker = resolveNpcSpeakerV1(performance.actorId, input.activeScene);
      return {
        ...block,
        speaker: {
          ...block.speaker,
          speakerId: speaker.speakerId,
          displayName: speaker.displayName,
          knownNameStatus: speaker.knownNameStatus,
          ariaLabel: `Réplique PNJ - ${speaker.displayName}`,
          visualToken: speaker.speakerId
        },
        ariaLabel: `${speaker.displayName}: ${block.kind}`,
        visualStyleToken: speaker.speakerId,
        text: utterance.text,
        sourceRefs: [
          ...block.sourceRefs,
          `npc-performance:${performance.performanceId}`,
          ...utterance.speechActs.flatMap(act => act.sourceRefs)
        ]
      };
    })
  } as DisplayPacketV1 & JsonObject;
}

export function resolveNpcSpeakerV1(actorId: string, activeScene: PlayableSceneStateV1): {
  speakerId: string;
  displayName: string;
  knownNameStatus: "KNOWN" | "DESIGNATION" | "UNKNOWN";
} {
  const normalizedActorId = normalizeNpcActorIdV1(actorId);
  const actor = activeScene.presentNpc.find(npc => npc.actorId === normalizedActorId);
  const ambientActor = activeScene.ambientPopulation?.find(presence => presence.actorId === normalizedActorId);
  const designation = actor
    ? narrativeDesignationOfV1(actor)
    : ambientActor
      ? narrativeDesignationOfV1(ambientActor)
      : undefined;
  return {
    speakerId: npcSpeakerIdForActorV1(actorId) ?? "speaker-npc",
    displayName: designation?.playerFacingLabel ?? actor?.displayName ?? ambientActor?.displayName ?? "Interlocuteur",
    knownNameStatus: designation?.knowledgeStatus ?? "UNKNOWN"
  };
}

function buildLocalNpcPerformancePayload(
  actorId: string,
  interpretation: NarrativeIntentInterpretationV1 | null,
  _sceneState: ReferenceSceneStateV1 | null,
  actorDisplayName: string | null = null,
  dialogueActOverride: NpcDialogueActKindV1 | null = null,
  dialogueContentGoalOverride: string | null = null,
  intentIdOverride: string | null = null,
  profileContract?: NpcConversationProfileContractV1
): NpcPerformerPayloadV1 {
  const knownActorId = actorId;
  const dialogueAct = dialogueActOverride ?? interpretation?.semanticIntent.dialogueAct?.act ?? "OTHER";
  const dialogueContentGoal = dialogueContentGoalOverride ?? interpretation?.semanticIntent.dialogueAct?.contentGoal ?? "Réagir prudemment à l'interlocuteur.";
  const intentId = intentIdOverride ?? interpretation?.intentId ?? "intent:unknown";
  const fallback = buildNpcDialogueFallbackV1(knownActorId, dialogueAct, actorDisplayName);
  const content = fallback.text;
  const conversationProfile = buildLocalConversationProfileV1({
    actorId: knownActorId,
    actorDisplayName,
    dialogueContentGoal,
    contract: profileContract
  });
  return {
    schemaVersion: 1,
    performanceId: `${intentId}:npc-performance:1`,
    actorId: knownActorId,
    reactionFrame: {
      schemaVersion: 1,
      sourceDialogueAct: dialogueAct,
      responseMode: responseModeForDialogueActV1(dialogueAct),
      addressedContentGoal: dialogueContentGoal
    },
    conversationProfile,
    utterances: [{
      utteranceId: `${intentId}:npc-utterance:1`,
      text: content,
      audience: ["player-character"],
      speechActs: [{
        type: "assertion",
        content,
        epistemicBasis: "known",
        sourceRefs: [
          `intent:${intentId}`
        ]
      }]
    }],
    knowledgeClaims: [{
      utteranceId: `${intentId}:npc-utterance:1`,
      speechActIndex: 0,
      subject: {
        mode: "UNRESOLVED",
        ref: null,
        kind: "OTHER",
        label: null
      }
    }],
    nonVerbalReactions: [fallback.nonVerbalReaction],
    durableCommitments: [],
    revealedRefs: [],
    knowledgeUsed: [
      `intent:${intentId}`
    ],
    safetyConstraints: {
      noMechanicalSuccess: true,
      noSecretReveal: true,
      noDurableCommitment: true,
      noStateMutation: true
    }
  };
}

function buildLocalConversationProfileV1(input: {
  actorId: string;
  actorDisplayName: string | null;
  dialogueContentGoal: string;
  contract?: NpcConversationProfileContractV1;
}): NpcEphemeralConversationProfileV1 {
  const prior = input.contract?.priorProfile ?? null;
  const displayName = input.actorDisplayName?.trim() || "Cet interlocuteur";
  return {
    schemaVersion: 1,
    profileId: input.contract?.expectedProfileId ?? `${input.actorId}:conversation`,
    actorId: input.actorId,
    lifecycle: "EPHEMERAL_DIALOGUE",
    continuityRevision: input.contract?.expectedRevision ?? 1,
    continuitySource: input.contract?.expectedContinuitySource ?? "INITIALIZED",
    perspectiveSummary: prior?.perspectiveSummary ??
      `${displayName} aborde l'échange depuis son rôle visible et la situation immédiate.`,
    currentConcerns: prior?.currentConcerns.length
      ? [...prior.currentConcerns]
      : ["Répondre sans dépasser ce que la situation visible permet d'affirmer."],
    subjectiveOpinions: prior?.subjectiveOpinions.map(opinion => ({ ...opinion })) ?? [],
    conversationHooks: [
      input.dialogueContentGoal,
      ...(prior?.conversationHooks ?? []).filter(hook => hook !== input.dialogueContentGoal)
    ].slice(0, 4),
    boundaries: prior?.boundaries.length
      ? [...prior.boundaries]
      : ["Ne pas présenter une supposition ou une parole personnelle comme un fait établi."],
    speechStyle: prior?.speechStyle.length ? [...prior.speechStyle] : ["direct", "prudent"],
    relationshipTone: prior?.relationshipTone ?? "NEUTRAL",
    durable: false
  };
}

export async function loadLatestNpcConversationProfileV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  actorId: string;
}): Promise<(NpcEphemeralConversationProfileV1 & JsonObject) | null> {
  const operations = await input.repository.listOperations(
    input.campaignId,
    "narrative.turn.input",
    100
  );
  if (!operations.ok) return null;
  const ordered = [...operations.value]
    .filter(operation => operation.phase === "COMPLETED" && operation.resultPayload !== null)
    .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt));
  for (const operation of ordered) {
    const performance = (operation.resultPayload as {
      npcPerformance?: {
        actorId?: unknown;
        conversationProfile?: unknown;
      } | null;
    }).npcPerformance ?? null;
    if (performance?.actorId !== input.actorId) continue;
    const profile = normalizeNpcConversationProfileV1(performance.conversationProfile);
    if (profile !== null && profile.actorId === input.actorId) return profile;
  }
  return null;
}

function normalizeNpcConversationProfileV1(
  value: unknown
): (NpcEphemeralConversationProfileV1 & JsonObject) | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const profile = value as Partial<NpcEphemeralConversationProfileV1>;
  if (
    profile.schemaVersion !== 1 ||
    typeof profile.profileId !== "string" ||
    typeof profile.actorId !== "string" ||
    profile.lifecycle !== "EPHEMERAL_DIALOGUE" ||
    !Number.isInteger(profile.continuityRevision) ||
    (profile.continuityRevision ?? 0) < 1 ||
    !["INITIALIZED", "CONTINUED"].includes(String(profile.continuitySource)) ||
    typeof profile.perspectiveSummary !== "string" ||
    !Array.isArray(profile.currentConcerns) ||
    !Array.isArray(profile.subjectiveOpinions) ||
    !Array.isArray(profile.conversationHooks) ||
    !Array.isArray(profile.boundaries) ||
    !Array.isArray(profile.speechStyle) ||
    !["NEUTRAL", "WARM", "GUARDED", "CURIOUS", "COMPASSIONATE", "IRRITATED"].includes(String(profile.relationshipTone)) ||
    profile.durable !== false
  ) return null;
  return {
    ...profile,
    schemaVersion: 1,
    profileId: profile.profileId,
    actorId: profile.actorId,
    lifecycle: "EPHEMERAL_DIALOGUE",
    continuityRevision: profile.continuityRevision as number,
    continuitySource: profile.continuitySource as "INITIALIZED" | "CONTINUED",
    perspectiveSummary: profile.perspectiveSummary,
    currentConcerns: profile.currentConcerns.filter((entry): entry is string => typeof entry === "string").slice(0, 3),
    subjectiveOpinions: profile.subjectiveOpinions.filter((entry): entry is { topic: string; stance: string } =>
      entry !== null &&
      typeof entry === "object" &&
      typeof (entry as { topic?: unknown }).topic === "string" &&
      typeof (entry as { stance?: unknown }).stance === "string"
    ).slice(0, 4),
    conversationHooks: profile.conversationHooks.filter((entry): entry is string => typeof entry === "string").slice(0, 4),
    boundaries: profile.boundaries.filter((entry): entry is string => typeof entry === "string").slice(0, 4),
    speechStyle: profile.speechStyle.filter((entry): entry is string => typeof entry === "string").slice(0, 4),
    relationshipTone: profile.relationshipTone as NpcEphemeralConversationProfileV1["relationshipTone"],
    durable: false
  } as NpcEphemeralConversationProfileV1 & JsonObject;
}

async function buildNpcPerformerRequestV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operationId: string;
  rawInput: string;
  actorId: string;
  interpretation: NarrativeIntentInterpretationV1;
  mjPlan: MjPlannerPayloadV1 | null;
  resolution: NarrativeResolutionResultV1;
  sceneState: ReferenceSceneStateV1;
  activeScene: PlayableSceneStateV1;
  config: NpcPerformerConfigV1;
}): Promise<AiCallRequestV1> {
  const snapshotId = `${input.operationId}:snapshot:npc-performance`;
  const packId = `${input.operationId}:pack:npc-performance`;
  const roleContextPack = {
    schemaVersion: 1,
    role: "npc_performer",
    authority: "PERFORM_VISIBLE_ACTOR_ONLY",
    actorId: input.actorId,
    visibleScene: input.activeScene.sceneId,
    visibleActor: findVisibleActorV1(input.activeScene, input.actorId),
    spatialContext: {
      playerLocation: input.activeScene.locationName,
      perceptibleSituation: [...input.activeScene.perceptibleSituation],
      currentTension: input.activeScene.currentTension
    },
    forbiddenAuthority: ["commit", "time", "inventory", "tactical", "rest", "durable_lore", "secret_reveal", "social_success"]
  };
  const priorNpcUtterances = await reconstructRenderedNpcUtterancesV1({
    repository: input.repository,
    campaignId: input.campaignId,
    actorId: input.actorId,
    limit: 20
  });
  const renderedNpcUtterances = priorNpcUtterances.ok ? priorNpcUtterances.value : [];
  const rememberedPlayerSpeech = new Map(input.sceneState.shortTermNpcMemory
    .filter(memory => `npc:${memory.actorId}` === input.actorId)
    .map(memory => [memory.operationId, memory.playerIntentSummary] as const));
  const dialogueHistory = renderedNpcUtterances.map(utterance => ({
    operationId: utterance.sourceOperationId,
    playerIntentSummary: rememberedPlayerSpeech.get(utterance.sourceOperationId) ??
      (utterance.playerExpressionText === null
        ? "Expression antérieure non reconstruite."
        : `Le joueur a dit : ${utterance.playerExpressionText}`),
    npcUtterances: [utterance.text]
  }));
  const priorPlayerSpeech = dialogueHistory.map(entry => ({
    operationId: entry.operationId,
    playerIntentSummary: entry.playerIntentSummary
  }));
  const priorConversationProfile = await loadLatestNpcConversationProfileV1({
    repository: input.repository,
    campaignId: input.campaignId,
    actorId: input.actorId
  });
  const profileId = priorConversationProfile?.profileId ?? `${input.actorId}:conversation`;
  const expectedRevision = (priorConversationProfile?.continuityRevision ?? 0) + 1;
  const outputProfileRef = `npc-conversation-profile:${profileId}:revision:${expectedRevision}`;
  const conversationProfileContract: NpcConversationProfileContractV1 = {
    schemaVersion: 1,
    expectedProfileId: profileId,
    expectedRevision,
    expectedContinuitySource: priorConversationProfile === null ? "INITIALIZED" : "CONTINUED",
    outputProfileRef,
    priorProfile: priorConversationProfile,
    authority: "EPHEMERAL_PRESENTATION_ONLY",
    durablePromotionAllowed: false
  };
  const authorizedActorKnowledge = await loadNpcAuthorizedKnowledgeContextV1({
    repository: input.repository,
    campaignId: input.campaignId,
    actorId: input.actorId
  });
  const allowedSourceRefs = [
    `playable-scene:${input.activeScene.sceneId}`,
    `intent:${input.interpretation.intentId}`,
    outputProfileRef,
    ...npcAuthorizedKnowledgeSourceRefsV1(authorizedActorKnowledge),
    ...renderedNpcUtterances.flatMap(utterance => [
      `operation:${utterance.sourceOperationId}`,
      `render-projection:${utterance.renderOperationId}`
    ])
  ];
  const task = {
    rawInput: input.rawInput,
    actorId: input.actorId,
    intentId: input.interpretation.intentId,
    interpretation: {
      intentId: input.interpretation.intentId,
      coreMeaning: input.interpretation.coreMeaning,
      semanticIntent: input.interpretation.semanticIntent,
      target: input.interpretation.target ?? null,
      referentResolution: input.interpretation.referentResolution ?? null
    },
    dialogueAct: input.interpretation.semanticIntent.dialogueAct ?? null,
    conversationProfileContract,
    knowledgeEnvelope: {
      allowedSourceRefs: [...new Set(allowedSourceRefs)],
      authorizedActorKnowledge,
      allowedSubjectRefs: [...new Set([
        `playable-scene:${input.activeScene.sceneId}`,
        ...input.activeScene.presentNpc.map(actor => `actor:${actor.actorId}`),
        ...(input.activeScene.ambientPopulation ?? []).map(actor => `actor:${actor.actorId}`)
      ])],
      publicFactRefs: [`playable-scene:${input.activeScene.sceneId}`],
      priorPlayerSpeech,
      priorNpcUtterances: renderedNpcUtterances,
      dialogueHistory,
      visibleSituation: {
        playerLocation: input.activeScene.locationName,
        visibleActor: findVisibleActorV1(input.activeScene, input.actorId),
        forbiddenContradictions: ["Ne pas déplacer le joueur ou le PNJ hors de la scène active.", "Ne pas inventer une présence, une issue ou un événement absent du contexte visible."]
      },
      memoryLimit: priorNpcUtterances.ok
        ? "Seules les répliques EXACT et le dernier profil conversationnel éphémère acceptés peuvent être rappelés; leur contenu reste attribué à cet acteur, jamais une vérité objective."
        : "La reconstruction des répliques a échoué; ne jamais inventer ni prétendre répéter une réponse antérieure."
    },
    requiredOutput: "bounded_visible_npc_reaction_without_commit"
  };
  return {
    schemaVersion: 1,
    callId: `${input.operationId}:ai:npc-performer:call`,
    operationId: input.operationId,
    attemptId: `${input.operationId}:ai:npc-performer:attempt:1`,
    campaignId: input.campaignId,
    snapshotId,
    packId,
    role: input.config.route.role,
    contractVersion: NPC_PERFORMER_CONTRACT_VERSION_V1,
    modelRouteId: input.config.route.routeId,
    contextFingerprint: await computeJsonFingerprint({ roleContextPack, task }) as `sha256:${string}`,
    idempotencyKey: `${input.operationId}:npc-performer`,
    input: {
      instructionsRef: "npc-performer/minimal/v1",
      roleContextPack,
      task
    },
    limits: {
      inputTokenBudget: 2_000,
      outputTokenBudget: Math.min(2_000, input.config.route.outputTokenLimit),
      timeoutMs: input.config.route.timeoutMs
    }
  };
}

function findVisibleActorV1(scene: PlayableSceneStateV1, actorId: string): JsonObject | null {
  const matches = (candidateId: string) => `npc:${candidateId}` === actorId || candidateId === actorId;
  const npc = scene.presentNpc.find(candidate => matches(candidate.actorId));
  if (npc) return npc;
  return scene.ambientPopulation?.find(candidate => matches(candidate.actorId)) ?? null;
}
function isNarrativeIntentInterpretation(value: unknown): value is NarrativeIntentInterpretationV1 {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Partial<NarrativeIntentInterpretationV1>).schemaVersion === 1 &&
    typeof (value as Partial<NarrativeIntentInterpretationV1>).intentId === "string" &&
    typeof (value as Partial<NarrativeIntentInterpretationV1>).intentType === "string" &&
    isNarrativeSemanticIntentV1((value as Partial<NarrativeIntentInterpretationV1>).semanticIntent) &&
    isNarrativeRuntimeDecisionV1((value as Partial<NarrativeIntentInterpretationV1>).runtimeDecision);
}

function isReferenceSceneState(value: unknown): value is ReferenceSceneStateV1 {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Partial<ReferenceSceneStateV1>).schemaVersion === 1 &&
    Array.isArray((value as Partial<ReferenceSceneStateV1>).shortTermNpcMemory);
}
