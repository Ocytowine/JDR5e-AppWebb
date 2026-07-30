import {
  cloneJson,
  computeRequestFingerprint,
  coreError,
  opaqueId,
  type AcceptedCommandDraft,
  type AggregateId,
  type AggregateRecord,
  type CampaignId,
  type CampaignRecord,
  type CampaignRepository,
  type CommandId,
  type CommitId,
  type EventDraft,
  type EventId,
  type EventRecord,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RequestId,
  type Result,
  type WriterId
} from "../core";
import {
  CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1,
  CAMPAIGN_NPC_REGISTRY_CONTRACT_VERSION_V1,
  campaignNpcRegistryAggregateIdV1,
  type CampaignNpcRecordV1,
  type CampaignNpcRegistryV1
} from "./campaignNpcPromotion";
import {
  BASTION_REGISTRY_AGGREGATE_TYPE_V1,
  bastionRegistryAggregateIdV1,
  loadBastionRegistryV1,
  type BastionOccupantActivityV1,
  type BastionOccupantAssignmentV1,
  type BastionRecordV1,
  type BastionRegistryV1
} from "./bastionAuthority";

export const BASTION_OCCUPANT_ASSIGNMENT_CONTRACT_V1 =
  "bastion-occupant-assignment/1" as const;
export const BASTION_OCCUPANT_ACTIVITY_CONTRACT_V1 =
  "bastion-occupant-activity/1" as const;
export const BASTION_OCCUPANT_CATALOG_CONTRACT_V1 =
  "bastion-occupant-catalog/1" as const;

export interface BastionOccupantRoleDefinitionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof BASTION_OCCUPANT_CATALOG_CONTRACT_V1;
  roleDefinitionRef: string;
  displayName: string;
  allowedActivityRefs: string[];
}

export interface BastionOccupantActivityDefinitionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof BASTION_OCCUPANT_CATALOG_CONTRACT_V1;
  activityDefinitionRef: string;
  displayName: string;
  minimumIntervalSeconds: number;
  publicNarrative: string;
}

export interface BastionOccupantCatalogV1 {
  readonly catalogRef: string;
  resolveRole(roleDefinitionRef: string):
    | BastionOccupantRoleDefinitionV1
    | null
    | Promise<BastionOccupantRoleDefinitionV1 | null>;
  resolveActivity(activityDefinitionRef: string):
    | BastionOccupantActivityDefinitionV1
    | null
    | Promise<BastionOccupantActivityDefinitionV1 | null>;
}

export interface BastionOwnerProofDecisionV1 extends JsonObject {
  schemaVersion: 1;
  authorized: boolean;
  reasonCode: string;
  sourceOperationId: string | null;
  sourceEventId: string | null;
  proofRefs: string[];
}

export interface BastionOccupantAssignmentAuthorityV1 {
  readonly authorityRef: string;
  authorize(input: {
    campaign: CampaignRecord;
    bastion: BastionRecordV1;
    npc: CampaignNpcRecordV1;
    role: BastionOccupantRoleDefinitionV1;
  }): BastionOwnerProofDecisionV1 | Promise<BastionOwnerProofDecisionV1>;
}

export interface BastionOccupantActivityDecisionV1
  extends BastionOwnerProofDecisionV1 {
  activityDefinitionRef: string | null;
}

export interface BastionOccupantActivityAuthorityV1 {
  readonly authorityRef: string;
  select(input: {
    campaign: CampaignRecord;
    bastion: BastionRecordV1;
    npc: CampaignNpcRecordV1;
    assignment: BastionOccupantAssignmentV1;
    occurredAtGameSecond: number;
  }):
    | BastionOccupantActivityDecisionV1
    | Promise<BastionOccupantActivityDecisionV1>;
}

export interface AssignBastionOccupantCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof BASTION_OCCUPANT_ASSIGNMENT_CONTRACT_V1;
  clientRequestId: string;
  bastionId: string;
  campaignNpcId: string;
  roleDefinitionRef: string;
}

export interface ResolveBastionOccupantActivityCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof BASTION_OCCUPANT_ACTIVITY_CONTRACT_V1;
  clientRequestId: string;
  bastionId: string;
  assignmentId: string;
  boundaryKind: "LOCAL_TIME_BOUNDARY" | "LOCAL_EVENT_COMPLETED";
  occurredAtGameSecond: number;
}

export interface BastionOccupantAssignmentSummaryV1 extends JsonObject {
  schemaVersion: 1;
  bastionId: string;
  placeRef: string;
  placeDisplayName: string;
  assignmentId: string;
  campaignNpcId: string;
  actorDisplayName: string;
  roleDefinitionRef: string;
  roleDisplayName: string;
  assignedAtGameSecond: number;
}

export interface BastionOccupantActivitySummaryV1 extends JsonObject {
  schemaVersion: 1;
  bastionId: string;
  placeRef: string;
  placeDisplayName: string;
  assignmentId: string;
  campaignNpcId: string;
  actorDisplayName: string;
  roleDisplayName: string;
  activityId: string;
  activityDefinitionRef: string;
  activityDisplayName: string;
  occurredAtGameSecond: number;
  narrative: string;
}

export interface BastionOccupantAssignmentResultV1 extends JsonObject {
  schemaVersion: 1;
  status: "BLOCKED_BY_OWNER" | "ASSIGNED";
  reasonCode: string;
  assignment: BastionOccupantAssignmentV1 | null;
  publicSummary: BastionOccupantAssignmentSummaryV1 | null;
  commitId: string | null;
  replayed: boolean;
}

export interface BastionOccupantActivityResultV1 extends JsonObject {
  schemaVersion: 1;
  status: "CALM" | "ACTIVITY_COMMITTED";
  reasonCode: string;
  activity: BastionOccupantActivityV1 | null;
  publicSummary: BastionOccupantActivitySummaryV1 | null;
  commitId: string | null;
  replayed: boolean;
}

export async function assignBastionOccupantV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: AssignBastionOccupantCommandV1;
  catalog: BastionOccupantCatalogV1 | null;
  authority: BastionOccupantAssignmentAuthorityV1 | null;
}): Promise<Result<BastionOccupantAssignmentResultV1>> {
  const issues = validateAssignmentCommand(input.command);
  if (issues.length > 0) return invalid("bastion.occupant-assignment-command-invalid", issues);
  if (input.catalog === null || !nonEmpty(input.catalog.catalogRef)) {
    return invalid("bastion.occupant-catalog-required", ["an explicit occupant catalog is required"]);
  }
  const operationId = opaqueId<OperationId>(
    `bastion-occupant-assignment:${input.command.clientRequestId}`
  );
  const fingerprint = await computeRequestFingerprint(
    "bastion.occupant-assignment",
    1,
    input.command
  );
  const replay = await restoreAssignment(input.repository, operationId, fingerprint);
  if (replay !== null) return replay;

  const role = await input.catalog.resolveRole(input.command.roleDefinitionRef);
  if (role === null) {
    return invalid("bastion.occupant-role-not-found", ["the selected role is absent from the injected catalog"]);
  }
  const roleIssues = validateRole(role, input.command.roleDefinitionRef);
  if (roleIssues.length > 0) return invalid("bastion.occupant-role-invalid", roleIssues);
  const [campaign, registry, npcRegistry, clock] = await Promise.all([
    input.repository.getCampaign(input.campaignId),
    loadBastionRegistryV1(input.repository, input.campaignId),
    loadCampaignNpcRegistryV1(input.repository, input.campaignId),
    loadCampaignClock(input.repository, input.campaignId)
  ]);
  if (!campaign.ok) return campaign;
  if (!registry.ok) return registry;
  if (!npcRegistry.ok) return npcRegistry;
  if (!clock.ok) return clock;
  const bastion = registry.value.state.bastions.find(value =>
    value.bastionId === input.command.bastionId && value.status === "ACTIVE"
  );
  if (bastion === undefined) {
    return invalid("bastion.occupant-target-unavailable", ["the selected active bastion does not exist"]);
  }
  const npc = npcRegistry.value.state.npcs.find(value =>
    value.campaignNpcId === input.command.campaignNpcId
  );
  if (npc === undefined) {
    return invalid("bastion.occupant-campaign-npc-required", [
      "the occupant must already exist in the campaign NPC registry"
    ]);
  }
  const existing = bastion.occupantAssignments.find(value =>
    value.campaignNpcId === npc.campaignNpcId && value.status === "ACTIVE"
  );
  if (existing !== undefined) {
    return invalid("bastion.occupant-already-assigned", ["the campaign NPC already has an active assignment"]);
  }
  if (input.authority === null || !nonEmpty(input.authority.authorityRef)) {
    return blockedAssignment({
      repository: input.repository,
      campaignId: input.campaignId,
      command: input.command,
      operationId,
      fingerprint,
      reasonCode: "OWNER_AUTHORITY_UNAVAILABLE"
    });
  }
  const decision = await input.authority.authorize({
    campaign: campaign.value,
    bastion: cloneJson(bastion),
    npc: cloneJson(npc),
    role: cloneJson(role)
  });
  const decisionIssues = validateOwnerDecision(decision);
  if (decisionIssues.length > 0) {
    return invalid("bastion.occupant-owner-decision-invalid", decisionIssues);
  }
  if (!decision.authorized) {
    return blockedAssignment({
      repository: input.repository,
      campaignId: input.campaignId,
      command: input.command,
      operationId,
      fingerprint,
      reasonCode: decision.reasonCode
    });
  }
  const proof = await verifyCommittedOwnerProof(input.repository, input.campaignId, decision);
  if (!proof.ok) return proof;
  const assignedAtGameSecond = Number(clock.value.payload.elapsedGameSeconds);
  if (!nonNegativeInteger(assignedAtGameSecond)) {
    return invalid("bastion.campaign-clock-invalid", ["elapsedGameSeconds must be a non-negative integer"]);
  }
  const assignment: BastionOccupantAssignmentV1 = {
    schemaVersion: 1,
    assignmentId: `bastion-assignment:${bastion.bastionId}:${npc.campaignNpcId}`,
    campaignNpcId: npc.campaignNpcId,
    actorId: npc.actorId,
    actorDisplayName: npc.displayName,
    roleDefinitionRef: role.roleDefinitionRef,
    roleDisplayName: role.displayName,
    roleCatalogRef: input.catalog.catalogRef,
    authorityRef: input.authority.authorityRef,
    authorityProofRefs: unique([
      ...decision.proofRefs,
      `operation:${decision.sourceOperationId}`,
      `event:${decision.sourceEventId}`
    ]),
    status: "ACTIVE",
    assignedAtGameSecond,
    endedAtGameSecond: null,
    lastActivityAtGameSecond: null,
    activityCount: 0,
    version: 1
  };
  const summary: BastionOccupantAssignmentSummaryV1 = {
    schemaVersion: 1,
    bastionId: bastion.bastionId,
    placeRef: bastion.placeRef,
    placeDisplayName: bastion.placeDisplayName,
    assignmentId: assignment.assignmentId,
    campaignNpcId: npc.campaignNpcId,
    actorDisplayName: npc.displayName,
    roleDefinitionRef: role.roleDefinitionRef,
    roleDisplayName: role.displayName,
    assignedAtGameSecond
  };
  const nextBastion: BastionRecordV1 = {
    ...bastion,
    occupantAssignments: [...bastion.occupantAssignments, assignment],
    version: bastion.version + 1
  };
  const operation = await beginOperation({
    repository: input.repository,
    campaignId: input.campaignId,
    operationId,
    clientRequestId: input.command.clientRequestId,
    fingerprint,
    operationKind: "bastion.occupant-assignment",
    payload: input.command
  });
  if (!operation.ok) return operation;
  const committed = await commitBastionMutation({
    repository: input.repository,
    campaignId: input.campaignId,
    operation: operation.value,
    registryAggregate: registry.value.aggregate!,
    nextRegistry: replaceBastion(registry.value.state, nextBastion),
    commandType: "bastion.assign-occupant",
    commandPayload: {
      bastionId: bastion.bastionId,
      assignmentId: assignment.assignmentId,
      campaignNpcId: npc.campaignNpcId,
      roleDefinitionRef: role.roleDefinitionRef
    },
    eventType: "bastion_occupant_assigned",
    eventPayload: summary,
    occurredAtGameSecond: assignedAtGameSecond
  });
  if (!committed.ok) return committed;
  const result: BastionOccupantAssignmentResultV1 = {
    schemaVersion: 1,
    status: "ASSIGNED",
    reasonCode: decision.reasonCode,
    assignment,
    publicSummary: summary,
    commitId: committed.value.commitId,
    replayed: false
  };
  const completed = await input.repository.completePresentation(
    operationId,
    "COMMITTED_RENDERED",
    1,
    result
  );
  return completed.ok ? { ok: true, value: result } : completed;
}

export async function resolveBastionOccupantActivityBoundaryV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: ResolveBastionOccupantActivityCommandV1;
  catalog: BastionOccupantCatalogV1 | null;
  authority: BastionOccupantActivityAuthorityV1 | null;
}): Promise<Result<BastionOccupantActivityResultV1>> {
  const issues = validateActivityCommand(input.command);
  if (issues.length > 0) return invalid("bastion.occupant-activity-command-invalid", issues);
  if (input.catalog === null || !nonEmpty(input.catalog.catalogRef)) {
    return invalid("bastion.occupant-catalog-required", ["an explicit occupant catalog is required"]);
  }
  const operationId = opaqueId<OperationId>(
    `bastion-occupant-activity:${input.command.clientRequestId}`
  );
  const fingerprint = await computeRequestFingerprint(
    "bastion.occupant-activity",
    1,
    input.command
  );
  const replay = await restoreActivity(input.repository, operationId, fingerprint);
  if (replay !== null) return replay;
  const [campaign, registry, npcRegistry, clock] = await Promise.all([
    input.repository.getCampaign(input.campaignId),
    loadBastionRegistryV1(input.repository, input.campaignId),
    loadCampaignNpcRegistryV1(input.repository, input.campaignId),
    loadCampaignClock(input.repository, input.campaignId)
  ]);
  if (!campaign.ok) return campaign;
  if (!registry.ok) return registry;
  if (!npcRegistry.ok) return npcRegistry;
  if (!clock.ok) return clock;
  const currentGameSecond = Number(clock.value.payload.elapsedGameSeconds);
  if (currentGameSecond !== input.command.occurredAtGameSecond) {
    return invalid("bastion.occupant-activity-clock-mismatch", [
      "the autonomous boundary must cite the authoritative campaign clock"
    ]);
  }
  const bastion = registry.value.state.bastions.find(value =>
    value.bastionId === input.command.bastionId && value.status === "ACTIVE"
  );
  const assignment = bastion?.occupantAssignments.find(value =>
    value.assignmentId === input.command.assignmentId && value.status === "ACTIVE"
  );
  if (bastion === undefined || assignment === undefined) {
    return invalid("bastion.occupant-assignment-unavailable", ["the active assignment does not exist"]);
  }
  const npc = npcRegistry.value.state.npcs.find(value =>
    value.campaignNpcId === assignment.campaignNpcId
  );
  if (npc === undefined || npc.actorId !== assignment.actorId) {
    return invalid("bastion.occupant-campaign-npc-mismatch", ["the persistent NPC no longer matches the assignment"]);
  }
  if (input.authority === null || !nonEmpty(input.authority.authorityRef)) {
    return recordCalmActivity({
      repository: input.repository,
      campaignId: input.campaignId,
      command: input.command,
      operationId,
      fingerprint,
      reasonCode: "ACTIVITY_AUTHORITY_UNAVAILABLE"
    });
  }
  const decision = await input.authority.select({
    campaign: campaign.value,
    bastion: cloneJson(bastion),
    npc: cloneJson(npc),
    assignment: cloneJson(assignment),
    occurredAtGameSecond: input.command.occurredAtGameSecond
  });
  const decisionIssues = validateActivityDecision(decision);
  if (decisionIssues.length > 0) {
    return invalid("bastion.occupant-activity-decision-invalid", decisionIssues);
  }
  if (!decision.authorized || decision.activityDefinitionRef === null) {
    return recordCalmActivity({
      repository: input.repository,
      campaignId: input.campaignId,
      command: input.command,
      operationId,
      fingerprint,
      reasonCode: decision.reasonCode
    });
  }
  const role = await input.catalog.resolveRole(assignment.roleDefinitionRef);
  const activityDefinition = await input.catalog.resolveActivity(decision.activityDefinitionRef);
  if (role === null || activityDefinition === null) {
    return invalid("bastion.occupant-activity-not-catalogued", [
      "the selected role or activity is absent from the injected catalog"
    ]);
  }
  const roleIssues = validateRole(role, assignment.roleDefinitionRef);
  const activityIssues = validateActivityDefinition(
    activityDefinition,
    decision.activityDefinitionRef
  );
  if (roleIssues.length > 0 || activityIssues.length > 0) {
    return invalid("bastion.occupant-activity-definition-invalid", [
      ...roleIssues,
      ...activityIssues
    ]);
  }
  if (!role.allowedActivityRefs.includes(activityDefinition.activityDefinitionRef)) {
    return invalid("bastion.occupant-activity-not-allowed", [
      "the selected activity is not allowed by the assigned role"
    ]);
  }
  if (
    assignment.lastActivityAtGameSecond !== null
    && assignment.lastActivityAtGameSecond + activityDefinition.minimumIntervalSeconds
      > input.command.occurredAtGameSecond
  ) {
    return recordCalmActivity({
      repository: input.repository,
      campaignId: input.campaignId,
      command: input.command,
      operationId,
      fingerprint,
      reasonCode: "MINIMUM_INTERVAL_NOT_REACHED"
    });
  }
  const proof = await verifyCommittedOwnerProof(input.repository, input.campaignId, decision);
  if (!proof.ok) return proof;
  const activity: BastionOccupantActivityV1 = {
    schemaVersion: 1,
    activityId: `bastion-occupant-activity:${input.command.clientRequestId}`,
    assignmentId: assignment.assignmentId,
    campaignNpcId: assignment.campaignNpcId,
    activityDefinitionRef: activityDefinition.activityDefinitionRef,
    activityDisplayName: activityDefinition.displayName,
    authorityRef: input.authority.authorityRef,
    authorityProofRefs: unique([
      ...decision.proofRefs,
      `operation:${decision.sourceOperationId}`,
      `event:${decision.sourceEventId}`
    ]),
    occurredAtGameSecond: input.command.occurredAtGameSecond,
    publicNarrative: activityDefinition.publicNarrative,
    version: 1
  };
  const summary: BastionOccupantActivitySummaryV1 = {
    schemaVersion: 1,
    bastionId: bastion.bastionId,
    placeRef: bastion.placeRef,
    placeDisplayName: bastion.placeDisplayName,
    assignmentId: assignment.assignmentId,
    campaignNpcId: assignment.campaignNpcId,
    actorDisplayName: assignment.actorDisplayName,
    roleDisplayName: assignment.roleDisplayName,
    activityId: activity.activityId,
    activityDefinitionRef: activity.activityDefinitionRef,
    activityDisplayName: activity.activityDisplayName,
    occurredAtGameSecond: activity.occurredAtGameSecond,
    narrative: activity.publicNarrative
  };
  const nextAssignment: BastionOccupantAssignmentV1 = {
    ...assignment,
    lastActivityAtGameSecond: input.command.occurredAtGameSecond,
    activityCount: assignment.activityCount + 1,
    version: assignment.version + 1
  };
  const nextBastion: BastionRecordV1 = {
    ...bastion,
    occupantAssignments: bastion.occupantAssignments.map(value =>
      value.assignmentId === nextAssignment.assignmentId ? nextAssignment : value
    ),
    occupantActivities: [...bastion.occupantActivities, activity],
    version: bastion.version + 1
  };
  const operation = await beginOperation({
    repository: input.repository,
    campaignId: input.campaignId,
    operationId,
    clientRequestId: input.command.clientRequestId,
    fingerprint,
    operationKind: "bastion.occupant-activity",
    payload: input.command
  });
  if (!operation.ok) return operation;
  const committed = await commitBastionMutation({
    repository: input.repository,
    campaignId: input.campaignId,
    operation: operation.value,
    registryAggregate: registry.value.aggregate!,
    nextRegistry: replaceBastion(registry.value.state, nextBastion),
    commandType: "bastion.resolve-occupant-activity",
    commandPayload: {
      bastionId: bastion.bastionId,
      assignmentId: assignment.assignmentId,
      activityDefinitionRef: activity.activityDefinitionRef,
      boundaryKind: input.command.boundaryKind
    },
    eventType: "bastion_occupant_activity_completed",
    eventPayload: summary,
    occurredAtGameSecond: input.command.occurredAtGameSecond
  });
  if (!committed.ok) return committed;
  const result: BastionOccupantActivityResultV1 = {
    schemaVersion: 1,
    status: "ACTIVITY_COMMITTED",
    reasonCode: decision.reasonCode,
    activity,
    publicSummary: summary,
    commitId: committed.value.commitId,
    replayed: false
  };
  const completed = await input.repository.completePresentation(
    operationId,
    "COMMITTED_RENDERED",
    1,
    result
  );
  return completed.ok ? { ok: true, value: result } : completed;
}

export async function loadCampaignNpcRegistryV1(
  repository: CampaignRepository,
  campaignId: CampaignId
): Promise<Result<{ aggregate: AggregateRecord | null; state: CampaignNpcRegistryV1 }>> {
  const aggregate = await repository.getAggregate(
    campaignId,
    CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1,
    campaignNpcRegistryAggregateIdV1(campaignId)
  );
  if (!aggregate.ok) {
    return aggregate.error.code === "NOT_FOUND"
      ? invalid("bastion.campaign-npc-registry-required", [
          "an occupant requires an existing campaign NPC registry"
        ])
      : aggregate;
  }
  const state = aggregate.value.payload as unknown as CampaignNpcRegistryV1;
  if (
    state.schemaVersion !== 1
    || state.contractVersion !== CAMPAIGN_NPC_REGISTRY_CONTRACT_VERSION_V1
    || state.campaignId !== campaignId
    || !Array.isArray(state.npcs)
  ) {
    return invalid("bastion.campaign-npc-registry-invalid", ["campaign NPC registry is invalid"]);
  }
  return { ok: true, value: { aggregate: aggregate.value, state } };
}

async function verifyCommittedOwnerProof(
  repository: CampaignRepository,
  campaignId: CampaignId,
  decision: BastionOwnerProofDecisionV1
): Promise<Result<EventRecord>> {
  const operation = await repository.getOperation(
    opaqueId<OperationId>(decision.sourceOperationId!)
  );
  if (
    !operation.ok
    || operation.value.campaignId !== campaignId
    || operation.value.commitId === null
    || !["COMMITTED_PENDING_RENDER", "COMPLETED"].includes(operation.value.phase)
  ) {
    return invalid("bastion.occupant-owner-proof-not-committed", [
      "the owner decision operation must be committed in this campaign"
    ]);
  }
  let cursor: { commitSequence: number; eventSequence: number } | null = null;
  while (true) {
    const page = await repository.listEvents(campaignId, cursor, 1_024);
    if (!page.ok) return page;
    const found = page.value.find(event =>
      event.eventId === decision.sourceEventId
      && event.operationId === operation.value.operationId
      && event.commitId === operation.value.commitId
    );
    if (found !== undefined) return { ok: true, value: found };
    const last = page.value.at(-1);
    if (last === undefined || page.value.length < 1_024) {
      return invalid("bastion.occupant-owner-proof-event-missing", [
        "the owner decision event is not part of the committed operation"
      ]);
    }
    cursor = { commitSequence: last.commitSequence, eventSequence: last.eventSequence };
  }
}

async function blockedAssignment(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: AssignBastionOccupantCommandV1;
  operationId: OperationId;
  fingerprint: string;
  reasonCode: string;
}): Promise<Result<BastionOccupantAssignmentResultV1>> {
  const operation = await beginOperation({
    ...input,
    clientRequestId: input.command.clientRequestId,
    operationKind: "bastion.occupant-assignment",
    payload: input.command
  });
  if (!operation.ok) return operation;
  const result: BastionOccupantAssignmentResultV1 = {
    schemaVersion: 1,
    status: "BLOCKED_BY_OWNER",
    reasonCode: input.reasonCode,
    assignment: null,
    publicSummary: null,
    commitId: null,
    replayed: false
  };
  const completed = await input.repository.completeWithoutCommit(input.operationId, 1, result);
  return completed.ok ? { ok: true, value: result } : completed;
}

async function recordCalmActivity(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: ResolveBastionOccupantActivityCommandV1;
  operationId: OperationId;
  fingerprint: string;
  reasonCode: string;
}): Promise<Result<BastionOccupantActivityResultV1>> {
  const operation = await beginOperation({
    ...input,
    clientRequestId: input.command.clientRequestId,
    operationKind: "bastion.occupant-activity",
    payload: input.command
  });
  if (!operation.ok) return operation;
  const result: BastionOccupantActivityResultV1 = {
    schemaVersion: 1,
    status: "CALM",
    reasonCode: input.reasonCode,
    activity: null,
    publicSummary: null,
    commitId: null,
    replayed: false
  };
  const completed = await input.repository.completeWithoutCommit(input.operationId, 1, result);
  return completed.ok ? { ok: true, value: result } : completed;
}

async function beginOperation(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operationId: OperationId;
  clientRequestId: string;
  fingerprint: string;
  operationKind: string;
  payload: JsonObject;
}): Promise<Result<OperationRecord>> {
  const campaign = await input.repository.getCampaign(input.campaignId);
  if (!campaign.ok) return campaign;
  const now = new Date().toISOString();
  return input.repository.receiveOperation({
    schemaVersion: 1,
    operationId: input.operationId,
    campaignId: input.campaignId,
    clientRequestId: opaqueId<RequestId>(input.clientRequestId),
    idempotencyKey: opaqueId(input.operationId),
    requestFingerprint: input.fingerprint,
    operationKind: input.operationKind,
    requestPayloadSchemaVersion: 1,
    requestPayload: cloneJson(input.payload),
    phase: "RECEIVED",
    observedCampaignRevision: campaign.value.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: now,
    updatedAt: now
  });
}

async function commitBastionMutation(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operation: OperationRecord;
  registryAggregate: AggregateRecord;
  nextRegistry: BastionRegistryV1;
  commandType: string;
  commandPayload: JsonObject;
  eventType: string;
  eventPayload: JsonObject;
  occurredAtGameSecond: number;
}): Promise<Result<{ commitId: CommitId }>> {
  const preparing = await input.repository.transitionOperation(
    input.operation.operationId,
    "RECEIVED",
    "PREPARING"
  );
  if (!preparing.ok) return preparing;
  const ready = await input.repository.transitionOperation(
    input.operation.operationId,
    "PREPARING",
    "READY_TO_COMMIT"
  );
  if (!ready.ok) return ready;
  const lease = await input.repository.acquireWriterLease(
    input.campaignId,
    opaqueId<WriterId>(`${input.operation.operationId}:writer`),
    120_000
  );
  if (!lease.ok) return lease;
  try {
    const commandId = opaqueId<CommandId>(`${input.operation.operationId}:command`);
    const command: AcceptedCommandDraft = {
      schemaVersion: 1,
      contractId: "bastion-authority",
      contractVersion: 1,
      commandId,
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commandType: input.commandType,
      target: {
        aggregateType: BASTION_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId: input.registryAggregate.aggregateId,
        expectedAggregateRevision: input.registryAggregate.aggregateRevision
      },
      payloadSchemaVersion: 1,
      payload: input.commandPayload,
      acceptedAtGameSecond: input.occurredAtGameSecond
    };
    const event: EventDraft = {
      schemaVersion: 1,
      eventId: opaqueId<EventId>(`${input.operation.operationId}:event`),
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      eventType: input.eventType,
      origin: input.commandType === "bastion.assign-occupant" ? "PLAYER_INTENT" : "RULE",
      causation: { kind: "COMMAND", id: commandId },
      aggregateRefs: [{
        aggregateType: BASTION_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId: input.registryAggregate.aggregateId,
        aggregateRevision: input.registryAggregate.aggregateRevision + 1
      }],
      visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
      occurredAtGameSecond: input.occurredAtGameSecond,
      payloadSchemaVersion: 1,
      payload: input.eventPayload
    };
    return input.repository.commit({
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commitId: opaqueId<CommitId>(`${input.operation.operationId}:commit`),
      idempotencyKey: input.operation.idempotencyKey,
      requestFingerprint: input.operation.requestFingerprint,
      expectedCampaignRevision: input.operation.observedCampaignRevision,
      writerLease: lease.value,
      acceptedCommands: [command],
      aggregateWrites: [{
        aggregateType: BASTION_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId: bastionRegistryAggregateIdV1(input.campaignId),
        expectedAggregateRevision: input.registryAggregate.aggregateRevision,
        payloadSchemaVersion: 1,
        payload: input.nextRegistry
      }],
      events: [event],
      outboxTasks: []
    });
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

async function loadCampaignClock(
  repository: CampaignRepository,
  campaignId: CampaignId
): Promise<Result<AggregateRecord>> {
  const campaign = await repository.getCampaign(campaignId);
  return campaign.ok
    ? repository.getAggregate(campaignId, "world.clock", campaign.value.clockAggregateId)
    : campaign;
}

function replaceBastion(registry: BastionRegistryV1, bastion: BastionRecordV1): BastionRegistryV1 {
  return {
    ...registry,
    bastions: registry.bastions.map(value => value.bastionId === bastion.bastionId ? bastion : value),
    version: registry.version + 1
  };
}

async function restoreAssignment(
  repository: CampaignRepository,
  operationId: OperationId,
  fingerprint: string
): Promise<Result<BastionOccupantAssignmentResultV1> | null> {
  const operation = await repository.getOperation(operationId);
  if (!operation.ok && operation.error.code === "NOT_FOUND") return null;
  if (!operation.ok) return operation;
  if (operation.value.requestFingerprint !== fingerprint) {
    return { ok: false, error: coreError("IDEMPOTENCY_CONFLICT", "bastion.occupant-assignment-conflict") };
  }
  if (operation.value.phase !== "COMPLETED") {
    return invalid("bastion.occupant-assignment-operation-incomplete", ["operation is not completed"]);
  }
  const result = operation.value.resultPayload as unknown as BastionOccupantAssignmentResultV1;
  return { ok: true, value: { ...cloneJson(result), replayed: true } };
}

async function restoreActivity(
  repository: CampaignRepository,
  operationId: OperationId,
  fingerprint: string
): Promise<Result<BastionOccupantActivityResultV1> | null> {
  const operation = await repository.getOperation(operationId);
  if (!operation.ok && operation.error.code === "NOT_FOUND") return null;
  if (!operation.ok) return operation;
  if (operation.value.requestFingerprint !== fingerprint) {
    return { ok: false, error: coreError("IDEMPOTENCY_CONFLICT", "bastion.occupant-activity-conflict") };
  }
  if (operation.value.phase !== "COMPLETED") {
    return invalid("bastion.occupant-activity-operation-incomplete", ["operation is not completed"]);
  }
  const result = operation.value.resultPayload as unknown as BastionOccupantActivityResultV1;
  return { ok: true, value: { ...cloneJson(result), replayed: true } };
}

function validateAssignmentCommand(command: AssignBastionOccupantCommandV1): string[] {
  const issues: string[] = [];
  if (command.schemaVersion !== 1) issues.push("schemaVersion must be 1");
  if (command.contractVersion !== BASTION_OCCUPANT_ASSIGNMENT_CONTRACT_V1) {
    issues.push("contractVersion is invalid");
  }
  [command.clientRequestId, command.bastionId, command.campaignNpcId, command.roleDefinitionRef]
    .forEach(value => { if (!nonEmpty(value)) issues.push("command identities are required"); });
  return issues;
}

function validateActivityCommand(command: ResolveBastionOccupantActivityCommandV1): string[] {
  const issues: string[] = [];
  if (command.schemaVersion !== 1) issues.push("schemaVersion must be 1");
  if (command.contractVersion !== BASTION_OCCUPANT_ACTIVITY_CONTRACT_V1) {
    issues.push("contractVersion is invalid");
  }
  [command.clientRequestId, command.bastionId, command.assignmentId]
    .forEach(value => { if (!nonEmpty(value)) issues.push("command identities are required"); });
  if (!["LOCAL_TIME_BOUNDARY", "LOCAL_EVENT_COMPLETED"].includes(command.boundaryKind)) {
    issues.push("boundaryKind is invalid");
  }
  if (!nonNegativeInteger(command.occurredAtGameSecond)) {
    issues.push("occurredAtGameSecond must be a non-negative integer");
  }
  return issues;
}

function validateRole(role: BastionOccupantRoleDefinitionV1, expectedRef: string): string[] {
  const issues: string[] = [];
  if (
    role.schemaVersion !== 1
    || role.contractVersion !== BASTION_OCCUPANT_CATALOG_CONTRACT_V1
  ) issues.push("role contract is invalid");
  if (role.roleDefinitionRef !== expectedRef) issues.push("roleDefinitionRef mismatch");
  if (!publicText(role.displayName, 120)) issues.push("role displayName is invalid");
  if (
    !Array.isArray(role.allowedActivityRefs)
    || new Set(role.allowedActivityRefs).size !== role.allowedActivityRefs.length
    || role.allowedActivityRefs.some(value => !nonEmpty(value))
  ) issues.push("allowedActivityRefs are invalid");
  return issues;
}

function validateActivityDefinition(
  activity: BastionOccupantActivityDefinitionV1,
  expectedRef: string
): string[] {
  const issues: string[] = [];
  if (
    activity.schemaVersion !== 1
    || activity.contractVersion !== BASTION_OCCUPANT_CATALOG_CONTRACT_V1
  ) issues.push("activity contract is invalid");
  if (activity.activityDefinitionRef !== expectedRef) issues.push("activityDefinitionRef mismatch");
  if (!publicText(activity.displayName, 120)) issues.push("activity displayName is invalid");
  if (!nonNegativeInteger(activity.minimumIntervalSeconds)) {
    issues.push("minimumIntervalSeconds must be a non-negative integer");
  }
  if (!publicText(activity.publicNarrative, 600)) issues.push("publicNarrative is invalid");
  return issues;
}

function validateOwnerDecision(decision: BastionOwnerProofDecisionV1): string[] {
  const issues: string[] = [];
  if (decision.schemaVersion !== 1) issues.push("decision schemaVersion must be 1");
  if (typeof decision.authorized !== "boolean") issues.push("authorized must be boolean");
  if (!nonEmpty(decision.reasonCode)) issues.push("reasonCode is required");
  if (!Array.isArray(decision.proofRefs) || decision.proofRefs.some(value => !nonEmpty(value))) {
    issues.push("proofRefs are invalid");
  }
  if (decision.authorized) {
    if (!nonEmpty(decision.sourceOperationId)) issues.push("authorized decision requires sourceOperationId");
    if (!nonEmpty(decision.sourceEventId)) issues.push("authorized decision requires sourceEventId");
    if (decision.proofRefs.length === 0) issues.push("authorized decision requires proofRefs");
  } else if (
    decision.sourceOperationId !== null
    || decision.sourceEventId !== null
    || decision.proofRefs.length > 0
  ) {
    issues.push("rejected decision cannot expose proof details");
  }
  return issues;
}

function validateActivityDecision(decision: BastionOccupantActivityDecisionV1): string[] {
  const issues = validateOwnerDecision(decision);
  if (decision.authorized && !nonEmpty(decision.activityDefinitionRef)) {
    issues.push("authorized activity requires activityDefinitionRef");
  }
  if (!decision.authorized && decision.activityDefinitionRef !== null) {
    issues.push("calm decision cannot select an activity");
  }
  return issues;
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function publicText(value: unknown, maximumLength: number): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length > 0
    && value.length <= maximumLength
    && !/[\r\n\u0000-\u001f\u007f]/u.test(value);
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function invalid(messageKey: string, issues: string[] = []): Result<never> {
  return {
    ok: false,
    error: coreError("VALIDATION_FAILED", messageKey, { issues })
  };
}
