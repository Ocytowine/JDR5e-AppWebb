import type { CharacterAggregatePayloadV1 } from "../bootstrap";
import {
  cloneJson,
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
  type JsonObject,
  type OperationRecord,
  type Result,
  type WriterId
} from "../core";
import type { AccessControlRecordV1 } from "./accessControl";
import { loadAccessControlRegistryV1 } from "./accessControlAuthority";
import { validateSkillCheckProposalV1, type SkillCheckProposalV1 } from "./skillCheckProposal";

export const RULES_ACCESS_CHECK_CONTRACT_V1 = "rules-access-check/1" as const;
export const RULES_ACCESS_ATTEMPT_REGISTRY_CONTRACT_V1 = "rules-access-attempt-registry/1" as const;
export const RULES_ACCESS_ATTEMPT_REGISTRY_AGGREGATE_TYPE_V1 = "rules-access-attempt.registry" as const;

export type RulesAccessMethodV1 = "FORCE" | "LOCKPICK";
export type RulesAccessNoiseV1 = "NONE" | "AUDIBLE" | "LOUD";

export interface RulesAccessCheckPolicyV1 extends JsonObject {
  schemaVersion: 1;
  proposal: SkillCheckProposalV1;
  method: RulesAccessMethodV1;
  deviceRef: string;
  requiredItemIds: string[];
  durationSeconds: number;
  success: {
    playerFacingText: string;
    satisfyRequirementRefs: string[];
    waiveRequirementRefs: string[];
    resultingAccessState: "OPEN" | "CONTROLLED";
    noise: RulesAccessNoiseV1;
    consumedItemInstanceIds: string[];
    sourceRefs: string[];
  };
  failure: {
    playerFacingText: string;
    resultingAccessState: "CONTROLLED" | "BLOCKED";
    noise: RulesAccessNoiseV1;
    consumedItemInstanceIds: string[];
    sourceRefs: string[];
  };
  ruleRefs: string[];
}

export interface BeginRulesAccessCheckCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof RULES_ACCESS_CHECK_CONTRACT_V1;
  clientRequestId: string;
  sourceOperationId: string;
  accessControlRef: string;
  characterAggregateId: string;
  actorRef: string;
  deviceRef: string;
  method: RulesAccessMethodV1;
  toolItemInstanceId: string | null;
  occurredAtGameSecond: number;
}

export interface RulesAccessAuthorizationV1 extends JsonObject {
  schemaVersion: 1;
  authority: "RULES_ACCESS_DOMAIN";
  resolutionRef: string;
  accessControlRef: string;
  actorRef: string;
  deviceRef: string;
  method: RulesAccessMethodV1;
  toolItemInstanceId: string | null;
  checkPolicy: RulesAccessCheckPolicyV1;
  sourceRefs: string[];
}

export interface RulesAccessAuthorityPortV1 {
  authorize(input: {
    campaignId: CampaignId;
    command: BeginRulesAccessCheckCommandV1;
    control: AccessControlRecordV1;
    character: CharacterAggregatePayloadV1;
  }): Promise<{ ok: true; authorization: RulesAccessAuthorizationV1 } | { ok: false; issues: string[] }>;
}

export interface RulesAccessAttemptRecordV1 extends JsonObject {
  schemaVersion: 1;
  resolutionRef: string;
  accessControlRef: string;
  actorRef: string;
  deviceRef: string;
  method: RulesAccessMethodV1;
  toolItemInstanceId: string | null;
  checkId: string;
  checkResolution: {
    rollId: string;
    outcome: "SUCCESS" | "FAILURE";
    resultingAccessState: "OPEN" | "CONTROLLED" | "BLOCKED";
    noise: RulesAccessNoiseV1;
    consumedItemInstanceIds: string[];
    playerFacingText: string;
    resolvedAtGameSecond: number;
    sourceRefs: string[];
  } | null;
  occurredAtGameSecond: number;
  sourceRefs: string[];
}

export interface RulesAccessAttemptRegistryV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof RULES_ACCESS_ATTEMPT_REGISTRY_CONTRACT_V1;
  campaignId: string;
  attempts: RulesAccessAttemptRecordV1[];
  version: number;
}

export interface BeginRulesAccessCheckResultV1 extends JsonObject {
  schemaVersion: 1;
  resolutionRef: string;
  accessControlRef: string;
  actorRef: string;
  deviceRef: string;
  method: RulesAccessMethodV1;
  checkPolicy: RulesAccessCheckPolicyV1;
  playerFacingText: string;
  commitId: string;
}

export function rulesAccessAttemptRegistryAggregateIdV1(campaignId: CampaignId): AggregateId {
  return opaqueId<AggregateId>(`agg-rules-access-attempts:${campaignId}`);
}

export async function loadRulesAccessAttemptRegistryV1(
  repository: CampaignRepository,
  campaignId: CampaignId
): Promise<Result<{ aggregate: AggregateRecord | null; state: RulesAccessAttemptRegistryV1 }>> {
  const aggregate = await repository.getAggregate(
    campaignId,
    RULES_ACCESS_ATTEMPT_REGISTRY_AGGREGATE_TYPE_V1,
    rulesAccessAttemptRegistryAggregateIdV1(campaignId)
  );
  if (!aggregate.ok) {
    return aggregate.error.code === "NOT_FOUND"
      ? { ok: true, value: { aggregate: null, state: emptyRegistry(campaignId) } }
      : aggregate;
  }
  const state = aggregate.value.payload as Partial<RulesAccessAttemptRegistryV1>;
  if (
    state.schemaVersion !== 1
    || state.contractVersion !== RULES_ACCESS_ATTEMPT_REGISTRY_CONTRACT_V1
    || state.campaignId !== campaignId
    || !Array.isArray(state.attempts)
    || !Number.isInteger(state.version)
  ) return invalid("rules-access.registry-invalid", ["rules access attempt registry payload is invalid"]);
  return { ok: true, value: { aggregate: aggregate.value, state: state as RulesAccessAttemptRegistryV1 } };
}

export async function beginRulesAccessCheckV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operation: OperationRecord;
  command: BeginRulesAccessCheckCommandV1;
  authorityPort: RulesAccessAuthorityPortV1;
}): Promise<Result<BeginRulesAccessCheckResultV1>> {
  const issues = validateCommand(input.command);
  if (issues.length > 0) return invalid("rules-access.command-invalid", issues);
  if (
    input.operation.campaignId !== input.campaignId
    || input.operation.phase !== "RECEIVED"
    || input.command.sourceOperationId !== input.operation.operationId
  ) return invalid("rules-access.bound-operation-invalid", ["received source operation from the same campaign required"]);
  const [access, attempts, character] = await Promise.all([
    loadAccessControlRegistryV1(input.repository, input.campaignId),
    loadRulesAccessAttemptRegistryV1(input.repository, input.campaignId),
    input.repository.getAggregate(input.campaignId, "character.state", opaqueId<AggregateId>(input.command.characterAggregateId))
  ]);
  if (!access.ok) return access;
  if (!attempts.ok) return attempts;
  if (!character.ok) return character;
  const control = access.value.state.controls.find(entry => entry.accessControlRef === input.command.accessControlRef);
  if (control === undefined || control.state !== "CONTROLLED") {
    return invalid("rules-access.control-not-controlled", [input.command.accessControlRef]);
  }
  const decision = await input.authorityPort.authorize({
    campaignId: input.campaignId,
    command: input.command,
    control,
    character: character.value.payload as unknown as CharacterAggregatePayloadV1
  });
  if (!decision.ok) return invalid("rules-access.authority-rejected", decision.issues);
  const authorizationIssues = validateAuthorization(input.command, control, decision.authorization);
  if (authorizationIssues.length > 0) return invalid("rules-access.authorization-invalid", authorizationIssues);
  if (attempts.value.state.attempts.some(attempt => attempt.resolutionRef === decision.authorization.resolutionRef)) {
    return invalid("rules-access.resolution-ref-conflict", [decision.authorization.resolutionRef]);
  }
  const attempt: RulesAccessAttemptRecordV1 = {
    schemaVersion: 1,
    resolutionRef: decision.authorization.resolutionRef,
    accessControlRef: input.command.accessControlRef,
    actorRef: input.command.actorRef,
    deviceRef: input.command.deviceRef,
    method: input.command.method,
    toolItemInstanceId: input.command.toolItemInstanceId,
    checkId: decision.authorization.checkPolicy.proposal.checkId,
    checkResolution: null,
    occurredAtGameSecond: input.command.occurredAtGameSecond,
    sourceRefs: [...decision.authorization.sourceRefs]
  };
  const nextRegistry: RulesAccessAttemptRegistryV1 = {
    ...cloneJson(attempts.value.state),
    attempts: [...attempts.value.state.attempts.map(cloneJson), attempt],
    version: attempts.value.state.version + 1
  };
  const preparing = await input.repository.transitionOperation(input.operation.operationId, "RECEIVED", "PREPARING");
  if (!preparing.ok) return preparing;
  const ready = await input.repository.transitionOperation(input.operation.operationId, "PREPARING", "READY_TO_COMMIT");
  if (!ready.ok) return ready;
  const committed = await commitAttempt({
    repository: input.repository,
    campaignId: input.campaignId,
    operation: ready.value,
    command: input.command,
    authorization: decision.authorization,
    currentRegistry: attempts.value.aggregate,
    nextRegistry
  });
  if (!committed.ok) return committed;
  return { ok: true, value: {
    schemaVersion: 1,
    resolutionRef: decision.authorization.resolutionRef,
    accessControlRef: input.command.accessControlRef,
    actorRef: input.command.actorRef,
    deviceRef: input.command.deviceRef,
    method: input.command.method,
    checkPolicy: decision.authorization.checkPolicy,
    playerFacingText: "L'action mécanique est préparée ; son issue dépend du test proposé.",
    commitId: committed.value.commitId
  } };
}

function validateCommand(command: BeginRulesAccessCheckCommandV1): string[] {
  const issues: string[] = [];
  if (command.schemaVersion !== 1 || command.contractVersion !== RULES_ACCESS_CHECK_CONTRACT_V1) issues.push("rules access command contract mismatch");
  for (const value of [command.clientRequestId, command.sourceOperationId, command.accessControlRef, command.characterAggregateId, command.actorRef, command.deviceRef]) if (!value.trim()) issues.push("rules access identities are required");
  if (!["FORCE", "LOCKPICK"].includes(command.method)) issues.push("rules access method is invalid");
  if (!Number.isInteger(command.occurredAtGameSecond) || command.occurredAtGameSecond < 0) issues.push("occurredAtGameSecond is invalid");
  return issues;
}

function validateAuthorization(
  command: BeginRulesAccessCheckCommandV1,
  control: AccessControlRecordV1,
  authorization: RulesAccessAuthorizationV1
): string[] {
  const issues: string[] = [];
  if (authorization.schemaVersion !== 1 || authorization.authority !== "RULES_ACCESS_DOMAIN" || !authorization.resolutionRef.trim()) issues.push("rules access authorization contract is invalid");
  if (authorization.accessControlRef !== command.accessControlRef || authorization.actorRef !== command.actorRef || authorization.deviceRef !== command.deviceRef || authorization.method !== command.method || authorization.toolItemInstanceId !== command.toolItemInstanceId) issues.push("rules access authorization identity mismatch");
  if (authorization.sourceRefs.length === 0 || authorization.sourceRefs.some(ref => !ref.trim())) issues.push("rules access sources are required");
  const policy = authorization.checkPolicy;
  const proposal = validateSkillCheckProposalV1(policy.proposal);
  if (!proposal.ok) issues.push(...proposal.issues);
  if (policy.schemaVersion !== 1 || policy.method !== command.method || policy.deviceRef !== command.deviceRef || policy.proposal.domain !== "rules" || policy.proposal.targetRef !== command.deviceRef || policy.proposal.difficulty.status !== "RULE_RESOLVED" || policy.proposal.characterContext === null) issues.push("rules access proposal is not ready or mismatched");
  if (policy.requiredItemIds.length > 0 && command.toolItemInstanceId === null) issues.push("required rules access tool is missing");
  const known = new Set(control.requirements.map(requirement => requirement.requirementRef));
  const touched = [...policy.success.satisfyRequirementRefs, ...policy.success.waiveRequirementRefs];
  if (touched.some(ref => !known.has(ref)) || new Set(touched).size !== touched.length) issues.push("rules access requirement mapping is invalid");
  if (policy.success.resultingAccessState === "OPEN" && control.requirements.some(requirement => requirement.status === "ACTIVE" && !touched.includes(requirement.requirementRef))) issues.push("rules success cannot open while requirements remain active");
  if (policy.success.consumedItemInstanceIds.some(id => id !== command.toolItemInstanceId) || policy.failure.consumedItemInstanceIds.some(id => id !== command.toolItemInstanceId)) issues.push("rules access cannot consume another item instance");
  if (!Number.isInteger(policy.durationSeconds) || policy.durationSeconds <= 0 || policy.ruleRefs.length === 0) issues.push("rules access duration and rules are required");
  return issues;
}

async function commitAttempt(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operation: OperationRecord;
  command: BeginRulesAccessCheckCommandV1;
  authorization: RulesAccessAuthorizationV1;
  currentRegistry: AggregateRecord | null;
  nextRegistry: RulesAccessAttemptRegistryV1;
}): Promise<Result<{ commitId: CommitId }>> {
  const lease = await input.repository.acquireWriterLease(input.campaignId, opaqueId<WriterId>(`${input.operation.operationId}:writer`), 120_000);
  if (!lease.ok) return lease;
  try {
    const aggregateId = rulesAccessAttemptRegistryAggregateIdV1(input.campaignId);
    const acceptedCommand: AcceptedCommandDraft = {
      schemaVersion: 1,
      contractId: "rules-access-check",
      contractVersion: 1,
      commandId: opaqueId(`${input.operation.operationId}:command`),
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commandType: "rules.access.begin-check",
      target: { aggregateType: RULES_ACCESS_ATTEMPT_REGISTRY_AGGREGATE_TYPE_V1, aggregateId, expectedAggregateRevision: input.currentRegistry?.aggregateRevision ?? null },
      payloadSchemaVersion: 1,
      payload: { resolutionRef: input.authorization.resolutionRef, accessControlRef: input.command.accessControlRef, deviceRef: input.command.deviceRef, method: input.command.method, checkId: input.authorization.checkPolicy.proposal.checkId },
      acceptedAtGameSecond: input.command.occurredAtGameSecond
    };
    const event: EventDraft = {
      schemaVersion: 1,
      eventId: opaqueId<EventId>(`${input.operation.operationId}:event`),
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      eventType: "rules.access.check-required",
      origin: "PLAYER_INTENT",
      causation: { kind: "COMMAND", id: acceptedCommand.commandId },
      aggregateRefs: [{ aggregateType: RULES_ACCESS_ATTEMPT_REGISTRY_AGGREGATE_TYPE_V1, aggregateId, aggregateRevision: input.currentRegistry === null ? 0 : input.currentRegistry.aggregateRevision + 1 }],
      visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
      occurredAtGameSecond: input.command.occurredAtGameSecond,
      payloadSchemaVersion: 1,
      payload: { accessControlRef: input.command.accessControlRef, resolutionRef: input.authorization.resolutionRef, method: input.command.method, checkId: input.authorization.checkPolicy.proposal.checkId }
    };
    const request: CommitRequest = {
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commitId: opaqueId<CommitId>(`${input.operation.operationId}:commit`),
      idempotencyKey: input.operation.idempotencyKey,
      requestFingerprint: input.operation.requestFingerprint,
      expectedCampaignRevision: input.operation.observedCampaignRevision,
      writerLease: lease.value,
      acceptedCommands: [acceptedCommand],
      aggregateWrites: [{ aggregateType: RULES_ACCESS_ATTEMPT_REGISTRY_AGGREGATE_TYPE_V1, aggregateId, expectedAggregateRevision: input.currentRegistry?.aggregateRevision ?? null, payloadSchemaVersion: 1, payload: cloneJson(input.nextRegistry) }],
      events: [event],
      outboxTasks: []
    };
    const committed = await input.repository.commit(request);
    return committed.ok ? { ok: true, value: { commitId: committed.value.commitId } } : committed;
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

function emptyRegistry(campaignId: CampaignId): RulesAccessAttemptRegistryV1 {
  return { schemaVersion: 1, contractVersion: RULES_ACCESS_ATTEMPT_REGISTRY_CONTRACT_V1, campaignId, attempts: [], version: 1 };
}

function invalid<T>(messageKey: string, issues: string[]): Result<T> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey, { issues }) };
}
