import assert from "node:assert/strict";
import {
  buildDestinationMentionV1,
  decideDestinationPlausibilityV1,
  type DestinationMentionV1,
  type DestinationResolutionContextV1
} from "../../src/application/destinationPlausibility";
import { arbitrateDestinationPlausibilityV1 } from "../../src/application/destinationPlausibilityArbitration";
import { FakeContractAiProviderV1 } from "../../src/ai/FakeContractAiProvider";

const baseMention: DestinationMentionV1 = {
  schemaVersion: 1,
  mentionKind: "DESCRIPTIVE_REQUEST",
  rawMention: "une rue calme non loin",
  requestedDisplayName: null,
  destinationDescription: "une rue calme non loin",
  proposedPlaceRef: null,
  visibleBoundaryRef: null,
  declaredScale: "LOCAL"
};

const baseContext: DestinationResolutionContextV1 = {
  schemaVersion: 1,
  contractVersion: "destination-plausibility/1",
  sourceSceneId: "scene:archives",
  sourceLocationRef: "location:archives_de_lysenthe",
  currentParentLocationRef: "location:quartier_des_archives",
  geographicChain: ["archives_de_lysenthe", "quartier_des_archives", "lysenthe"],
  mention: baseMention,
  knownPlaces: [{
    schemaVersion: 1,
    placeRef: "location:caserne_centrale",
    displayName: "Caserne centrale",
    aliases: ["caserne principale"],
    parentLocationRef: "location:quartier_militaire",
    arrivalSceneId: "scene:caserne_centrale",
    sourceRefs: ["wiki:lysenthe:caserne_centrale"]
  }],
  topology: {
    schemaVersion: 1,
    contractVersion: "scene-transition/1",
    topologyId: "topology:test",
    topologyVersion: 1,
    connections: []
  },
  matchedLoreConstraints: []
};

const descriptive = decideDestinationPlausibilityV1(baseContext);
assert.equal(descriptive.outcome, "ARBITRATION_REQUIRED");
assert.equal(descriptive.code, "EXPLICIT_LOCAL_DESCRIPTION_REQUIRES_ARBITRATION");
assert.equal(descriptive.allowedParentLocationRef, "location:quartier_des_archives");
assert.equal(descriptive.commitAuthority, false);

const visibleExit = decideDestinationPlausibilityV1({
  ...baseContext,
  mention: {
    ...baseMention,
    mentionKind: "VISIBLE_DECLARED_EXIT",
    rawMention: "Place des Archives",
    requestedDisplayName: "Place des Archives",
    destinationDescription: null,
    visibleBoundaryRef: "poi:place_des_archives"
  }
});
assert.equal(visibleExit.outcome, "CREATE_LOCAL");
assert.equal(visibleExit.code, "VISIBLE_EXIT_CAN_BE_MATERIALIZED");

const knownRemote = decideDestinationPlausibilityV1({
  ...baseContext,
  mention: {
    ...baseMention,
    mentionKind: "PROPER_NAME",
    rawMention: "la caserne principale",
    requestedDisplayName: "la caserne principale",
    destinationDescription: null
  }
});
assert.equal(knownRemote.outcome, "TRAVEL_REQUIRED");
assert.equal(knownRemote.destinationRef, "location:caserne_centrale");

const knownLocalWithoutVisibleRoute = decideDestinationPlausibilityV1({
  ...baseContext,
  knownPlaces: [{
    ...baseContext.knownPlaces[0]!,
    parentLocationRef: "location:quartier_des_archives"
  }],
  mention: {
    ...baseMention,
    mentionKind: "KNOWN_PLACE",
    rawMention: "Caserne centrale",
    requestedDisplayName: "Caserne centrale",
    destinationDescription: null
  }
});
assert.equal(knownLocalWithoutVisibleRoute.outcome, "CLARIFY");
assert.equal(knownLocalWithoutVisibleRoute.code, "KNOWN_DESTINATION_ROUTE_REQUIRED");

const knownLocalVisible = decideDestinationPlausibilityV1({
  ...baseContext,
  knownPlaces: [{ ...baseContext.knownPlaces[0]!, parentLocationRef: "location:quartier_des_archives" }],
  topology: {
    ...baseContext.topology,
    connections: [{
      schemaVersion: 1, connectionId: "connection:caserne", sourceSceneId: baseContext.sourceSceneId,
      boundaryRef: "poi:porte_caserne", destinationRef: "location:caserne_centrale", scale: "LOCAL", state: "OPEN",
      sourceRefs: ["wiki:route_caserne"], version: 1
    }]
  },
  mention: {
    ...baseMention,
    mentionKind: "VISIBLE_DECLARED_EXIT",
    rawMention: "Caserne centrale",
    requestedDisplayName: "Caserne centrale",
    destinationDescription: null,
    visibleBoundaryRef: "poi:porte_caserne"
  }
});
assert.equal(knownLocalVisible.outcome, "USE_KNOWN_DESTINATION");

const explicitTravel = decideDestinationPlausibilityV1({
  ...baseContext,
  mention: {
    ...baseMention,
    rawMention: "je pars pour Astryade",
    destinationDescription: "Astryade",
    declaredScale: "TRAVEL"
  }
});
assert.equal(explicitTravel.outcome, "TRAVEL_REQUIRED");
assert.equal(explicitTravel.destinationRef, null);

const contradiction = decideDestinationPlausibilityV1({
  ...baseContext,
  matchedLoreConstraints: [{
    schemaVersion: 1,
    constraintId: "constraint:no-imperial-palace",
    effect: "FORBID",
    reason: "Aucun palais impérial ne se trouve dans le quartier des Archives.",
    condition: null,
    ownerDomain: null,
    sourceRefs: ["wiki:lysenthe:quartier_des_archives#institutions"]
  }]
});
assert.equal(contradiction.outcome, "REJECT_CONTRADICTION");
assert.deepEqual(contradiction.sourceRefs, ["wiki:lysenthe:quartier_des_archives#institutions"]);

const conditional = decideDestinationPlausibilityV1({
  ...baseContext,
  matchedLoreConstraints: [{
    schemaVersion: 1,
    constraintId: "constraint:secret-exit",
    effect: "REQUIRE_CONDITION",
    reason: "La sortie secrète ne peut être empruntée sans l'avoir découverte.",
    condition: "Découvrir le mécanisme caché.",
    ownerDomain: "WorldDomain",
    sourceRefs: ["wiki:archives_de_lysenthe#passage-secret"]
  }]
});
assert.notEqual(conditional.outcome, "CONDITION_REQUIRED");
assert.equal(conditional.accessHint?.state, "CONTROLLED");
assert.deepEqual(conditional.accessHint?.requirements, ["Découvrir le mécanisme caché."]);
assert.deepEqual(conditional.accessHint?.sourceRefs, ["wiki:archives_de_lysenthe#passage-secret"]);

const ambiguous = decideDestinationPlausibilityV1({
  ...baseContext,
  knownPlaces: [
    { ...baseContext.knownPlaces[0]!, placeRef: "location:caserne_est", parentLocationRef: "location:quartier_des_archives" },
    { ...baseContext.knownPlaces[0]!, placeRef: "location:caserne_ouest", parentLocationRef: "location:quartier_des_archives" }
  ],
  mention: {
    ...baseMention,
    mentionKind: "PROPER_NAME",
    rawMention: "Caserne centrale",
    requestedDisplayName: "Caserne centrale",
    destinationDescription: null
  }
});
assert.equal(ambiguous.outcome, "CLARIFY");
assert.equal(ambiguous.code, "DESTINATION_MENTION_AMBIGUOUS");
assert.deepEqual(ambiguous.candidatePlaceRefs, ["location:caserne_est", "location:caserne_ouest"]);

const unknownScope = decideDestinationPlausibilityV1({
  ...baseContext,
  mention: { ...baseMention, declaredScale: "UNKNOWN" }
});
assert.equal(unknownScope.outcome, "CLARIFY");
assert.equal(unknownScope.code, "DESTINATION_SCOPE_UNCLEAR");

const unknownNamed = decideDestinationPlausibilityV1({
  ...baseContext,
  mention: {
    ...baseMention,
    mentionKind: "PROPER_NAME",
    rawMention: "le palais impérial derrière cette porte",
    requestedDisplayName: "palais impérial",
    destinationDescription: null,
    declaredScale: "UNKNOWN"
  }
});
assert.equal(unknownNamed.outcome, "ARBITRATION_REQUIRED");

const invalid = decideDestinationPlausibilityV1({
  ...baseContext,
  sourceLocationRef: "not-canonical"
});
assert.equal(invalid.outcome, "CLARIFY");
assert.equal(invalid.code, "INVALID_CONTEXT");

const namedMention = buildDestinationMentionV1({
  rawMention: "Place des Archives",
  proposedPlaceRef: null,
  visibleBoundaryRef: "poi:place_des_archives",
  visibleDestinationName: "Place des Archives"
});
assert.equal(namedMention.requestedDisplayName, "Place des Archives");
assert.equal(namedMention.destinationDescription, null);
const freeDescription = buildDestinationMentionV1({
  rawMention: "une rue calme non loin",
  proposedPlaceRef: null,
  visibleBoundaryRef: null,
  visibleDestinationName: null
});
assert.equal(freeDescription.requestedDisplayName, null);
assert.equal(freeDescription.destinationDescription, "une rue calme non loin");
assert.equal(freeDescription.declaredScale, "LOCAL");

async function verifyAiArbitration(): Promise<void> {
const arbitrationAttemptId = "operation-arbitration:ai:destination-arbiter:attempt:1";
const provider = new FakeContractAiProviderV1([[
  arbitrationAttemptId,
  {
    schemaVersion: 1,
    contractVersion: "destination-plausibility-arbitration/1",
    outputId: "output:destination-arbitration",
    callId: "operation-arbitration:ai:destination-arbiter:call",
    attemptId: arbitrationAttemptId,
    packId: "operation-arbitration:pack:destination-arbiter",
    snapshotId: "operation-arbitration:snapshot:destination-arbiter",
    role: "destination_arbiter",
    status: "OK",
    payload: {
      outcome: "CREATE_LOCAL",
      allowedParentLocationRef: "location:quartier_des_archives",
      reason: "Une rue secondaire calme est compatible avec ce quartier.",
      accessHint: null,
      sourceRefs: ["wiki:quartier_des_archives"]
    },
    diagnostics: [],
    supersedesOutputId: null
  }
]]);
const arbitration = await arbitrateDestinationPlausibilityV1({
  campaignId: "campaign-1",
  operationId: "operation-arbitration",
  mention: freeDescription,
  sourceSceneId: "scene:archives",
  sourceLocationRef: "location:archives_de_lysenthe",
  allowedParentLocationRefs: ["location:quartier_des_archives"],
  knownPlaces: [],
  brief: {
    contractVersion: "lore-guided-scene-creation-brief/1",
    sourceRefs: ["wiki:quartier_des_archives"],
    strictConstraints: [], localGuidance: [], regionalGuidance: [], unresolvedDimensions: [],
    creationType: "PLACE", anchorEntityId: "archives_de_lysenthe", geographicChain: ["archives_de_lysenthe", "quartier_des_archives"]
  } as never,
  config: {
    provider,
    route: {
      schemaVersion: 1, routeId: "test-destination-arbiter", role: "destination_arbiter", providerKind: "FAKE_CONTRACT",
      providerId: "fake", modelId: "fake", modelConfigVersion: "1", certified: true,
      allowedContractVersions: ["destination-plausibility-arbitration/1"], inputTokenLimit: 2_000, outputTokenLimit: 800,
      timeoutMs: 1_000, fallbackRouteIds: []
    },
    retryPolicy: { schemaVersion: 1, role: "destination_arbiter", maxTechnicalRetries: 0, maxTargetedCorrections: 0, maxFullRegenerations: 0, allowFallback: false }
  }
});
assert.equal(arbitration.ok, true);
if (arbitration.ok) assert.equal(arbitration.decision.outcome, "CREATE_LOCAL");
}

verifyAiArbitration().then(() => {
  console.log("Destination plausibility: deterministic matrix, mention identity and sourced AI arbitration verified.");
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
