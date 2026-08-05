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
import { validateAccessControlRecordV1, type AccessControlRecordV1 } from "./accessControl";
import {
  ACCESS_CONTROL_REGISTRY_AGGREGATE_TYPE_V1,
  accessControlRegistryAggregateIdV1,
  loadAccessControlRegistryV1,
  type AccessControlRegistryV1
} from "./accessControlAuthority";
import { validateSkillCheckProposalV1, type SkillCheckProposalV1 } from "./skillCheckProposal";

export const SOCIAL_ACCESS_RESOLUTION_CONTRACT_V1 = "social-access-resolution/1" as const;
export const SOCIAL_ACCESS_ATTEMPT_REGISTRY_CONTRACT_V1 = "social-access-attempt-registry/1" as const;
export const SOCIAL_ACCESS_ATTEMPT_REGISTRY_AGGREGATE_TYPE_V1 = "social-access-attempt.registry" as const;

export type SocialAccessOutcomeV1 = "GRANTED" | "DENIED" | "CONDITION_OFFERED" | "CHECK_REQUIRED";

export interface SocialAccessCheckPolicyV1 extends JsonObject {
  schemaVersion: 1;
  proposal: SkillCheckProposalV1;
  durationSeconds: number;
  success: {
    playerFacingResponse: string;
    requirementRef: string;
    satisfyRequirementRefs: string[];
    waiveRequirementRefs: string[];
    resultingAccessState: "OPEN" | "CONTROLLED";
    sourceRefs: string[];
  };
  failure: {
    playerFacingResponse: string;
    sourceRefs: string[];
  };
  ruleRefs: string[];
}

export interface ResolveSocialAccessCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof SOCIAL_ACCESS_RESOLUTION_CONTRACT_V1;
  clientRequestId: string;
  sourceOperationId: string;
  accessControlRef: string;
  playerActorRef: string;
  targetActorRef: string;
  speechText: string;
  occurredAtGameSecond: number;
}

export interface SocialAccessAuthorizationV1 extends JsonObject {
  schemaVersion: 1;
  authority: "SOCIAL_ACCESS_DOMAIN";
  resolutionRef: string;
  accessControlRef: string;
  respondingActorRef: string;
  outcome: SocialAccessOutcomeV1;
  requirementRef: string | null;
  satisfyRequirementRefs: string[];
  waiveRequirementRefs: string[];
  resultingAccessState: "OPEN" | "CONTROLLED";
  playerFacingResponse: string;
  conditionRef: string | null;
  checkProposalRef: string | null;
  checkPolicy: SocialAccessCheckPolicyV1 | null;
  sourceRefs: string[];
}

export interface SocialAccessAuthorityPortV1 {
  resolve(input: {
    campaignId: CampaignId;
    command: ResolveSocialAccessCommandV1;
    control: AccessControlRecordV1;
  }): Promise<{ ok: true; authorization: SocialAccessAuthorizationV1 } | { ok: false; issues: string[] }>;
}

export interface SocialAccessAttemptRecordV1 extends JsonObject {
  schemaVersion: 1;
  resolutionRef: string;
  accessControlRef: string;
  playerActorRef: string;
  respondingActorRef: string;
  speechText: string;
  outcome: SocialAccessOutcomeV1;
  conditionRef: string | null;
  checkProposalRef: string | null;
  checkResolution: {
    checkId: string;
    rollId: string;
    outcome: "GRANTED" | "DENIED";
    playerFacingResponse: string;
    resolvedAtGameSecond: number;
    sourceRefs: string[];
  } | null;
  occurredAtGameSecond: number;
  sourceRefs: string[];
}

export interface SocialAccessAttemptRegistryV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof SOCIAL_ACCESS_ATTEMPT_REGISTRY_CONTRACT_V1;
  campaignId: string;
  attempts: SocialAccessAttemptRecordV1[];
  version: number;
}

export interface SocialAccessResolutionResultV1 extends JsonObject {
  schemaVersion: 1;
  accessControlRef: string;
  resolutionRef: string;
  playerActorRef: string;
  respondingActorRef: string;
  outcome: SocialAccessOutcomeV1;
  resultingAccessState: "OPEN" | "CONTROLLED";
  playerFacingResponse: string;
  conditionRef: string | null;
  checkProposalRef: string | null;
  checkPolicy: SocialAccessCheckPolicyV1 | null;
  commitId: string;
  replayed: boolean;
}

export function socialAccessAttemptRegistryAggregateIdV1(campaignId: CampaignId): AggregateId {
  return opaqueId<AggregateId>(`agg-social-access-attempts:${campaignId}`);
}

export async function loadSocialAccessAttemptRegistryV1(repository: CampaignRepository, campaignId: CampaignId): Promise<Result<{ aggregate: AggregateRecord | null; state: SocialAccessAttemptRegistryV1 }>> {
  const aggregate = await repository.getAggregate(campaignId, SOCIAL_ACCESS_ATTEMPT_REGISTRY_AGGREGATE_TYPE_V1, socialAccessAttemptRegistryAggregateIdV1(campaignId));
  if (!aggregate.ok) {
    if (aggregate.error.code === "NOT_FOUND") return { ok: true, value: { aggregate: null, state: emptyAttemptRegistry(campaignId) } };
    return aggregate;
  }
  const state = aggregate.value.payload as Partial<SocialAccessAttemptRegistryV1>;
  if (state.schemaVersion !== 1 || state.contractVersion !== SOCIAL_ACCESS_ATTEMPT_REGISTRY_CONTRACT_V1 || state.campaignId !== campaignId || !Array.isArray(state.attempts) || typeof state.version !== "number" || !Number.isInteger(state.version) || state.version < 1 || state.attempts.some(attempt => validateAttempt(attempt as SocialAccessAttemptRecordV1).length > 0) || new Set(state.attempts.map(attempt => (attempt as SocialAccessAttemptRecordV1).resolutionRef)).size !== state.attempts.length) {
    return invalid("social-access.registry-invalid", ["social access attempt registry payload is invalid"]);
  }
  return { ok: true, value: { aggregate: aggregate.value, state: state as SocialAccessAttemptRegistryV1 } };
}

export async function resolveSocialAccessV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: ResolveSocialAccessCommandV1;
  authorityPort: SocialAccessAuthorityPortV1;
  operation?: OperationRecord;
}): Promise<Result<SocialAccessResolutionResultV1>> {
  const commandIssues = validateCommand(input.command);
  if (commandIssues.length > 0) return invalid("social-access.command-invalid", commandIssues);
  const operationId = input.operation?.operationId ?? opaqueId<OperationId>(`resolve-social-access:${input.command.clientRequestId}`);
  const fingerprint = input.operation?.requestFingerprint ?? await computeRequestFingerprint("social.access.resolve", 1, input.command);
  if (input.operation !== undefined) {
    if (input.operation.campaignId !== input.campaignId || input.operation.phase !== "RECEIVED" || input.command.sourceOperationId !== input.operation.operationId) {
      return invalid("social-access.bound-operation-invalid", ["received source operation from the same campaign required"]);
    }
  } else {
    const existing = await input.repository.getOperation(operationId);
    if (existing.ok && existing.value.requestFingerprint !== fingerprint) return { ok: false, error: coreError("IDEMPOTENCY_CONFLICT", "social-access.request-conflict") };
    if (existing.ok && existing.value.phase === "COMPLETED") return restore(existing.value);
    if (existing.ok) return invalid("social-access.operation-incomplete", [existing.value.phase]);
    if (existing.error.code !== "NOT_FOUND") return existing;
  }

  const [campaign, sourceOperation, accessRegistry, attemptRegistry] = await Promise.all([
    input.repository.getCampaign(input.campaignId),
    input.repository.getOperation(opaqueId<OperationId>(input.command.sourceOperationId)),
    loadAccessControlRegistryV1(input.repository, input.campaignId),
    loadSocialAccessAttemptRegistryV1(input.repository, input.campaignId)
  ]);
  if (!campaign.ok) return campaign;
  if (!sourceOperation.ok) return sourceOperation;
  if (!accessRegistry.ok) return accessRegistry;
  if (!attemptRegistry.ok) return attemptRegistry;
  const sourceIsBound = input.operation !== undefined && sourceOperation.value.operationId === input.operation.operationId && sourceOperation.value.phase === "RECEIVED";
  if (sourceOperation.value.campaignId !== input.campaignId || (!sourceIsBound && sourceOperation.value.phase !== "COMPLETED")) {
    return invalid("social-access.source-operation-invalid", ["completed source operation, or bound received operation, is required"]);
  }
  const control = accessRegistry.value.state.controls.find(entry => entry.accessControlRef === input.command.accessControlRef);
  if (control === undefined) return invalid("social-access.control-not-found", [input.command.accessControlRef]);
  if (control.state !== "CONTROLLED") return invalid("social-access.control-not-controlled", [control.state]);
  const decision = await input.authorityPort.resolve({ campaignId: input.campaignId, command: input.command, control });
  if (!decision.ok) return invalid("social-access.authority-rejected", decision.issues);
  const authorization = decision.authorization;
  const authorizationIssues = validateAuthorization(input.command, control, authorization);
  if (authorizationIssues.length > 0) return invalid("social-access.authorization-invalid", authorizationIssues);
  const nextControlResult = applyAuthorization(control, authorization);
  if (!nextControlResult.ok) return invalid("social-access.authorization-result-invalid", nextControlResult.issues);
  const attempt: SocialAccessAttemptRecordV1 = {
    schemaVersion: 1,
    resolutionRef: authorization.resolutionRef,
    accessControlRef: control.accessControlRef,
    playerActorRef: input.command.playerActorRef,
    respondingActorRef: authorization.respondingActorRef,
    speechText: input.command.speechText.trim(),
    outcome: authorization.outcome,
    conditionRef: authorization.conditionRef,
    checkProposalRef: authorization.checkProposalRef,
    checkResolution: null,
    occurredAtGameSecond: input.command.occurredAtGameSecond,
    sourceRefs: [...authorization.sourceRefs]
  };
  if (attemptRegistry.value.state.attempts.some(entry => entry.resolutionRef === attempt.resolutionRef)) return invalid("social-access.resolution-ref-conflict", [attempt.resolutionRef]);
  const nextAttemptRegistry: SocialAccessAttemptRegistryV1 = {
    ...cloneJson(attemptRegistry.value.state),
    attempts: [...attemptRegistry.value.state.attempts.map(entry => cloneJson(entry)), attempt],
    version: attemptRegistry.value.state.version + 1
  };
  const nextAccessRegistry: AccessControlRegistryV1 = {
    ...cloneJson(accessRegistry.value.state),
    controls: accessRegistry.value.state.controls.map(entry => entry.accessControlRef === control.accessControlRef ? nextControlResult.control : cloneJson(entry)),
    version: accessRegistry.value.state.version + (nextControlResult.changed ? 1 : 0)
  };
  const started = input.operation === undefined
    ? await beginOperation(input.repository, input.campaignId, operationId, input.command, fingerprint, campaign.value.campaignRevision)
    : await prepareBoundOperation(input.repository, input.operation);
  if (!started.ok) return started;
  const committed = await commitResolution({
    repository: input.repository,
    campaignId: input.campaignId,
    operation: started.value,
    command: input.command,
    currentAccessRegistry: accessRegistry.value.aggregate,
    currentAttemptRegistry: attemptRegistry.value.aggregate,
    nextAccessRegistry,
    nextAttemptRegistry,
    accessChanged: nextControlResult.changed,
    control: nextControlResult.control,
    authorization
  });
  if (!committed.ok) return committed;
  const result: SocialAccessResolutionResultV1 = {
    schemaVersion: 1,
    accessControlRef: control.accessControlRef,
    resolutionRef: authorization.resolutionRef,
    playerActorRef: input.command.playerActorRef,
    respondingActorRef: authorization.respondingActorRef,
    outcome: authorization.outcome,
    resultingAccessState: nextControlResult.control.state as "OPEN" | "CONTROLLED",
    playerFacingResponse: authorization.playerFacingResponse,
    conditionRef: authorization.conditionRef,
    checkProposalRef: authorization.checkProposalRef,
    checkPolicy: authorization.checkPolicy,
    commitId: committed.value.commitId,
    replayed: false
  };
  if (input.operation !== undefined) return { ok: true, value: result };
  const completed = await input.repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, result);
  return completed.ok ? { ok: true, value: result } : completed;
}

function applyAuthorization(control: AccessControlRecordV1, authorization: SocialAccessAuthorizationV1): { ok: true; control: AccessControlRecordV1; changed: boolean } | { ok: false; issues: string[] } {
  if (authorization.outcome !== "GRANTED") return { ok: true, control: cloneJson(control), changed: false };
  const satisfy = new Set(authorization.satisfyRequirementRefs);
  const waive = new Set(authorization.waiveRequirementRefs);
  const requirements = control.requirements.map(requirement => satisfy.has(requirement.requirementRef)
    ? { ...cloneJson(requirement), status: "SATISFIED" as const }
    : waive.has(requirement.requirementRef)
      ? { ...cloneJson(requirement), status: "WAIVED" as const }
      : cloneJson(requirement));
  const next: AccessControlRecordV1 = { ...cloneJson(control), state: authorization.resultingAccessState, requirements, version: control.version + 1 };
  const issues = validateAccessControlRecordV1(next);
  if (next.state === "OPEN" && requirements.some(requirement => requirement.status === "ACTIVE")) issues.push("OPEN result leaves active requirements");
  return issues.length === 0 ? { ok: true, control: next, changed: true } : { ok: false, issues };
}

function validateAuthorization(command: ResolveSocialAccessCommandV1, control: AccessControlRecordV1, value: SocialAccessAuthorizationV1): string[] {
  const issues: string[] = [];
  if (value.schemaVersion !== 1 || value.authority !== "SOCIAL_ACCESS_DOMAIN" || !value.resolutionRef.trim()) issues.push("social access authorization contract is invalid");
  if (!["GRANTED", "DENIED", "CONDITION_OFFERED", "CHECK_REQUIRED"].includes(value.outcome)) issues.push("social access outcome is invalid");
  if (value.accessControlRef !== command.accessControlRef || value.respondingActorRef !== command.targetActorRef) issues.push("social access identity mismatch");
  if (!value.playerFacingResponse.trim() || value.sourceRefs.length === 0 || value.sourceRefs.some(ref => !ref.trim())) issues.push("visible response and source refs are required");
  const known = new Set(control.requirements.map(entry => entry.requirementRef));
  const touched = [...value.satisfyRequirementRefs, ...value.waiveRequirementRefs];
  if (touched.some(ref => !known.has(ref)) || new Set(touched).size !== touched.length) issues.push("requirement mappings are invalid or duplicated");
  if (value.outcome === "GRANTED") {
    const requirement = value.requirementRef === null ? null : control.requirements.find(entry => entry.requirementRef === value.requirementRef);
    if (requirement === null || requirement === undefined || requirement.status !== "ACTIVE" || requirement.kind !== "SOCIAL_PERMISSION" || requirement.ownerDomain !== "social") issues.push("grant requires an active social permission requirement");
    if (value.requirementRef !== null && !value.satisfyRequirementRefs.includes(value.requirementRef)) issues.push("granted social requirement must be satisfied");
    if (value.conditionRef !== null || value.checkProposalRef !== null) issues.push("grant cannot retain a condition or pending check");
  } else {
    if (touched.length > 0 || value.resultingAccessState !== "CONTROLLED" || value.requirementRef !== null) issues.push("non-granted outcome cannot mutate access requirements");
  }
  if (value.outcome === "CONDITION_OFFERED" ? value.conditionRef === null : value.conditionRef !== null) issues.push("conditionRef must match CONDITION_OFFERED");
  if (value.outcome === "CHECK_REQUIRED" ? value.checkProposalRef === null : value.checkProposalRef !== null) issues.push("checkProposalRef must match CHECK_REQUIRED");
  if (value.outcome === "CHECK_REQUIRED" ? value.checkPolicy === null : value.checkPolicy !== null) issues.push("checkPolicy must match CHECK_REQUIRED");
  if (value.checkPolicy !== null) issues.push(...validateCheckPolicy(control, value));
  return issues;
}

function validateAttempt(value: SocialAccessAttemptRecordV1): string[] {
  const issues: string[] = [];
  if (value.schemaVersion !== 1 || !value.resolutionRef?.trim() || !value.accessControlRef?.trim() || !value.playerActorRef?.trim() || !value.respondingActorRef?.trim() || !value.speechText?.trim()) issues.push("social access attempt identities and speech are invalid");
  if (!["GRANTED", "DENIED", "CONDITION_OFFERED", "CHECK_REQUIRED"].includes(value.outcome)) issues.push("social access attempt outcome is invalid");
  if (!Number.isInteger(value.occurredAtGameSecond) || value.occurredAtGameSecond < 0 || !Array.isArray(value.sourceRefs) || value.sourceRefs.length === 0) issues.push("social access attempt time or sources are invalid");
  if (value.outcome === "CONDITION_OFFERED" ? value.conditionRef === null : value.conditionRef !== null) issues.push("social access attempt condition is inconsistent");
  if (value.outcome === "CHECK_REQUIRED" ? value.checkProposalRef === null : value.checkProposalRef !== null) issues.push("social access attempt check is inconsistent");
  if (value.checkResolution != null) {
    if (value.outcome !== "CHECK_REQUIRED" || value.checkProposalRef !== value.checkResolution.checkId) issues.push("social access check resolution is not bound to its proposal");
    if (!["GRANTED", "DENIED"].includes(value.checkResolution.outcome) || !value.checkResolution.rollId.trim() || !value.checkResolution.playerFacingResponse.trim()) issues.push("social access check resolution is invalid");
    if (!Number.isInteger(value.checkResolution.resolvedAtGameSecond) || value.checkResolution.resolvedAtGameSecond < value.occurredAtGameSecond) issues.push("social access check resolution time is invalid");
  }
  return issues;
}

function validateCheckPolicy(control: AccessControlRecordV1, authorization: SocialAccessAuthorizationV1): string[] {
  const policy = authorization.checkPolicy;
  if (policy === null) return [];
  const issues: string[] = [];
  const proposalValidation = validateSkillCheckProposalV1(policy.proposal);
  if (!proposalValidation.ok) issues.push(...proposalValidation.issues.map(issue => `check proposal: ${issue}`));
  if (policy.schemaVersion !== 1 || policy.proposal.domain !== "social" || policy.proposal.checkId !== authorization.checkProposalRef) issues.push("social check proposal identity is invalid");
  if (policy.proposal.targetRef !== authorization.respondingActorRef) issues.push("social check target must be the responding actor");
  if (policy.proposal.difficulty.status !== "RULE_RESOLVED" || policy.proposal.characterContext === null) issues.push("social check proposal must be ready to roll");
  if (!Number.isInteger(policy.durationSeconds) || policy.durationSeconds < 0) issues.push("social check duration is invalid");
  const known = new Set(control.requirements.map(requirement => requirement.requirementRef));
  const touched = [...policy.success.satisfyRequirementRefs, ...policy.success.waiveRequirementRefs];
  if (!known.has(policy.success.requirementRef) || touched.some(ref => !known.has(ref)) || !policy.success.satisfyRequirementRefs.includes(policy.success.requirementRef)) issues.push("social check success requirements are invalid");
  if (policy.success.resultingAccessState === "OPEN") {
    const remaining = control.requirements.filter(requirement => requirement.status === "ACTIVE" && !touched.includes(requirement.requirementRef));
    if (remaining.length > 0) issues.push("social check success cannot open while requirements remain active");
  }
  if (!policy.success.playerFacingResponse.trim() || !policy.failure.playerFacingResponse.trim()) issues.push("social check outcome responses are required");
  if (policy.success.sourceRefs.length === 0 || policy.failure.sourceRefs.length === 0 || policy.ruleRefs.length === 0) issues.push("social check outcome sources and rules are required");
  return issues;
}

function validateCommand(command: ResolveSocialAccessCommandV1): string[] {
  const issues: string[] = [];
  if (command.schemaVersion !== 1 || command.contractVersion !== SOCIAL_ACCESS_RESOLUTION_CONTRACT_V1) issues.push("social access command contract mismatch");
  for (const value of [command.clientRequestId, command.sourceOperationId, command.accessControlRef, command.playerActorRef, command.targetActorRef, command.speechText]) if (!value.trim()) issues.push("command identities and speech are required");
  if (!Number.isInteger(command.occurredAtGameSecond) || command.occurredAtGameSecond < 0) issues.push("occurredAtGameSecond is invalid");
  return issues;
}

function emptyAttemptRegistry(campaignId: CampaignId): SocialAccessAttemptRegistryV1 {
  return { schemaVersion: 1, contractVersion: SOCIAL_ACCESS_ATTEMPT_REGISTRY_CONTRACT_V1, campaignId, attempts: [], version: 1 };
}

async function beginOperation(repository: CampaignRepository, campaignId: CampaignId, operationId: OperationId, command: ResolveSocialAccessCommandV1, fingerprint: string, campaignRevision: number): Promise<Result<OperationRecord>> {
  const now = new Date().toISOString();
  const received = await repository.receiveOperation({ schemaVersion: 1, operationId, campaignId, clientRequestId: opaqueId<RequestId>(command.clientRequestId), idempotencyKey: opaqueId<IdempotencyKey>(operationId), requestFingerprint: fingerprint, operationKind: "social.access.resolve", requestPayloadSchemaVersion: 1, requestPayload: cloneJson(command), phase: "RECEIVED", observedCampaignRevision: campaignRevision, commitId: null, completionMode: null, resultPayloadSchemaVersion: null, resultPayload: null, failure: null, receivedAt: now, updatedAt: now });
  if (!received.ok) return received;
  const preparing = await repository.transitionOperation(operationId, "RECEIVED", "PREPARING");
  if (!preparing.ok) return preparing;
  return repository.transitionOperation(operationId, "PREPARING", "READY_TO_COMMIT");
}

async function prepareBoundOperation(repository: CampaignRepository, operation: OperationRecord): Promise<Result<OperationRecord>> {
  const preparing = await repository.transitionOperation(operation.operationId, "RECEIVED", "PREPARING");
  if (!preparing.ok) return preparing;
  return repository.transitionOperation(operation.operationId, "PREPARING", "READY_TO_COMMIT");
}

async function commitResolution(input: {
  repository: CampaignRepository; campaignId: CampaignId; operation: OperationRecord; command: ResolveSocialAccessCommandV1;
  currentAccessRegistry: AggregateRecord | null; currentAttemptRegistry: AggregateRecord | null;
  nextAccessRegistry: AccessControlRegistryV1; nextAttemptRegistry: SocialAccessAttemptRegistryV1; accessChanged: boolean;
  control: AccessControlRecordV1; authorization: SocialAccessAuthorizationV1;
}): Promise<Result<{ commitId: CommitId }>> {
  const lease = await input.repository.acquireWriterLease(input.campaignId, opaqueId<WriterId>(`${input.operation.operationId}:writer`), 120_000);
  if (!lease.ok) return lease;
  try {
    const accessAggregateId = accessControlRegistryAggregateIdV1(input.campaignId);
    const attemptAggregateId = socialAccessAttemptRegistryAggregateIdV1(input.campaignId);
    const acceptedCommand: AcceptedCommandDraft = { schemaVersion: 1, contractId: "social-access-resolution", contractVersion: 1, commandId: opaqueId(`${input.operation.operationId}:command`), campaignId: input.campaignId, operationId: input.operation.operationId, commandType: "social.access.resolve", target: { aggregateType: SOCIAL_ACCESS_ATTEMPT_REGISTRY_AGGREGATE_TYPE_V1, aggregateId: attemptAggregateId, expectedAggregateRevision: input.currentAttemptRegistry?.aggregateRevision ?? null }, payloadSchemaVersion: 1, payload: { accessControlRef: input.control.accessControlRef, resolutionRef: input.authorization.resolutionRef, outcome: input.authorization.outcome, respondingActorRef: input.authorization.respondingActorRef }, acceptedAtGameSecond: input.command.occurredAtGameSecond };
    const writes: CommitRequest["aggregateWrites"] = [{ aggregateType: SOCIAL_ACCESS_ATTEMPT_REGISTRY_AGGREGATE_TYPE_V1, aggregateId: attemptAggregateId, expectedAggregateRevision: input.currentAttemptRegistry?.aggregateRevision ?? null, payloadSchemaVersion: 1, payload: cloneJson(input.nextAttemptRegistry) }];
    if (input.accessChanged) writes.push({ aggregateType: ACCESS_CONTROL_REGISTRY_AGGREGATE_TYPE_V1, aggregateId: accessAggregateId, expectedAggregateRevision: input.currentAccessRegistry?.aggregateRevision ?? null, payloadSchemaVersion: 1, payload: cloneJson(input.nextAccessRegistry) });
    const event: EventDraft = { schemaVersion: 1, eventId: opaqueId<EventId>(`${input.operation.operationId}:event`), campaignId: input.campaignId, operationId: input.operation.operationId, eventType: `social.access.${input.authorization.outcome.toLowerCase()}`, origin: "PLAYER_INTENT", causation: { kind: "COMMAND", id: acceptedCommand.commandId }, aggregateRefs: writes.map(write => ({ aggregateType: write.aggregateType, aggregateId: write.aggregateId, aggregateRevision: write.expectedAggregateRevision === null ? 0 : write.expectedAggregateRevision + 1 })), visibility: { scope: "PLAYER_VISIBLE", actorIds: [] }, occurredAtGameSecond: input.command.occurredAtGameSecond, payloadSchemaVersion: 1, payload: { accessControlRef: input.control.accessControlRef, resolutionRef: input.authorization.resolutionRef, outcome: input.authorization.outcome, resultingAccessState: input.control.state } };
    const committed = await input.repository.commit({ campaignId: input.campaignId, operationId: input.operation.operationId, commitId: opaqueId<CommitId>(`${input.operation.operationId}:commit`), idempotencyKey: input.operation.idempotencyKey, requestFingerprint: input.operation.requestFingerprint, expectedCampaignRevision: input.operation.observedCampaignRevision, writerLease: lease.value, acceptedCommands: [acceptedCommand], aggregateWrites: writes, events: [event], outboxTasks: [] });
    return committed.ok ? { ok: true, value: { commitId: committed.value.commitId } } : committed;
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

function restore(operation: OperationRecord): Result<SocialAccessResolutionResultV1> {
  const result = operation.resultPayload as Partial<SocialAccessResolutionResultV1> | null;
  if (result?.schemaVersion !== 1 || typeof result.accessControlRef !== "string" || typeof result.commitId !== "string") return invalid("social-access.result-invalid", ["completed result invalid"]);
  return { ok: true, value: { ...result, replayed: true } as SocialAccessResolutionResultV1 };
}

function invalid<T>(messageKey: string, issues: string[]): Result<T> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey, { issues }) };
}
