import assert from "node:assert/strict";
import {
  NARRATIVE_CONTEXT_MANIFEST_CONTRACT_V1,
  NARRATIVE_CONTEXT_ROLE_REQUIREMENTS_V1,
  createNarrativeContextManifestV1,
  validateNarrativeContextManifestV1,
  validateNarrativeContextRoleRequirementsV1,
  type NarrativeContextManifestV1,
  type NarrativeContextProjectionDescriptorV1,
  type NarrativeContextRolePolicyV1
} from "../../src/application";

const PRIVATE_CANARY = "PRIVATE_CONTEXT_PAYLOAD_MUST_NOT_ENTER_MANIFEST";

const projections: NarrativeContextProjectionDescriptorV1[] = [
  projection("projection:raw-input", "PLAYER_RAW_INPUT", "player-input", ["player_intent_interpreter"], "PUBLIC", "INLINE_ELIGIBLE", "CAMPAIGN_REVISION", 48),
  projection("projection:scene", "SCENE_VISIBLE", "playable-scene", ["player_intent_interpreter", "npc_performer", "scene_writer"], "PUBLIC", "REFERENCE_ONLY", "SCENE_REVISION", 2_904),
  projection("projection:focus", "INTERACTION_FOCUS", "local-interaction-focus", ["player_intent_interpreter", "npc_performer"], "PUBLIC", "REFERENCE_ONLY", "SCENE_REVISION", 420, ["projection:scene"]),
  projection("projection:selectors", "INFORMATION_SELECTORS", "lore-information-catalog", ["player_intent_interpreter"], "PUBLIC", "REFERENCE_ONLY", "STATIC_VERSIONED", 7_726),
  projection("projection:capabilities", "RUNTIME_CAPABILITIES", "runtime-capability-registry", ["player_intent_interpreter"], "PUBLIC", "REFERENCE_ONLY", "STATIC_VERSIONED", 2_100),
  projection("projection:resolved-turn", "RESOLVED_TURN", "narrative-turn-controller", ["npc_performer", "scene_writer", "coherence_critic"], "PUBLIC", "REFERENCE_ONLY", "CAMPAIGN_REVISION", 1_200),
  projection("projection:npc-public", "NPC_PUBLIC_PROFILE", "scene-actor-registry", ["npc_performer"], "PUBLIC", "REFERENCE_ONLY", "SCENE_REVISION", 520, ["projection:scene"]),
  projection("projection:npc-private", "NPC_ROLE_PRIVATE_CONTEXT", "npc-conversation-profile", ["npc_performer"], "ROLE_PRIVATE", "REFERENCE_ONLY", "CAMPAIGN_REVISION", 640),
  projection("projection:disclosure", "NPC_DISCLOSURE", "npc-information-disclosure", ["npc_performer"], "ROLE_PRIVATE", "REFERENCE_ONLY", "CAMPAIGN_REVISION", 840, ["projection:resolved-turn"]),
  projection("projection:notebook", "PLAYER_PRIVATE_NOTEBOOK", "player-private-notebook", [], "FORBIDDEN_FOR_AI", "FORBIDDEN", "CAMPAIGN_REVISION", 0),
  projection("projection:gm-secrets", "GM_SECRETS", "plot-authority", [], "FORBIDDEN_FOR_AI", "FORBIDDEN", "CAMPAIGN_REVISION", 0)
];

const rolePolicies: NarrativeContextRolePolicyV1[] = [
  {
    profileId: "player-intent-v8",
    role: "player_intent_interpreter",
    purpose: "Comprendre la saisie sans conséquence.",
    requiredProjectionIds: ["projection:raw-input", "projection:scene", "projection:selectors", "projection:capabilities"],
    optionalProjectionIds: ["projection:focus"],
    forbiddenProjectionIds: ["projection:npc-private", "projection:disclosure", "projection:notebook", "projection:gm-secrets"]
  },
  {
    profileId: "npc-dialogue-performance",
    role: "npc_performer",
    purpose: "Répondre depuis l'acte résolu et les faits divulgables.",
    requiredProjectionIds: ["projection:resolved-turn", "projection:scene", "projection:npc-public", "projection:disclosure"],
    optionalProjectionIds: ["projection:focus", "projection:npc-private"],
    forbiddenProjectionIds: ["projection:raw-input", "projection:selectors", "projection:notebook", "projection:gm-secrets"]
  },
  {
    profileId: "resolved-scene-render",
    role: "scene_writer",
    purpose: "Rendre une conséquence déjà arbitrée.",
    requiredProjectionIds: ["projection:resolved-turn", "projection:scene"],
    optionalProjectionIds: [],
    forbiddenProjectionIds: ["projection:raw-input", "projection:npc-private", "projection:notebook", "projection:gm-secrets"]
  }
];

const manifest = createNarrativeContextManifestV1({
  manifestId: "manifest:j10k1",
  operationId: "operation:j10k1",
  campaignId: "campaign:j10k1",
  snapshot: {
    snapshotId: "snapshot:j10k1:17",
    campaignRevision: 17,
    sceneId: "wiki-location:archives_de_lysenthe",
    sceneVersion: 3
  },
  projections: [...projections].reverse(),
  rolePolicies: [...rolePolicies].reverse()
});

assert.equal(manifest.contractVersion, NARRATIVE_CONTEXT_MANIFEST_CONTRACT_V1);
assert.equal(validateNarrativeContextManifestV1(manifest).ok, true);
assert.equal(validateNarrativeContextRoleRequirementsV1(NARRATIVE_CONTEXT_ROLE_REQUIREMENTS_V1).ok, true);
assert.deepEqual(manifest.projections.map(entry => entry.projectionId), [...manifest.projections.map(entry => entry.projectionId)].sort());
assert.deepEqual(manifest.rolePolicies.map(entry => entry.profileId), [...manifest.rolePolicies.map(entry => entry.profileId)].sort());
assert.equal(manifest.authority, "READ_ONLY_CONTEXT_MANIFEST");
assert.equal(manifest.noCommit, true);
assert.equal(manifest.noGameTime, true);
assert.equal(JSON.stringify(manifest).includes(PRIVATE_CANARY), false);
assert.equal(Object.hasOwn(manifest.projections[0] ?? {}, "payload"), false, "le manifeste référence une projection sans recopier son contenu");

const interpreterProfile = NARRATIVE_CONTEXT_ROLE_REQUIREMENTS_V1.find(profile => profile.profileId === "player-intent-v8");
assert.ok(interpreterProfile?.requiredKinds.includes("PLAYER_RAW_INPUT"));
assert.ok(interpreterProfile?.requiredKinds.includes("INFORMATION_SELECTORS"));
assert.ok(interpreterProfile?.forbiddenKinds.includes("NPC_ROLE_PRIVATE_CONTEXT"));
assert.ok(interpreterProfile?.forbiddenKinds.includes("PLAYER_PRIVATE_NOTEBOOK"));
const performerProfile = NARRATIVE_CONTEXT_ROLE_REQUIREMENTS_V1.find(profile => profile.profileId === "npc-dialogue-performance");
assert.ok(performerProfile?.requiredKinds.includes("NPC_DISCLOSURE"));
assert.ok(performerProfile?.forbiddenKinds.includes("PLAYER_RAW_INPUT"));
const factCreationProfile = NARRATIVE_CONTEXT_ROLE_REQUIREMENTS_V1.find(profile => profile.profileId === "missing-public-fact-creation");
assert.equal(factCreationProfile?.role, "scene_creator");
assert.ok(factCreationProfile?.requiredKinds.includes("MISSING_FACT_TARGET"));
assert.ok(factCreationProfile?.forbiddenKinds.includes("SCENE_VISIBLE"));

assertInvalid(withMutation(manifest, draft => {
  draft.projections.push(structuredClone(draft.projections[0]!));
}), "projectionId must be unique");
assertInvalid(withMutation(manifest, draft => {
  const forbidden = draft.projections.find(entry => entry.projectionId === "projection:notebook")!;
  forbidden.allowedRoles = ["player_intent_interpreter"];
}), "forbidden projection cannot allow a role");
assertInvalid(withMutation(manifest, draft => {
  draft.projections[0]!.dependencyProjectionIds = ["projection:absent"];
}), "dependency projection:absent is unknown");
assertInvalid(withMutation(manifest, draft => {
  const scene = draft.projections.find(entry => entry.projectionId === "projection:scene")!;
  const focus = draft.projections.find(entry => entry.projectionId === "projection:focus")!;
  scene.dependencyProjectionIds = [focus.projectionId];
  focus.dependencyProjectionIds = [scene.projectionId];
}), "projection dependency cycle");
assertInvalid(withMutation(manifest, draft => {
  draft.snapshot.sceneVersion = null;
}), "snapshot sceneId and sceneVersion must be present together");
assertInvalid(withMutation(manifest, draft => {
  const policy = draft.rolePolicies.find(entry => entry.profileId === "player-intent-v8")!;
  policy.requiredProjectionIds.push("projection:notebook");
}), "forbidden for AI consumption");
assertInvalid(withMutation(manifest, draft => {
  const policy = draft.rolePolicies.find(entry => entry.profileId === "npc-dialogue-performance")!;
  policy.requiredProjectionIds.push("projection:raw-input");
}), "does not allow role npc_performer");
assertInvalid(createNarrativeContextManifestV1({
  manifestId: "manifest:j10k1:duplicate-policy-ref",
  operationId: "operation:j10k1:duplicate-policy-ref",
  campaignId: "campaign:j10k1",
  snapshot: manifest.snapshot,
  projections,
  rolePolicies: [{
    ...rolePolicies[0]!,
    requiredProjectionIds: ["projection:scene", "projection:scene"]
  }]
}), "requiredProjectionIds must not contain duplicates");
assertInvalid(withMutation(manifest, draft => {
  draft.noCommit = false as true;
}), "manifest must be noCommit");

const mutableInput = structuredClone(projections);
const isolated = createNarrativeContextManifestV1({
  manifestId: "manifest:j10k1:isolation",
  operationId: "operation:j10k1:isolation",
  campaignId: "campaign:j10k1",
  snapshot: manifest.snapshot,
  projections: mutableInput,
  rolePolicies
});
mutableInput[0]!.ownerId = PRIVATE_CANARY;
assert.equal(JSON.stringify(isolated).includes(PRIVATE_CANARY), false, "le manifeste clone ses descripteurs d'entrée");

console.log("narrative-context-manifest/J10-K1: OK (passive manifest, ownership, classification, role policies, snapshot and dependency guards)");

function projection(
  projectionId: string,
  kind: NarrativeContextProjectionDescriptorV1["kind"],
  ownerId: string,
  allowedRoles: NarrativeContextProjectionDescriptorV1["allowedRoles"],
  classification: NarrativeContextProjectionDescriptorV1["classification"],
  transport: NarrativeContextProjectionDescriptorV1["transport"],
  consistency: NarrativeContextProjectionDescriptorV1["consistency"],
  serializedCharacters: number,
  dependencyProjectionIds: string[] = []
): NarrativeContextProjectionDescriptorV1 {
  return {
    projectionId,
    kind,
    contractVersion: `${ownerId}/1`,
    ownerId,
    sourceRefs: [`source:${ownerId}`],
    classification,
    allowedRoles,
    consistency,
    sourceVersion: `${consistency.toLowerCase()}:1`,
    dependencyProjectionIds,
    transport,
    serializedCharacters
  };
}

function withMutation(
  value: NarrativeContextManifestV1,
  mutate: (draft: NarrativeContextManifestV1) => void
): NarrativeContextManifestV1 {
  const draft = structuredClone(value);
  mutate(draft);
  return draft;
}

function assertInvalid(value: unknown, expectedIssue: string): void {
  const validation = validateNarrativeContextManifestV1(value);
  assert.equal(validation.ok, false, `invalid fixture unexpectedly accepted: ${expectedIssue}`);
  assert.ok(validation.issues.some(issue => issue.includes(expectedIssue)), JSON.stringify(validation.issues));
}
