import assert from "node:assert/strict";
import {
  prepareSceneTransitionWorldRequestV1,
  type SceneReferentRegistryV1,
  type SceneTransitionRequestV1,
  type SceneTransitionTopologyV1
} from "../../src/application";

const topology: SceneTransitionTopologyV1 = {
  schemaVersion: 1,
  contractVersion: "scene-transition/1",
  topologyId: "topology:j6:local-exploration",
  topologyVersion: 3,
  connections: [
    connection("connection:archives-place", "scene:archives", "boundary:archives-place", "location:place", "scene:place"),
    connection("connection:place-archives", "scene:place", "boundary:place-archives", "location:archives", "scene:archives"),
    connection("connection:place-courtyard", "scene:place", "boundary:place-courtyard", "location:courtyard", "scene:courtyard"),
    connection("connection:courtyard-place", "scene:courtyard", "boundary:courtyard-place", "location:place", "scene:place")
  ]
};

const steps = [
  ["scene:archives", "boundary:archives-place", "location:place", "scene:place"],
  ["scene:place", "boundary:place-courtyard", "location:courtyard", "scene:courtyard"],
  ["scene:courtyard", "boundary:courtyard-place", "location:place", "scene:place"],
  ["scene:place", "boundary:place-archives", "location:archives", "scene:archives"]
] as const;

function connection(connectionId: string, sourceSceneId: string, boundaryRef: string, destinationRef: string, arrivalSceneId: string) {
  return {
    schemaVersion: 1 as const,
    connectionId,
    sourceSceneId,
    boundaryRef,
    destinationRef,
    scale: "LOCAL" as const,
    state: "OPEN" as const,
    sourceRefs: [`world-topology:${connectionId}`, `arrival-scene:${arrivalSceneId}`],
    version: 1
  };
}

function registry(sceneId: string, boundaryRef: string, destinationRef: string): SceneReferentRegistryV1 {
  return {
    schemaVersion: 1,
    contractVersion: "scene-referent-registry/1",
    sceneId,
    sceneVersion: 1,
    referents: [{
      schemaVersion: 1,
      canonicalRef: boundaryRef,
      kind: "object",
      displayName: "Passage visible",
      publicAliases: ["passage"],
      publicProperties: ["Le passage est visible depuis la scène."],
      publicDestinationAliases: [destinationRef],
      present: true,
      visible: true,
      interactionCapabilities: ["observe", "manipulate"],
      sourceRef: `scene:${sceneId}:${boundaryRef}`,
      version: 1
    }]
  };
}

function request(index: number, sourceSceneId: string, boundaryRef: string): SceneTransitionRequestV1 {
  return {
    schemaVersion: 1,
    contractVersion: "scene-transition/1",
    requestId: `request:j6:local:${index}`,
    operationId: `operation:j6:local:${index}`,
    campaignId: "campaign:j6:local",
    actorRef: "character:j6",
    sourceSceneId,
    sourceSceneVersion: 1,
    boundaryRef,
    expectedDestinationRef: null,
    intentId: `intent:j6:local:${index}`,
    idempotencyKey: `campaign:j6:local:transition:${index}`
  };
}

function runJourney() {
  let currentSceneId = "scene:archives";
  let elapsedGameSeconds = 0;
  const visited = [currentSceneId];
  const commands: string[] = [];
  for (const [index, [sourceSceneId, boundaryRef, destinationRef, arrivalSceneId]] of steps.entries()) {
    assert.equal(currentSceneId, sourceSceneId);
    const prepared = prepareSceneTransitionWorldRequestV1({
      request: request(index, sourceSceneId, boundaryRef),
      registry: registry(sourceSceneId, boundaryRef, destinationRef),
      topology,
      currentSceneVersion: 1
    });
    assert.equal(prepared.decision.disposition, "READY");
    assert.equal(prepared.command?.destinationRef, destinationRef);
    commands.push(prepared.command!.commandId);
    currentSceneId = arrivalSceneId;
    elapsedGameSeconds += 8;
    visited.push(currentSceneId);
  }
  return { currentSceneId, elapsedGameSeconds, visited, commands };
}

const controlled = prepareSceneTransitionWorldRequestV1({
  request: request(99, "scene:place", "boundary:place-courtyard"),
  registry: registry("scene:place", "boundary:place-courtyard", "location:courtyard"),
  topology,
  currentSceneVersion: 1,
  accessControls: [{
    schemaVersion: 1,
    contractVersion: "access-control/1",
    accessControlRef: "access:j6:courtyard",
    connectionId: "connection:place-courtyard",
    sourceSceneId: "scene:place",
    boundaryRef: "boundary:place-courtyard",
    destinationRef: "location:courtyard",
    state: "CONTROLLED",
    ownerDomain: "WorldDomain",
    thresholdDescription: "Un passage contrôlé mène à la cour.",
    requirements: [],
    approachDomains: ["social"],
    approachesAreNonExhaustive: true,
    sourceRefs: ["world-topology:connection:place-courtyard"],
    version: 1
  }]
});
assert.equal(controlled.decision.disposition, "HANDOFF");
assert.equal(controlled.command, null);

const first = runJourney();
const replay = runJourney();
assert.deepEqual(replay, first);
assert.deepEqual(first.visited, ["scene:archives", "scene:place", "scene:courtyard", "scene:place", "scene:archives"]);
assert.equal(first.currentSceneId, "scene:archives");
assert.equal(first.elapsedGameSeconds, 32);
assert.equal(new Set(first.commands).size, 4);

console.log("local-exploration/J6: 3 places, controlled access, 4 transitions, return and stable replay OK");
