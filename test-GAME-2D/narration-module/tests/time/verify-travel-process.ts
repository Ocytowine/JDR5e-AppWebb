import { opaqueId, type CampaignId } from "../../src/core";
import {
  createTravelProcessStatePayloadV1,
  buildTravelProcessFromRouteCatalogV1,
  prepareTravelSegmentV1,
  validateProcessStatePayloadV1,
  validateTimeAdvanceProposalV1,
  type TravelPlanV1,
  type TravelProcessStateV1,
  type WorldTravelRouteCatalogV1
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
  const party = {
    schemaVersion: 1 as const,
    partyId: "party:j6",
    partyRevision: 3,
    leaderActorId: "character-001",
    memberActorIds: ["character-001", "npc-companion-fixture"],
    sourceRefs: ["party-registry:party:j6:3"]
  };
  const travelResources = [{ itemId: "item:ration", quantity: 10 }];
  const routeCatalog: WorldTravelRouteCatalogV1 = {
    schemaVersion: 1,
    catalogId: "world-routes-j6",
    catalogVersion: 1,
    anchors: ["archives_de_lysenthe", "porte_nord", "hameau_du_torrent_froid"].map(locationId => ({
      schemaVersion: 1, locationId, status: "AVAILABLE", sourceRefs: [`world-anchor:${locationId}`]
    })),
    routes: [{
      schemaVersion: 1, routeId: "route:archives-porte", fromLocationId: "archives_de_lysenthe", toLocationId: "porte_nord",
      direction: "BIDIRECTIONAL", status: "OPEN", distanceUnits: 2, estimatedSecondsByMode: { WALK: 1_800 }, dangerLevel: 10,
      environmentTags: ["ville", "route_surveillee"], sourceRefs: ["world-route:archives-porte"],
      resourceRates: [{ schemaVersion: 1, itemId: "item:ration", unitsPerPersonPerDay: 24, sourceRefs: ["rules:travel-rations"] }]
    }, {
      schemaVersion: 1, routeId: "route:porte-hameau", fromLocationId: "porte_nord", toLocationId: "hameau_du_torrent_froid",
      direction: "BIDIRECTIONAL", status: "OPEN", distanceUnits: 4, estimatedSecondsByMode: { WALK: 2_400 }, dangerLevel: 20,
      environmentTags: ["route_sauvage"], sourceRefs: ["world-route:porte-hameau"],
      resourceRates: [{ schemaVersion: 1, itemId: "item:ration", unitsPerPersonPerDay: 24, sourceRefs: ["rules:travel-rations"] }]
    }, {
      schemaVersion: 1, routeId: "route:archives-hameau-longue", fromLocationId: "archives_de_lysenthe", toLocationId: "hameau_du_torrent_froid",
      direction: "BIDIRECTIONAL", status: "OPEN", distanceUnits: 9, estimatedSecondsByMode: { WALK: 9_000 }, dangerLevel: 5,
      environmentTags: ["route_surveillee"], sourceRefs: ["world-route:archives-hameau-longue"]
    }]
  };
  const planned = buildTravelProcessFromRouteCatalogV1({
    campaignId, characterId: "character-001", originLocationId: "archives_de_lysenthe", destinationLocationId: "hameau_du_torrent_froid",
    mode: "WALK", createdAtGameSecond: 0, source: { kind: "PLAYER_INTENT", id: "intent:j6:travel", version: 1 }, catalog: routeCatalog, party
  });
  assert.equal(planned.ok, true);
  if (!planned.ok) throw new Error("J6 route catalog did not produce a travel process");
  assert.deepEqual(planned.value.plan.route.map(step => step.toLocationId), ["porte_nord", "hameau_du_torrent_froid"]);
  assert.equal(planned.value.plan.totalEstimatedSeconds, 4_200);
  const firstLeg = await prepareTravelSegmentV1({
    ...baseInput(), process: planned.value, currentGameSecond: 0, worldSimulatedThrough: 0,
    maxSegmentSeconds: 1_800, encounterCandidates: [], worldPressure: 0, partySnapshot: party, availableResources: travelResources
  });
  assert.equal(firstLeg.ok, true);
  if (!firstLeg.ok) throw new Error("J6 first travel leg failed");
  assert.equal(firstLeg.value.nextProcess.checkpoint.currentLocationId, "porte_nord");
  assert.equal(firstLeg.value.nextProcess.checkpoint.nextLocationId, "hameau_du_torrent_froid");
  const boundaryLeg = await prepareTravelSegmentV1({
    ...baseInput(), process: firstLeg.value.nextProcess, currentGameSecond: 1_800, worldSimulatedThrough: 0,
    maxSegmentSeconds: 2_400, encounterCandidates: [], worldPressure: 0, partySnapshot: party, availableResources: travelResources
  });
  assert.equal(boundaryLeg.ok, true);
  if (!boundaryLeg.ok) throw new Error("J6 boundary travel leg failed");
  assert.equal(boundaryLeg.value.stopReason, "WORLD_BOUNDARY");
  const arrivalLeg = await prepareTravelSegmentV1({
    ...baseInput(), process: boundaryLeg.value.nextProcess, currentGameSecond: 3_600, worldSimulatedThrough: 3_600,
    maxSegmentSeconds: 600, encounterCandidates: [], worldPressure: 0, partySnapshot: party, availableResources: travelResources
  });
  assert.equal(arrivalLeg.ok, true);
  if (!arrivalLeg.ok) throw new Error("J6 arrival travel leg failed");
  assert.equal(arrivalLeg.value.nextProcess.status, "ARRIVED");
  assert.equal(arrivalLeg.value.nextProcess.checkpoint.currentLocationId, "hameau_du_torrent_froid");
  const unsupportedBoat = buildTravelProcessFromRouteCatalogV1({
    campaignId, characterId: "character-001", originLocationId: "archives_de_lysenthe", destinationLocationId: "hameau_du_torrent_froid",
    mode: "BOAT", createdAtGameSecond: 0, source: { kind: "PLAYER_INTENT", id: "intent:j6:boat", version: 1 }, catalog: routeCatalog, party
  });
  assert.equal(unsupportedBoat.ok, false);
  const staleParty = await prepareTravelSegmentV1({
    ...baseInput(), process: planned.value, partySnapshot: { ...party, partyRevision: 4 }, availableResources: travelResources
  });
  assert.equal(staleParty.ok, false);
  const missingSupplies = await prepareTravelSegmentV1({
    ...baseInput(), process: planned.value, partySnapshot: party, availableResources: []
  });
  assert.equal(missingSupplies.ok, false);
  console.log("PASS [travel-process] J6 builds only world-backed routes and keeps the right anchor across multiple legs");

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
