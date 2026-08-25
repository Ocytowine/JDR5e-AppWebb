import {
  cloneJson,
  computeRequestFingerprint,
  coreError,
  opaqueId,
  type AcceptedCommandDraft,
  type AggregateId,
  type AggregateRecord,
  type CampaignId,
  type CampaignRepository,
  type CommandId,
  type CommitId,
  type CommitRequest,
  type EventDraft,
  type EventId,
  type IdempotencyKey,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RequestId,
  type Result,
  type WriterId
} from "../core";
import type { TravelPartySnapshotV1 } from "../time";
import {
  CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1,
  CAMPAIGN_NPC_REGISTRY_CONTRACT_VERSION_V1,
  campaignNpcRegistryAggregateIdV1,
  projectCampaignNpcsIntoSceneV1,
  type CampaignNpcRecordV1,
  type CampaignNpcRegistryV1
} from "./campaignNpcPromotion";
import {
  loadMissionRelationRegistryV1,
  type MissionRelationEngagementV1
} from "./missionRelationAuthority";
import type { PlayableSceneStateV1 } from "./playableScene";
import { loadSceneActorRegistryV1, type SceneActorRegistryV1 } from "./sceneActorRegistry";

export const COMPANION_PARTY_REGISTRY_CONTRACT_V1 = "companion-party-registry/1" as const;
export const COMPANION_PARTY_REGISTRY_AGGREGATE_TYPE_V1 = "companion.party-registry" as const;

export type CompanionMembershipStatusV1 = "ACTIVE" | "SEPARATED" | "LEFT";
export type CompanionDirectiveCategoryV1 = "FOLLOW" | "SCOUT" | "ASSIST" | "GUARD" | "SOCIAL" | "PERSONAL_RISK";
export type CompanionDirectiveDispositionV1 = "ACCEPTED" | "ADAPTED" | "CONDITIONAL" | "REFUSED";

export interface CompanionAutonomyRuleV1 extends JsonObject {
  schemaVersion: 1;
  category: CompanionDirectiveCategoryV1;
  disposition: CompanionDirectiveDispositionV1;
  adaptation: string | null;
  conditions: string[];
  sourceRefs: string[];
}

export interface CompanionAutonomyPolicyV1 extends JsonObject {
  schemaVersion: 1;
  policyId: string;
  policyRevision: number;
  rules: CompanionAutonomyRuleV1[];
  sourceRefs: string[];
}

export interface CompanionMemberV1 extends JsonObject {
  schemaVersion: 1;
  campaignNpcId: string;
  actorId: string;
  status: CompanionMembershipStatusV1;
  currentSceneId: string;
  recruitmentEngagementId: string;
  recruitedAtGameSecond: number;
  separatedAtGameSecond: number | null;
  separationReason: string | null;
  autonomyPolicy: CompanionAutonomyPolicyV1;
  sourceRefs: string[];
  version: number;
}

export interface CompanionDirectiveV1 extends JsonObject {
  schemaVersion: 1;
  directiveId: string;
  campaignNpcId: string;
  category: CompanionDirectiveCategoryV1;
  requestSummary: string;
  disposition: CompanionDirectiveDispositionV1;
  adaptation: string | null;
  conditions: string[];
  executionStatus: "NOT_STARTED";
  decidedAtGameSecond: number;
  sourceRefs: string[];
  version: 1;
}

export interface CompanionPartyRegistryV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof COMPANION_PARTY_REGISTRY_CONTRACT_V1;
  campaignId: string;
  partyId: string;
  leaderActorId: string;
  currentSceneId: string;
  members: CompanionMemberV1[];
  directives: CompanionDirectiveV1[];
  version: number;
}

export interface RecruitCompanionCommandV1 extends JsonObject {
  schemaVersion: 1;
  clientRequestId: string;
  campaignNpcId: string;
  actorId: string;
  engagementId: string;
  activeSceneId: string;
  leaderActorId: string;
  occurredAtGameSecond: number;
  autonomyPolicy: CompanionAutonomyPolicyV1;
}

export interface DecideCompanionDirectiveCommandV1 extends JsonObject {
  schemaVersion: 1;
  clientRequestId: string;
  directiveId: string;
  campaignNpcId: string;
  category: CompanionDirectiveCategoryV1;
  requestSummary: string;
  presenceAction: "SEPARATE" | "REJOIN" | "LEAVE" | null;
  occurredAtGameSecond: number;
}

export interface MoveCompanionPartyCommandV1 extends JsonObject {
  schemaVersion: 1;
  clientRequestId: string;
  fromSceneId: string;
  toSceneId: string;
  sourceWorldEventRef: string;
  occurredAtGameSecond: number;
}

export interface ChangeCompanionPresenceCommandV1 extends JsonObject {
  schemaVersion: 1;
  clientRequestId: string;
  campaignNpcId: string;
  action: "SEPARATE" | "REJOIN" | "LEAVE";
  sceneId: string;
  reason: string;
  sourceRefs: string[];
  occurredAtGameSecond: number;
}

export interface CompanionPartyMutationResultV1 extends JsonObject {
  schemaVersion: 1;
  registry: CompanionPartyRegistryV1;
  member: CompanionMemberV1 | null;
  directive: CompanionDirectiveV1 | null;
  commitId: string;
  replayed: boolean;
}

export function companionPartyRegistryAggregateIdV1(campaignId: string): AggregateId {
  return opaqueId<AggregateId>(`agg-companion-party:${campaignId}`);
}

export function createEmptyCompanionPartyRegistryV1(input: {
  campaignId: string;
  leaderActorId: string;
  currentSceneId: string;
}): CompanionPartyRegistryV1 {
  return {
    schemaVersion: 1,
    contractVersion: COMPANION_PARTY_REGISTRY_CONTRACT_V1,
    campaignId: input.campaignId,
    partyId: `party:${input.campaignId}:${input.leaderActorId}`,
    leaderActorId: input.leaderActorId,
    currentSceneId: input.currentSceneId,
    members: [],
    directives: [],
    version: 1
  };
}

export async function recruitCompanionV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: RecruitCompanionCommandV1;
}): Promise<Result<CompanionPartyMutationResultV1>> {
  const issues = validateRecruitCommand(input.command);
  if (issues.length > 0) return invalid("companion.recruit-command-invalid", issues);
  const [engagements, campaignNpcs, sceneActors] = await Promise.all([
    loadMissionRelationRegistryV1(input.repository, input.campaignId),
    loadCampaignNpcRegistryV1(input.repository, input.campaignId),
    loadSceneActorRegistryV1({
      repository: input.repository,
      campaignId: input.campaignId,
      sceneId: input.command.activeSceneId
    })
  ]);
  if (!engagements.ok) return engagements;
  if (!campaignNpcs.ok) return campaignNpcs;
  if (!sceneActors.ok) return sceneActors;
  const engagement = engagements.value.state.engagements.find(value => value.engagementId === input.command.engagementId);
  const npc = campaignNpcs.value.npcs.find(value => value.campaignNpcId === input.command.campaignNpcId);
  const evidenceIssues = validateRecruitmentEvidence(input.command, engagement, npc, sceneActors.value.state);
  if (evidenceIssues.length > 0) return invalid("companion.recruitment-evidence-invalid", evidenceIssues);
  return mutateRegistry({
    repository: input.repository,
    campaignId: input.campaignId,
    clientRequestId: input.command.clientRequestId,
    operationKind: "companion.recruit",
    payload: cloneJson(input.command),
    leaderActorId: input.command.leaderActorId,
    initialSceneId: input.command.activeSceneId,
    occurredAtGameSecond: input.command.occurredAtGameSecond,
    commandType: "companion.recruit",
    eventType: "companion.recruited",
    mutate(registry) {
      if (registry.currentSceneId !== input.command.activeSceneId || registry.leaderActorId !== input.command.leaderActorId) {
        return { ok: false, issues: ["active party scene or leader mismatch"] };
      }
      if (registry.members.some(value => value.campaignNpcId === input.command.campaignNpcId || value.actorId === input.command.actorId)) {
        return { ok: false, issues: ["NPC is already or was already a member of this party"] };
      }
      const member: CompanionMemberV1 = {
        schemaVersion: 1,
        campaignNpcId: input.command.campaignNpcId,
        actorId: input.command.actorId,
        status: "ACTIVE",
        currentSceneId: input.command.activeSceneId,
        recruitmentEngagementId: input.command.engagementId,
        recruitedAtGameSecond: input.command.occurredAtGameSecond,
        separatedAtGameSecond: null,
        separationReason: null,
        autonomyPolicy: cloneJson(input.command.autonomyPolicy),
        sourceRefs: unique([
          `mission-relation:${input.command.engagementId}`,
          `campaign-npc:${input.command.campaignNpcId}`,
          ...input.command.autonomyPolicy.sourceRefs
        ]),
        version: 1
      };
      return {
        ok: true,
        registry: { ...registry, members: [...registry.members, member], version: registry.version + 1 },
        member,
        directive: null,
        eventPayload: { campaignNpcId: member.campaignNpcId, actorId: member.actorId, sceneId: member.currentSceneId }
      };
    }
  });
}

export async function decideCompanionDirectiveV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: DecideCompanionDirectiveCommandV1;
}): Promise<Result<CompanionPartyMutationResultV1>> {
  if (!validDirectiveCommand(input.command)) return invalid("companion.directive-command-invalid", ["directive command is invalid"]);
  return mutateRegistry({
    repository: input.repository,
    campaignId: input.campaignId,
    clientRequestId: input.command.clientRequestId,
    operationKind: "companion.directive.decide",
    payload: cloneJson(input.command),
    leaderActorId: "unused",
    initialSceneId: "unused",
    occurredAtGameSecond: input.command.occurredAtGameSecond,
    commandType: "companion.directive.decide",
    eventType: "companion.directive-decided",
    mutate: registry => decideDirectiveMutation(registry, input.command)
  });
}

export async function decideCompanionDirectiveInNarrativeTurnV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operation: OperationRecord;
  command: DecideCompanionDirectiveCommandV1;
}): Promise<Result<CompanionPartyMutationResultV1>> {
  if (!validDirectiveCommand(input.command)) return invalid("companion.directive-command-invalid", ["directive command is invalid"]);
  return mutateRegistry({
    repository: input.repository,
    campaignId: input.campaignId,
    clientRequestId: input.command.clientRequestId,
    operationKind: "companion.directive.decide",
    payload: cloneJson(input.command),
    leaderActorId: "unused",
    initialSceneId: "unused",
    occurredAtGameSecond: input.command.occurredAtGameSecond,
    commandType: "companion.directive.decide",
    eventType: "companion.directive-decided",
    existingOperation: input.operation,
    mutate: registry => decideDirectiveMutation(registry, input.command)
  });
}

function decideDirectiveMutation(
  registry: CompanionPartyRegistryV1,
  command: DecideCompanionDirectiveCommandV1
): MutationDecision {
  if (registry.directives.some(value => value.directiveId === command.directiveId)) {
    return { ok: false, issues: ["directiveId already exists"] };
  }
  const member = registry.members.find(value => value.campaignNpcId === command.campaignNpcId);
  if (
    member === undefined
    || member.currentSceneId !== registry.currentSceneId
    || member.status === "LEFT"
    || (member.status === "SEPARATED" && command.category !== "FOLLOW")
  ) {
    return { ok: false, issues: ["companion is not available for this request in the party scene"] };
  }
  const rule = member.autonomyPolicy.rules.find(value => value.category === command.category);
  const directive: CompanionDirectiveV1 = {
    schemaVersion: 1,
    directiveId: command.directiveId,
    campaignNpcId: command.campaignNpcId,
    category: command.category,
    requestSummary: command.requestSummary,
    disposition: rule?.disposition ?? "REFUSED",
    adaptation: rule?.adaptation ?? null,
    conditions: [...(rule?.conditions ?? [])],
    executionStatus: "NOT_STARTED",
    decidedAtGameSecond: command.occurredAtGameSecond,
    sourceRefs: unique([...(rule?.sourceRefs ?? member.autonomyPolicy.sourceRefs), `companion-policy:${member.autonomyPolicy.policyId}:${member.autonomyPolicy.policyRevision}`]),
    version: 1
  };
  const presenceAction = command.presenceAction ?? null;
  let updatedMember = member;
  if (presenceAction !== null && ["ACCEPTED", "ADAPTED"].includes(directive.disposition)) {
    if (presenceAction === "SEPARATE" && member.status !== "ACTIVE") {
      return { ok: false, issues: ["only an active companion can separate"] };
    }
    if (presenceAction === "REJOIN" && member.status !== "SEPARATED") {
      return { ok: false, issues: ["only a separated companion can rejoin"] };
    }
    const status: CompanionMembershipStatusV1 = presenceAction === "REJOIN"
      ? "ACTIVE"
      : presenceAction === "LEAVE"
        ? "LEFT"
        : "SEPARATED";
    updatedMember = {
      ...member,
      status,
      separatedAtGameSecond: status === "ACTIVE" ? null : command.occurredAtGameSecond,
      separationReason: status === "ACTIVE" ? null : command.requestSummary,
      sourceRefs: unique([...member.sourceRefs, ...directive.sourceRefs, `companion-directive:${directive.directiveId}`]),
      version: member.version + 1
    };
  }
  const members = registry.members.map(value =>
    value.campaignNpcId === updatedMember.campaignNpcId ? updatedMember : value
  );
  return {
    ok: true,
    registry: { ...registry, members, directives: [...registry.directives, directive], version: registry.version + 1 },
    member: updatedMember,
    directive,
    eventPayload: {
      directiveId: directive.directiveId,
      campaignNpcId: directive.campaignNpcId,
      disposition: directive.disposition,
      adaptation: directive.adaptation,
      conditions: directive.conditions,
      presenceStatus: updatedMember.status
    }
  };
}

export async function moveCompanionPartyV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: MoveCompanionPartyCommandV1;
}): Promise<Result<CompanionPartyMutationResultV1>> {
  if (![input.command.clientRequestId, input.command.fromSceneId, input.command.toSceneId, input.command.sourceWorldEventRef].every(nonEmpty)
    || !gameSecond(input.command.occurredAtGameSecond) || input.command.fromSceneId === input.command.toSceneId) {
    return invalid("companion.move-command-invalid", ["validated world movement is required"]);
  }
  return mutateRegistry({
    repository: input.repository, campaignId: input.campaignId,
    clientRequestId: input.command.clientRequestId, operationKind: "companion.party.move",
    payload: cloneJson(input.command), leaderActorId: "unused", initialSceneId: "unused",
    occurredAtGameSecond: input.command.occurredAtGameSecond,
    commandType: "companion.party.move", eventType: "companion.party-moved",
    mutate(registry) {
      if (registry.currentSceneId !== input.command.fromSceneId) return { ok: false, issues: ["party origin scene mismatch"] };
      const members = registry.members.map(member => member.status === "ACTIVE"
        ? { ...member, currentSceneId: input.command.toSceneId, sourceRefs: unique([...member.sourceRefs, input.command.sourceWorldEventRef]), version: member.version + 1 }
        : member);
      return {
        ok: true,
        registry: { ...registry, currentSceneId: input.command.toSceneId, members, version: registry.version + 1 },
        member: null, directive: null,
        eventPayload: { fromSceneId: input.command.fromSceneId, toSceneId: input.command.toSceneId, sourceWorldEventRef: input.command.sourceWorldEventRef }
      };
    }
  });
}

export async function changeCompanionPresenceV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: ChangeCompanionPresenceCommandV1;
}): Promise<Result<CompanionPartyMutationResultV1>> {
  if (![input.command.clientRequestId, input.command.campaignNpcId, input.command.sceneId, input.command.reason].every(nonEmpty)
    || input.command.sourceRefs.length === 0 || input.command.sourceRefs.some(ref => !nonEmpty(ref))
    || !gameSecond(input.command.occurredAtGameSecond)) {
    return invalid("companion.presence-command-invalid", ["presence command and owner sources are required"]);
  }
  return mutateRegistry({
    repository: input.repository, campaignId: input.campaignId,
    clientRequestId: input.command.clientRequestId, operationKind: `companion.${input.command.action.toLowerCase()}`,
    payload: cloneJson(input.command), leaderActorId: "unused", initialSceneId: "unused",
    occurredAtGameSecond: input.command.occurredAtGameSecond,
    commandType: `companion.${input.command.action.toLowerCase()}`, eventType: `companion.${input.command.action.toLowerCase()}`,
    mutate(registry) {
      const index = registry.members.findIndex(value => value.campaignNpcId === input.command.campaignNpcId);
      if (index < 0) return { ok: false, issues: ["companion member not found"] };
      const current = registry.members[index]!;
      if (input.command.action === "SEPARATE" && (current.status !== "ACTIVE" || input.command.sceneId !== registry.currentSceneId)) {
        return { ok: false, issues: ["only an active present companion can separate"] };
      }
      if (input.command.action === "REJOIN" && (current.status !== "SEPARATED" || input.command.sceneId !== registry.currentSceneId)) {
        return { ok: false, issues: ["reunion requires the current party scene"] };
      }
      if (input.command.action === "LEAVE" && current.status === "LEFT") return { ok: false, issues: ["companion already left"] };
      const status: CompanionMembershipStatusV1 = input.command.action === "REJOIN" ? "ACTIVE" : input.command.action === "LEAVE" ? "LEFT" : "SEPARATED";
      const member: CompanionMemberV1 = {
        ...current,
        status,
        currentSceneId: input.command.sceneId,
        separatedAtGameSecond: status === "ACTIVE" ? null : input.command.occurredAtGameSecond,
        separationReason: status === "ACTIVE" ? null : input.command.reason,
        sourceRefs: unique([...current.sourceRefs, ...input.command.sourceRefs]),
        version: current.version + 1
      };
      const members = [...registry.members];
      members[index] = member;
      return {
        ok: true,
        registry: { ...registry, members, version: registry.version + 1 },
        member, directive: null,
        eventPayload: { campaignNpcId: member.campaignNpcId, status: member.status, sceneId: member.currentSceneId, reason: input.command.reason }
      };
    }
  });
}

export function companionTravelPartySnapshotV1(registry: CompanionPartyRegistryV1): TravelPartySnapshotV1 {
  return {
    schemaVersion: 1,
    partyId: registry.partyId,
    partyRevision: registry.version,
    leaderActorId: registry.leaderActorId,
    memberActorIds: unique([registry.leaderActorId, ...registry.members.filter(member => member.status === "ACTIVE").map(member => member.actorId)]),
    sourceRefs: [`companion.party-registry:${registry.partyId}:${registry.version}`]
  };
}

export function projectActiveCompanionsIntoSceneV1(input: {
  scene: PlayableSceneStateV1;
  party: CompanionPartyRegistryV1;
  campaignNpcs: CampaignNpcRegistryV1;
}): PlayableSceneStateV1 {
  if (input.scene.sceneId !== input.party.currentSceneId) return input.scene;
  return projectCampaignNpcsIntoSceneV1({
    scene: input.scene,
    registry: input.campaignNpcs,
    presentCampaignNpcIds: input.party.members
      .filter(member => member.status === "ACTIVE" && member.currentSceneId === input.scene.sceneId)
      .map(member => member.campaignNpcId)
  });
}

export async function hydrateActiveCompanionsV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  scene: PlayableSceneStateV1;
}): Promise<Result<PlayableSceneStateV1>> {
  const party = await loadCompanionPartyRegistryV1({ repository: input.repository, campaignId: input.campaignId });
  if (!party.ok) return party;
  if (party.value.state === null) return { ok: true, value: input.scene };
  const npcs = await loadCampaignNpcRegistryV1(input.repository, input.campaignId);
  if (!npcs.ok) return npcs;
  return {
    ok: true,
    value: projectActiveCompanionsIntoSceneV1({ scene: input.scene, party: party.value.state, campaignNpcs: npcs.value })
  };
}

export function companionDirectiveNarrationV1(input: {
  companionName: string;
  directive: CompanionDirectiveV1;
}): string {
  const name = input.companionName.trim() || "Ton compagnon";
  if (input.directive.disposition === "ACCEPTED") {
    return `${name} acquiesce et se prépare à t'aider, sans présumer encore du résultat.`;
  }
  if (input.directive.disposition === "ADAPTED") {
    return `${name} accepte l'idée, mais à sa manière : ${sentence(input.directive.adaptation ?? "il choisit une approche plus prudente")}`;
  }
  if (input.directive.disposition === "CONDITIONAL") {
    return `${name} ne s'engage pas encore. ${sentence(input.directive.conditions.join(" "))}`;
  }
  return `${name} refuse, sans détour, tout en restant libre de poursuivre la route à tes côtés.`;
}

export function companionRecruitmentNarrationV1(companionName: string): string {
  const name = companionName.trim() || "Ton interlocuteur";
  return `${name} choisit de poursuivre la route avec toi. Ce choix vous lie pour le voyage, sans lui retirer sa propre volonté.`;
}

export function companionPresenceNarrationV1(input: {
  companionName: string;
  action: "SEPARATE" | "REJOIN" | "LEAVE";
}): string {
  const name = input.companionName.trim() || "Ton compagnon";
  if (input.action === "SEPARATE") {
    return `${name} acquiesce et reste ici, libre de ses mouvements, tandis que tu poursuis sans lui.`;
  }
  if (input.action === "REJOIN") {
    return `${name} revient à tes côtés et reprend la route avec toi.`;
  }
  return `${name} accepte que vos routes se sÃ©parent ici et prend congÃ©.`;
}

export async function loadCompanionPartyRegistryV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
}): Promise<Result<{ aggregate: AggregateRecord | null; state: CompanionPartyRegistryV1 | null }>> {
  const aggregate = await input.repository.getAggregate(input.campaignId, COMPANION_PARTY_REGISTRY_AGGREGATE_TYPE_V1, companionPartyRegistryAggregateIdV1(input.campaignId));
  if (!aggregate.ok) return aggregate.error.code === "NOT_FOUND" ? { ok: true, value: { aggregate: null, state: null } } : aggregate;
  const state = aggregate.value.payload as CompanionPartyRegistryV1;
  const issues = validateRegistry(state, input.campaignId);
  return issues.length === 0
    ? { ok: true, value: { aggregate: aggregate.value, state } }
    : invalid("companion.registry-invalid", issues);
}

async function loadCampaignNpcRegistryV1(repository: CampaignRepository, campaignId: CampaignId): Promise<Result<CampaignNpcRegistryV1>> {
  const aggregate = await repository.getAggregate(campaignId, CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1, campaignNpcRegistryAggregateIdV1(campaignId));
  if (!aggregate.ok) return aggregate;
  const state = aggregate.value.payload as CampaignNpcRegistryV1;
  return state.contractVersion === CAMPAIGN_NPC_REGISTRY_CONTRACT_VERSION_V1 && state.campaignId === campaignId && Array.isArray(state.npcs)
    ? { ok: true, value: state }
    : invalid("companion.campaign-npc-registry-invalid", ["campaign NPC registry is invalid"]);
}

type MutationDecision = { ok: false; issues: string[] } | {
  ok: true;
  registry: CompanionPartyRegistryV1;
  member: CompanionMemberV1 | null;
  directive: CompanionDirectiveV1 | null;
  eventPayload: JsonObject;
};

async function mutateRegistry(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  clientRequestId: string;
  operationKind: string;
  payload: JsonObject;
  leaderActorId: string;
  initialSceneId: string;
  occurredAtGameSecond: number;
  commandType: string;
  eventType: string;
  existingOperation?: OperationRecord;
  mutate(registry: CompanionPartyRegistryV1): MutationDecision;
}): Promise<Result<CompanionPartyMutationResultV1>> {
  const fingerprint = input.existingOperation?.requestFingerprint
    ?? await computeRequestFingerprint(input.operationKind, 1, input.payload);
  const operationId = input.existingOperation?.operationId
    ?? opaqueId<OperationId>(`${input.operationKind}:${input.clientRequestId}`);
  if (input.existingOperation !== undefined && (
    input.existingOperation.campaignId !== input.campaignId ||
    input.existingOperation.phase !== "RECEIVED"
  )) {
    return invalid("companion.narrative-operation-invalid", ["received narrative operation is required"]);
  }
  if (input.existingOperation === undefined) {
  const existing = await input.repository.getOperation(operationId);
  if (existing.ok && existing.value.requestFingerprint !== fingerprint) return invalid("companion.idempotency-conflict", ["clientRequestId reused with different content"], "IDEMPOTENCY_CONFLICT");
  if (existing.ok && existing.value.phase === "COMPLETED") return restore(existing.value);
  if (existing.ok) return { ok: false, error: coreError("CAMPAIGN_BUSY", "companion.operation-incomplete", { operationId }) };
  if (existing.error.code !== "NOT_FOUND") return existing;
  }
  const campaign = await input.repository.getCampaign(input.campaignId);
  if (!campaign.ok) return campaign;
  const loaded = await loadCompanionPartyRegistryV1({ repository: input.repository, campaignId: input.campaignId });
  if (!loaded.ok) return loaded;
  const current = loaded.value.state ?? createEmptyCompanionPartyRegistryV1({ campaignId: input.campaignId, leaderActorId: input.leaderActorId, currentSceneId: input.initialSceneId });
  const decision = input.mutate(current);
  if (!decision.ok) return invalid("companion.mutation-refused", decision.issues);
  const registryIssues = validateRegistry(decision.registry, input.campaignId);
  if (registryIssues.length > 0) return invalid("companion.next-registry-invalid", registryIssues);
  const now = new Date().toISOString();
  const received = input.existingOperation === undefined
    ? await input.repository.receiveOperation({
    schemaVersion: 1, operationId, campaignId: input.campaignId,
    clientRequestId: opaqueId<RequestId>(input.clientRequestId),
    idempotencyKey: opaqueId<IdempotencyKey>(`${input.operationKind}:${input.clientRequestId}`),
    requestFingerprint: fingerprint, operationKind: input.operationKind,
    requestPayloadSchemaVersion: 1, requestPayload: input.payload,
    phase: "RECEIVED", observedCampaignRevision: campaign.value.campaignRevision,
    commitId: null, completionMode: null, resultPayloadSchemaVersion: null,
    resultPayload: null, failure: null, receivedAt: now, updatedAt: now
    })
    : { ok: true as const, value: input.existingOperation };
  if (!received.ok) return received;
  const preparing = await input.repository.transitionOperation(operationId, "RECEIVED", "PREPARING");
  if (!preparing.ok) return preparing;
  const ready = await input.repository.transitionOperation(operationId, "PREPARING", "READY_TO_COMMIT");
  if (!ready.ok) return ready;
  const lease = await input.repository.acquireWriterLease(input.campaignId, opaqueId<WriterId>(`${operationId}:writer`), 120_000);
  if (!lease.ok) return lease;
  try {
    const aggregateId = companionPartyRegistryAggregateIdV1(input.campaignId);
    const commandId = opaqueId<CommandId>(`${operationId}:command`);
    const nextRevision = loaded.value.aggregate === null ? 0 : loaded.value.aggregate.aggregateRevision + 1;
    const command: AcceptedCommandDraft = {
      schemaVersion: 1, contractId: "companion.party-registry", contractVersion: 1,
      commandId, campaignId: input.campaignId, operationId, commandType: input.commandType,
      target: { aggregateType: COMPANION_PARTY_REGISTRY_AGGREGATE_TYPE_V1, aggregateId, expectedAggregateRevision: loaded.value.aggregate?.aggregateRevision ?? null },
      payloadSchemaVersion: 1, payload: input.payload, acceptedAtGameSecond: input.occurredAtGameSecond
    };
    const event: EventDraft = {
      schemaVersion: 1, eventId: opaqueId<EventId>(`${operationId}:event`), campaignId: input.campaignId,
      operationId, eventType: input.eventType, origin: "PLAYER_INTENT", causation: { kind: "COMMAND", id: commandId },
      aggregateRefs: [{ aggregateType: COMPANION_PARTY_REGISTRY_AGGREGATE_TYPE_V1, aggregateId, aggregateRevision: nextRevision }],
      visibility: { scope: "PLAYER_VISIBLE", actorIds: [] }, occurredAtGameSecond: input.occurredAtGameSecond,
      payloadSchemaVersion: 1, payload: decision.eventPayload
    };
    const request: CommitRequest = {
      campaignId: input.campaignId, operationId, commitId: opaqueId<CommitId>(`${operationId}:commit`),
      idempotencyKey: ready.value.idempotencyKey, requestFingerprint: fingerprint,
      expectedCampaignRevision: ready.value.observedCampaignRevision, writerLease: lease.value,
      acceptedCommands: [command], aggregateWrites: [{
        aggregateType: COMPANION_PARTY_REGISTRY_AGGREGATE_TYPE_V1, aggregateId,
        expectedAggregateRevision: loaded.value.aggregate?.aggregateRevision ?? null,
        payloadSchemaVersion: 1, payload: cloneJson(decision.registry)
      }], events: [event], outboxTasks: []
    };
    const committed = await input.repository.commit(request);
    if (!committed.ok) return committed;
    const result: CompanionPartyMutationResultV1 = {
      schemaVersion: 1, registry: decision.registry, member: decision.member,
      directive: decision.directive, commitId: committed.value.commitId, replayed: false
    };
    if (input.existingOperation !== undefined) return { ok: true, value: result };
    const completed = await input.repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, result);
    return completed.ok ? { ok: true, value: result } : completed;
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

function validateRecruitmentEvidence(
  command: RecruitCompanionCommandV1,
  engagement: MissionRelationEngagementV1 | undefined,
  npc: CampaignNpcRecordV1 | undefined,
  sceneActors: SceneActorRegistryV1
): string[] {
  const issues: string[] = [];
  if (engagement === undefined || engagement.status !== "ACCEPTED" || engagement.resolution === null) issues.push("accepted mission or relation is required");
  if (engagement !== undefined && (engagement.sceneActorId !== command.actorId || engagement.engagementId !== command.engagementId)) issues.push("engagement actor mismatch");
  if (npc === undefined || npc.actorId !== command.actorId || npc.campaignNpcId !== command.campaignNpcId) issues.push("durable campaign NPC mismatch");
  if (npc !== undefined && engagement !== undefined && npc.cause.durableRef !== engagement.durableRef) issues.push("NPC durable cause does not match engagement");
  if (engagement !== undefined && engagement.sceneId !== command.activeSceneId) issues.push("recruitment requires the engagement scene");
  if (!sceneActors.actors.some(actor => actor.actorId === command.actorId)) issues.push("recruitment requires the actor registered in the active scene");
  return issues;
}

function validateRecruitCommand(command: RecruitCompanionCommandV1): string[] {
  const issues = [command.clientRequestId, command.campaignNpcId, command.actorId, command.engagementId, command.activeSceneId, command.leaderActorId].every(nonEmpty) ? [] : ["recruitment identities are required"];
  if (!gameSecond(command.occurredAtGameSecond)) issues.push("occurredAtGameSecond is invalid");
  if (!validPolicy(command.autonomyPolicy)) issues.push("autonomy policy is invalid");
  return issues;
}

function validPolicy(policy: CompanionAutonomyPolicyV1): boolean {
  return policy?.schemaVersion === 1 && nonEmpty(policy.policyId) && Number.isInteger(policy.policyRevision) && policy.policyRevision > 0
    && policy.sourceRefs.length > 0 && policy.sourceRefs.every(nonEmpty)
    && new Set(policy.rules.map(rule => rule.category)).size === policy.rules.length
    && policy.rules.every(rule => rule.schemaVersion === 1 && ["FOLLOW", "SCOUT", "ASSIST", "GUARD", "SOCIAL", "PERSONAL_RISK"].includes(rule.category)
      && ["ACCEPTED", "ADAPTED", "CONDITIONAL", "REFUSED"].includes(rule.disposition)
      && (rule.adaptation === null || nonEmpty(rule.adaptation)) && rule.conditions.every(nonEmpty) && rule.sourceRefs.length > 0 && rule.sourceRefs.every(nonEmpty)
      && (rule.disposition !== "ADAPTED" || rule.adaptation !== null) && (rule.disposition !== "CONDITIONAL" || rule.conditions.length > 0));
}

function validDirectiveCommand(command: DecideCompanionDirectiveCommandV1): boolean {
  return command.schemaVersion === 1 && [command.clientRequestId, command.directiveId, command.campaignNpcId, command.requestSummary].every(nonEmpty)
    && ["FOLLOW", "SCOUT", "ASSIST", "GUARD", "SOCIAL", "PERSONAL_RISK"].includes(command.category)
    && (command.presenceAction === null || ["SEPARATE", "REJOIN", "LEAVE"].includes(command.presenceAction))
    && gameSecond(command.occurredAtGameSecond);
}

function validateRegistry(registry: CompanionPartyRegistryV1, campaignId: string): string[] {
  const issues: string[] = [];
  if (registry.schemaVersion !== 1 || registry.contractVersion !== COMPANION_PARTY_REGISTRY_CONTRACT_V1 || registry.campaignId !== campaignId) issues.push("registry contract or campaign mismatch");
  if (![registry.partyId, registry.leaderActorId, registry.currentSceneId].every(nonEmpty) || !Number.isInteger(registry.version) || registry.version < 1) issues.push("registry identity or version invalid");
  if (new Set(registry.members.map(member => member.campaignNpcId)).size !== registry.members.length || new Set(registry.members.map(member => member.actorId)).size !== registry.members.length) issues.push("duplicate companion member");
  if (new Set(registry.directives.map(directive => directive.directiveId)).size !== registry.directives.length) issues.push("duplicate directive");
  if (registry.members.some(member => !validPolicy(member.autonomyPolicy) || !["ACTIVE", "SEPARATED", "LEFT"].includes(member.status))) issues.push("invalid member state");
  return issues;
}

function restore(operation: OperationRecord): Result<CompanionPartyMutationResultV1> {
  const result = operation.resultPayload as CompanionPartyMutationResultV1 | null;
  return result?.schemaVersion === 1 && result.registry?.contractVersion === COMPANION_PARTY_REGISTRY_CONTRACT_V1
    ? { ok: true, value: { ...result, replayed: true } }
    : { ok: false, error: coreError("PERSISTENCE_FAILURE", "companion.completed-result-missing", {}) };
}

function nonEmpty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function gameSecond(value: unknown): value is number { return Number.isInteger(value) && Number(value) >= 0; }
function unique(values: string[]): string[] { return [...new Set(values)].sort(); }
function sentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "Il préfère attendre.";
  const capitalized = `${trimmed[0]!.toLocaleUpperCase("fr-FR")}${trimmed.slice(1)}`;
  return /[.!?]$/u.test(capitalized) ? capitalized : `${capitalized}.`;
}
function invalid<T>(messageKey: string, issues: string[], code: "VALIDATION_FAILED" | "IDEMPOTENCY_CONFLICT" = "VALIDATION_FAILED"): Result<T> {
  return { ok: false, error: coreError(code, messageKey, { issues }) };
}
