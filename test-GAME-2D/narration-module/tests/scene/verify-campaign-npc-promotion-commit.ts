import assert from "node:assert/strict";
import {
  MemoryCampaignRepository,
  computeRequestFingerprint,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord,
  type CommitId,
  type IdempotencyKey,
  type OperationId,
  type OperationRecord,
  type RequestId,
  type WriterId
} from "../../src/core";
import {
  CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1,
  PROTOTYPE_INN_BACK_ROOM_SCENE_V1,
  campaignNpcRegistryAggregateIdV1,
  createEmptyCampaignNpcRegistryV1,
  prepareCampaignNpcPromotionCommitV1,
  prepareCampaignNpcPromotionV1,
  projectCampaignNpcsIntoSceneV1,
  type CampaignNpcPromotionCauseV1,
  type SceneActorRecordV1
} from "../../src/application";

async function main(): Promise<void> {
  const repository = new MemoryCampaignRepository();
  const campaignId = opaqueId<CampaignId>("campaign:npc-promotion");
  const now = "2026-07-27T18:00:00.000Z";
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: opaqueId<AggregateId>("clock:npc-promotion"),
    dependencies: {
      contentPackageId: "content.jdr5e",
      contentPackageVersion: 1,
      rulesetId: "rules.jdr5e",
      rulesetVersion: 2,
      calendarId: "calendar.test",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: now,
    updatedAt: now
  };
  const created = await repository.createCampaign(campaign, {
    elapsedGameSeconds: 0,
    calendarId: "calendar.test",
    calendarVersion: 1
  });
  assert.equal(created.ok, true);

  const operationId = opaqueId<OperationId>("operation:promote-copiste");
  const idempotencyKey = opaqueId<IdempotencyKey>("idempotency:promote-copiste");
  const requestPayload = { actorId: actor.actorId, durableRef: cause.durableRef };
  const fingerprint = await computeRequestFingerprint("campaign.promote-scene-actor", 1, requestPayload);
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId,
    campaignId,
    clientRequestId: opaqueId<RequestId>("request:promote-copiste"),
    idempotencyKey,
    requestFingerprint: fingerprint,
    operationKind: "campaign.promote-scene-actor",
    requestPayloadSchemaVersion: 1,
    requestPayload,
    phase: "RECEIVED",
    observedCampaignRevision: 0,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: now,
    updatedAt: now
  };
  assert.equal((await repository.receiveOperation(operation)).ok, true);
  assert.equal((await repository.transitionOperation(operationId, "RECEIVED", "PREPARING")).ok, true);
  assert.equal((await repository.transitionOperation(operationId, "PREPARING", "READY_TO_COMMIT")).ok, true);
  const lease = await repository.acquireWriterLease(
    campaignId,
    opaqueId<WriterId>("writer:promote-copiste"),
    120_000
  );
  if (!lease.ok) throw new Error(lease.error.messageKey);

  const prepared = prepareCampaignNpcPromotionV1({
    campaignId,
    operationId,
    commandId: "command:promote-copiste",
    idempotencyKey,
    sceneActor: actor,
    cause,
    registry: createEmptyCampaignNpcRegistryV1(campaignId),
    registryRevision: null
  });
  if (!prepared.ok || prepared.status !== "READY") throw new Error("promotion preparation failed");
  const atomic = prepareCampaignNpcPromotionCommitV1({
    prepared,
    currentRegistryAggregate: null,
    expectedCampaignRevision: 0,
    requestFingerprint: fingerprint,
    commitId: opaqueId<CommitId>("commit:promote-copiste"),
    writerLease: lease.value,
    occurredAtGameSecond: 0
  });
  if (!atomic.ok) throw new Error(atomic.issues.join("; "));
  assert.equal(atomic.value.aggregateWrites.length, 1);
  assert.equal(atomic.value.events[0]?.visibility.scope, "PLAYER_VISIBLE");
  assert.equal(JSON.stringify(atomic.value).includes(actor.immediateGoal), false);

  const committed = await repository.commit(atomic.value);
  if (!committed.ok) throw new Error(`${committed.error.messageKey}: ${JSON.stringify(committed.error.details)}`);
  const replayed = await repository.commit(atomic.value);
  if (!replayed.ok) throw new Error(replayed.error.messageKey);
  assert.equal(replayed.value.commitId, committed.value.commitId);

  const stored = await repository.getAggregate(
    campaignId,
    CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1,
    campaignNpcRegistryAggregateIdV1(campaignId)
  );
  if (!stored.ok) throw new Error(stored.error.messageKey);
  assert.equal(stored.value.payload.npcs instanceof Array, true);
  const events = await repository.listEvents(campaignId, null, 20);
  if (!events.ok) throw new Error(events.error.messageKey);
  assert.equal(events.value.filter(event => event.eventType === "campaign.npc.promoted").length, 1);

  const stale = prepareCampaignNpcPromotionCommitV1({
    prepared,
    currentRegistryAggregate: stored.value,
    expectedCampaignRevision: 1,
    requestFingerprint: fingerprint,
    commitId: opaqueId<CommitId>("commit:stale-promotion"),
    writerLease: lease.value,
    occurredAtGameSecond: 0
  });
  assert.equal(stale.ok, false, "stale null revision must be rejected before commit");

  const projected = projectCampaignNpcsIntoSceneV1({
    scene: PROTOTYPE_INN_BACK_ROOM_SCENE_V1,
    registry: prepared.nextRegistry,
    presentCampaignNpcIds: [prepared.npc.campaignNpcId]
  });
  assert.equal(projected.presentNpc[0]?.displayName, "Copiste itinérant");
  assert.equal(projected.presentNpc[0]?.immediateGoal, null, "local seed is not reconstructed as campaign fact");
  await repository.releaseWriterLease(lease.value);

  console.log("campaign-npc-promotion-commit/1: atomic commit, replay, conflict and cross-scene projection OK");
}

const actor: SceneActorRecordV1 = {
  schemaVersion: 1,
  sceneId: "scene:inn",
  actorId: "scene:inn:ambient:copiste",
  displayName: "Copiste itinérant",
  publicRole: "Copiste de passage",
  visibleActivity: "classe ses feuillets",
  visibleAppearance: "doigts tachés d'encre",
  demeanor: "réservé",
  immediateGoal: "finir son classement",
  currentPressure: "la pluie retarde son départ",
  speechStyle: ["précis"],
  conversationalHooks: ["voyage"],
  boundaries: ["aucun engagement implicite"],
  knowledgeRefs: ["scene:inn"],
  keywords: ["copiste"],
  promotedByOperationId: "operation:first-speech",
  version: 1
};
const cause: CampaignNpcPromotionCauseV1 = {
  schemaVersion: 1,
  causeKind: "ONGOING_COMMITMENT",
  authority: "QUEST",
  durableRef: "quest:copy-lost-journal",
  publicSourceRefs: ["quest:copy-lost-journal", "event:commitment-accepted"],
  version: 1
};

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
