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
import type { CharacterAggregatePayloadV1, CharacterInventoryInstanceV1 } from "../bootstrap";
import { validateAccessControlRecordV1, type AccessControlRecordV1 } from "./accessControl";
import {
  ACCESS_CONTROL_REGISTRY_AGGREGATE_TYPE_V1,
  accessControlRegistryAggregateIdV1,
  loadAccessControlRegistryV1,
  type AccessControlRegistryV1
} from "./accessControlAuthority";

export const INVENTORY_ACCESS_RESOLUTION_CONTRACT_V1 = "inventory-access-resolution/1" as const;

export interface ResolveInventoryAccessCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof INVENTORY_ACCESS_RESOLUTION_CONTRACT_V1;
  clientRequestId: string;
  sourceOperationId: string;
  characterAggregateId: string;
  actorRef: string;
  accessControlRef: string;
  presentedItemInstanceId: string;
  occurredAtGameSecond: number;
}

export interface InventoryAccessPolicyAuthorizationV1 extends JsonObject {
  schemaVersion: 1;
  authority: "INVENTORY_ACCESS_POLICY";
  policyRef: string;
  accessControlRef: string;
  requirementRef: string;
  acceptedItemIds: string[];
  accessibility: "OWNED_INVENTORY" | "DIRECTLY_ACCESSIBLE";
  credentialMode: "NONE" | "ACTIVE_PROOF_REQUIRED";
  credentialScopeRef: string | null;
  usePolicy: "RETAIN" | "CONSUME_ONE";
  satisfyRequirementRefs: string[];
  waiveRequirementRefs: string[];
  resultingAccessState: "OPEN" | "CONTROLLED";
  sourceRefs: string[];
}

export interface InventoryAccessPolicyPortV1 {
  authorize(input: {
    campaignId: CampaignId;
    command: ResolveInventoryAccessCommandV1;
    control: AccessControlRecordV1;
  }): Promise<{ ok: true; authorization: InventoryAccessPolicyAuthorizationV1 } | { ok: false; issues: string[] }>;
}

export interface InventoryCredentialProofV1 extends JsonObject {
  schemaVersion: 1;
  authority: "INVENTORY_CREDENTIAL_DOMAIN";
  proofRef: string;
  itemInstanceId: string;
  itemId: string;
  holderActorRef: string;
  state: "ACTIVE";
  validAtGameSecond: number;
  scopeRefs: string[];
  sourceRefs: string[];
}

export interface InventoryCredentialPortV1 {
  verify(input: {
    campaignId: CampaignId;
    command: ResolveInventoryAccessCommandV1;
    item: CharacterInventoryInstanceV1;
    policy: InventoryAccessPolicyAuthorizationV1;
  }): Promise<{ ok: true; proof: InventoryCredentialProofV1 } | { ok: false; issues: string[] }>;
}

export interface InventoryAccessResolutionResultV1 extends JsonObject {
  schemaVersion: 1;
  accessControlRef: string;
  requirementRef: string;
  itemInstanceId: string;
  itemId: string;
  usePolicy: "RETAIN" | "CONSUME_ONE";
  resultingAccessState: "OPEN" | "CONTROLLED";
  credentialProofRef: string | null;
  commitId: string;
  replayed: boolean;
}

export async function resolveInventoryAccessV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: ResolveInventoryAccessCommandV1;
  policyPort: InventoryAccessPolicyPortV1;
  credentialPort?: InventoryCredentialPortV1 | null;
  operation?: OperationRecord;
}): Promise<Result<InventoryAccessResolutionResultV1>> {
  const commandIssues = validateCommand(input.command);
  if (commandIssues.length > 0) return invalid("inventory.access-command-invalid", commandIssues);
  const operationId = input.operation?.operationId ?? opaqueId<OperationId>(`resolve-inventory-access:${input.command.clientRequestId}`);
  const fingerprint = input.operation?.requestFingerprint ?? await computeRequestFingerprint("inventory.access.resolve", 1, input.command);
  if (input.operation !== undefined) {
    if (input.operation.campaignId !== input.campaignId || input.operation.phase !== "RECEIVED" || input.command.sourceOperationId !== input.operation.operationId) {
      return invalid("inventory.access-bound-operation-invalid", ["received source operation from the same campaign required"]);
    }
  } else {
    const existing = await input.repository.getOperation(operationId);
    if (existing.ok && existing.value.requestFingerprint !== fingerprint) return { ok: false, error: coreError("IDEMPOTENCY_CONFLICT", "inventory.access-request-conflict") };
    if (existing.ok && existing.value.phase === "COMPLETED") return restore(existing.value);
    if (existing.ok) return invalid("inventory.access-operation-incomplete", [existing.value.phase]);
    if (existing.error.code !== "NOT_FOUND") return existing;
  }

  const [campaign, sourceOperation, character, accessRegistry] = await Promise.all([
    input.repository.getCampaign(input.campaignId),
    input.repository.getOperation(opaqueId<OperationId>(input.command.sourceOperationId)),
    input.repository.getAggregate(input.campaignId, "character.state", opaqueId<AggregateId>(input.command.characterAggregateId)),
    loadAccessControlRegistryV1(input.repository, input.campaignId)
  ]);
  if (!campaign.ok) return campaign;
  if (!sourceOperation.ok) return sourceOperation;
  if (!character.ok) return character;
  if (!accessRegistry.ok) return accessRegistry;
  const sourceIsBoundOperation = input.operation !== undefined && sourceOperation.value.operationId === input.operation.operationId && sourceOperation.value.phase === "RECEIVED";
  if (sourceOperation.value.campaignId !== input.campaignId || (!sourceIsBoundOperation && sourceOperation.value.phase !== "COMPLETED")) return invalid("inventory.access-source-operation-invalid", ["completed source operation, or the bound received operation, is required"]);
  const characterState = character.value.payload as unknown as CharacterAggregatePayloadV1;
  const characterIssues = validateCharacterInventory(characterState);
  if (characterIssues.length > 0) return invalid("inventory.character-state-invalid", characterIssues);
  const control = accessRegistry.value.state.controls.find(entry => entry.accessControlRef === input.command.accessControlRef);
  if (control === undefined) return invalid("inventory.access-control-not-found", [input.command.accessControlRef]);
  if (control.state !== "CONTROLLED") return invalid("inventory.access-control-not-controlled", [control.state]);

  const policyDecision = await input.policyPort.authorize({ campaignId: input.campaignId, command: input.command, control });
  if (!policyDecision.ok) return invalid("inventory.access-policy-rejected", policyDecision.issues);
  const policy = policyDecision.authorization;
  const policyIssues = validatePolicy(input.command, control, policy);
  if (policyIssues.length > 0) return invalid("inventory.access-policy-invalid", policyIssues);
  const item = characterState.inventory.find(entry => entry.instanceId === input.command.presentedItemInstanceId);
  if (item === undefined) return invalid("inventory.item-not-owned", [input.command.presentedItemInstanceId]);
  const itemIssues = validatePresentedItem(characterState.inventory, item, policy);
  if (itemIssues.length > 0) return invalid("inventory.item-not-eligible", itemIssues);

  let credentialProof: InventoryCredentialProofV1 | null = null;
  if (policy.credentialMode === "ACTIVE_PROOF_REQUIRED") {
    if (input.credentialPort === null || input.credentialPort === undefined) return invalid("inventory.credential-port-required", [policy.policyRef]);
    const proofDecision = await input.credentialPort.verify({ campaignId: input.campaignId, command: input.command, item, policy });
    if (!proofDecision.ok) return invalid("inventory.credential-rejected", proofDecision.issues);
    const proofIssues = validateCredentialProof(input.command, item, policy, proofDecision.proof);
    if (proofIssues.length > 0) return invalid("inventory.credential-proof-invalid", proofIssues);
    credentialProof = proofDecision.proof;
  }

  const nextControlResult = applyPolicyToControl(control, policy);
  if (!nextControlResult.ok) return invalid("inventory.access-policy-result-invalid", nextControlResult.issues);
  const nextCharacterResult = applyItemUse(characterState, item, policy.usePolicy);
  if (!nextCharacterResult.ok) return invalid("inventory.item-use-invalid", nextCharacterResult.issues);
  const nextRegistry: AccessControlRegistryV1 = {
    ...cloneJson(accessRegistry.value.state),
    controls: accessRegistry.value.state.controls.map(entry => entry.accessControlRef === control.accessControlRef ? nextControlResult.control : cloneJson(entry)),
    version: accessRegistry.value.state.version + 1
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
    character: character.value,
    currentAccessRegistry: accessRegistry.value.aggregate,
    nextCharacter: nextCharacterResult.character,
    characterChanged: nextCharacterResult.changed,
    nextAccessRegistry: nextRegistry,
    control: nextControlResult.control,
    item,
    policy,
    credentialProof
  });
  if (!committed.ok) return committed;
  const result: InventoryAccessResolutionResultV1 = {
    schemaVersion: 1,
    accessControlRef: control.accessControlRef,
    requirementRef: policy.requirementRef,
    itemInstanceId: item.instanceId,
    itemId: item.itemId,
    usePolicy: policy.usePolicy,
    resultingAccessState: nextControlResult.control.state as "OPEN" | "CONTROLLED",
    credentialProofRef: credentialProof?.proofRef ?? null,
    commitId: committed.value.commitId,
    replayed: false
  };
  if (input.operation !== undefined) return { ok: true, value: result };
  const completed = await input.repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, result);
  return completed.ok ? { ok: true, value: result } : completed;
}

function applyPolicyToControl(
  control: AccessControlRecordV1,
  policy: InventoryAccessPolicyAuthorizationV1
): { ok: true; control: AccessControlRecordV1 } | { ok: false; issues: string[] } {
  const satisfy = new Set(policy.satisfyRequirementRefs);
  const waive = new Set(policy.waiveRequirementRefs);
  const requirements = control.requirements.map(requirement => satisfy.has(requirement.requirementRef)
    ? { ...cloneJson(requirement), status: "SATISFIED" as const }
    : waive.has(requirement.requirementRef)
      ? { ...cloneJson(requirement), status: "WAIVED" as const }
      : cloneJson(requirement));
  const next: AccessControlRecordV1 = { ...cloneJson(control), state: policy.resultingAccessState, requirements, version: control.version + 1 };
  const issues = validateAccessControlRecordV1(next);
  if (policy.resultingAccessState === "OPEN" && requirements.some(requirement => requirement.status === "ACTIVE")) issues.push("OPEN result leaves active requirements");
  return issues.length === 0 ? { ok: true, control: next } : { ok: false, issues };
}

function applyItemUse(
  character: CharacterAggregatePayloadV1,
  item: CharacterInventoryInstanceV1,
  usePolicy: InventoryAccessPolicyAuthorizationV1["usePolicy"]
): { ok: true; character: CharacterAggregatePayloadV1; changed: boolean } | { ok: false; issues: string[] } {
  if (usePolicy === "RETAIN") return { ok: true, character: cloneJson(character as unknown as JsonObject) as unknown as CharacterAggregatePayloadV1, changed: false };
  if (item.equippedSlot !== null || character.inventory.some(entry => entry.storedInInstanceId === item.instanceId)) return { ok: false, issues: ["consumed item cannot be equipped or contain another item"] };
  const inventory = character.inventory.flatMap(entry => {
    if (entry.instanceId !== item.instanceId) return [cloneJson(entry as unknown as JsonObject) as unknown as CharacterInventoryInstanceV1];
    return entry.quantity === 1 ? [] : [{ ...cloneJson(entry as unknown as JsonObject) as unknown as CharacterInventoryInstanceV1, quantity: entry.quantity - 1 }];
  });
  return { ok: true, character: { ...cloneJson(character as unknown as JsonObject) as unknown as CharacterAggregatePayloadV1, inventory }, changed: true };
}

function validatePresentedItem(inventory: CharacterInventoryInstanceV1[], item: CharacterInventoryInstanceV1, policy: InventoryAccessPolicyAuthorizationV1): string[] {
  const issues: string[] = [];
  if (!policy.acceptedItemIds.includes(item.itemId)) issues.push("item definition is not accepted by policy");
  if (!Number.isInteger(item.quantity) || item.quantity < 1) issues.push("item quantity is invalid");
  if (policy.accessibility === "DIRECTLY_ACCESSIBLE" && item.storedInInstanceId !== null) issues.push("item is not directly accessible");
  if (item.storedInInstanceId !== null && !inventory.some(entry => entry.instanceId === item.storedInInstanceId)) issues.push("item container is missing");
  return issues;
}

function validateCredentialProof(command: ResolveInventoryAccessCommandV1, item: CharacterInventoryInstanceV1, policy: InventoryAccessPolicyAuthorizationV1, proof: InventoryCredentialProofV1): string[] {
  const issues: string[] = [];
  if (proof.schemaVersion !== 1 || proof.authority !== "INVENTORY_CREDENTIAL_DOMAIN" || !proof.proofRef.trim()) issues.push("credential proof contract is invalid");
  if (proof.itemInstanceId !== item.instanceId || proof.itemId !== item.itemId || proof.holderActorRef !== command.actorRef) issues.push("credential proof identity mismatch");
  if (proof.state !== "ACTIVE" || proof.validAtGameSecond !== command.occurredAtGameSecond) issues.push("credential is not active at the requested game second");
  if (policy.credentialScopeRef === null || !proof.scopeRefs.includes(policy.credentialScopeRef)) issues.push("credential scope is insufficient");
  if (proof.sourceRefs.length === 0) issues.push("credential proof requires sources");
  return issues;
}

function validatePolicy(command: ResolveInventoryAccessCommandV1, control: AccessControlRecordV1, policy: InventoryAccessPolicyAuthorizationV1): string[] {
  const issues: string[] = [];
  if (policy.schemaVersion !== 1 || policy.authority !== "INVENTORY_ACCESS_POLICY" || !policy.policyRef.trim()) issues.push("policy contract is invalid");
  if (policy.accessControlRef !== command.accessControlRef || policy.accessControlRef !== control.accessControlRef) issues.push("policy access control mismatch");
  const requirement = control.requirements.find(entry => entry.requirementRef === policy.requirementRef);
  if (requirement === undefined || requirement.status !== "ACTIVE" || !["ITEM", "AUTHORIZATION"].includes(requirement.kind)) issues.push("policy requirement is not an active inventory requirement");
  if (policy.acceptedItemIds.length === 0 || policy.acceptedItemIds.some(value => !value.trim())) issues.push("policy acceptedItemIds are invalid");
  if (policy.credentialMode === "ACTIVE_PROOF_REQUIRED" && (policy.credentialScopeRef === null || !policy.credentialScopeRef.trim())) issues.push("credential scope is required");
  if (policy.credentialMode === "NONE" && policy.credentialScopeRef !== null) issues.push("credential scope must be null without credential proof");
  const knownRequirements = new Set(control.requirements.map(entry => entry.requirementRef));
  const touched = [...policy.satisfyRequirementRefs, ...policy.waiveRequirementRefs];
  if (!policy.satisfyRequirementRefs.includes(policy.requirementRef)) issues.push("inventory requirement must be satisfied by policy");
  if (touched.some(ref => !knownRequirements.has(ref)) || new Set(touched).size !== touched.length) issues.push("policy requirement mappings are invalid or duplicated");
  if (policy.sourceRefs.length === 0) issues.push("policy requires sources");
  return issues;
}

function validateCharacterInventory(character: CharacterAggregatePayloadV1): string[] {
  const issues: string[] = [];
  if (character.schemaVersion !== 1 || !character.characterId?.trim() || !Array.isArray(character.inventory)) return ["character inventory contract is invalid"];
  const ids = character.inventory.map(item => item.instanceId);
  if (ids.some(id => !id.trim()) || new Set(ids).size !== ids.length) issues.push("inventory instance ids are invalid or duplicated");
  for (const item of character.inventory) {
    if (!item.itemId.trim() || !Number.isInteger(item.quantity) || item.quantity < 1) issues.push(`invalid inventory item ${item.instanceId}`);
    if (item.storedInInstanceId !== null && !ids.includes(item.storedInInstanceId)) issues.push(`missing container for ${item.instanceId}`);
  }
  const parentById = new Map(character.inventory.map(item => [item.instanceId, item.storedInInstanceId]));
  for (const item of character.inventory) {
    const visited = new Set<string>();
    let current: string | null = item.instanceId;
    while (current !== null) {
      if (visited.has(current)) {
        issues.push(`inventory containment cycle for ${item.instanceId}`);
        break;
      }
      visited.add(current);
      current = parentById.get(current) ?? null;
    }
  }
  return issues;
}

function validateCommand(command: ResolveInventoryAccessCommandV1): string[] {
  const issues: string[] = [];
  if (command.schemaVersion !== 1 || command.contractVersion !== INVENTORY_ACCESS_RESOLUTION_CONTRACT_V1) issues.push("inventory access command contract mismatch");
  for (const value of [command.clientRequestId, command.sourceOperationId, command.characterAggregateId, command.actorRef, command.accessControlRef, command.presentedItemInstanceId]) if (!value.trim()) issues.push("command identities are required");
  if (!Number.isInteger(command.occurredAtGameSecond) || command.occurredAtGameSecond < 0) issues.push("occurredAtGameSecond is invalid");
  return issues;
}

async function beginOperation(repository: CampaignRepository, campaignId: CampaignId, operationId: OperationId, command: ResolveInventoryAccessCommandV1, fingerprint: string, campaignRevision: number): Promise<Result<OperationRecord>> {
  const now = new Date().toISOString();
  const received = await repository.receiveOperation({
    schemaVersion: 1, operationId, campaignId,
    clientRequestId: opaqueId<RequestId>(command.clientRequestId), idempotencyKey: opaqueId<IdempotencyKey>(operationId),
    requestFingerprint: fingerprint, operationKind: "inventory.access.resolve", requestPayloadSchemaVersion: 1,
    requestPayload: cloneJson(command), phase: "RECEIVED", observedCampaignRevision: campaignRevision,
    commitId: null, completionMode: null, resultPayloadSchemaVersion: null, resultPayload: null, failure: null,
    receivedAt: now, updatedAt: now
  });
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
  repository: CampaignRepository;
  campaignId: CampaignId;
  operation: OperationRecord;
  command: ResolveInventoryAccessCommandV1;
  character: AggregateRecord;
  currentAccessRegistry: AggregateRecord | null;
  nextCharacter: CharacterAggregatePayloadV1;
  characterChanged: boolean;
  nextAccessRegistry: AccessControlRegistryV1;
  control: AccessControlRecordV1;
  item: CharacterInventoryInstanceV1;
  policy: InventoryAccessPolicyAuthorizationV1;
  credentialProof: InventoryCredentialProofV1 | null;
}): Promise<Result<{ commitId: CommitId }>> {
  const lease = await input.repository.acquireWriterLease(input.campaignId, opaqueId<WriterId>(`${input.operation.operationId}:writer`), 120_000);
  if (!lease.ok) return lease;
  try {
    const accessAggregateId = accessControlRegistryAggregateIdV1(input.campaignId);
    const commandId = opaqueId<CommandId>(`${input.operation.operationId}:command`);
    const acceptedCommand: AcceptedCommandDraft = {
      schemaVersion: 1, contractId: "inventory-access-resolution", contractVersion: 1,
      commandId, campaignId: input.campaignId, operationId: input.operation.operationId,
      commandType: "inventory.access.resolve",
      target: { aggregateType: ACCESS_CONTROL_REGISTRY_AGGREGATE_TYPE_V1, aggregateId: accessAggregateId, expectedAggregateRevision: input.currentAccessRegistry?.aggregateRevision ?? null },
      payloadSchemaVersion: 1,
      payload: {
        accessControlRef: input.control.accessControlRef,
        requirementRef: input.policy.requirementRef,
        itemInstanceId: input.command.presentedItemInstanceId,
        itemId: input.item.itemId,
        usePolicy: input.policy.usePolicy,
        policyRef: input.policy.policyRef,
        credentialProofRef: input.credentialProof?.proofRef ?? null
      },
      acceptedAtGameSecond: input.command.occurredAtGameSecond
    };
    const aggregateWrites: CommitRequest["aggregateWrites"] = [{
      aggregateType: ACCESS_CONTROL_REGISTRY_AGGREGATE_TYPE_V1,
      aggregateId: accessAggregateId,
      expectedAggregateRevision: input.currentAccessRegistry?.aggregateRevision ?? null,
      payloadSchemaVersion: 1,
      payload: cloneJson(input.nextAccessRegistry)
    }];
    if (input.characterChanged) aggregateWrites.push({
      aggregateType: "character.state",
      aggregateId: input.character.aggregateId,
      expectedAggregateRevision: input.character.aggregateRevision,
      payloadSchemaVersion: 1,
      payload: cloneJson(input.nextCharacter as unknown as JsonObject)
    });
    const event: EventDraft = {
      schemaVersion: 1, eventId: opaqueId<EventId>(`${input.operation.operationId}:event`), campaignId: input.campaignId,
      operationId: input.operation.operationId, eventType: "inventory.access.requirement-satisfied", origin: "PLAYER_INTENT",
      causation: { kind: "COMMAND", id: commandId },
      aggregateRefs: aggregateWrites.map(write => ({ aggregateType: write.aggregateType, aggregateId: write.aggregateId, aggregateRevision: write.expectedAggregateRevision === null ? 0 : write.expectedAggregateRevision + 1 })),
      visibility: { scope: "PLAYER_VISIBLE", actorIds: [] }, occurredAtGameSecond: input.command.occurredAtGameSecond,
      payloadSchemaVersion: 1,
      payload: { accessControlRef: input.control.accessControlRef, resultingAccessState: input.control.state, usePolicy: input.policy.usePolicy }
    };
    const request: CommitRequest = {
      campaignId: input.campaignId, operationId: input.operation.operationId,
      commitId: opaqueId<CommitId>(`${input.operation.operationId}:commit`), idempotencyKey: input.operation.idempotencyKey,
      requestFingerprint: input.operation.requestFingerprint, expectedCampaignRevision: input.operation.observedCampaignRevision,
      writerLease: lease.value, acceptedCommands: [acceptedCommand], aggregateWrites, events: [event], outboxTasks: []
    };
    const committed = await input.repository.commit(request);
    return committed.ok ? { ok: true, value: { commitId: committed.value.commitId } } : committed;
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

function restore(operation: OperationRecord): Result<InventoryAccessResolutionResultV1> {
  const result = operation.resultPayload as Partial<InventoryAccessResolutionResultV1> | null;
  if (result?.schemaVersion !== 1 || typeof result.accessControlRef !== "string" || typeof result.commitId !== "string") return invalid("inventory.access-result-invalid", ["completed result invalid"]);
  return { ok: true, value: { ...result, replayed: true } as InventoryAccessResolutionResultV1 };
}

function invalid<T>(messageKey: string, issues: string[]): Result<T> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey, { issues }) };
}
