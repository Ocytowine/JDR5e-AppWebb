import assert from "node:assert/strict";
import {
  buildSceneEphemeralCreationPolicyV1,
  describeAcceptedSceneEphemeralCreationV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  SCENE_EPHEMERAL_CREATION_CONTRACT_VERSION_V1,
  validateSceneEphemeralCreationProposalV1,
  type SceneEphemeralCreationProposalV1
} from "../../src/application";

function main(): void {
  const policy = buildSceneEphemeralCreationPolicyV1(REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1);

  assert.equal(policy.contractVersion, SCENE_EPHEMERAL_CREATION_CONTRACT_VERSION_V1);
  assert.equal(policy.sceneId, "reference-inn-rain-001");
  assert.deepEqual(policy.allowedKinds, ["ambient_sound", "sensory_detail", "background_extra", "minor_obstacle"]);
  assert.equal(policy.allowedGroundingRefs.includes("playable-scene:reference-inn-rain-001"), true);

  const ambient = validateSceneEphemeralCreationProposalV1(proposal({
    proposalId: "i06u-ambient-rain",
    kind: "ambient_sound",
    text: "Une bourrasque fait vibrer les volets pendant un bref silence dans la salle."
  }), policy);
  assert.equal(ambient.ok, true);
  if (ambient.ok) {
    assert.equal(ambient.decision, "ACCEPT_EPHEMERAL");
    assert.match(describeAcceptedSceneEphemeralCreationV1(ambient.proposal), /éphémère|fin du tour/u);
  }

  const extra = validateSceneEphemeralCreationProposalV1(proposal({
    proposalId: "i06u-background-extra",
    kind: "background_extra",
    text: "Un client anonyme baisse les yeux vers sa chope sans prendre part à l'échange."
  }), policy);
  assert.equal(extra.ok, true, "un figurant anonyme sans nom ni engagement durable reste autorisé");

  const usefulItem = validateSceneEphemeralCreationProposalV1(proposal({
    proposalId: "i06u-useful-item",
    kind: "sensory_detail",
    text: "Une clé utilisable dépasse soudain d'une poche près de la porte du fond."
  }), policy);
  assert.equal(usefulItem.ok, false);
  if (!usefulItem.ok) assert.equal(usefulItem.code, "EPHEMERAL_DURABLE_RISK");

  const secret = validateSceneEphemeralCreationProposalV1(proposal({
    proposalId: "i06u-secret",
    kind: "sensory_detail",
    text: "Un indice caché révèle le secret de la porte du fond."
  }), policy);
  assert.equal(secret.ok, false);
  if (!secret.ok) assert.equal(secret.code, "EPHEMERAL_SECRET_RISK");

  const durableNpc = validateSceneEphemeralCreationProposalV1(proposal({
    proposalId: "i06u-durable-npc",
    kind: "background_extra",
    text: "Un nouveau PNJ durable entre dans la salle et reviendra demain."
  }), policy);
  assert.equal(durableNpc.ok, false);
  if (!durableNpc.ok) assert.equal(durableNpc.code, "EPHEMERAL_DURABLE_RISK");

  const wrongGrounding = validateSceneEphemeralCreationProposalV1(proposal({
    proposalId: "i06u-grounding",
    kind: "minor_obstacle",
    text: "Une chaise renversée oblige à contourner légèrement le comptoir.",
    groundedIn: ["lore-fragment:secret-unavailable"]
  }), policy);
  assert.equal(wrongGrounding.ok, false);
  if (!wrongGrounding.ok) assert.equal(wrongGrounding.code, "EPHEMERAL_GROUNDING_INVALID");

  const promotion = validateSceneEphemeralCreationProposalV1(({
    ...proposal({
      proposalId: "i06u-promotion",
      kind: "sensory_detail",
      text: "La fumée de la cheminée pique les yeux."
    }),
    promotesToLore: true
  } as unknown) as SceneEphemeralCreationProposalV1, policy);
  assert.equal(promotion.ok, false);
  if (!promotion.ok) assert.equal(promotion.code, "EPHEMERAL_DURABLE_RISK");

  const customPolicyRisk = validateSceneEphemeralCreationProposalV1(proposal({
    proposalId: "i06u-custom-policy",
    kind: "sensory_detail",
    text: "Une marque interdite apparaît dans la buée."
  }), {
    ...policy,
    forbiddenPatterns: [...policy.forbiddenPatterns, "marque interdite"]
  });
  assert.equal(customPolicyRisk.ok, false);
  if (!customPolicyRisk.ok) assert.equal(customPolicyRisk.code, "EPHEMERAL_DURABLE_RISK");

  assert.equal(
    REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1.aiSceneWriterPolicy.mayCreate.length,
    0,
    "I-06U n'ouvre pas la création durable sur le contrat de scène lui-même"
  );

  console.log("scene-ephemeral-creation/1: OK");
}

function proposal(overrides: Partial<SceneEphemeralCreationProposalV1> = {}): SceneEphemeralCreationProposalV1 {
  return {
    schemaVersion: 1,
    contractVersion: SCENE_EPHEMERAL_CREATION_CONTRACT_VERSION_V1,
    proposalId: "i06u-proposal",
    kind: "sensory_detail",
    text: "La lumière tremble un instant sur les flaques près de l'entrée.",
    groundedIn: ["playable-scene:reference-inn-rain-001"],
    playerVisible: true,
    expiresAt: "TURN_END",
    persistence: "EPHEMERAL_ONLY",
    createsDurableFact: false,
    promotesToLore: false,
    version: 1,
    ...overrides
  };
}

main();
