import { computeJsonFingerprint, type JsonObject } from "../core";
import type { ContractAiProviderV1 } from "../ai/FakeContractAiProvider";
import { runAiPipelineCallV1 } from "../ai/pipeline";
import type {
  AiCallRequestV1,
  AiIncidentRecordV1,
  AiModelRouteV1,
  AiRetryPolicyV1,
  AiRoleOutputEnvelopeV1,
  MjPlannerPayloadV1,
  NpcPerformerPayloadV1
} from "../ai/types";
import type { DisplayPacketV1 } from "../scene";
import { isNarrativeRuntimeDecisionV1, isNarrativeSemanticIntentV1, type NarrativeIntentInterpretationV1 } from "./intentClarification";
import type { NarrativeResolutionResultV1 } from "./narrativeResolution";
import type { ReferenceSceneStateV1 } from "./referenceSceneState";

export const NPC_PERFORMER_CONTRACT_VERSION_V1 = "npc-performer/1" as const;

export interface NpcPerformerConfigV1 {
  provider: ContractAiProviderV1;
  route: AiModelRouteV1;
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
  safetyNotes: string[];
}

export class LocalNpcPerformerProviderV1 implements ContractAiProviderV1 {
  async generate(request: AiCallRequestV1): Promise<unknown> {
    const task = request.input.task as { actorId?: unknown; interpretation?: unknown; sceneState?: unknown };
    const actorId = typeof task.actorId === "string" ? task.actorId : "npc:npc-garde-blesse";
    const interpretation = isNarrativeIntentInterpretation(task.interpretation)
      ? task.interpretation
      : null;
    const sceneState = isReferenceSceneState(task.sceneState) ? task.sceneState : null;
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
      payload: buildLocalNpcPerformancePayload(actorId, interpretation, sceneState),
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
  if (input.interpretation.intentType !== "speech" && input.interpretation.intentType !== "mixed") return false;
  if (input.interpretation.requiresClarification) return false;
  return findNpcPerformerActorIdV1(input.mjPlan) !== null;
}

export async function performNpcTurnV1(input: {
  campaignId: string;
  operationId: string;
  rawInput: string;
  interpretation: NarrativeIntentInterpretationV1;
  mjPlan: MjPlannerPayloadV1 | null;
  resolution: NarrativeResolutionResultV1;
  sceneState: ReferenceSceneStateV1;
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
    return {
      schemaVersion: 1,
      contractVersion: NPC_PERFORMER_CONTRACT_VERSION_V1,
      calledPerformer: true,
      performance: acceptedOutput.payload as NpcPerformerPayloadV1 & JsonObject,
      acceptedOutput,
      performanceFailure: null,
      incidents: run.incidents,
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
    safetyNotes: ["Échec npc_performer diagnostiqué sans réaction PNJ de remplacement."]
  };
}

export function applyNpcPerformanceToDisplayPacketV1(input: {
  displayPacket: DisplayPacketV1 & JsonObject;
  performance: (NpcPerformerPayloadV1 & JsonObject) | null;
}): DisplayPacketV1 & JsonObject {
  const performance = input.performance;
  const utterance = performance?.utterances[0] ?? null;
  if (performance === null || utterance === null) return input.displayPacket;
  let replaced = false;
  return {
    ...input.displayPacket,
    displayBlocks: input.displayPacket.displayBlocks.map(block => {
      if (replaced || block.kind !== "NPC_SPEECH") return block;
      replaced = true;
      const speaker = npcSpeakerForActorId(performance.actorId);
      return {
        ...block,
        speaker: {
          ...block.speaker,
          speakerId: speaker.speakerId,
          displayName: speaker.displayName,
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

function npcSpeakerForActorId(actorId: string): { speakerId: string; displayName: string } {
  if (actorId === "npc:npc-serveuse-nerveuse" || actorId === "npc-serveuse-nerveuse") {
    return { speakerId: "speaker-serveuse-nerveuse", displayName: "Serveuse nerveuse" };
  }
  return { speakerId: "speaker-garde-blesse", displayName: "Garde blessé" };
}

function buildLocalNpcPerformancePayload(
  actorId: string,
  interpretation: NarrativeIntentInterpretationV1 | null,
  sceneState: ReferenceSceneStateV1 | null
): NpcPerformerPayloadV1 {
  const knownActorId = actorId === "npc:npc-serveuse-nerveuse" || actorId === "npc-serveuse-nerveuse" ? "npc:npc-serveuse-nerveuse" : "npc:npc-garde-blesse";
  const isWaitress = knownActorId === "npc:npc-serveuse-nerveuse";
  const previousMemory = sceneState?.shortTermNpcMemory.filter(memory => `npc:${memory.actorId}` === knownActorId).at(-2) ?? null;
  const content = previousMemory !== null
    ? isWaitress
      ? "Elle garde la voix basse. « Je vous l'ai dit : moins cette porte attire les regards, mieux ça vaut pour tout le monde. »"
      : "Le garde vous reconnaît et souffle. « Je vous l'ai dit : la porte du fond. Mais pas d'esclandre dans ma salle. »"
    : isWaitress
      ? "Elle baisse la voix. « Pas ici. Si vous cherchez des réponses, ne faites pas de bruit près de la porte du fond. »"
      : "Le garde serre sa mâchoire. « Si vous voulez comprendre ce qui s'est passé, commencez par la porte du fond. Mais ne déclenchez pas de scandale ici. »";
  return {
    schemaVersion: 1,
    performanceId: `${interpretation?.intentId ?? "intent:unknown"}:npc-performance:1`,
    actorId: knownActorId,
    utterances: [{
      utteranceId: `${interpretation?.intentId ?? "intent:unknown"}:npc-utterance:1`,
      text: content,
      audience: ["player-character"],
      speechActs: [{
        type: "assertion",
        content,
        epistemicBasis: "known",
        sourceRefs: [
          "reference-scene:reference-inn-rain-001",
          `intent:${interpretation?.intentId ?? "unknown"}`
        ]
      }]
    }],
    nonVerbalReactions: [isWaitress ? "voix baissée" : "mâchoire crispée"],
    durableCommitments: [],
    revealedRefs: [],
    knowledgeUsed: [
      "reference-scene:reference-inn-rain-001",
      "scene-visible:porte-du-fond"
    ],
    safetyConstraints: {
      noMechanicalSuccess: true,
      noSecretReveal: true,
      noDurableCommitment: true,
      noStateMutation: true
    }
  };
}

async function buildNpcPerformerRequestV1(input: {
  campaignId: string;
  operationId: string;
  rawInput: string;
  actorId: string;
  interpretation: NarrativeIntentInterpretationV1;
  mjPlan: MjPlannerPayloadV1 | null;
  resolution: NarrativeResolutionResultV1;
  sceneState: ReferenceSceneStateV1;
  config: NpcPerformerConfigV1;
}): Promise<AiCallRequestV1> {
  const snapshotId = `${input.operationId}:snapshot:npc-performance`;
  const packId = `${input.operationId}:pack:npc-performance`;
  const roleContextPack = {
    schemaVersion: 1,
    role: "npc_performer",
    authority: "PERFORM_VISIBLE_ACTOR_ONLY",
    actorId: input.actorId,
    visibleScene: "reference-inn-rain-001",
    forbiddenAuthority: ["commit", "time", "inventory", "tactical", "rest", "durable_lore", "secret_reveal", "social_success"]
  };
  const task = {
    rawInput: input.rawInput,
    actorId: input.actorId,
    interpretation: input.interpretation,
    mjPlan: input.mjPlan,
    resolution: input.resolution,
    sceneState: input.sceneState,
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
      outputTokenBudget: 1_000,
      timeoutMs: 1_000
    }
  };
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
