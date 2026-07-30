import {
  coreError,
  type CampaignId,
  type CampaignRepository,
  type JsonObject,
  type RepositoryClock,
  type Result
} from "../core";
import {
  buildDisplayPacketFromRenderPlanV1,
  SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
  validateRenderPlanV1,
  type DisplayPacketV1,
  type RenderPlanV1,
  type SpeakerRefV1
} from "../scene";
import type { NarrativeRenderProjectionRecordResultV1 } from "./narrativeRenderProjection";
import { recordNarrativeDirectDisplayProjectionV1 } from "./narrativeRenderProjection";
import { narrativeDesignationOfV1, narrativeFirstMentionV1 } from "./narrativeDesignation";
import { npcSpeakerIdForActorV1 } from "./npcActorIdentity";
import type { PlayableSceneStateV1 } from "./playableScene";
import {
  SOCIAL_LOCAL_INITIATIVE_CONTRACT_V1,
  type SocialLocalInitiativeResultV1,
  type SocialLocalInitiativeSignalV1
} from "./socialActorAuthority";

export const SOCIAL_INITIATIVE_PERFORMANCE_CONTRACT_V1 = "social-initiative-performance/1" as const;

export interface SocialInitiativePublicActorV1 extends JsonObject {
  actorId: string;
  displayName: string;
  narrativeLabel: string;
  publicRole: string;
  visibleState: string;
}

export interface SocialInitiativePublicTargetV1 extends JsonObject {
  targetRef: string;
  displayLabel: string;
}

export interface SocialInitiativePerformanceV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof SOCIAL_INITIATIVE_PERFORMANCE_CONTRACT_V1;
  actorId: string;
  blockKind: "GM_NARRATION" | "NPC_SPEECH";
  text: string;
  sourceRefs: string[];
}

export interface SocialInitiativePerformerV1 {
  perform(input: {
    initiative: SocialLocalInitiativeSignalV1;
    actor: SocialInitiativePublicActorV1;
    target: SocialInitiativePublicTargetV1;
  }): Promise<Result<SocialInitiativePerformanceV1>>;
}

export interface NarrativeSocialBoundaryResultV1 {
  initiativeResult: SocialLocalInitiativeResultV1;
  performance: SocialInitiativePerformanceV1 | null;
  displayPacket: (DisplayPacketV1 & JsonObject) | null;
  projection: NarrativeRenderProjectionRecordResultV1 | null;
}

export class LocalSocialInitiativePerformerV1 implements SocialInitiativePerformerV1 {
  async perform(input: {
    initiative: SocialLocalInitiativeSignalV1;
    actor: SocialInitiativePublicActorV1;
    target: SocialInitiativePublicTargetV1;
  }): Promise<Result<SocialInitiativePerformanceV1>> {
    const subject = narrativeFirstMentionV1(
      narrativeDesignationOfV1(input.actor),
      input.actor.narrativeLabel || input.actor.displayName
    );
    const action = input.initiative.publicActionHint
      .trim()
      .replace(/[.!?]+$/u, "");
    return {
      ok: true,
      value: {
        schemaVersion: 1,
        contractVersion: SOCIAL_INITIATIVE_PERFORMANCE_CONTRACT_V1,
        actorId: input.initiative.actorId,
        blockKind: "GM_NARRATION",
        text: `${capitalize(subject)} ${action}.`,
        sourceRefs: [input.initiative.sourceEventRef]
      }
    };
  }
}

export async function projectAndRecordSocialInitiativeV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  clock: RepositoryClock;
  idPrefix: string;
  clientRequestId: string;
  sourceOperationId: string;
  initiativeResult: SocialLocalInitiativeResultV1;
  scene: PlayableSceneStateV1;
  performer: SocialInitiativePerformerV1;
}): Promise<Result<NarrativeSocialBoundaryResultV1>> {
  if (input.initiativeResult.status === "CALM" || input.initiativeResult.initiative === null) {
    return {
      ok: true,
      value: {
        initiativeResult: input.initiativeResult,
        performance: null,
        displayPacket: null,
        projection: null
      }
    };
  }
  const publicContext = resolvePublicPerformanceContextV1(
    input.scene,
    input.initiativeResult.initiative
  );
  if (!publicContext.ok) return publicContext;
  const performance = await input.performer.perform({
    initiative: input.initiativeResult.initiative,
    actor: publicContext.value.actor,
    target: publicContext.value.target
  });
  if (!performance.ok) return performance;
  const performanceIssues = validatePerformanceV1(
    performance.value,
    input.initiativeResult.initiative
  );
  if (performanceIssues.length > 0) {
    return {
      ok: false,
      error: coreError("VALIDATION_FAILED", "social.initiative-performance-invalid", {
        issues: performanceIssues
      })
    };
  }
  const displayPacket = buildSocialInitiativeDisplayPacketV1({
    operationId: input.sourceOperationId,
    scene: input.scene,
    initiative: input.initiativeResult.initiative,
    actor: publicContext.value.actor,
    performance: performance.value
  });
  const recorded = await recordNarrativeDirectDisplayProjectionV1({
    repository: input.repository,
    campaignId: input.campaignId,
    clock: input.clock,
    idPrefix: input.idPrefix,
    request: {
      schemaVersion: 1,
      clientRequestId: input.clientRequestId,
      sourceOperationId: input.sourceOperationId,
      sourceContractVersion: SOCIAL_LOCAL_INITIATIVE_CONTRACT_V1,
      displayPacket,
      statusMessage: "Initiative locale PNJ projetée depuis un événement social committé.",
      sourceRefs: [
        input.initiativeResult.initiative.sourceEventRef,
        `commit:${input.initiativeResult.commitId}`
      ]
    }
  });
  if (!recorded.ok) return recorded;
  return {
    ok: true,
    value: {
      initiativeResult: input.initiativeResult,
      performance: performance.value,
      displayPacket,
      projection: recorded.value
    }
  };
}

export function buildSocialInitiativeDisplayPacketV1(input: {
  operationId: string;
  scene: PlayableSceneStateV1;
  initiative: SocialLocalInitiativeSignalV1;
  actor: SocialInitiativePublicActorV1;
  performance: SocialInitiativePerformanceV1;
}): DisplayPacketV1 & JsonObject {
  const speaker = input.performance.blockKind === "NPC_SPEECH"
    ? npcSpeaker(input.actor)
    : gmSpeaker();
  const sourceRefs = [...new Set([
    input.initiative.sourceEventRef,
    ...input.performance.sourceRefs,
    `actor:${input.actor.actorId}`,
    input.initiative.targetRef
  ])];
  const plan: RenderPlanV1 = {
    schemaVersion: 1,
    contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
    operationId: input.operationId,
    sceneId: input.scene.sceneId,
    sourceRevision: input.scene.version,
    blocks: [{
      blockId: `${input.operationId}:social-initiative`,
      kind: input.performance.blockKind,
      speakerRef: speaker,
      sourceRefs,
      groundedIn: [input.initiative.sourceEventRef],
      textPolicy: "DETERMINISTIC_ONLY",
      visibility: "PLAYER_VISIBLE",
      order: 0,
      text: input.performance.text
    }],
    rhythmDecision: {
      reason: "ASK_PLAYER",
      diagnostic: "autonomous local initiative rendered; control returns to the player"
    },
    fallbackAllowed: false,
    version: 1
  };
  const validation = validateRenderPlanV1(plan);
  if (!validation.ok) throw new Error(`Invalid social initiative render plan: ${validation.issues.join("; ")}`);
  return buildDisplayPacketFromRenderPlanV1({
    renderPlan: plan,
    rawInputAvailable: false,
    diagnosticsEnabled: false
  }) as DisplayPacketV1 & JsonObject;
}

function resolvePublicPerformanceContextV1(
  scene: PlayableSceneStateV1,
  initiative: SocialLocalInitiativeSignalV1
): Result<{ actor: SocialInitiativePublicActorV1; target: SocialInitiativePublicTargetV1 }> {
  const present = scene.presentNpc.find(actor => actor.actorId === initiative.actorId);
  const ambient = scene.ambientPopulation.find(actor => actor.actorId === initiative.actorId);
  if (present === undefined && ambient === undefined) {
    return {
      ok: false,
      error: coreError("CAMPAIGN_INTEGRITY_FAILURE", "social.initiative-actor-not-visible", {
        actorId: initiative.actorId,
        sceneId: scene.sceneId
      })
    };
  }
  const actor: SocialInitiativePublicActorV1 = present !== undefined
    ? {
        actorId: present.actorId,
        displayName: present.displayName,
        narrativeLabel: present.narrativeLabel,
        publicRole: present.publicRole,
        visibleState: present.visibleState
      }
    : {
        actorId: ambient!.actorId,
        displayName: ambient!.displayName,
        narrativeLabel: ambient!.displayName,
        publicRole: ambient!.publicRole,
        visibleState: `${ambient!.visibleActivity}; ${ambient!.visibleAppearance}; ${ambient!.demeanor}`
      };
  const targetActorId = initiative.targetRef.startsWith("actor:")
    ? initiative.targetRef.slice("actor:".length)
    : null;
  const targetActor = targetActorId === null
    ? null
    : scene.presentNpc.find(candidate => candidate.actorId === targetActorId) ??
      scene.ambientPopulation.find(candidate => candidate.actorId === targetActorId) ??
      null;
  if (targetActorId !== null && targetActor === null && !initiative.targetsPlayer) {
    return {
      ok: false,
      error: coreError("CAMPAIGN_INTEGRITY_FAILURE", "social.initiative-target-not-visible", {
        targetRef: initiative.targetRef,
        sceneId: scene.sceneId
      })
    };
  }
  const displayLabel = initiative.targetsPlayer
    ? "le personnage"
    : targetActor !== null
      ? targetActor.displayName
      : initiative.targetRef;
  return {
    ok: true,
    value: {
      actor,
      target: { targetRef: initiative.targetRef, displayLabel }
    }
  };
}

function validatePerformanceV1(
  performance: SocialInitiativePerformanceV1,
  initiative: SocialLocalInitiativeSignalV1
): string[] {
  const issues: string[] = [];
  if (
    performance.schemaVersion !== 1 ||
    performance.contractVersion !== SOCIAL_INITIATIVE_PERFORMANCE_CONTRACT_V1
  ) issues.push("performance contract mismatch");
  if (performance.actorId !== initiative.actorId) issues.push("performance actor mismatch");
  if (!performance.text.trim()) issues.push("performance text is required");
  if (performance.blockKind === "NPC_SPEECH" && initiative.actKind !== "SPEAK") {
    issues.push("NPC speech requires a SPEAK initiative");
  }
  if (!performance.sourceRefs.includes(initiative.sourceEventRef)) {
    issues.push("performance must cite the committed initiative event");
  }
  return issues;
}

function npcSpeaker(actor: SocialInitiativePublicActorV1): SpeakerRefV1 {
  return {
    schemaVersion: 1,
    speakerId: npcSpeakerIdForActorV1(actor.actorId) ?? `speaker-${actor.actorId}`,
    kind: "NPC",
    actorRef: `npc:${actor.actorId}`,
    displayName: actor.displayName,
    knownNameStatus: "DESIGNATION",
    roleLabel: actor.publicRole,
    accessibilityLabel: `${actor.publicRole} ${actor.displayName}`,
    visualToken: "speaker-npc"
  };
}

function gmSpeaker(): SpeakerRefV1 {
  return {
    schemaVersion: 1,
    speakerId: "speaker-gm",
    kind: "GM",
    actorRef: null,
    displayName: "MJ",
    knownNameStatus: "KNOWN",
    roleLabel: "Narration",
    accessibilityLabel: "Maître du jeu",
    visualToken: "speaker-gm"
  };
}

function capitalize(text: string): string {
  return text.length === 0 ? text : `${text[0]!.toLocaleUpperCase("fr-FR")}${text.slice(1)}`;
}
