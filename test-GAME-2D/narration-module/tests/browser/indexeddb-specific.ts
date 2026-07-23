import {
  IndexedDbCampaignRepository,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type IndexedDbFailurePoint,
  type OperationId,
  type Result,
  type WorkerId,
  type WriterId
} from "../../src/core/index";
import { assert } from "../contracts/assertions";
import {
  MutableClock,
  campaignFixture,
  commitRequest,
  expectError,
  expectOk,
  initialClock,
  lease,
  operationFixture,
  readyOperation
} from "../contracts/verify-campaign-core";
import { campaignBootstrapFixture } from "../contracts/verify-campaign-bootstrap";
import { resolveSceneV1 } from "../../src/application";

interface SpecificTest {
  name: string;
  run: () => Promise<void>;
}

export interface IndexedDbSpecificRun {
  passed: number;
  failed: number;
  failures: Array<{ name: string; message: string }>;
}

const tests: SpecificTest[] = [];
const runId = crypto.randomUUID().replaceAll("-", "");

function id<T extends string>(value: string): T {
  return opaqueId<T>(value);
}

function test(name: string, run: () => Promise<void>): void {
  tests.push({ name, run });
}

function name(suffix: string): string {
  return `jdr5e-specific-${runId}-${suffix}`;
}

async function deleteTestDatabase(databaseName: string): Promise<void> {
  await IndexedDbCampaignRepository.deleteDatabase(databaseName);
}

async function open(
  databaseName: string,
  clock: MutableClock,
  failureInjector?: (point: IndexedDbFailurePoint) => void
): Promise<IndexedDbCampaignRepository> {
  return IndexedDbCampaignRepository.open({ databaseName, clock, failureInjector });
}

async function bootstrap(repository: IndexedDbCampaignRepository, clock: MutableClock, suffix: string) {
  const campaign = campaignFixture(clock, suffix);
  expectOk(await repository.createCampaign(campaign, initialClock));
  return campaign;
}

async function nativeOpen(databaseName: string, version: number): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, version);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function expectRejected(work: Promise<unknown>): Promise<void> {
  let rejected = false;
  try {
    await work;
  } catch {
    rejected = true;
  }
  assert.equal(rejected, true, "Expected the promise to reject.");
}

test("01 close and reopen preserves the active campaign", async () => {
  const databaseName = name("reopen");
  const clock = new MutableClock();
  const first = await open(databaseName, clock);
  const campaign = await bootstrap(first, clock, "idb_reopen");
  first.close();
  const second = await open(databaseName, clock);
  assert.deepEqual(expectOk(await second.getCampaign(campaign.campaignId)), campaign);
  second.close();
  await deleteTestDatabase(databaseName);
});

test("00 dynamic place catalog reconstructs an IndexedDB-confirmed scene", async () => {
  const databaseName = name("dynamic-place-catalog");
  const clock = new MutableClock();
  const repository = await open(databaseName, clock);
  try {
    const campaign = await bootstrap(repository, clock, "dynamic_place_catalog");
    const operation = await readyOperation(repository, campaign, clock, "dynamic_place_catalog");
    const writerLease = await lease(repository, campaign.campaignId, "dynamic_place_catalog");
    const placeId = id<AggregateId>("agg_dynamic_place_registry");
    const topologyId = id<AggregateId>("agg_dynamic_topology");
    const factsId = id<AggregateId>("agg_dynamic_place_facts");
    const request = commitRequest({ campaign, operation, writerLease, suffix: "dynamic_place_catalog", aggregateType: "world.place-registry", aggregateId: placeId });
    request.aggregateWrites = [
      { aggregateType: "world.place-registry", aggregateId: placeId, expectedAggregateRevision: null, payloadSchemaVersion: 1, payload: { schemaVersion: 1, contractVersion: "world-place-registry/1", places: [{ schemaVersion: 1, placeRef: "location:indexeddb_lane", arrivalSceneId: "dynamic-place:indexeddb_lane", displayName: "Ruelle persistée", summary: "Une ruelle conservée dans la campagne.", initialTension: "Le passage reste calme.", parentLocationRef: "location:test", perceptibleFeatures: ["pavés humides"], populationRoles: ["passant"], localNorms: ["circulation discrète"], persistenceDepth: "LIGHT_REFERENCE", sourceRefs: ["lore:test"], createdByProposalId: "proposal:indexeddb", version: 1 }], version: 1 } },
      { aggregateType: "world.scene-topology", aggregateId: topologyId, expectedAggregateRevision: null, payloadSchemaVersion: 1, payload: { schemaVersion: 1, contractVersion: "world-scene-topology/1", topology: { schemaVersion: 1, contractVersion: "scene-transition/1", topologyId: "topology-indexeddb", topologyVersion: 1, connections: [] }, version: 1 } },
      { aggregateType: "campaign.place-facts", aggregateId: factsId, expectedAggregateRevision: null, payloadSchemaVersion: 1, payload: { schemaVersion: 1, contractVersion: "campaign-place-facts/1", facts: [{ schemaVersion: 1, placeRef: "location:indexeddb_lane", narrativeCommitments: ["stable_place_identity"], sourceRefs: ["lore:test"], createdByProposalId: "proposal:indexeddb", validFromGameSecond: 0, version: 1 }], version: 1 } }
    ];
    request.events[0].aggregateRefs = [
      { aggregateType: "world.place-registry", aggregateId: placeId, aggregateRevision: 0 },
      { aggregateType: "world.scene-topology", aggregateId: topologyId, aggregateRevision: 0 },
      { aggregateType: "campaign.place-facts", aggregateId: factsId, aggregateRevision: 0 }
    ];
    expectOk(await repository.commit(request));
    expectOk(await repository.releaseWriterLease(writerLease));
    const resolved = expectOk(await resolveSceneV1({ sceneId: "dynamic-place:indexeddb_lane", sources: [], dynamicCatalog: { repository, campaignId: campaign.campaignId, placeRegistryAggregateId: placeId, topologyAggregateId: topologyId, factRegistryAggregateId: factsId } }));
    assert.equal(resolved.sourceKind, "DYNAMIC_CAMPAIGN");
    assert.equal(resolved.scene.locationName, "Ruelle persistée");
    assert.deepEqual(resolved.scene.ambientPopulation.map(presence => presence.publicRole), ["passant"]);
    assert.equal(resolved.scene.presentNpc.length, 0);
  } finally {
    repository.close();
    await deleteTestDatabase(databaseName);
  }
});

test("01b atomic bootstrap survives close and reopen", async () => {
  const databaseName = name("bootstrap_reopen");
  const clock = new MutableClock();
  const request = await campaignBootstrapFixture(clock, "idb_bootstrap_reopen");
  const first = await open(databaseName, clock);
  expectOk(await first.bootstrapCampaign(request));
  first.close();
  const second = await open(databaseName, clock);
  assert.deepEqual(expectOk(await second.getCampaign(request.campaign.campaignId)), request.campaign);
  assert.deepEqual(expectOk(await second.getCommit(request.commit.commitId)), request.commit);
  assert.deepEqual(expectOk(await second.bootstrapCampaign(request)).commit, request.commit);
  assert.equal(expectOk(await second.listEvents(request.campaign.campaignId, null, 10)).length, 1);
  second.close();
  await deleteTestDatabase(databaseName);
});

test("02 aborted commit remains absent after reopen", async () => {
  const databaseName = name("abort");
  const clock = new MutableClock();
  let fail = true;
  const first = await open(databaseName, clock, point => {
    if (fail && point === "AFTER_EVENTS") throw new Error("abort transaction");
  });
  const campaign = await bootstrap(first, clock, "idb_abort");
  const operation = await readyOperation(first, campaign, clock, "idb_abort");
  const writerLease = await lease(first, campaign.campaignId, "idb_abort");
  const request = commitRequest({ campaign, operation, writerLease, suffix: "idb_abort" });
  expectError(await first.commit(request), "PERSISTENCE_FAILURE");
  fail = false;
  first.close();
  const second = await open(databaseName, clock);
  assert.equal(expectOk(await second.getCampaign(campaign.campaignId)).campaignRevision, 0);
  expectError(await second.getCommit(request.commitId), "NOT_FOUND");
  assert.equal(expectOk(await second.listEvents(campaign.campaignId, null, 10)).length, 0);
  second.close();
  await deleteTestDatabase(databaseName);
});

test("03 unknown outcome resolves after connection loss", async () => {
  const databaseName = name("unknown");
  const clock = new MutableClock();
  const first = await open(databaseName, clock);
  const campaign = await bootstrap(first, clock, "idb_unknown");
  const operation = await readyOperation(first, campaign, clock, "idb_unknown");
  const writerLease = await lease(first, campaign.campaignId, "idb_unknown");
  const committed = expectOk(await first.commit(commitRequest({ campaign, operation, writerLease, suffix: "idb_unknown" })));
  first.close();
  const second = await open(databaseName, clock);
  assert.deepEqual(
    expectOk(await second.getCommitByIdempotencyKey(campaign.campaignId, operation.idempotencyKey)),
    committed
  );
  second.close();
  await deleteTestDatabase(databaseName);
});

test("04 two connections reject an obsolete fencing token", async () => {
  const databaseName = name("fencing");
  const clock = new MutableClock();
  const first = await open(databaseName, clock);
  const second = await open(databaseName, clock);
  const campaign = await bootstrap(first, clock, "idb_fencing");
  const operation = await readyOperation(first, campaign, clock, "idb_fencing");
  const oldLease = await lease(first, campaign.campaignId, "shared");
  await lease(second, campaign.campaignId, "shared");
  expectError(
    await first.commit(commitRequest({ campaign, operation, writerLease: oldLease, suffix: "idb_fencing" })),
    "STALE_FENCING_TOKEN"
  );
  first.close();
  second.close();
  await deleteTestDatabase(databaseName);
});

test("05 concurrent operation reception keeps one active operation", async () => {
  const databaseName = name("operations");
  const clock = new MutableClock();
  const first = await open(databaseName, clock);
  const second = await open(databaseName, clock);
  const campaign = await bootstrap(first, clock, "idb_operations");
  const operationA = await operationFixture(campaign, clock, "idb_operations_a");
  const operationB = await operationFixture(campaign, clock, "idb_operations_b");
  const results = await Promise.all([first.receiveOperation(operationA), second.receiveOperation(operationB)]);
  assert.equal(results.filter(result => result.ok).length, 1);
  assert.equal(results.filter(result => !result.ok && result.error.code === "CAMPAIGN_BUSY").length, 1);
  first.close();
  second.close();
  await deleteTestDatabase(databaseName);
});

test("06 event cursor crosses commit boundaries without loss", async () => {
  const databaseName = name("pagination");
  const clock = new MutableClock();
  const repository = await open(databaseName, clock);
  const campaign = await bootstrap(repository, clock, "idb_pages");
  const firstOperation = await readyOperation(repository, campaign, clock, "idb_pages_1");
  const firstLease = await lease(repository, campaign.campaignId, "idb_pages_1");
  expectOk(await repository.commit(commitRequest({
    campaign,
    operation: firstOperation,
    writerLease: firstLease,
    suffix: "idb_pages_1",
    eventCount: 2
  })));
  expectOk(await repository.completePresentation(firstOperation.operationId, "COMMITTED_RENDERED", 1, { text: "one" }));
  expectOk(await repository.releaseWriterLease(firstLease));
  const campaignV1 = expectOk(await repository.getCampaign(campaign.campaignId));
  const secondOperation = await readyOperation(repository, campaignV1, clock, "idb_pages_2");
  const secondLease = await lease(repository, campaign.campaignId, "idb_pages_2");
  expectOk(await repository.commit(commitRequest({
    campaign: campaignV1,
    operation: secondOperation,
    writerLease: secondLease,
    suffix: "idb_pages_2",
    expectedAggregateRevision: 0,
    eventCount: 2
  })));
  const firstPage = expectOk(await repository.listEvents(campaign.campaignId, null, 3));
  const cursor = firstPage[2];
  const secondPage = expectOk(await repository.listEvents(campaign.campaignId, {
    commitSequence: cursor.commitSequence,
    eventSequence: cursor.eventSequence
  }, 3));
  assert.equal(firstPage.length, 3);
  assert.equal(secondPage.length, 1);
  repository.close();
  await deleteTestDatabase(databaseName);
});

test("07 outbox lease is reclaimable after reopen", async () => {
  const databaseName = name("outbox");
  const clock = new MutableClock();
  const first = await open(databaseName, clock);
  const campaign = await bootstrap(first, clock, "idb_outbox");
  const operation = await readyOperation(first, campaign, clock, "idb_outbox");
  const writerLease = await lease(first, campaign.campaignId, "idb_outbox");
  expectOk(await first.commit(commitRequest({ campaign, operation, writerLease, suffix: "idb_outbox" })));
  const initial = expectOk(await first.claimOutboxTasks(campaign.campaignId, id<WorkerId>("worker_idb_a"), 1, 1_000));
  assert.equal(initial[0].attemptCount, 1);
  first.close();
  clock.advance(1_001);
  const second = await open(databaseName, clock);
  const reclaimed = expectOk(await second.claimOutboxTasks(campaign.campaignId, id<WorkerId>("worker_idb_b"), 1, 1_000));
  assert.equal(reclaimed[0].attemptCount, 2);
  second.close();
  await deleteTestDatabase(databaseName);
});

test("08 read-only state survives reopen", async () => {
  const databaseName = name("readonly");
  const clock = new MutableClock();
  const first = await open(databaseName, clock);
  const campaign = await bootstrap(first, clock, "idb_readonly");
  expectOk(await first.setCampaignReadOnly(campaign.campaignId, {
    code: "MANUAL_LOCK",
    incidentId: null
  }));
  first.close();
  const second = await open(databaseName, clock);
  assert.equal(expectOk(await second.getCampaign(campaign.campaignId)).status, "READ_ONLY");
  expectError(await second.receiveOperation(await operationFixture(campaign, clock, "idb_readonly_new")), "CAMPAIGN_READ_ONLY");
  second.close();
  await deleteTestDatabase(databaseName);
});

test("09 migration activates a complete generation and keeps a backup", async () => {
  const databaseName = name("migration");
  const clock = new MutableClock();
  const repository = await open(databaseName, clock);
  const campaign = await bootstrap(repository, clock, "idb_migration");
  const operation = await readyOperation(repository, campaign, clock, "idb_migration");
  const writerLease = await lease(repository, campaign.campaignId, "idb_migration");
  expectOk(await repository.commit(commitRequest({ campaign, operation, writerLease, suffix: "idb_migration" })));
  expectOk(await repository.completePresentation(operation.operationId, "COMMITTED_RENDERED", 1, { text: "done" }));
  expectOk(await repository.releaseWriterLease(writerLease));
  const report = expectOk(await repository.migrateCampaignStorage({
    campaignId: campaign.campaignId,
    ownerId: id<WriterId>("writer_migration"),
    batchSize: 1
  }));
  const state = expectOk(await repository.getCampaignStorageState(campaign.campaignId));
  assert.equal(state.head.activeGenerationId, report.targetGenerationId);
  assert.equal(state.generations.some(generation => generation.generationId === report.sourceGenerationId && generation.status === "BACKUP"), true);
  assert.equal(expectOk(await repository.listEvents(campaign.campaignId, null, 10)).length, 1);
  const backup = expectOk(await repository.confirmCampaignStorageMigration(campaign.campaignId, report.sourceGenerationId));
  assert.ok(backup.confirmedAt);
  repository.close();
  await deleteTestDatabase(databaseName);
});

test("10 invalid migration leaves the source generation active", async () => {
  const databaseName = name("migration_invalid");
  const clock = new MutableClock();
  const repository = await open(databaseName, clock);
  const campaign = await bootstrap(repository, clock, "idb_migration_invalid");
  const before = expectOk(await repository.getCampaignStorageState(campaign.campaignId));
  expectError(await repository.migrateCampaignStorage({
    campaignId: campaign.campaignId,
    ownerId: id<WriterId>("writer_migration_invalid"),
    transform: (store, record) => store === "aggregates" ? {} : record
  }), "PERSISTENCE_FAILURE");
  const after = expectOk(await repository.getCampaignStorageState(campaign.campaignId));
  assert.equal(after.head.activeGenerationId, before.head.activeGenerationId);
  assert.equal(after.head.migration.state, "FAILED");
  assert.deepEqual(expectOk(await repository.getCampaign(campaign.campaignId)), campaign);
  repository.close();
  await deleteTestDatabase(databaseName);
});

test("11 post-activation failure rolls back and expired owner can be replaced", async () => {
  const databaseName = name("migration_abort");
  const clock = new MutableClock();
  const repository = await open(databaseName, clock, point => {
    if (point === "AFTER_MIGRATION_ACTIVATION") throw new Error("interrupted after activation");
  });
  const campaign = await bootstrap(repository, clock, "idb_migration_abort");
  const owner = id<WriterId>("writer_migration_abort");
  expectError(await repository.migrateCampaignStorage({
    campaignId: campaign.campaignId,
    ownerId: owner
  }), "PERSISTENCE_FAILURE");
  const failedState = expectOk(await repository.getCampaignStorageState(campaign.campaignId));
  assert.equal(failedState.head.migration.state, "FAILED");
  assert.equal(
    failedState.generations.find(generation => generation.generationId === failedState.head.activeGenerationId)?.status,
    "ACTIVE"
  );
  expectError(await repository.receiveOperation(await operationFixture(campaign, clock, "idb_blocked")), "CAMPAIGN_BUSY");
  clock.advance(5 * 60 * 1_000 + 1);
  expectOk(await repository.abortCampaignStorageMigration(
    campaign.campaignId,
    id<WriterId>("writer_migration_recovery")
  ));
  expectOk(await repository.receiveOperation(await operationFixture(campaign, clock, "idb_unblocked")));
  repository.close();
  await deleteTestDatabase(databaseName);
});

test("12 future physical database version is refused without downgrade", async () => {
  const databaseName = name("future");
  const clock = new MutableClock();
  const repository = await open(databaseName, clock);
  await bootstrap(repository, clock, "idb_future");
  repository.close();
  const future = await nativeOpen(databaseName, 2);
  future.close();
  await expectRejected(IndexedDbCampaignRepository.open({ databaseName, clock }));
  const stillFuture = await nativeOpen(databaseName, 2);
  assert.equal(stillFuture.version, 2);
  stillFuture.close();
  await deleteTestDatabase(databaseName);
});

test("13 versionchange closes the old adapter connection", async () => {
  const databaseName = name("versionchange");
  const clock = new MutableClock();
  const repository = await open(databaseName, clock);
  const campaign = await bootstrap(repository, clock, "idb_versionchange");
  const upgraded = await nativeOpen(databaseName, 2);
  expectError(await repository.getCampaign(campaign.campaignId), "PERSISTENCE_FAILURE");
  let deleteRejected = false;
  try {
    await IndexedDbCampaignRepository.deleteDatabase(databaseName);
  } catch {
    deleteRejected = true;
  }
  assert.equal(deleteRejected, true, "A blocking connection must make deletion fail explicitly.");
  upgraded.close();
  await deleteTestDatabase(databaseName);
});

test("14 quota-style abort never publishes a partial commit", async () => {
  const databaseName = name("quota");
  const clock = new MutableClock();
  const repository = await open(databaseName, clock, point => {
    if (point === "AFTER_OUTBOX") throw new DOMException("quota", "QuotaExceededError");
  });
  const campaign = await bootstrap(repository, clock, "idb_quota");
  const estimate = expectOk(await repository.getBrowserStorageEstimate(true));
  assert.equal(typeof estimate.warning, "boolean");
  const operation = await readyOperation(repository, campaign, clock, "idb_quota");
  const writerLease = await lease(repository, campaign.campaignId, "idb_quota");
  const request = commitRequest({ campaign, operation, writerLease, suffix: "idb_quota" });
  expectError(await repository.commit(request), "PERSISTENCE_FAILURE");
  assert.equal(expectOk(await repository.getCampaign(campaign.campaignId)).campaignRevision, 0);
  expectError(await repository.getAggregate(
    campaign.campaignId,
    "scene.state",
    id<AggregateId>("agg_scene_main")
  ), "NOT_FOUND");
  repository.close();
  await deleteTestDatabase(databaseName);
});

test("15 pre-migration connection resolves the newly active generation", async () => {
  const databaseName = name("old_connection");
  const clock = new MutableClock();
  const migrator = await open(databaseName, clock);
  const oldConnection = await open(databaseName, clock);
  const campaign = await bootstrap(migrator, clock, "idb_old_connection");
  const report = expectOk(await migrator.migrateCampaignStorage({
    campaignId: campaign.campaignId,
    ownerId: id<WriterId>("writer_old_connection")
  }));
  assert.equal(expectOk(await oldConnection.getCampaign(campaign.campaignId)).campaignId, campaign.campaignId);
  const operation = await operationFixture(campaign, clock, "idb_after_migration");
  expectOk(await oldConnection.receiveOperation(operation));
  assert.equal(expectOk(await migrator.getOperation(operation.operationId)).operationId, operation.operationId);
  const state = expectOk(await migrator.getCampaignStorageState(campaign.campaignId));
  assert.equal(state.head.activeGenerationId, report.targetGenerationId);
  migrator.close();
  oldConnection.close();
  await deleteTestDatabase(databaseName);
});

export async function runIndexedDbSpecificTests(): Promise<IndexedDbSpecificRun> {
  const failures: Array<{ name: string; message: string }> = [];
  for (const entry of tests) {
    try {
      await entry.run();
      console.log(`PASS [indexeddb-specific] ${entry.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      failures.push({ name: entry.name, message });
      console.error(`FAIL [indexeddb-specific] ${entry.name}`);
      console.error(error);
    }
  }
  return { passed: tests.length - failures.length, failed: failures.length, failures };
}
