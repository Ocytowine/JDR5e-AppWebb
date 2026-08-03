import assert from "node:assert/strict";
import {
  MemoryCampaignRepository,
  computeRequestFingerprint,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord,
  type IdempotencyKey,
  type OperationId,
  type OperationRecord,
  type RequestId
} from "../../src/core";
import {
  ACCESS_CONTROL_CONTRACT_V1,
  UPSERT_ACCESS_CONTROL_COMMAND_V1,
  decideAccessTraversalV1,
  loadAccessControlRegistryV1,
  routeAccessApproachV1,
  upsertAccessControlV1,
  type AccessControlOwnerPortV1,
  type AccessControlRecordV1,
  type UpsertAccessControlCommandV1
} from "../../src/application";

const repository = new MemoryCampaignRepository();
const campaignId = opaqueId<CampaignId>("cmp-access-control");
const now = new Date("2026-08-03T12:00:00.000Z").toISOString();
const campaign: CampaignRecord = {
  schemaVersion: 1,
  campaignId,
  campaignRevision: 0,
  status: "ACTIVE",
  clockAggregateId: opaqueId<AggregateId>("agg-access-clock"),
  dependencies: { contentPackageId: "content.access", contentPackageVersion: 1, rulesetId: "rules.access", rulesetVersion: 1, calendarId: "calendar.access", calendarVersion: 1 },
  writeBlock: null,
  lastCommitId: null,
  createdAt: now,
  updatedAt: now
};

async function main(): Promise<void> {
await expectOk(repository.createCampaign(campaign, { elapsedGameSeconds: 0, calendarId: "calendar.access", calendarVersion: 1 }));
await seedSource("source-access-owner-1");
const controlled = control(1, "CONTROLLED");
const command = accessCommand("source-access-owner-1", controlled, "request-access-control-1");
const first = await expectOk(upsertAccessControlV1({ repository, campaignId, command, ownerPort: ownerPort(command) }));
assert.equal(first.replayed, false);
assert.equal(first.state, "CONTROLLED");
const replay = await expectOk(upsertAccessControlV1({ repository, campaignId, command, ownerPort: ownerPort(command) }));
assert.equal(replay.replayed, true);

const registry = await expectOk(loadAccessControlRegistryV1(repository, campaignId));
assert.equal(registry.state.controls.length, 1);
const traversal = decideAccessTraversalV1({ connectionId: controlled.connectionId, control: registry.state.controls[0]! });
assert.equal(traversal.disposition, "HANDOFF");
assert.equal(traversal.code, "ACCESS_CONTROLLED");
assert.deepEqual(traversal.playerKnownRequirements.map(requirement => requirement.requirementRef), ["access-requirement:garde-autorise"]);
assert.equal(JSON.stringify(traversal).includes("mandat-du-collegium"), false, "private requirement must not leak");

assert.equal(routeAccessApproachV1({ control: controlled, requestedDomain: "social", actionHint: "Je demande au garde." }).domain, "social");
const freeApproach = routeAccessApproachV1({ control: controlled, requestedDomain: null, actionHint: "Je force la serrure." });
assert.equal(freeApproach.domain, "rules");
assert.equal(freeApproach.noSuccessDecision, true);
assert.equal(freeApproach.reason.includes("jamais exhaustive"), true);

await seedSource("source-access-owner-2");
const opened = control(2, "OPEN");
opened.requirements = opened.requirements.map(requirement => ({ ...requirement, status: "SATISFIED" }));
const openCommand = accessCommand("source-access-owner-2", opened, "request-access-control-2");
await expectOk(upsertAccessControlV1({ repository, campaignId, command: openCommand, ownerPort: ownerPort(openCommand) }));
const updated = await expectOk(loadAccessControlRegistryV1(repository, campaignId));
assert.equal(decideAccessTraversalV1({ connectionId: opened.connectionId, control: updated.state.controls[0]! }).disposition, "ALLOW");

console.log("access control: persistent threshold, private requirements, free approach routing and owner-authorized opening verified.");
}

void main();

function control(version: number, state: AccessControlRecordV1["state"]): AccessControlRecordV1 {
  return {
    schemaVersion: 1,
    contractVersion: ACCESS_CONTROL_CONTRACT_V1,
    accessControlRef: "access-control:archives-confidentielles",
    connectionId: "connection:archives-confidentielles",
    sourceSceneId: "scene:archives-galerie-nord",
    boundaryRef: "poi:porte-confidentielle",
    destinationRef: "location:archives-confidentielles",
    state,
    ownerDomain: "AccessDomain",
    thresholdDescription: "Une porte surveillée au fond de la galerie nord.",
    requirements: [{
      schemaVersion: 1,
      requirementRef: "access-requirement:garde-autorise",
      kind: "SOCIAL_PERMISSION",
      description: "Le garde doit autoriser le passage.",
      status: "ACTIVE",
      visibility: "PUBLIC",
      ownerDomain: "social",
      sourceRefs: ["world-fact:garde-poste"],
      version: 1
    }, {
      schemaVersion: 1,
      requirementRef: "access-requirement:mandat-du-collegium",
      kind: "AUTHORIZATION",
      description: "Un mandat du Collegium satisfait le règlement.",
      status: "ACTIVE",
      visibility: "SYSTEM_PRIVATE",
      ownerDomain: "inventory",
      sourceRefs: ["rule:archives-mandat"],
      version: 1
    }],
    approachDomains: ["social", "inventory", "perception"],
    approachesAreNonExhaustive: true,
    sourceRefs: ["world-fact:garde-poste", "rule:archives-mandat"],
    version
  };
}

function accessCommand(sourceOperationId: string, value: AccessControlRecordV1, clientRequestId: string): UpsertAccessControlCommandV1 {
  return { schemaVersion: 1, contractVersion: UPSERT_ACCESS_CONTROL_COMMAND_V1, clientRequestId, sourceOperationId, occurredAtGameSecond: 0, control: value };
}

function ownerPort(value: UpsertAccessControlCommandV1): AccessControlOwnerPortV1 {
  return {
    async authorize() {
      return { ok: true, authorization: {
        schemaVersion: 1,
        authority: "ACCESS_OWNER_DOMAIN",
        sourceOperationId: value.sourceOperationId,
        accessControlRef: value.control.accessControlRef,
        connectionId: value.control.connectionId,
        ownerDomain: value.control.ownerDomain,
        permittedState: value.control.state,
        sourceRefs: [...value.control.sourceRefs]
      } };
    }
  };
}

async function seedSource(operationId: string): Promise<void> {
  const current = await expectOk(repository.getCampaign(campaignId));
  const payload = { schemaVersion: 1, domain: "AccessDomain" };
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId: opaqueId<OperationId>(operationId),
    campaignId,
    clientRequestId: opaqueId<RequestId>(`${operationId}:request`),
    idempotencyKey: opaqueId<IdempotencyKey>(`${operationId}:key`),
    requestFingerprint: await computeRequestFingerprint("access.owner-resolution", 1, payload),
    operationKind: "access.owner-resolution",
    requestPayloadSchemaVersion: 1,
    requestPayload: payload,
    phase: "RECEIVED",
    observedCampaignRevision: current.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: now,
    updatedAt: now
  };
  await expectOk(repository.receiveOperation(operation));
  await expectOk(repository.completeWithoutCommit(operation.operationId, 1, { schemaVersion: 1, ownerDecision: true }));
}

async function expectOk<T>(promise: Promise<{ ok: true; value: T } | { ok: false; error: unknown }>): Promise<T> {
  const result = await promise;
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}
