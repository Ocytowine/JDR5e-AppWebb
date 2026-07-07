import { opaqueId, type CampaignId } from "../../src/core";
import {
  createTravelProcessStatePayloadV1,
  prepareTravelSegmentV1,
  validateProcessStatePayloadV1,
  validateTimeAdvanceProposalV1,
  type TravelPlanV1,
  type TravelProcessStateV1
} from "../../src/time";
import { assert } from "../contracts/assertions";

const campaignId = opaqueId<CampaignId>("campaign-travel-001");

function plan(overrides: Partial<TravelPlanV1> = {}): TravelPlanV1 {
  return {
    schemaVersion: 1,
    planId: "travel-plan-001",
    campaignId,
    characterId: "character-001",
    originLocationId: "archives_de_lysenthe",
    destinationLocationId: "porte_nord",
    mode: "WALK",
    route: [{
      stepId: "step-archives-porte",
      fromLocationId: "archives_de_lysenthe",
      toLocationId: "porte_nord",
      distanceUnits: 4,
      estimatedSeconds: 7_200,
      dangerLevel: 80,
      environmentTags: ["route_sauvage", "ruines"]
    }],
    totalEstimatedSeconds: 7_200,
    createdAtGameSecond: 0,
    source: { kind: "PLAYER_INTENT", id: "intent-travel-001", version: 1 },
    ...overrides
  };
}

function travelProcess(overrides: Partial<TravelProcessStateV1> = {}): TravelProcessStateV1 {
  const basePlan = plan();
  return {
    schemaVersion: 1,
    processId: "travel-process-001",
    campaignId,
    status: "PLANNED",
    plan: basePlan,
    checkpoint: {
      schemaVersion: 1,
      checkpointId: "travel.checkpoint.initial",
      processId: "travel-process-001",
      checkpointRevision: 0,
      status: "PLANNED",
      currentLocationId: "archives_de_lysenthe",
      nextLocationId: "porte_nord",
      elapsedTravelSeconds: 0,
      remainingTravelSeconds: 7_200,
      completedStepIds: [],
      activeSegment: null,
      lastEncounterDecision: null
    },
    ...overrides
  };
}

function baseInput(overrides: Partial<Parameters<typeof prepareTravelSegmentV1>[0]> = {}): Parameters<typeof prepareTravelSegmentV1>[0] {
  return {
    process: travelProcess(),
    currentGameSecond: 0,
    worldSimulatedThrough: 0,
    secondsPerWorldBoundary: 3_600,
    maxSegmentSeconds: 7_200,
    contentPackageId: "jdr5e.base-content",
    contentPackageVersion: 1,
    rulesetId: "jdr5e.rules",
    rulesetVersion: 1,
    encounterCandidates: [{
      schemaVersion: 1,
      candidateId: "signal-goblin-family-cart",
      category: "STRANGE",
      ref: { kind: "WORLD_SIGNAL", id: "world-signal-goblin-family-cart" },
      weight: 10,
      locationId: "archives_de_lysenthe",
      environmentTags: ["ruines"]
    }],
    worldPressure: 40,
    ...overrides
  };
}

async function run(): Promise<void> {
  const meta = await prepareTravelSegmentV1(baseInput({ forceNoGameTime: true }));
  assert.equal(meta.ok, true);
  if (meta.ok) {
    assert.equal(meta.value.stopReason, "NO_GAME_TIME");
    assert.equal(meta.value.timeProposal.category, "NO_GAME_TIME");
    assert.equal(meta.value.timeProposal.duration.recommendedSeconds, 0);
    assert.deepEqual(meta.value.nextProcess, baseInput().process);
    assert.equal(validateTimeAdvanceProposalV1(meta.value.timeProposal, 0).ok, true);
  }
  console.log("PASS [travel-process] NAR-ACC-007 meta clarification consumes no game time");

  const first = await prepareTravelSegmentV1(baseInput());
  const replay = await prepareTravelSegmentV1(baseInput());
  assert.equal(first.ok, true);
  assert.deepEqual(first, replay);
  if (first.ok) {
    assert.equal(first.value.stopReason, "WORLD_BOUNDARY");
    assert.equal(first.value.timeProposal.category, "PROCESS_SEGMENT");
    assert.equal(first.value.timeProposal.duration.recommendedSeconds, 3_600);
    assert.equal(first.value.nextProcess.checkpoint.elapsedTravelSeconds, 3_600);
    assert.ok(first.value.encounterDecision.seedFingerprint.startsWith("sha256:"));
    assert.equal(validateTimeAdvanceProposalV1(first.value.timeProposal, 0).ok, true);
  }
  console.log("PASS [travel-process] segment stops at world boundary with stable replay");

  const encounter = await prepareTravelSegmentV1(baseInput({
    worldSimulatedThrough: 3_600,
    maxSegmentSeconds: 1_800,
    worldPressure: 100
  }));
  assert.equal(encounter.ok, true);
  if (encounter.ok) {
    assert.equal(encounter.value.stopReason, "ENCOUNTER");
    assert.equal(encounter.value.encounterDecision.triggered, true);
    assert.deepEqual(encounter.value.encounterDecision.candidateRef, {
      kind: "WORLD_SIGNAL",
      id: "world-signal-goblin-family-cart"
    });
    assert.equal(encounter.value.nextProcess.status, "INTERRUPTED");
    assert.equal(encounter.value.pendingDecision?.kind, "TRAVEL_ENCOUNTER_DECISION");
    assert.equal(encounter.value.pendingDecision?.canObserve, true);
    assert.equal(encounter.value.pendingDecision?.canAvoid, true);
    assert.equal(encounter.value.pendingDecision?.canApproach, true);
    const payload = await createTravelProcessStatePayloadV1({
      process: encounter.value.nextProcess,
      pendingDecision: encounter.value.pendingDecision,
      lastAppliedEventId: "event-travel-segment-001",
      expectedCampaignRevision: 4
    });
    assert.equal(payload.ok, true);
    if (payload.ok) {
      assert.equal(payload.value.processType, "travel.process");
      assert.equal(payload.value.status, "SUSPENDED");
      assert.equal(payload.value.pendingDecision?.kind, "TRAVEL_ENCOUNTER_DECISION");
      assert.equal((await validateProcessStatePayloadV1(payload.value)).ok, true);
    }
  }
  console.log("PASS [travel-process] NAR-ACC-010 encounter is deterministic, checkpointed and leaves player approach open");

  const interrupted = await prepareTravelSegmentV1(baseInput({
    worldSimulatedThrough: 3_600,
    interruption: { interruptAtGameSecond: 600, reason: "scheduled-effect-before-arrival" }
  }));
  assert.equal(interrupted.ok, true);
  if (interrupted.ok) {
    assert.equal(interrupted.value.stopReason, "INTERRUPTION");
    assert.equal(interrupted.value.timeProposal.duration.recommendedSeconds, 600);
    assert.equal(interrupted.value.nextProcess.status, "INTERRUPTED");
  }
  console.log("PASS [travel-process] NAR-ACC-020 earlier interruption stops before later travel completion");
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
