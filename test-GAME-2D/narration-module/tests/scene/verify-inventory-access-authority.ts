import assert from "node:assert/strict";
import {
  MemoryCampaignRepository,
  computeRequestFingerprint,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord,
  type CommandId,
  type CommitId,
  type EventId,
  type IdempotencyKey,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RequestId,
  type Result,
  type WriterId
} from "../../src/core";
import type { CharacterAggregatePayloadV1 } from "../../src/bootstrap";
import {
  ACTIVE_CAMPAIGN_CHARACTER_PROFILE_AGGREGATE_TYPE_V1,
  activeCampaignCharacterProfileAggregateIdV1,
  createActiveCampaignCharacterProfileV1
} from "../../src/bootstrap";
import {
  ACCESS_CONTROL_CONTRACT_V1,
  INVENTORY_ACCESS_RESOLUTION_CONTRACT_V1,
  UPSERT_ACCESS_CONTROL_COMMAND_V1,
  loadAccessControlRegistryV1,
  createCatalogInventoryAccessRuntimeV1,
  resolveInventoryAccessV1,
  upsertAccessControlV1,
  type AccessControlOwnerPortV1,
  type AccessControlRecordV1,
  type InventoryAccessPolicyAuthorizationV1,
  type InventoryAccessPolicyPortV1,
  type InventoryCredentialPortV1,
  type ResolveInventoryAccessCommandV1,
  type UpsertAccessControlCommandV1
} from "../../src/application";

async function main(): Promise<void> {
  const retained = await setup("retain", [{ instanceId: "item:mandate:1", itemId: "mandate-collegium", itemKind: "object", quantity: 1, equippedSlot: null, storedInInstanceId: null, primaryWeapon: false }]);
  const baseCommand = command(retained, "present-mandate", "item:mandate:1");

  const absent = await resolveInventoryAccessV1({ ...retained, command: command(retained, "claim-fake-mandate", "item:absent"), policyPort: policyPort(policy(retained, "RETAIN", true)), credentialPort: validCredential() });
  assert.equal(absent.ok, false);
  if (!absent.ok) assert.equal(absent.error.messageKey, "inventory.item-not-owned");

  const revoked = await resolveInventoryAccessV1({ ...retained, command: baseCommand, policyPort: policyPort(policy(retained, "RETAIN", true)), credentialPort: { async verify() { return { ok: false, issues: ["credential revoked"] }; } } });
  assert.equal(revoked.ok, false);
  if (!revoked.ok) assert.equal(revoked.error.messageKey, "inventory.credential-rejected");

  const wrongHolder: InventoryCredentialPortV1 = {
    async verify(input) {
      return { ok: true, proof: { schemaVersion: 1, authority: "INVENTORY_CREDENTIAL_DOMAIN", proofRef: "credential-proof:wrong-holder", itemInstanceId: input.item.instanceId, itemId: input.item.itemId, holderActorRef: "actor:other", state: "ACTIVE", validAtGameSecond: input.command.occurredAtGameSecond, scopeRefs: ["access-scope:archives-confidential"], sourceRefs: ["credential-registry:mandates"] } };
    }
  };
  const forged = await resolveInventoryAccessV1({ ...retained, command: baseCommand, policyPort: policyPort(policy(retained, "RETAIN", true)), credentialPort: wrongHolder });
  assert.equal(forged.ok, false);
  if (!forged.ok) assert.equal(forged.error.messageKey, "inventory.credential-proof-invalid");

  const success = expectOk(await resolveInventoryAccessV1({ ...retained, command: baseCommand, policyPort: policyPort(policy(retained, "RETAIN", true)), credentialPort: validCredential() }));
  assert.equal(success.resultingAccessState, "OPEN");
  assert.equal(success.usePolicy, "RETAIN");
  const retainedCharacter = expectOk(await retained.repository.getAggregate(retained.campaignId, "character.state", retained.characterAggregateId));
  assert.equal((retainedCharacter.payload as unknown as CharacterAggregatePayloadV1).inventory[0]?.quantity, 1, "un mandat présenté reste dans l'inventaire");
  const replay = expectOk(await resolveInventoryAccessV1({ ...retained, command: baseCommand, policyPort: policyPort(policy(retained, "RETAIN", true)), credentialPort: validCredential() }));
  assert.equal(replay.replayed, true);

  const nested = await setup("nested", [
    { instanceId: "item:bag:1", itemId: "bag", itemKind: "object", quantity: 1, equippedSlot: null, storedInInstanceId: null, primaryWeapon: false },
    { instanceId: "item:key:nested", itemId: "service-key", itemKind: "object", quantity: 1, equippedSlot: null, storedInInstanceId: "item:bag:1", primaryWeapon: false }
  ]);
  const directPolicy = { ...policy(nested, "RETAIN", false), acceptedItemIds: ["service-key"], accessibility: "DIRECTLY_ACCESSIBLE" as const };
  const inaccessible = await resolveInventoryAccessV1({ ...nested, command: command(nested, "nested-key-direct", "item:key:nested"), policyPort: policyPort(directPolicy) });
  assert.equal(inaccessible.ok, false);
  if (!inaccessible.ok) assert.equal(inaccessible.error.messageKey, "inventory.item-not-eligible");

  const cyclic = await setup("cyclic", [
    { instanceId: "item:key:cyclic", itemId: "service-key", itemKind: "object", quantity: 1, equippedSlot: null, storedInInstanceId: "item:bag:cyclic", primaryWeapon: false },
    { instanceId: "item:bag:cyclic", itemId: "bag", itemKind: "object", quantity: 1, equippedSlot: null, storedInInstanceId: "item:key:cyclic", primaryWeapon: false }
  ]);
  const cyclicPolicy = { ...policy(cyclic, "RETAIN", false), acceptedItemIds: ["service-key"] };
  const cyclicResult = await resolveInventoryAccessV1({ ...cyclic, command: command(cyclic, "cyclic-inventory", "item:key:cyclic"), policyPort: policyPort(cyclicPolicy) });
  assert.equal(cyclicResult.ok, false);
  if (!cyclicResult.ok) assert.equal(cyclicResult.error.messageKey, "inventory.character-state-invalid");

  const consumed = await setup("consume", [{ instanceId: "item:seal:1", itemId: "single-use-seal", itemKind: "object", quantity: 2, equippedSlot: null, storedInInstanceId: null, primaryWeapon: false }], false);
  const consumePolicy = { ...policy(consumed, "CONSUME_ONE", false), acceptedItemIds: ["single-use-seal"], waiveRequirementRefs: [] };
  const consumedResult = expectOk(await resolveInventoryAccessV1({ ...consumed, command: command(consumed, "consume-seal", "item:seal:1"), policyPort: policyPort(consumePolicy) }));
  assert.equal(consumedResult.usePolicy, "CONSUME_ONE");
  const consumedCharacter = expectOk(await consumed.repository.getAggregate(consumed.campaignId, "character.state", consumed.characterAggregateId));
  assert.equal((consumedCharacter.payload as unknown as CharacterAggregatePayloadV1).inventory[0]?.quantity, 1);
  assert.equal(expectOk(await loadAccessControlRegistryV1(consumed.repository, consumed.campaignId)).state.controls[0]?.state, "OPEN");

  const runtimeFixture = await setup("runtime", [{ instanceId: "item:mandate:runtime", itemId: "mandate-collegium", itemKind: "object", quantity: 1, equippedSlot: null, storedInInstanceId: null, primaryWeapon: false }]);
  const runtimeOperation = await beginReceivedOperation(runtimeFixture.repository, runtimeFixture.campaignId, "runtime-inventory-turn", "narrative.turn.input", { rawInput: "Je présente mon mandat." });
  const runtime = createCatalogInventoryAccessRuntimeV1({
    itemResolver: { async resolve() { return { ok: true, itemInstanceId: "item:mandate:runtime", playerFacingLabel: "Le mandat du Collegium" }; } },
    policyPort: policyPort(policy(runtimeFixture, "RETAIN", true)),
    credentialPort: validCredential()
  });
  const runtimeResult = expectOk(await runtime.execute({
    repository: runtimeFixture.repository,
    campaignId: runtimeFixture.campaignId,
    operation: runtimeOperation,
    rawInput: "Je présente mon mandat.",
    interpretation: { referentResolution: { resolvedTarget: { ref: runtimeFixture.control.boundaryRef } }, semanticIntent: { target: null } } as never,
    domainCommand: null,
    activeScene: { sceneId: runtimeFixture.control.sourceSceneId } as never
  }));
  assert.equal(runtimeResult.resolution.resultingAccessState, "OPEN");
  assert.match(runtimeResult.playerFacingText, /reste dans ton inventaire/u);
  assert.equal(runtimeResult.commit.operationId, runtimeOperation.operationId, "le runtime doit committer dans l'opération narrative reçue");

  console.log("inventory access authority: ownership, accessibility, credential validity, retention, consumption, atomic opening and replay verified.");
}

type Fixture = Awaited<ReturnType<typeof setup>>;

async function setup(slug: string, inventory: CharacterAggregatePayloadV1["inventory"], withAlternative = true) {
  const repository = new MemoryCampaignRepository();
  const campaignId = opaqueId<CampaignId>(`cmp-inventory-access:${slug}`);
  const characterAggregateId = opaqueId<AggregateId>(`agg-character:${slug}`);
  const now = new Date("2026-08-03T17:00:00.000Z").toISOString();
  const campaign: CampaignRecord = {
    schemaVersion: 1, campaignId, campaignRevision: 0, status: "ACTIVE", clockAggregateId: opaqueId<AggregateId>(`agg-clock:${slug}`),
    dependencies: { contentPackageId: "content.inventory-access", contentPackageVersion: 1, rulesetId: "rules.inventory-access", rulesetVersion: 1, calendarId: "calendar.inventory-access", calendarVersion: 1 },
    writeBlock: null, lastCommitId: null, createdAt: now, updatedAt: now
  };
  expectOk(await repository.createCampaign(campaign, { elapsedGameSeconds: 0, calendarId: "calendar.inventory-access", calendarVersion: 1 }));
  await seedCharacter(repository, campaignId, characterAggregateId, character(inventory), slug);
  await seedCompletedOperation(repository, campaignId, `source-control:${slug}`, "access.owner-resolution");
  const control = accessControl(slug, withAlternative);
  const accessCommand: UpsertAccessControlCommandV1 = { schemaVersion: 1, contractVersion: UPSERT_ACCESS_CONTROL_COMMAND_V1, clientRequestId: `seed-control:${slug}`, sourceOperationId: `source-control:${slug}`, occurredAtGameSecond: 0, control };
  expectOk(await upsertAccessControlV1({ repository, campaignId, command: accessCommand, ownerPort: accessOwnerPort(accessCommand) }));
  await seedCompletedOperation(repository, campaignId, `source-inventory-intent:${slug}`, "narrative.inventory-intent");
  return { repository, campaignId, characterAggregateId, slug, control };
}

function command(fixture: Fixture, clientRequestId: string, itemInstanceId: string): ResolveInventoryAccessCommandV1 {
  return { schemaVersion: 1, contractVersion: INVENTORY_ACCESS_RESOLUTION_CONTRACT_V1, clientRequestId: `${clientRequestId}:${fixture.slug}`, sourceOperationId: `source-inventory-intent:${fixture.slug}`, characterAggregateId: fixture.characterAggregateId, actorRef: "actor:hero", accessControlRef: fixture.control.accessControlRef, presentedItemInstanceId: itemInstanceId, occurredAtGameSecond: 0 };
}

function policy(fixture: Fixture, usePolicy: "RETAIN" | "CONSUME_ONE", credential: boolean): InventoryAccessPolicyAuthorizationV1 {
  return {
    schemaVersion: 1, authority: "INVENTORY_ACCESS_POLICY", policyRef: `inventory-access-policy:${fixture.slug}`,
    accessControlRef: fixture.control.accessControlRef, requirementRef: `${fixture.control.accessControlRef}:requirement:item`,
    acceptedItemIds: ["mandate-collegium"], accessibility: "OWNED_INVENTORY",
    credentialMode: credential ? "ACTIVE_PROOF_REQUIRED" : "NONE", credentialScopeRef: credential ? "access-scope:archives-confidential" : null,
    usePolicy, satisfyRequirementRefs: [`${fixture.control.accessControlRef}:requirement:item`],
    waiveRequirementRefs: fixture.control.requirements.some(requirement => requirement.kind === "SOCIAL_PERMISSION") ? [`${fixture.control.accessControlRef}:requirement:social`] : [],
    resultingAccessState: "OPEN", sourceRefs: ["rule:inventory-access-policy"]
  };
}

function policyPort(value: InventoryAccessPolicyAuthorizationV1): InventoryAccessPolicyPortV1 {
  return { async authorize() { return { ok: true, authorization: value }; } };
}

function validCredential(): InventoryCredentialPortV1 {
  return { async verify(input) { return { ok: true, proof: { schemaVersion: 1, authority: "INVENTORY_CREDENTIAL_DOMAIN", proofRef: `credential-proof:${input.item.instanceId}`, itemInstanceId: input.item.instanceId, itemId: input.item.itemId, holderActorRef: input.command.actorRef, state: "ACTIVE", validAtGameSecond: input.command.occurredAtGameSecond, scopeRefs: ["access-scope:archives-confidential"], sourceRefs: ["credential-registry:mandates"] } }; } };
}

function accessControl(slug: string, withAlternative: boolean): AccessControlRecordV1 {
  const ref = `access-control:${slug}`;
  return {
    schemaVersion: 1, contractVersion: ACCESS_CONTROL_CONTRACT_V1, accessControlRef: ref, connectionId: `connection:${slug}`,
    sourceSceneId: `scene:${slug}:source`, boundaryRef: `poi:${slug}:door`, destinationRef: `location:${slug}:restricted`, state: "CONTROLLED", ownerDomain: "AccessDomain", thresholdDescription: "Un accès contrôlé.",
    requirements: [{ schemaVersion: 1, requirementRef: `${ref}:requirement:item`, kind: "AUTHORIZATION", description: "Présenter un titre accepté.", status: "ACTIVE", visibility: "ACTOR_KNOWN", ownerDomain: "inventory", sourceRefs: ["rule:inventory-access-policy"], version: 1 },
      ...(withAlternative ? [{ schemaVersion: 1 as const, requirementRef: `${ref}:requirement:social`, kind: "SOCIAL_PERMISSION" as const, description: "Obtenir une permission directe.", status: "ACTIVE" as const, visibility: "PUBLIC" as const, ownerDomain: "social", sourceRefs: ["rule:social-permission"], version: 1 as const }] : [])],
    approachDomains: ["inventory", "social"], approachesAreNonExhaustive: true, sourceRefs: ["rule:inventory-access-policy"], version: 1
  };
}

function character(inventory: CharacterAggregatePayloadV1["inventory"]): CharacterAggregatePayloadV1 {
  return {
    schemaVersion: 1, characterId: "hero", sourceFingerprint: `sha256:${"1".repeat(64)}`, rulesetId: "rules.inventory-access", rulesetVersion: 1, name: "Hero", raceId: "human", backgroundId: "sage", classes: [], globalLevel: 1,
    abilityScores: { FOR: 10, DEX: 10, CON: 10, INT: 10, SAG: 10, CHA: 10 }, currentHitPoints: 10, temporaryHitPoints: 0, exhaustion: 0, languages: [], skills: [], expertise: [], proficiencies: {}, inventory, equipmentSlots: {}, actionIds: [], reactionIds: [], spellIds: [], featureIds: [], choices: {}, progressionHistory: [], description: {}, profile: {}, appearance: {}, movementModes: {}, vision: {}, resources: {}
  };
}

async function seedCharacter(repository: MemoryCampaignRepository, campaignId: CampaignId, aggregateId: AggregateId, payload: CharacterAggregatePayloadV1, slug: string): Promise<void> {
  const operation = await beginReadyOperation(repository, campaignId, `bootstrap-character:${slug}`, "character.bootstrap", { characterId: payload.characterId });
  const campaign = expectOk(await repository.getCampaign(campaignId));
  const lease = expectOk(await repository.acquireWriterLease(campaignId, opaqueId<WriterId>(`${operation.operationId}:writer`), 120_000));
  try {
    expectOk(await repository.commit({ campaignId, operationId: operation.operationId, commitId: opaqueId<CommitId>(`${operation.operationId}:commit`), idempotencyKey: operation.idempotencyKey, requestFingerprint: operation.requestFingerprint, expectedCampaignRevision: campaign.campaignRevision, writerLease: lease,
      acceptedCommands: [{ schemaVersion: 1, contractId: "character-bootstrap", contractVersion: 1, commandId: opaqueId<CommandId>(`${operation.operationId}:command`), campaignId, operationId: operation.operationId, commandType: "character.bootstrap", target: { aggregateType: "character.state", aggregateId, expectedAggregateRevision: null }, payloadSchemaVersion: 1, payload: { characterId: payload.characterId }, acceptedAtGameSecond: 0 }],
      aggregateWrites: [
        { aggregateType: "character.state", aggregateId, expectedAggregateRevision: null, payloadSchemaVersion: 1, payload: payload as unknown as JsonObject },
        { aggregateType: ACTIVE_CAMPAIGN_CHARACTER_PROFILE_AGGREGATE_TYPE_V1, aggregateId: activeCampaignCharacterProfileAggregateIdV1(campaignId), expectedAggregateRevision: null, payloadSchemaVersion: 1, payload: createActiveCampaignCharacterProfileV1({ campaignId, characterId: payload.characterId, characterStateAggregateId: aggregateId, tacticalProjectionAggregateId: opaqueId<AggregateId>(`agg-tactical:${slug}`), narrativeProjectionAggregateId: opaqueId<AggregateId>(`agg-narrative:${slug}`), positionAggregateId: opaqueId<AggregateId>(`agg-position:${slug}`), contentPackageId: "content.inventory-access", contentPackageVersion: 1, rulesetId: "rules.inventory-access", rulesetVersion: 1, sourceFingerprint: payload.sourceFingerprint }) }
      ],
      events: [{ schemaVersion: 1, eventId: opaqueId<EventId>(`${operation.operationId}:event`), campaignId, operationId: operation.operationId, eventType: "character.bootstrapped", origin: "SYSTEM", causation: { kind: "OPERATION", id: operation.operationId }, aggregateRefs: [{ aggregateType: "character.state", aggregateId, aggregateRevision: 0 }, { aggregateType: ACTIVE_CAMPAIGN_CHARACTER_PROFILE_AGGREGATE_TYPE_V1, aggregateId: activeCampaignCharacterProfileAggregateIdV1(campaignId), aggregateRevision: 0 }], visibility: { scope: "SYSTEM", actorIds: [] }, occurredAtGameSecond: 0, payloadSchemaVersion: 1, payload: { characterId: payload.characterId } }], outboxTasks: [] }));
    expectOk(await repository.completePresentation(operation.operationId, "COMMITTED_RENDERED", 1, { bootstrapped: true }));
  } finally { expectOk(await repository.releaseWriterLease(lease)); }
}

function accessOwnerPort(command: UpsertAccessControlCommandV1): AccessControlOwnerPortV1 {
  return { async authorize() { return { ok: true, authorization: { schemaVersion: 1, authority: "ACCESS_OWNER_DOMAIN", sourceOperationId: command.sourceOperationId, accessControlRef: command.control.accessControlRef, connectionId: command.control.connectionId, ownerDomain: command.control.ownerDomain, permittedState: command.control.state, sourceRefs: [...command.control.sourceRefs] } }; } };
}

async function seedCompletedOperation(repository: MemoryCampaignRepository, campaignId: CampaignId, operationId: string, kind: string): Promise<void> {
  const campaign = expectOk(await repository.getCampaign(campaignId));
  const payload = { schemaVersion: 1, accepted: true };
  const now = new Date("2026-08-03T17:00:00.000Z").toISOString();
  const operation: OperationRecord = { schemaVersion: 1, operationId: opaqueId<OperationId>(operationId), campaignId, clientRequestId: opaqueId<RequestId>(`${operationId}:request`), idempotencyKey: opaqueId<IdempotencyKey>(`${operationId}:key`), requestFingerprint: await computeRequestFingerprint(kind, 1, payload), operationKind: kind, requestPayloadSchemaVersion: 1, requestPayload: payload, phase: "RECEIVED", observedCampaignRevision: campaign.campaignRevision, commitId: null, completionMode: null, resultPayloadSchemaVersion: null, resultPayload: null, failure: null, receivedAt: now, updatedAt: now };
  expectOk(await repository.receiveOperation(operation));
  expectOk(await repository.completeWithoutCommit(operation.operationId, 1, { accepted: true }));
}

async function beginReadyOperation(repository: MemoryCampaignRepository, campaignId: CampaignId, operationId: string, kind: string, payload: JsonObject): Promise<OperationRecord> {
  const received = await beginReceivedOperation(repository, campaignId, operationId, kind, payload);
  const preparing = expectOk(await repository.transitionOperation(received.operationId, "RECEIVED", "PREPARING"));
  return expectOk(await repository.transitionOperation(preparing.operationId, "PREPARING", "READY_TO_COMMIT"));
}

async function beginReceivedOperation(repository: MemoryCampaignRepository, campaignId: CampaignId, operationId: string, kind: string, payload: JsonObject): Promise<OperationRecord> {
  const campaign = expectOk(await repository.getCampaign(campaignId));
  const now = new Date("2026-08-03T17:00:00.000Z").toISOString();
  return expectOk(await repository.receiveOperation({ schemaVersion: 1, operationId: opaqueId<OperationId>(operationId), campaignId, clientRequestId: opaqueId<RequestId>(`${operationId}:request`), idempotencyKey: opaqueId<IdempotencyKey>(`${operationId}:key`), requestFingerprint: await computeRequestFingerprint(kind, 1, payload), operationKind: kind, requestPayloadSchemaVersion: 1, requestPayload: payload, phase: "RECEIVED", observedCampaignRevision: campaign.campaignRevision, commitId: null, completionMode: null, resultPayloadSchemaVersion: null, resultPayload: null, failure: null, receivedAt: now, updatedAt: now }));
}

function expectOk<T>(result: Result<T>): T { if (!result.ok) throw new Error(`${result.error.code}: ${result.error.messageKey} ${JSON.stringify(result.error.details)}`); return result.value; }

void main().catch(error => { console.error(error); process.exitCode = 1; });
