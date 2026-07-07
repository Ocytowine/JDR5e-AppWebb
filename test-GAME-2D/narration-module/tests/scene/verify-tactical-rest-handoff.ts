import {
  computeRequestFingerprint,
  MemoryCampaignRepository,
  opaqueId,
  type AggregateId,
  type CampaignClockPayload,
  type CampaignId,
  type CampaignRecord,
  type CommandId,
  type CommitFailurePoint,
  type CommitId,
  type EventId,
  type IdempotencyKey,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RepositoryClock,
  type RequestId,
  type Result,
  type WriterId
} from "../../src/core/index";
import {
  HANDOFF_CONTRACT_VERSION,
  createHandoffOutcomeTemporalBatchV1,
  createRestProcessStateFromSeedV1,
  createRestSegmentTemporalBatchV1,
  prepareNextRestSegmentV1,
  prepareHandoffOutcomeIntegrationV1,
  prepareRestStartCommitV1,
  prepareRestSegmentCommitV1,
  prepareTimedHandoffOutcomeIntegrationV1,
  restProcessAggregateId,
  validateRestSeedV1,
  validateTacticalEncounterSeedV1,
  type ProcessHandoffV1,
  type PreparedRestSegmentV1,
  type RestProcessStateV1,
  type RestOutcomeV1,
  type RestSeedV1,
  type TacticalEncounterSeedV1,
  type TacticalOutcomeV1
} from "../../src/handoff/index";
import { assert } from "../contracts/assertions";

type AsyncTest = () => Promise<void>;

const tests: Array<{ name: string; run: AsyncTest }> = [];

function test(name: string, run: AsyncTest): void {
  tests.push({ name, run });
}

class MutableClock implements RepositoryClock {
  constructor(private epochMs = Date.parse("2026-07-07T10:00:00.000Z")) {}

  now(): Date {
    return new Date(this.epochMs);
  }

  advance(ms: number): void {
    this.epochMs += ms;
  }
}

function id<T extends string>(value: string): T {
  return opaqueId<T>(value);
}

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(`Expected success, got ${result.error.code}: ${result.error.messageKey}`);
  return result.value;
}

function expectError<T>(result: Result<T>, code: string): void {
  assert.equal(result.ok, false, "Expected an error result.");
  if (!result.ok) assert.equal(result.error.code, code);
}

const initialClock: CampaignClockPayload = {
  elapsedGameSeconds: 0,
  calendarId: "calendar.test",
  calendarVersion: 1
};

function campaignFixture(clock: MutableClock, suffix: string): CampaignRecord {
  const instant = clock.now().toISOString();
  return {
    schemaVersion: 1,
    campaignId: id<CampaignId>(`cmp_i07a_${suffix}`),
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: id<AggregateId>(`agg_clock_i07a_${suffix}`),
    dependencies: {
      contentPackageId: "content.test",
      contentPackageVersion: 1,
      rulesetId: "rules.house",
      rulesetVersion: 1,
      calendarId: "calendar.test",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: instant,
    updatedAt: instant
  };
}

async function operationFixture(
  campaign: CampaignRecord,
  clock: MutableClock,
  suffix: string,
  operationKind: string,
  payload: JsonObject,
  observedCampaignRevision = campaign.campaignRevision,
  idempotencyKey?: IdempotencyKey
): Promise<OperationRecord> {
  const instant = clock.now().toISOString();
  return {
    schemaVersion: 1,
    operationId: id<OperationId>(`op_i07a_${suffix}`),
    campaignId: campaign.campaignId,
    clientRequestId: id<RequestId>(`req_i07a_${suffix}`),
    idempotencyKey: idempotencyKey ?? id<IdempotencyKey>(`idem_i07a_${suffix}`),
    requestFingerprint: await computeRequestFingerprint(operationKind, 1, payload),
    operationKind,
    requestPayloadSchemaVersion: 1,
    requestPayload: payload,
    phase: "RECEIVED",
    observedCampaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: instant,
    updatedAt: instant
  };
}

async function setup(suffix: string, failureInjector?: (point: CommitFailurePoint) => void) {
  const clock = new MutableClock();
  const repository = new MemoryCampaignRepository({ clock, failureInjector: failureInjector as ((point: string) => void) | undefined });
  const campaign = campaignFixture(clock, suffix);
  expectOk(await repository.createCampaign(campaign, initialClock));
  return { repository, clock, campaign };
}

async function readyOperation(
  repository: MemoryCampaignRepository,
  campaign: CampaignRecord,
  clock: MutableClock,
  suffix: string,
  operationKind: string,
  payload: JsonObject,
  idempotencyKey?: IdempotencyKey
): Promise<OperationRecord> {
  const operation = await operationFixture(campaign, clock, suffix, operationKind, payload, campaign.campaignRevision, idempotencyKey);
  expectOk(await repository.receiveOperation(operation));
  expectOk(await repository.transitionOperation(operation.operationId, "RECEIVED", "PREPARING"));
  return expectOk(await repository.transitionOperation(operation.operationId, "PREPARING", "READY_TO_COMMIT"));
}

async function lease(repository: MemoryCampaignRepository, campaignId: CampaignId, suffix: string) {
  return expectOk(await repository.acquireWriterLease(campaignId, id<WriterId>(`writer_i07a_${suffix}`), 120_000));
}

function processAggregateId(processId: string): AggregateId {
  return id<AggregateId>(`agg_handoff_${processId}`);
}

function scheduleAggregateId(suffix: string): AggregateId {
  return id<AggregateId>(`agg_schedule_i07b_${suffix}`);
}

function simulationCursorAggregateId(suffix: string): AggregateId {
  return id<AggregateId>(`agg_cursor_i07b_${suffix}`);
}

async function readyTimeSegmentOperation(
  repository: MemoryCampaignRepository,
  campaign: CampaignRecord,
  clock: MutableClock,
  suffix: string,
  batchFingerprint: string
): Promise<OperationRecord> {
  return readyOperation(repository, campaign, clock, suffix, "time.segment", { batchFingerprint });
}

function tacticalSeed(campaign: CampaignRecord, processId = "proc_tactical_i07a"): TacticalEncounterSeedV1 {
  return {
    schemaVersion: 1,
    contractVersion: HANDOFF_CONTRACT_VERSION,
    seedId: "seed_tactical_i07a",
    processId,
    campaignId: campaign.campaignId,
    sceneId: "scene_market_gate",
    locationRef: { kind: "wiki.location", id: "ville_test.porte_marche" },
    startedAtGameSecond: 0,
    rulesetRef: { kind: "ruleset", id: "rules.house@1" },
    cause: { trigger: "guard_blocks_player", narrativeCanResolve: false },
    stakes: { failure: "capture", success: "passage" },
    objectives: [{ actorId: "pj-1", objective: "escape_without_capture" }],
    participants: [{
      actorId: "pj-1",
      tacticalProjectionRef: "projection.pj-1.v1",
      visibleAppearance: "vetements de voyage, symbole sacre visible"
    }, {
      actorId: "guard-1",
      tacticalProjectionRef: "projection.guard-1.v1",
      visibleAppearance: "garde en livree"
    }],
    teams: [{ teamId: "heroes", actors: ["pj-1"] }, { teamId: "guards", actors: ["guard-1"] }],
    tacticalMapRef: null,
    mapGenerationRequest: { footprint: "market_gate_small", coverDensity: "medium" },
    entryZones: [{ zoneId: "south_gate" }],
    exitZones: [{ zoneId: "north_alley" }],
    knownTerrain: [{ terrainId: "market_stalls", effect: "cover" }],
    lightingAndVisibility: { light: "daylight", visibility: "clear" },
    weatherAndHazards: [{ hazardId: "crowd", severity: "low" }],
    initialPositions: [{ actorId: "pj-1", zoneId: "south_gate" }, { actorId: "guard-1", zoneId: "north_alley" }],
    surpriseState: { surprisedActors: [] },
    allowedEndConditions: ["escape", "capture", "surrender", "all_hostiles_neutralized"],
    sourceAggregateRefs: [{ kind: "scene.state", id: "scene_market_gate" }],
    seedFingerprint: "fp_tactical_seed_i07a",
    version: 1
  };
}

function pendingTacticalProcess(campaign: CampaignRecord, sourceOperationId: OperationId, processId = "proc_tactical_i07a"): ProcessHandoffV1 {
  return {
    schemaVersion: 1,
    contractVersion: HANDOFF_CONTRACT_VERSION,
    processId,
    campaignId: campaign.campaignId,
    sourceOperationId,
    sourceSceneId: "scene_market_gate",
    processKind: "TACTICAL_ENCOUNTER",
    status: "COMPLETED_PENDING_INTEGRATION",
    createdAtGameSecond: 0,
    sourceRefs: [{ kind: "scene.state", id: "scene_market_gate" }],
    idempotencyKey: `handoff_${processId}`,
    version: 1,
    integratedOutcomeId: null,
    updatedAtGameSecond: null
  };
}

function tacticalOutcome(campaign: CampaignRecord, sourceOperationId: OperationId, processId = "proc_tactical_i07a"): TacticalOutcomeV1 {
  return {
    schemaVersion: 1,
    contractVersion: HANDOFF_CONTRACT_VERSION,
    processKind: "TACTICAL_ENCOUNTER",
    outcomeId: `outcome_${processId}`,
    processId,
    campaignId: campaign.campaignId,
    sourceOperationId,
    status: "COMPLETED",
    elapsedGameSeconds: 42,
    domainDeltas: [{
      deltaId: "delta_pj_damage",
      aggregateType: "character.state",
      aggregateId: id<AggregateId>("agg_character_pj_1"),
      expectedAggregateRevision: null,
      payloadSchemaVersion: 1,
      payload: { characterId: "pj-1", hp: 8, resourceLog: ["lost_4_hp"], elapsedGameSeconds: 42 },
      summary: "PJ loses 4 HP during tactical encounter."
    }],
    eventDrafts: [{
      eventType: "tactical_encounter_resolved",
      origin: "PROCESS",
      visibility: "PLAYER_VISIBLE",
      occurredAtGameSecond: 0,
      payloadSchemaVersion: 1,
      payload: { processId, endCondition: "escape", summary: "Le PJ echappe au garde, blesse." }
    }],
    narrativeProjection: { continuationPrompt: "reprendre dans la ruelle nord" },
    uiNotifications: [],
    memoryCandidates: [{ memoryType: "combat", text: "Le garde a vu le symbole sacre." }],
    sourceRefs: [{ kind: "process.handoff", id: processId }],
    finalStateFingerprint: "fp_tactical_outcome_i07a",
    integrationIdempotencyKey: `idem_integrate_${processId}`,
    version: 1,
    turnJournal: [{ turn: 1, actorId: "guard-1", action: "strike" }],
    finalParticipantStates: [{ actorId: "pj-1", hp: 8 }],
    casualtiesAndConditions: [{ actorId: "pj-1", condition: "wounded" }],
    resourceChanges: [{ actorId: "pj-1", hpDelta: -4 }],
    finalPositions: [{ actorId: "pj-1", zoneId: "north_alley" }],
    endCondition: "escape",
    placeDamage: [{ target: "market_stall", state: "broken" }],
    engagedSpeechAndKnowledge: [{ actorId: "guard-1", knowledge: "pj_symbol_seen" }],
    availableLoot: [{ objectId: "guard_keys", transfer: "not_automatic" }],
    consequenceCandidates: [{ kind: "social", target: "city_guard", value: "suspicious" }],
    checkpointRefs: [{ kind: "process.checkpoint", id: "chk_tactical_final" }]
  };
}

function restSeed(campaign: CampaignRecord, processId = "proc_rest_i07a"): RestSeedV1 {
  return {
    schemaVersion: 1,
    contractVersion: HANDOFF_CONTRACT_VERSION,
    seedId: "seed_rest_i07a",
    processId,
    campaignId: campaign.campaignId,
    sceneId: "scene_camp",
    locationRef: { kind: "wiki.location", id: "camp_bois_ouest" },
    restKind: "LONG_REST",
    startedAtGameSecond: 0,
    targetDurationSeconds: 28_800,
    rulesetRef: { kind: "ruleset", id: "rules.house@1" },
    participants: [{ actorId: "pj-1", fatigue: 1, hp: 8 }],
    safetyProfile: { danger: "medium", shelter: "light" },
    availableSupplies: [{ itemId: "ration", qty: 1 }],
    availableActivities: [{ activityId: "heal_wounds" }],
    watchPlan: { watches: [{ actorId: "pj-1", segment: 1 }] },
    riskSources: [{ kind: "travel_encounter", danger: "medium" }],
    nearbyWorldEvents: [],
    requiredQuestions: [{ questionId: "consume_ration", kind: "resource_choice" }],
    sourceAggregateRefs: [{ kind: "character.state", id: "pj-1" }],
    seedFingerprint: "fp_rest_seed_i07a",
    version: 1
  };
}

function segmentRestSeed(campaign: CampaignRecord, processId = "proc_rest_segment_i07c", interruptionPercent = 0): RestSeedV1 {
  return {
    ...restSeed(campaign, processId),
    targetDurationSeconds: 7_200,
    safetyProfile: { danger: interruptionPercent > 0 ? "high" : "low", shelter: "light", interruptionPercent }
  };
}

function restOutcome(campaign: CampaignRecord, sourceOperationId: OperationId, processId = "proc_rest_i07a"): RestOutcomeV1 {
  return {
    schemaVersion: 1,
    contractVersion: HANDOFF_CONTRACT_VERSION,
    processKind: "REST",
    outcomeId: `outcome_${processId}`,
    processId,
    campaignId: campaign.campaignId,
    sourceOperationId,
    status: "INTERRUPTED",
    elapsedGameSeconds: 3_600,
    domainDeltas: [{
      deltaId: "delta_rest_supplies",
      aggregateType: "inventory.state",
      aggregateId: id<AggregateId>("agg_inventory_pj_1"),
      expectedAggregateRevision: null,
      payloadSchemaVersion: 1,
      payload: { characterId: "pj-1", consumed: ["ration"], grantedLongRestBenefit: false },
      summary: "Ration consumed; long rest benefit not granted because the rest was interrupted."
    }],
    eventDrafts: [],
    narrativeProjection: { continuationPrompt: "reveil brutal avant les benefices du repos long" },
    uiNotifications: [{ kind: "rest_interrupted", messageKey: "rest.interrupted" }],
    memoryCandidates: [],
    sourceRefs: [{ kind: "process.handoff", id: processId }],
    finalStateFingerprint: "fp_rest_interrupted_i07a",
    integrationIdempotencyKey: `idem_integrate_${processId}`,
    version: 1,
    acquiredBenefits: [],
    refusedBenefits: [],
    remainingPossibleBenefits: [{ benefitId: "long_rest_recovery", reason: "duration_not_reached" }],
    healthFatigueConditionChanges: [],
    resourceChanges: [],
    consumptions: [{ itemId: "ration", qty: 1 }],
    completedActivities: [],
    hygieneAndPresentationChanges: [],
    livedEventsAndConversations: [{ event: "distant_noise" }],
    worldConsequences: [{ event: "patrol_moved_closer" }],
    interruptionReason: "hostile_noise_near_camp",
    appliedRuleRefs: [{ kind: "rule", id: "rest.long.duration" }]
  };
}

async function commitPendingProcess(
  repository: MemoryCampaignRepository,
  campaign: CampaignRecord,
  clock: MutableClock,
  process: ProcessHandoffV1,
  suffix: string,
  expectedProcessRevision: number | null = null
): Promise<CampaignRecord> {
  const operation = await readyOperation(repository, campaign, clock, `${suffix}_pending`, "handoff.process.complete", {
    processId: process.processId
  });
  const writerLease = await lease(repository, campaign.campaignId, `${suffix}_pending`);
  expectOk(await repository.commit({
    campaignId: campaign.campaignId,
    operationId: operation.operationId,
    commitId: id<CommitId>(`cmt_i07a_${suffix}_pending`),
    idempotencyKey: operation.idempotencyKey,
    requestFingerprint: operation.requestFingerprint,
    expectedCampaignRevision: campaign.campaignRevision,
    writerLease,
    acceptedCommands: [{
      schemaVersion: 1,
      contractId: "tactical-rest-handoff",
      contractVersion: 1,
      commandId: id<CommandId>(`cmd_i07a_${suffix}_pending`),
      campaignId: campaign.campaignId,
      operationId: operation.operationId,
      commandType: "handoff.mark_completed_pending_integration",
      target: {
        aggregateType: "process.handoff",
        aggregateId: processAggregateId(process.processId),
        expectedAggregateRevision: expectedProcessRevision
      },
      payloadSchemaVersion: 1,
      payload: { processId: process.processId },
      acceptedAtGameSecond: process.createdAtGameSecond
    }],
    aggregateWrites: [{
      aggregateType: "process.handoff",
      aggregateId: processAggregateId(process.processId),
      expectedAggregateRevision: expectedProcessRevision,
      payloadSchemaVersion: 1,
      payload: process
    }],
    events: [{
      schemaVersion: 1,
      eventId: id<EventId>(`evt_i07a_${suffix}_pending`),
      campaignId: campaign.campaignId,
      operationId: operation.operationId,
      eventType: "handoff_completed_pending_integration",
      origin: "PROCESS",
      causation: { kind: "COMMAND", id: `cmd_i07a_${suffix}_pending` },
      aggregateRefs: [{
        aggregateType: "process.handoff",
        aggregateId: processAggregateId(process.processId),
        aggregateRevision: expectedProcessRevision === null ? 0 : expectedProcessRevision + 1
      }],
      visibility: { scope: "SYSTEM", actorIds: [] },
      occurredAtGameSecond: process.createdAtGameSecond,
      payloadSchemaVersion: 1,
      payload: { processId: process.processId }
    }],
    outboxTasks: []
  }));
  expectOk(await repository.releaseWriterLease(writerLease));
  expectOk(await repository.completePresentation(operation.operationId, "COMMITTED_RENDERED", 1, { ok: true }));
  return expectOk(await repository.getCampaign(campaign.campaignId));
}

async function commitRestSegment(input: {
  repository: MemoryCampaignRepository;
  campaign: CampaignRecord;
  clock: MutableClock;
  suffix: string;
  segment: PreparedRestSegmentV1;
  restProcessExpectedRevision: number | null;
}): Promise<{ campaign: CampaignRecord; process: RestProcessStateV1 }> {
  const batch = await createRestSegmentTemporalBatchV1({
    batchId: `batch_i07c_${input.suffix}`,
    taskId: `task_i07c_${input.suffix}`,
    segment: input.segment
  });
  const operation = await readyTimeSegmentOperation(input.repository, input.campaign, input.clock, `rest_segment_${input.suffix}`, batch.batchFingerprint);
  const writerLease = await lease(input.repository, input.campaign.campaignId, `rest_segment_${input.suffix}`);
  const clockAggregate = expectOk(await input.repository.getAggregate(input.campaign.campaignId, "world.clock", input.campaign.clockAggregateId));
  const scheduleAggregate = input.restProcessExpectedRevision === null
    ? null
    : expectOk(await input.repository.getAggregate(input.campaign.campaignId, "world.schedule", scheduleAggregateId("rest_segments")));
  const cursorAggregate = input.restProcessExpectedRevision === null
    ? null
    : expectOk(await input.repository.getAggregate(input.campaign.campaignId, "world.simulation-cursor", simulationCursorAggregateId("rest_segments")));
  const prepared = await prepareRestSegmentCommitV1({
    campaign: input.campaign,
    operation,
    writerLease,
    clockAggregate,
    scheduleAggregate,
    scheduleAggregateId: scheduleAggregateId("rest_segments"),
    simulationCursorAggregate: cursorAggregate,
    simulationCursorAggregateId: simulationCursorAggregateId("rest_segments"),
    restProcessAggregateId: restProcessAggregateId(input.segment.processId),
    restProcessExpectedRevision: input.restProcessExpectedRevision,
    segment: input.segment,
    batch,
    eventId: id<EventId>(`evt_i07c_${input.suffix}`),
    commitId: id<CommitId>(`cmt_i07c_${input.suffix}`),
    commandId: id<CommandId>(`cmd_i07c_${input.suffix}`)
  });
  assert.equal(prepared.ok, true, prepared.ok ? undefined : prepared.diagnostics.map(value => value.code).join(","));
  if (!prepared.ok) throw new Error("rest segment preparation failed");
  const first = expectOk(await input.repository.commit(prepared.value));
  const replay = expectOk(await input.repository.commit(prepared.value));
  assert.deepEqual(replay, first);
  expectOk(await input.repository.releaseWriterLease(writerLease));
  expectOk(await input.repository.completePresentation(operation.operationId, "COMMITTED_RENDERED", 1, { ok: true }));
  const nextCampaign = expectOk(await input.repository.getCampaign(input.campaign.campaignId));
  const aggregate = expectOk(await input.repository.getAggregate(
    input.campaign.campaignId,
    "rest.process",
    restProcessAggregateId(input.segment.processId)
  ));
  return { campaign: nextCampaign, process: aggregate.payload as RestProcessStateV1 };
}

test("01 tactical handoff produces a typed seed without resolving combat", async () => {
  const { campaign } = await setup("seed");
  const seed = tacticalSeed(campaign);
  const validation = validateTacticalEncounterSeedV1(seed);
  assert.equal(validation.valid, true, validation.issues.join(" | "));
  assert.equal(seed.participants.length, 2);
  assert.equal("turnJournal" in seed, false, "A seed must not contain tactical resolution output.");
});

test("02 tactical outcome integration is idempotent and does not double consequences", async () => {
  const { repository, clock, campaign } = await setup("idem");
  const sourceOperationId = id<OperationId>("op_i07a_source_tactical");
  const process = pendingTacticalProcess(campaign, sourceOperationId);
  const afterProcess = await commitPendingProcess(repository, campaign, clock, process, "idem");
  const outcome = tacticalOutcome(afterProcess, sourceOperationId);
  const integrationOperation = await readyOperation(repository, afterProcess, clock, "idem_integrate", "handoff.outcome.integrate", {
    processId: process.processId
  }, id<IdempotencyKey>(outcome.integrationIdempotencyKey));
  const writerLease = await lease(repository, campaign.campaignId, "idem_integrate");
  const request = prepareHandoffOutcomeIntegrationV1({
    campaign: afterProcess,
    operation: integrationOperation,
    writerLease,
    process,
    processExpectedRevision: 0,
    outcome,
    commitId: id<CommitId>("cmt_i07a_idem_integrate"),
    commandId: id<CommandId>("cmd_i07a_idem_integrate"),
    eventIdPrefix: "evt_i07a_idem_integrate",
    integratedAtGameSecond: 0
  });
  const first = expectOk(await repository.commit(request));
  const replay = expectOk(await repository.commit(request));
  assert.deepEqual(replay, first);
  expectOk(await repository.releaseWriterLease(writerLease));

  const processAggregate = expectOk(await repository.getAggregate(campaign.campaignId, "process.handoff", processAggregateId(process.processId)));
  assert.equal(processAggregate.aggregateRevision, 1);
  assert.equal(processAggregate.payload.status, "INTEGRATED");
  const characterAggregate = expectOk(await repository.getAggregate(campaign.campaignId, "character.state", id<AggregateId>("agg_character_pj_1")));
  assert.equal(characterAggregate.aggregateRevision, 0);
  assert.equal(characterAggregate.payload.hp, 8);
  const events = expectOk(await repository.listEvents(campaign.campaignId, null, 20));
  assert.equal(events.filter(event => event.eventType === "tactical_encounter_resolved").length, 1);
});

test("03 failed integration leaves process completed pending integration", async () => {
  let failIntegration = false;
  const { repository, clock, campaign } = await setup("failure", point => {
    if (failIntegration && point === "AFTER_EVENTS") throw new Error("forced failure after events");
  });
  const sourceOperationId = id<OperationId>("op_i07a_source_failure");
  const process = pendingTacticalProcess(campaign, sourceOperationId, "proc_tactical_failure_i07a");
  const afterProcess = await commitPendingProcess(repository, campaign, clock, process, "failure");
  const outcome = tacticalOutcome(afterProcess, sourceOperationId, process.processId);
  const integrationOperation = await readyOperation(repository, afterProcess, clock, "failure_integrate", "handoff.outcome.integrate", {
    processId: process.processId
  }, id<IdempotencyKey>(outcome.integrationIdempotencyKey));
  const writerLease = await lease(repository, campaign.campaignId, "failure_integrate");
  const request = prepareHandoffOutcomeIntegrationV1({
    campaign: afterProcess,
    operation: integrationOperation,
    writerLease,
    process,
    processExpectedRevision: 0,
    outcome,
    commitId: id<CommitId>("cmt_i07a_failure_integrate"),
    commandId: id<CommandId>("cmd_i07a_failure_integrate"),
    eventIdPrefix: "evt_i07a_failure_integrate",
    integratedAtGameSecond: 0
  });
  failIntegration = true;
  expectError(await repository.commit(request), "PERSISTENCE_FAILURE");
  const processAggregate = expectOk(await repository.getAggregate(campaign.campaignId, "process.handoff", processAggregateId(process.processId)));
  assert.equal(processAggregate.aggregateRevision, 0);
  assert.equal(processAggregate.payload.status, "COMPLETED_PENDING_INTEGRATION");
  expectError(await repository.getAggregate(campaign.campaignId, "character.state", id<AggregateId>("agg_character_pj_1")), "NOT_FOUND");
});

test("04 rest starts only from an explicit valid seed and rest_started is committed", async () => {
  const { repository, clock, campaign } = await setup("rest_start");
  const seed = restSeed(campaign);
  assert.equal(validateRestSeedV1({ ...seed, restKind: "" }).valid, false);
  const operation = await readyOperation(repository, campaign, clock, "rest_start", "handoff.rest.start", { processId: seed.processId });
  const writerLease = await lease(repository, campaign.campaignId, "rest_start");
  assert.equal(expectOk(await repository.listEvents(campaign.campaignId, null, 10)).length, 0);
  expectOk(await repository.commit(prepareRestStartCommitV1({
    campaign,
    operation,
    writerLease,
    seed,
    processIdempotencyKey: "handoff_rest_start_i07a",
    commitId: id<CommitId>("cmt_i07a_rest_start"),
    commandId: id<CommandId>("cmd_i07a_rest_start"),
    eventId: id<EventId>("evt_i07a_rest_started")
  })));
  expectOk(await repository.releaseWriterLease(writerLease));
  const events = expectOk(await repository.listEvents(campaign.campaignId, null, 10));
  assert.deepEqual(events.map(event => event.eventType), ["rest_started"]);
});

test("05 interrupted rest emits committed interruption event and grants no long-rest benefit", async () => {
  const { repository, clock, campaign } = await setup("rest_interrupted");
  const seed = restSeed(campaign, "proc_rest_interrupted_i07a");
  const startOperation = await readyOperation(repository, campaign, clock, "rest_interrupted_start", "handoff.rest.start", {
    processId: seed.processId
  });
  const startLease = await lease(repository, campaign.campaignId, "rest_interrupted_start");
  expectOk(await repository.commit(prepareRestStartCommitV1({
    campaign,
    operation: startOperation,
    writerLease: startLease,
    seed,
    processIdempotencyKey: "handoff_rest_interrupted_i07a",
    commitId: id<CommitId>("cmt_i07a_rest_interrupted_start"),
    commandId: id<CommandId>("cmd_i07a_rest_interrupted_start"),
    eventId: id<EventId>("evt_i07a_rest_interrupted_started")
  })));
  expectOk(await repository.releaseWriterLease(startLease));
  expectOk(await repository.completePresentation(startOperation.operationId, "COMMITTED_RENDERED", 1, { ok: true }));
  const afterStart = expectOk(await repository.getCampaign(campaign.campaignId));
  const activeProcess = expectOk(await repository.getAggregate(campaign.campaignId, "process.handoff", processAggregateId(seed.processId))).payload as ProcessHandoffV1;
  const pendingProcess: ProcessHandoffV1 = { ...activeProcess, status: "COMPLETED_PENDING_INTEGRATION" };
  const markPending = await commitPendingProcess(repository, afterStart, clock, pendingProcess, "rest_interrupted_pending", 0);
  const outcome = restOutcome(markPending, pendingProcess.sourceOperationId, seed.processId);
  const integrationOperation = await readyOperation(repository, markPending, clock, "rest_interrupted_integrate", "handoff.outcome.integrate", {
    processId: seed.processId
  }, id<IdempotencyKey>(outcome.integrationIdempotencyKey));
  const integrationLease = await lease(repository, campaign.campaignId, "rest_interrupted_integrate");
  expectOk(await repository.commit(prepareHandoffOutcomeIntegrationV1({
    campaign: markPending,
    operation: integrationOperation,
    writerLease: integrationLease,
    process: pendingProcess,
    processExpectedRevision: 1,
    outcome,
    commitId: id<CommitId>("cmt_i07a_rest_interrupted_integrate"),
    commandId: id<CommandId>("cmd_i07a_rest_interrupted_integrate"),
    eventIdPrefix: "evt_i07a_rest_interrupted_integrate",
    integratedAtGameSecond: 0
  })));
  expectOk(await repository.releaseWriterLease(integrationLease));

  const inventory = expectOk(await repository.getAggregate(campaign.campaignId, "inventory.state", id<AggregateId>("agg_inventory_pj_1")));
  assert.equal(inventory.payload.grantedLongRestBenefit, false);
  const events = expectOk(await repository.listEvents(campaign.campaignId, null, 20));
  assert.equal(events.some(event => event.eventType === "rest_started"), true);
  assert.equal(events.some(event => event.eventType === "rest_interrupted"), true);
});

test("06 timed tactical integration advances world clock exactly once", async () => {
  const { repository, clock, campaign } = await setup("timed_tactical");
  const sourceOperationId = id<OperationId>("op_i07b_source_tactical");
  const process = pendingTacticalProcess(campaign, sourceOperationId, "proc_tactical_timed_i07b");
  const afterProcess = await commitPendingProcess(repository, campaign, clock, process, "timed_tactical");
  const outcome = tacticalOutcome(afterProcess, sourceOperationId, process.processId);
  const batch = await createHandoffOutcomeTemporalBatchV1({
    batchId: "batch_i07b_tactical",
    taskId: "task_i07b_tactical",
    currentGameSecond: 0,
    elapsedGameSeconds: outcome.elapsedGameSeconds,
    processId: process.processId,
    outcomeId: outcome.outcomeId
  });
  const operation = await readyOperation(repository, afterProcess, clock, "timed_tactical_integrate", "time.segment", {
    batchFingerprint: batch.batchFingerprint
  }, id<IdempotencyKey>(outcome.integrationIdempotencyKey));
  const writerLease = await lease(repository, campaign.campaignId, "timed_tactical_integrate");
  const clockAggregate = expectOk(await repository.getAggregate(campaign.campaignId, "world.clock", campaign.clockAggregateId));
  const prepared = await prepareTimedHandoffOutcomeIntegrationV1({
    campaign: afterProcess,
    operation,
    writerLease,
    clockAggregate,
    scheduleAggregate: null,
    scheduleAggregateId: scheduleAggregateId("timed_tactical"),
    simulationCursorAggregate: null,
    simulationCursorAggregateId: simulationCursorAggregateId("timed_tactical"),
    process,
    processExpectedRevision: 0,
    outcome,
    batch,
    eventId: id<EventId>("evt_i07b_tactical_integrated"),
    commitId: id<CommitId>("cmt_i07b_tactical_integrated"),
    commandId: id<CommandId>("cmd_i07b_tactical_integrated")
  });
  assert.equal(prepared.ok, true, prepared.ok ? undefined : prepared.diagnostics.map(value => value.code).join(","));
  if (!prepared.ok) throw new Error("timed tactical integration preparation failed");
  const first = expectOk(await repository.commit(prepared.value));
  const replay = expectOk(await repository.commit(prepared.value));
  assert.deepEqual(replay, first);
  expectOk(await repository.releaseWriterLease(writerLease));

  const storedClock = expectOk(await repository.getAggregate(campaign.campaignId, "world.clock", campaign.clockAggregateId));
  assert.equal(storedClock.payload.elapsedGameSeconds, outcome.elapsedGameSeconds);
  const characterAggregate = expectOk(await repository.getAggregate(campaign.campaignId, "character.state", id<AggregateId>("agg_character_pj_1")));
  assert.equal(characterAggregate.payload.hp, 8);
  const events = expectOk(await repository.listEvents(campaign.campaignId, null, 20));
  assert.equal(events.filter(event => event.eventType === "tactical_encounter_resolved").length, 1);
});

test("07 timed interrupted rest advances clock and still grants no unavailable benefit", async () => {
  const { repository, clock, campaign } = await setup("timed_rest");
  const sourceOperationId = id<OperationId>("op_i07b_source_rest");
  const process: ProcessHandoffV1 = {
    ...pendingTacticalProcess(campaign, sourceOperationId, "proc_rest_timed_i07b"),
    processKind: "REST",
    sourceSceneId: "scene_camp"
  };
  const afterProcess = await commitPendingProcess(repository, campaign, clock, process, "timed_rest");
  const outcome = restOutcome(afterProcess, sourceOperationId, process.processId);
  const batch = await createHandoffOutcomeTemporalBatchV1({
    batchId: "batch_i07b_rest",
    taskId: "task_i07b_rest",
    currentGameSecond: 0,
    elapsedGameSeconds: outcome.elapsedGameSeconds,
    processId: process.processId,
    outcomeId: outcome.outcomeId
  });
  const operation = await readyOperation(repository, afterProcess, clock, "timed_rest_integrate", "time.segment", {
    batchFingerprint: batch.batchFingerprint
  }, id<IdempotencyKey>(outcome.integrationIdempotencyKey));
  const writerLease = await lease(repository, campaign.campaignId, "timed_rest_integrate");
  const clockAggregate = expectOk(await repository.getAggregate(campaign.campaignId, "world.clock", campaign.clockAggregateId));
  const prepared = await prepareTimedHandoffOutcomeIntegrationV1({
    campaign: afterProcess,
    operation,
    writerLease,
    clockAggregate,
    scheduleAggregate: null,
    scheduleAggregateId: scheduleAggregateId("timed_rest"),
    simulationCursorAggregate: null,
    simulationCursorAggregateId: simulationCursorAggregateId("timed_rest"),
    process,
    processExpectedRevision: 0,
    outcome,
    batch,
    eventId: id<EventId>("evt_i07b_rest_interrupted"),
    commitId: id<CommitId>("cmt_i07b_rest_interrupted"),
    commandId: id<CommandId>("cmd_i07b_rest_interrupted")
  });
  assert.equal(prepared.ok, true, prepared.ok ? undefined : prepared.diagnostics.map(value => value.code).join(","));
  if (!prepared.ok) throw new Error("timed rest integration preparation failed");
  const first = expectOk(await repository.commit(prepared.value));
  const replay = expectOk(await repository.commit(prepared.value));
  assert.deepEqual(replay, first);
  expectOk(await repository.releaseWriterLease(writerLease));

  const storedClock = expectOk(await repository.getAggregate(campaign.campaignId, "world.clock", campaign.clockAggregateId));
  assert.equal(storedClock.payload.elapsedGameSeconds, outcome.elapsedGameSeconds);
  const inventory = expectOk(await repository.getAggregate(campaign.campaignId, "inventory.state", id<AggregateId>("agg_inventory_pj_1")));
  assert.equal(inventory.payload.grantedLongRestBenefit, false);
  const events = expectOk(await repository.listEvents(campaign.campaignId, null, 20));
  assert.equal(events.filter(event => event.eventType === "rest_interrupted").length, 1);
});

test("08 segmented rest commits checkpoint and clock for one segment", async () => {
  const { repository, clock, campaign } = await setup("rest_segment_one");
  const seed = segmentRestSeed(campaign, "proc_rest_segment_one_i07c");
  const process = await createRestProcessStateFromSeedV1({ seed, segmentSeconds: 3_600 });
  const segment = await prepareNextRestSegmentV1({
    process,
    currentGameSecond: 0,
    deterministicSeed: "stable-rest-seed",
    allowInterruption: true
  });
  const committed = await commitRestSegment({
    repository,
    campaign,
    clock,
    suffix: "one",
    segment,
    restProcessExpectedRevision: null
  });
  assert.equal(committed.process.status, "ACTIVE");
  assert.equal(committed.process.elapsedRestSeconds, 3_600);
  assert.equal(committed.process.currentSegmentIndex, 1);
  assert.equal(committed.process.acquiredBenefits.length, 0);
  const storedClock = expectOk(await repository.getAggregate(campaign.campaignId, "world.clock", campaign.clockAggregateId));
  assert.equal(storedClock.payload.elapsedGameSeconds, 3_600);
  const events = expectOk(await repository.listEvents(campaign.campaignId, null, 20));
  assert.equal(events.filter(event => event.eventType === "rest_segment_completed").length, 1);
});

test("09 segmented rest completes only when target duration is reached", async () => {
  const { repository, clock, campaign } = await setup("rest_segment_complete");
  const seed = segmentRestSeed(campaign, "proc_rest_segment_complete_i07c");
  const process = await createRestProcessStateFromSeedV1({ seed, segmentSeconds: 3_600 });
  const firstSegment = await prepareNextRestSegmentV1({
    process,
    currentGameSecond: 0,
    deterministicSeed: "stable-rest-seed",
    allowInterruption: false
  });
  const firstCommit = await commitRestSegment({
    repository,
    campaign,
    clock,
    suffix: "complete_first",
    segment: firstSegment,
    restProcessExpectedRevision: null
  });
  const secondSegment = await prepareNextRestSegmentV1({
    process: firstCommit.process,
    currentGameSecond: 3_600,
    deterministicSeed: "stable-rest-seed",
    allowInterruption: false
  });
  const secondCommit = await commitRestSegment({
    repository,
    campaign: firstCommit.campaign,
    clock,
    suffix: "complete_second",
    segment: secondSegment,
    restProcessExpectedRevision: 0
  });
  assert.equal(secondCommit.process.status, "COMPLETED");
  assert.equal(secondCommit.process.elapsedRestSeconds, 7_200);
  assert.equal(secondCommit.process.acquiredBenefits.length, 1);
  assert.equal(secondCommit.process.remainingBenefits.length, 0);
  const storedClock = expectOk(await repository.getAggregate(campaign.campaignId, "world.clock", campaign.clockAggregateId));
  assert.equal(storedClock.payload.elapsedGameSeconds, 7_200);
  const events = expectOk(await repository.listEvents(campaign.campaignId, null, 30));
  assert.equal(events.filter(event => event.eventType === "rest_completed").length, 1);
});

test("10 segmented rest interruption is deterministic and grants no long rest benefit", async () => {
  const { repository, clock, campaign } = await setup("rest_segment_interrupt");
  const seed = segmentRestSeed(campaign, "proc_rest_segment_interrupt_i07c", 100);
  const process = await createRestProcessStateFromSeedV1({ seed, segmentSeconds: 3_600 });
  const firstSegment = await prepareNextRestSegmentV1({
    process,
    currentGameSecond: 0,
    deterministicSeed: "danger-stable-seed",
    allowInterruption: true
  });
  const firstCommit = await commitRestSegment({
    repository,
    campaign,
    clock,
    suffix: "interrupt_first",
    segment: firstSegment,
    restProcessExpectedRevision: null
  });
  const secondA = await prepareNextRestSegmentV1({
    process: firstCommit.process,
    currentGameSecond: 3_600,
    deterministicSeed: "danger-stable-seed",
    allowInterruption: true
  });
  const secondB = await prepareNextRestSegmentV1({
    process: firstCommit.process,
    currentGameSecond: 3_600,
    deterministicSeed: "danger-stable-seed",
    allowInterruption: true
  });
  assert.deepEqual(secondA, secondB);
  const interrupted = await commitRestSegment({
    repository,
    campaign: firstCommit.campaign,
    clock,
    suffix: "interrupt_second",
    segment: secondA,
    restProcessExpectedRevision: 0
  });
  assert.equal(interrupted.process.status, "INTERRUPTED");
  assert.equal(interrupted.process.interruption.interrupted, true);
  assert.equal(interrupted.process.acquiredBenefits.length, 0);
  assert.equal(interrupted.process.remainingBenefits.length, 1);
  const events = expectOk(await repository.listEvents(campaign.campaignId, null, 30));
  assert.equal(events.filter(event => event.eventType === "rest_interrupted").length, 1);
});

export async function runTacticalRestHandoffTests(): Promise<{ passed: number; failed: number }> {
  let failures = 0;
  for (const entry of tests) {
    try {
      await entry.run();
      console.log(`PASS ${entry.name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${entry.name}`);
      console.error(error);
    }
  }
  const passed = tests.length - failures;
  console.log(`${failures === 0 ? "PASS" : "FAIL"} ${passed}/${tests.length} tactical-rest-handoff tests.`);
  return { passed, failed: failures };
}

void runTacticalRestHandoffTests().then(result => {
  if (result.failed > 0) process.exitCode = 1;
});
