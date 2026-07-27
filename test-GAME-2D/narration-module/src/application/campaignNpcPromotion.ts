import {
  cloneJson,
  opaqueId,
  type AcceptedCommandDraft,
  type AggregateId,
  type AggregateRecord,
  type CampaignId,
  type CommitId,
  type CommitRequest,
  type EventDraft,
  type EventId,
  type GameSecond,
  type IdempotencyKey,
  type JsonObject,
  type OperationId,
  type WriterLease
} from "../core";
import type { PlayableSceneStateV1 } from "./playableScene";
import type { SceneActorRecordV1 } from "./sceneActorRegistry";
import { narrativeDesignationOfV1 } from "./narrativeDesignation";

export const CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1 = "campaign.npc-registry" as const;
export const CAMPAIGN_NPC_REGISTRY_CONTRACT_VERSION_V1 = "campaign-npc-registry/1" as const;
export const CAMPAIGN_NPC_PROMOTION_COMMAND_VERSION_V1 = "campaign-npc-promotion-command/1" as const;

export type CampaignNpcPromotionCauseKindV1 =
  | "RELATION_CONFIRMED"
  | "ONGOING_COMMITMENT"
  | "AUTHORIZED_RELOCATION"
  | "WORLD_ROLE_RECOGNIZED";

export type CampaignNpcPromotionAuthorityV1 = "SOCIAL" | "QUEST" | "WORLD" | "FACTION";

export interface CampaignNpcPromotionCauseV1 extends JsonObject {
  schemaVersion: 1;
  causeKind: CampaignNpcPromotionCauseKindV1;
  authority: CampaignNpcPromotionAuthorityV1;
  durableRef: string;
  publicSourceRefs: string[];
  version: 1;
}

export interface CampaignNpcRecordV1 extends JsonObject {
  schemaVersion: 1;
  campaignNpcId: string;
  actorId: string;
  originSceneId: string;
  displayName: string;
  publicRole: string;
  visibleAppearance: string;
  cause: CampaignNpcPromotionCauseV1;
  promotedByOperationId: string;
  sourceRefs: string[];
  version: 1;
}

export interface CampaignNpcRegistryV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof CAMPAIGN_NPC_REGISTRY_CONTRACT_VERSION_V1;
  campaignId: string;
  npcs: CampaignNpcRecordV1[];
  version: number;
}

export interface CampaignNpcPromotionCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof CAMPAIGN_NPC_PROMOTION_COMMAND_VERSION_V1;
  commandId: string;
  campaignId: string;
  operationId: string;
  idempotencyKey: string;
  sourceSceneActorId: string;
  sourceSceneId: string;
  campaignNpcId: string;
  registryAggregateId: string;
  expectedRegistryRevision: number | null;
  cause: CampaignNpcPromotionCauseV1;
  sourceRefs: string[];
  commitAuthority: false;
  version: 1;
}

export type PrepareCampaignNpcPromotionResultV1 =
  | {
    ok: true;
    status: "READY";
    command: CampaignNpcPromotionCommandV1;
    nextRegistry: CampaignNpcRegistryV1;
    npc: CampaignNpcRecordV1;
  }
  | {
    ok: true;
    status: "ALREADY_PROMOTED";
    command: null;
    nextRegistry: CampaignNpcRegistryV1;
    npc: CampaignNpcRecordV1;
  }
  | { ok: false; issues: string[] };

export function campaignNpcRegistryAggregateIdV1(campaignId: string): AggregateId {
  return opaqueId<AggregateId>(`agg-campaign-npcs:${campaignId}`);
}

export function createEmptyCampaignNpcRegistryV1(campaignId: string): CampaignNpcRegistryV1 {
  return {
    schemaVersion: 1,
    contractVersion: CAMPAIGN_NPC_REGISTRY_CONTRACT_VERSION_V1,
    campaignId,
    npcs: [],
    version: 1
  };
}

export function prepareCampaignNpcPromotionV1(input: {
  campaignId: string;
  operationId: string;
  commandId: string;
  idempotencyKey: string;
  sceneActor: SceneActorRecordV1;
  cause: CampaignNpcPromotionCauseV1;
  registry: CampaignNpcRegistryV1;
  registryRevision: number | null;
}): PrepareCampaignNpcPromotionResultV1 {
  const issues = validateInput(input);
  if (issues.length > 0) return { ok: false, issues };

  const campaignNpcId = stableCampaignNpcId(input.sceneActor.actorId);
  const existing = input.registry.npcs.find(npc =>
    npc.actorId === input.sceneActor.actorId || npc.campaignNpcId === campaignNpcId
  );
  if (existing !== undefined) {
    return {
      ok: true,
      status: "ALREADY_PROMOTED",
      command: null,
      nextRegistry: input.registry,
      npc: existing
    };
  }

  const sourceRefs = unique([
    `scene:${input.sceneActor.sceneId}`,
    `scene-actor:${input.sceneActor.actorId}`,
    ...input.cause.publicSourceRefs
  ]);
  const npc: CampaignNpcRecordV1 = {
    schemaVersion: 1,
    campaignNpcId,
    actorId: input.sceneActor.actorId,
    originSceneId: input.sceneActor.sceneId,
    displayName: input.sceneActor.displayName,
    ...(narrativeDesignationOfV1(input.sceneActor) ? { designation: narrativeDesignationOfV1(input.sceneActor)! } : {}),
    publicRole: input.sceneActor.publicRole,
    visibleAppearance: input.sceneActor.visibleAppearance,
    cause: input.cause,
    promotedByOperationId: input.operationId,
    sourceRefs,
    version: 1
  };
  const nextRegistry: CampaignNpcRegistryV1 = {
    ...input.registry,
    npcs: [...input.registry.npcs, npc],
    version: input.registry.version + 1
  };
  const command: CampaignNpcPromotionCommandV1 = {
    schemaVersion: 1,
    contractVersion: CAMPAIGN_NPC_PROMOTION_COMMAND_VERSION_V1,
    commandId: input.commandId,
    campaignId: input.campaignId,
    operationId: input.operationId,
    idempotencyKey: input.idempotencyKey,
    sourceSceneActorId: input.sceneActor.actorId,
    sourceSceneId: input.sceneActor.sceneId,
    campaignNpcId,
    registryAggregateId: campaignNpcRegistryAggregateIdV1(input.campaignId),
    expectedRegistryRevision: input.registryRevision,
    cause: input.cause,
    sourceRefs,
    commitAuthority: false,
    version: 1
  };
  return { ok: true, status: "READY", command, nextRegistry, npc };
}

export function prepareCampaignNpcPromotionCommitV1(input: {
  prepared: Extract<PrepareCampaignNpcPromotionResultV1, { ok: true; status: "READY" }>;
  currentRegistryAggregate: AggregateRecord | null;
  expectedCampaignRevision: number;
  requestFingerprint: string;
  commitId: CommitId;
  writerLease: WriterLease;
  occurredAtGameSecond: GameSecond;
}): { ok: true; value: CommitRequest } | { ok: false; issues: string[] } {
  const { command, nextRegistry, npc } = input.prepared;
  const issues: string[] = [];
  const aggregateId = campaignNpcRegistryAggregateIdV1(command.campaignId);
  if (command.registryAggregateId !== aggregateId) issues.push("registry aggregate id mismatch");
  if (input.currentRegistryAggregate === null) {
    if (command.expectedRegistryRevision !== null) issues.push("new registry requires null expected revision");
    if (nextRegistry.npcs.length !== 1) issues.push("new registry must contain exactly the promoted NPC");
  } else {
    const aggregate = input.currentRegistryAggregate;
    if (
      aggregate.campaignId !== command.campaignId ||
      aggregate.aggregateType !== CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1 ||
      aggregate.aggregateId !== aggregateId ||
      aggregate.aggregateRevision !== command.expectedRegistryRevision
    ) issues.push("current campaign NPC registry mismatch");
    const current = aggregate.payload as Partial<CampaignNpcRegistryV1>;
    if (
      current.contractVersion !== CAMPAIGN_NPC_REGISTRY_CONTRACT_VERSION_V1 ||
      !Array.isArray(current.npcs) ||
      nextRegistry.npcs.length !== current.npcs.length + 1
    ) issues.push("next campaign NPC registry is not a single append");
    else if (JSON.stringify(nextRegistry.npcs.slice(0, -1)) !== JSON.stringify(current.npcs)) {
      issues.push("next campaign NPC registry alters existing records");
    }
  }
  if (nextRegistry.campaignId !== command.campaignId) issues.push("next registry campaign mismatch");
  if (nextRegistry.npcs.filter(candidate => candidate.campaignNpcId === command.campaignNpcId).length !== 1) {
    issues.push("promoted NPC missing or duplicated in next registry");
  }
  if (npc.campaignNpcId !== command.campaignNpcId || npc.cause.durableRef !== command.cause.durableRef) {
    issues.push("promoted NPC does not match command");
  }
  if (!input.requestFingerprint.trim()) issues.push("request fingerprint is required");
  if (!Number.isInteger(input.expectedCampaignRevision) || input.expectedCampaignRevision < 0) {
    issues.push("expected campaign revision must be non-negative");
  }
  if (issues.length > 0) return { ok: false, issues };

  const typedCampaignId = opaqueId<CampaignId>(command.campaignId);
  const typedOperationId = opaqueId<OperationId>(command.operationId);
  const nextRevision = command.expectedRegistryRevision === null ? 0 : command.expectedRegistryRevision + 1;
  const acceptedCommand: AcceptedCommandDraft = {
    schemaVersion: 1,
    contractId: "campaign.npc-promotion",
    contractVersion: 1,
    commandId: opaqueId(command.commandId),
    campaignId: typedCampaignId,
    operationId: typedOperationId,
    commandType: "campaign.promote-scene-actor",
    target: {
      aggregateType: CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1,
      aggregateId,
      expectedAggregateRevision: command.expectedRegistryRevision
    },
    payloadSchemaVersion: 1,
    payload: {
      sourceSceneActorId: command.sourceSceneActorId,
      sourceSceneId: command.sourceSceneId,
      campaignNpcId: command.campaignNpcId,
      causeKind: command.cause.causeKind,
      durableRef: command.cause.durableRef
    },
    acceptedAtGameSecond: input.occurredAtGameSecond
  };
  const event: EventDraft = {
    schemaVersion: 1,
    eventId: opaqueId<EventId>(`${command.operationId}:event:campaign-npc-promoted`),
    campaignId: typedCampaignId,
    operationId: typedOperationId,
    eventType: "campaign.npc.promoted",
    origin: "PLAYER_INTENT",
    causation: { kind: "COMMAND", id: acceptedCommand.commandId },
    aggregateRefs: [{
      aggregateType: CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1,
      aggregateId,
      aggregateRevision: nextRevision
    }],
    visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
    occurredAtGameSecond: input.occurredAtGameSecond,
    payloadSchemaVersion: 1,
    payload: {
      campaignNpcId: npc.campaignNpcId,
      displayName: npc.displayName,
      publicRole: npc.publicRole,
      causeKind: npc.cause.causeKind,
      durableRef: npc.cause.durableRef,
      sourceRefs: [...npc.sourceRefs]
    }
  };
  return {
    ok: true,
    value: {
      campaignId: typedCampaignId,
      operationId: typedOperationId,
      commitId: input.commitId,
      idempotencyKey: opaqueId<IdempotencyKey>(command.idempotencyKey),
      requestFingerprint: input.requestFingerprint,
      expectedCampaignRevision: input.expectedCampaignRevision,
      writerLease: input.writerLease,
      acceptedCommands: [acceptedCommand],
      aggregateWrites: [{
        aggregateType: CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId,
        expectedAggregateRevision: command.expectedRegistryRevision,
        payloadSchemaVersion: 1,
        payload: cloneJson(nextRegistry)
      }],
      events: [event],
      outboxTasks: []
    }
  };
}

export function projectCampaignNpcsIntoSceneV1(input: {
  scene: PlayableSceneStateV1;
  registry: CampaignNpcRegistryV1;
  presentCampaignNpcIds: string[];
}): PlayableSceneStateV1 {
  const requested = new Set(input.presentCampaignNpcIds);
  const existingActorIds = new Set(input.scene.presentNpc.map(actor => actor.actorId));
  const additions = input.registry.npcs
    .filter(npc => requested.has(npc.campaignNpcId) && !existingActorIds.has(npc.actorId))
    .map(npc => {
      const designation = narrativeDesignationOfV1(npc);
      return {
      schemaVersion: 1 as const,
      actorId: npc.actorId,
      displayName: npc.displayName,
      narrativeLabel: designation?.subsequentMention ?? npc.displayName,
      ...(designation ? { designation } : {}),
      publicRole: npc.publicRole,
      visibleState: npc.visibleAppearance,
      keywords: [npc.displayName, npc.publicRole],
      defaultReply: `${designation?.subsequentMention ?? npc.displayName} te prête attention.`,
      repeatedReply: `${designation?.subsequentMention ?? npc.displayName} reprend le fil de votre échange.`,
      demeanor: null,
      immediateGoal: null,
      currentPressure: null,
      speechStyle: [],
      conversationalHooks: [],
      boundaries: ["aucun fait caché déduit de la promotion de campagne"],
      knowledgeRefs: [...npc.sourceRefs],
      version: 1 as const
    };
    });
  return additions.length === 0
    ? input.scene
    : { ...input.scene, presentNpc: [...input.scene.presentNpc, ...additions] };
}

function validateInput(input: Parameters<typeof prepareCampaignNpcPromotionV1>[0]): string[] {
  const issues: string[] = [];
  if (![input.campaignId, input.operationId, input.commandId, input.idempotencyKey].every(value => value.trim())) {
    issues.push("campaign, operation, command and idempotency identities are required");
  }
  if (input.registry.contractVersion !== CAMPAIGN_NPC_REGISTRY_CONTRACT_VERSION_V1 || input.registry.campaignId !== input.campaignId) {
    issues.push("campaign NPC registry mismatch");
  }
  if (!input.sceneActor.actorId.trim() || !input.sceneActor.sceneId.trim() || !input.sceneActor.displayName.trim()) {
    issues.push("a persisted SCENE_ACTOR identity is required");
  }
  if (input.sceneActor.promotedByOperationId.trim().length === 0) issues.push("scene actor promotion evidence is required");
  if (!validCauseAuthority(input.cause.causeKind, input.cause.authority)) issues.push("promotion cause authority mismatch");
  if (!input.cause.durableRef.trim()) issues.push("durable cause reference is required");
  if (input.cause.publicSourceRefs.length === 0 || input.cause.publicSourceRefs.some(ref => !ref.trim())) {
    issues.push("at least one public reconstructible source is required");
  }
  if (input.cause.publicSourceRefs.some(ref => /^(?:secret|private|hidden):/iu.test(ref))) {
    issues.push("private or hidden promotion sources are forbidden");
  }
  if (input.registry.npcs.some((npc, index, all) =>
    all.findIndex(candidate => candidate.campaignNpcId === npc.campaignNpcId || candidate.actorId === npc.actorId) !== index
  )) issues.push("campaign NPC registry contains duplicate identities");
  return issues;
}

function validCauseAuthority(cause: CampaignNpcPromotionCauseKindV1, authority: CampaignNpcPromotionAuthorityV1): boolean {
  if (cause === "RELATION_CONFIRMED") return authority === "SOCIAL";
  if (cause === "ONGOING_COMMITMENT") return authority === "QUEST" || authority === "SOCIAL";
  if (cause === "AUTHORIZED_RELOCATION") return authority === "WORLD";
  return authority === "WORLD" || authority === "FACTION";
}

function stableCampaignNpcId(actorId: string): string {
  return `campaign-npc:${actorId.replace(/^npc:/u, "")}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
