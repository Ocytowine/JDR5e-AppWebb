import assert from "node:assert/strict";
import type {
  AiOpenSemanticComponentV8,
  AiOpenSemanticFrameV8
} from "../../src/ai/types";
import {
  buildOpenSemanticExecutionPlanV1,
  executeOpenSemanticPlanV1,
  type OpenSemanticOwnerPortV1
} from "../../src/application/openSemanticExecution";
import type { InterpreterRuntimeContextV1 } from "../../src/application/runtimeCapabilityRouting";

const runtimeContext: InterpreterRuntimeContextV1 = {
  schemaVersion: 1,
  contractVersion: "interpreter-runtime-context/1",
  capabilities: [
    {
      capabilityId: "scene.visible-interaction",
      domain: "scene_resolution",
      availability: "AVAILABLE",
      playerFacingScope: "Interaction locale visible."
    },
    {
      capabilityId: "scene.visible-dialogue",
      domain: "social",
      availability: "AVAILABLE",
      playerFacingScope: "Parole adressée à un acteur visible."
    },
    {
      capabilityId: "inventory.mutation",
      domain: "inventory",
      availability: "AVAILABLE",
      playerFacingScope: "Mutation validée par le propriétaire de l'inventaire."
    },
    {
      capabilityId: "tactical.generic-handoff",
      domain: "tactical",
      availability: "HANDOFF_ONLY",
      playerFacingScope: "Handoff tactique générique."
    },
    {
      capabilityId: "campaign.autonomous-boundaries",
      domain: "world",
      availability: "EXTERNAL_TRIGGER_ONLY",
      playerFacingScope: "Frontière autonome de campagne."
    }
  ],
  activeTravel: null
};

function component(
  componentId: string,
  order: number,
  domain: string | null,
  capabilityId: string | null,
  overrides: Partial<AiOpenSemanticComponentV8> = {}
): AiOpenSemanticComponentV8 {
  return {
    componentId,
    order,
    meaning: `Sens ouvert inhabituel ${componentId}, sans vocabulaire attendu par le runtime.`,
    commitment: "committed",
    conditions: [],
    negated: false,
    quoted: false,
    relationToPrevious: order === 1 ? "NONE" : "THEN",
    alternativeGroupId: null,
    dependsOnComponentIds: order === 1 ? [] : [`step-${order - 1}`],
    simultaneousWithComponentIds: [],
    supersedesComponentIds: [],
    mentionedTargets: [],
    suggestedDomain: domain,
    suggestedAction: capabilityId === null ? null : `action ouverte pour ${componentId}`,
    suggestedCapabilityId: capabilityId,
    ...overrides
  };
}

function frame(components: AiOpenSemanticComponentV8[]): AiOpenSemanticFrameV8 {
  return {
    schemaVersion: 1,
    understandingStatus: "UNDERSTOOD",
    overallMeaning: "Trois étapes ordonnées appartenant à trois propriétaires.",
    overallCommitment: "committed",
    globalConditions: [],
    components,
    ambiguities: [],
    clarificationQuestion: null,
    confidence: "high"
  };
}

function owner(input: {
  ownerId: string;
  domain: OpenSemanticOwnerPortV1["domain"];
  capabilityId: string;
  calls: string[];
  rejectPreflight?: boolean;
}): OpenSemanticOwnerPortV1 {
  return {
    ownerId: input.ownerId,
    domain: input.domain,
    capabilityIds: [input.capabilityId],
    async preflight(request) {
      assert.equal("rawInput" in request, false, "Un propriétaire G5 ne doit jamais recevoir le texte joueur brut.");
      input.calls.push(`preflight:${request.step.componentId}`);
      return input.rejectPreflight
        ? { status: "REJECTED", playerFacingReason: "Le prérequis propriétaire manque." }
        : { status: "READY", ownerStateFingerprint: `state:${request.step.componentId}` };
    },
    async execute(request) {
      assert.equal("rawInput" in request, false);
      input.calls.push(`execute:${request.step.componentId}`);
      return {
        status: "COMMITTED",
        commitRef: `commit:${request.idempotencyKey}`,
        playerFacingText: `Étape ${request.step.componentId} accomplie.`
      };
    }
  };
}

async function main(): Promise<void> {
  const orderedFrame = frame([
    component("step-1", 1, "scene_resolution", "scene.visible-interaction"),
    component("step-2", 2, "social", "scene.visible-dialogue"),
    component("step-3", 3, "inventory", "inventory.mutation")
  ]);
  const plan = buildOpenSemanticExecutionPlanV1({ frame: orderedFrame, runtimeContext });
  assert.deepEqual(plan.steps.map(step => step.disposition), ["ROUTABLE", "ROUTABLE", "ROUTABLE"]);
  assert.equal(plan.rawInputAccess, "FORBIDDEN");
  assert.equal(plan.steps.some(step => "rawInput" in step), false);

  const calls: string[] = [];
  const owners = [
    owner({ ownerId: "scene-owner", domain: "scene_resolution", capabilityId: "scene.visible-interaction", calls }),
    owner({ ownerId: "social-owner", domain: "social", capabilityId: "scene.visible-dialogue", calls }),
    owner({ ownerId: "inventory-owner", domain: "inventory", capabilityId: "inventory.mutation", calls })
  ];
  const first = await executeOpenSemanticPlanV1({
    operationId: "operation:g5:ordered",
    frame: orderedFrame,
    plan,
    owners
  });
  assert.equal(first.stop, null);
  assert.deepEqual(first.receipts.map(receipt => receipt.componentId), ["step-1", "step-2", "step-3"]);
  assert.deepEqual(calls, [
    "preflight:step-1", "execute:step-1",
    "preflight:step-2", "execute:step-2",
    "preflight:step-3", "execute:step-3"
  ]);

  calls.length = 0;
  const replay = await executeOpenSemanticPlanV1({
    operationId: "operation:g5:ordered",
    frame: orderedFrame,
    plan,
    owners,
    previousReceipts: first.receipts
  });
  assert.equal(replay.stop, null);
  assert.equal(replay.receipts.length, 3);
  assert.deepEqual(calls, [], "Le rejeu ne doit ni revalider ni recommitter les étapes déjà reçues.");

  const rejectionCalls: string[] = [];
  const rejected = await executeOpenSemanticPlanV1({
    operationId: "operation:g5:reject",
    frame: orderedFrame,
    plan,
    owners: [
      owner({ ownerId: "scene-owner", domain: "scene_resolution", capabilityId: "scene.visible-interaction", calls: rejectionCalls }),
      owner({ ownerId: "social-owner", domain: "social", capabilityId: "scene.visible-dialogue", calls: rejectionCalls, rejectPreflight: true }),
      owner({ ownerId: "inventory-owner", domain: "inventory", capabilityId: "inventory.mutation", calls: rejectionCalls })
    ]
  });
  assert.equal(rejected.stop?.componentId, "step-2");
  assert.equal(rejected.stop?.reason, "OWNER_REJECTED");
  assert.deepEqual(rejected.receipts.map(receipt => receipt.componentId), ["step-1"]);
  assert.deepEqual(rejectionCalls, [
    "preflight:step-1", "execute:step-1", "preflight:step-2"
  ], "Une étape ultérieure ne doit même pas être prévalidée après l'arrêt.");

  const guarded = buildOpenSemanticExecutionPlanV1({
    runtimeContext,
    frame: frame([
      component("step-1", 1, "inventory", "description ouverte non enregistrée"),
      component("step-2", 2, "tactical", "tactical.generic-handoff", { dependsOnComponentIds: [] }),
      component("step-3", 3, "world", "campaign.autonomous-boundaries", { dependsOnComponentIds: [] }),
      component("step-4", 4, "social", "scene.visible-dialogue", { commitment: "conditional", conditions: ["si le garde accepte"], dependsOnComponentIds: [] }),
      component("step-5", 5, "social", "scene.visible-dialogue", { alternativeGroupId: "choice", relationToPrevious: "ALTERNATIVE", dependsOnComponentIds: [] }),
      component("step-6", 6, "social", "scene.visible-dialogue", { quoted: true, dependsOnComponentIds: [] }),
      component("step-7", 7, "social", "scene.visible-dialogue", { simultaneousWithComponentIds: ["step-8"], dependsOnComponentIds: [] }),
      component("step-8", 8, "inventory", "inventory.mutation", { simultaneousWithComponentIds: ["step-7"], dependsOnComponentIds: [] })
    ])
  });
  assert.deepEqual(guarded.steps.map(step => step.disposition), [
    "UNDERSTOOD_UNSUPPORTED",
    "HANDOFF_ONLY",
    "EXTERNAL_TRIGGER_REJECTED",
    "AWAITING_CONDITION",
    "AWAITING_PLAYER_CHOICE",
    "SKIPPED_NON_EXECUTABLE",
    "AWAITING_ATOMIC_GROUP_OWNER",
    "AWAITING_ATOMIC_GROUP_OWNER"
  ]);

  const misleadingFrame = frame([
    component("step-1", 1, "inventory", "scene.visible-dialogue")
  ]);
  const mismatch = buildOpenSemanticExecutionPlanV1({ frame: misleadingFrame, runtimeContext });
  assert.equal(mismatch.steps[0]?.disposition, "UNDERSTOOD_UNSUPPORTED", "Le domaine et la capacité doivent correspondre exactement; le texte de meaning n'est jamais relu.");

  const tamperCalls: string[] = [];
  const tampered = structuredClone(plan);
  tampered.steps[0]!.meaning = "Sens remplacé après interprétation";
  const refusedTamper = await executeOpenSemanticPlanV1({
    operationId: "operation:g5:tampered",
    frame: orderedFrame,
    plan: tampered,
    owners: [
      owner({ ownerId: "scene-owner", domain: "scene_resolution", capabilityId: "scene.visible-interaction", calls: tamperCalls })
    ]
  });
  assert.equal(refusedTamper.stop?.reason, "PLAN_INVALID");
  assert.deepEqual(tamperCalls, []);

  const forgedReplay = await executeOpenSemanticPlanV1({
    operationId: "operation:g5:forged-replay",
    frame: orderedFrame,
    plan,
    owners,
    previousReceipts: [first.receipts[2]!]
  });
  assert.equal(forgedReplay.stop?.reason, "PLAN_INVALID", "Un reçu tardif ne peut pas contourner les étapes précédentes.");
  assert.deepEqual(forgedReplay.receipts, []);

  console.log("Open semantic owner routing G5: ordered preflight, stop and replay invariants passed.");
}

void main();
