import assert from "node:assert/strict";
import type {
  AiOpenSemanticComponentV8,
  AiOpenSemanticFrameV8
} from "../../src/ai/types";
import {
  buildOpenSemanticExecutionPlanV1,
  executeOpenSemanticPlanV1,
  selectOpenSemanticLegacyOwnerStepsV1,
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
      capabilityId: "scene.visible-actor-orientation",
      domain: "scene_resolution",
      availability: "AVAILABLE",
      playerFacingScope: "Orienter son attention vers un acteur visible."
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
  assert.equal(mismatch.steps[0]?.disposition, "ROUTABLE", "Une capacité publique exacte doit retrouver son propriétaire dans le registre, sans dépendre d'un domaine IA redondant.");
  assert.equal(mismatch.steps[0]?.suggestedDomain, "inventory");
  assert.equal(mismatch.steps[0]?.requiredDomain, "social");

  const archiveActor = "npc:wiki-location:archives_de_lysenthe:ambient:1";
  const orientationFrame = frame([
    component("step-1", 1, "scene_resolution", "scene.visible-actor-orientation", {
      mentionedTargets: [{ surface: "l'archiviste", proposedRef: archiveActor }]
    }),
    component("step-2", 2, "social", "scene.visible-dialogue", {
      mentionedTargets: [{ surface: "lui", proposedRef: archiveActor }],
      dialogueAct: { act: "ASK_QUESTION", contentGoal: "Comprendre le classement des actes." }
    })
  ]);
  const orientationPlan = buildOpenSemanticExecutionPlanV1({ frame: orientationFrame, runtimeContext });
  const orientationSelection = selectOpenSemanticLegacyOwnerStepsV1({
    frame: orientationFrame,
    plan: orientationPlan
  });
  assert.equal(orientationSelection?.mode, "LOCAL_SCENE_SEQUENCE");
  assert.deepEqual(
    orientationSelection?.steps.map(step => step.capabilityId),
    ["scene.visible-actor-orientation", "scene.visible-dialogue"]
  );

  const guardActor = "npc:wiki-location:archives_de_lysenthe:ambient:3";
  const dialogueSequenceFrame = frame([
    component("ask-chief", 1, "social", "scene.visible-dialogue", {
      mentionedTargets: [
        { surface: "votre chef", proposedRef: null },
        { surface: "au garde", proposedRef: guardActor }
      ],
      dialogueAct: {
        act: "ASK_QUESTION",
        contentGoal: "Savoir si le chef du garde est présent."
      }
    }),
    component("state-information", 2, "social", "scene.visible-dialogue", {
      dependsOnComponentIds: [],
      mentionedTargets: [{ surface: "lui", proposedRef: null }],
      dialogueAct: {
        act: "MAKE_STATEMENT",
        contentGoal: "Indiquer qu'une information doit être communiquée au chef."
      }
    })
  ]);
  const dialogueSequencePlan = buildOpenSemanticExecutionPlanV1({
    frame: dialogueSequenceFrame,
    runtimeContext
  });
  const dialogueSequenceSelection = selectOpenSemanticLegacyOwnerStepsV1({
    frame: dialogueSequenceFrame,
    plan: dialogueSequencePlan
  });
  assert.equal(dialogueSequenceSelection?.mode, "HOMOGENEOUS_DIALOGUE_SEQUENCE");
  assert.equal(dialogueSequenceSelection?.ownerDomain, "social");
  assert.equal(dialogueSequenceSelection?.executionPolicy, "ORDERED");
  assert.deepEqual(dialogueSequenceSelection?.targetRefs, [guardActor]);
  assert.deepEqual(
    dialogueSequenceSelection?.steps.map(step => step.componentId),
    ["ask-chief", "state-information"]
  );

  const simultaneousDialogueFrame = frame([
    component("ask-chief-now", 1, "social", "scene.visible-dialogue", {
      mentionedTargets: [{ surface: "au garde", proposedRef: guardActor }],
      dialogueAct: { act: "ASK_QUESTION", contentGoal: "Savoir si le chef est présent." }
    }),
    component("state-reason-now", 2, "social", "scene.visible-dialogue", {
      relationToPrevious: "SIMULTANEOUS",
      dependsOnComponentIds: [],
      simultaneousWithComponentIds: ["ask-chief-now"],
      mentionedTargets: [{ surface: "lui", proposedRef: guardActor }],
      dialogueAct: { act: "MAKE_STATEMENT", contentGoal: "Expliquer la raison de la demande." }
    })
  ]);
  const simultaneousDialoguePlan = buildOpenSemanticExecutionPlanV1({
    frame: simultaneousDialogueFrame,
    runtimeContext
  });
  assert.deepEqual(
    simultaneousDialoguePlan.steps.map(step => step.disposition),
    ["AWAITING_ATOMIC_GROUP_OWNER", "AWAITING_ATOMIC_GROUP_OWNER"]
  );
  const simultaneousDialogueSelection = selectOpenSemanticLegacyOwnerStepsV1({
    frame: simultaneousDialogueFrame,
    plan: simultaneousDialoguePlan
  });
  assert.equal(simultaneousDialogueSelection?.mode, "HOMOGENEOUS_DIALOGUE_SEQUENCE");
  assert.equal(simultaneousDialogueSelection?.executionPolicy, "ATOMIC");
  assert.deepEqual(simultaneousDialogueSelection?.targetRefs, [guardActor]);

  const causalDialogueFrame = frame([
    component("ask-chief-causal", 1, "social", "scene.visible-dialogue", {
      mentionedTargets: [{ surface: "au garde", proposedRef: guardActor }],
      dialogueAct: { act: "ASK_QUESTION", contentGoal: "Savoir si le chef est présent." }
    }),
    component("state-reason-causal", 2, "social", "scene.visible-dialogue", {
      relationToPrevious: "CONDITION_RESULT",
      dependsOnComponentIds: [],
      mentionedTargets: [{ surface: "lui", proposedRef: guardActor }],
      dialogueAct: { act: "MAKE_STATEMENT", contentGoal: "Donner la raison de la question." }
    })
  ]);
  const causalDialogueSelection = selectOpenSemanticLegacyOwnerStepsV1({
    frame: causalDialogueFrame,
    plan: buildOpenSemanticExecutionPlanV1({ frame: causalDialogueFrame, runtimeContext })
  });
  assert.equal(causalDialogueSelection?.mode, "HOMOGENEOUS_DIALOGUE_SEQUENCE");
  assert.equal(causalDialogueSelection?.executionPolicy, "ORDERED");
  assert.deepEqual(causalDialogueSelection?.targetRefs, [guardActor]);

  const rhetoricalConditionFrame = frame([
    component("state-origin", 1, "social", "scene.visible-dialogue", {
      mentionedTargets: [{ surface: "au garde", proposedRef: guardActor }],
      dialogueAct: { act: "MAKE_STATEMENT", contentGoal: "Dire ne pas être d'ici." }
    }),
    component("ask-alternative-source", 2, "social", "scene.visible-dialogue", {
      conditions: ["Si le garde ne sait pas ou ne souhaite pas répondre."],
      dependsOnComponentIds: [],
      mentionedTargets: [{ surface: "vous", proposedRef: guardActor }],
      dialogueAct: {
        act: "ASK_QUESTION",
        contentGoal: "Demander qui pourrait répondre si le garde ne sait pas ou ne souhaite pas parler."
      }
    })
  ]);
  const rhetoricalConditionPlan = buildOpenSemanticExecutionPlanV1({
    frame: rhetoricalConditionFrame,
    runtimeContext
  });
  assert.deepEqual(
    rhetoricalConditionPlan.steps.map(step => step.disposition),
    ["ROUTABLE", "ROUTABLE"],
    "une condition incluse dans une parole engagée appartient au contenu adressé"
  );
  const rhetoricalConditionSelection = selectOpenSemanticLegacyOwnerStepsV1({
    frame: rhetoricalConditionFrame,
    plan: rhetoricalConditionPlan
  });
  assert.equal(rhetoricalConditionSelection?.mode, "HOMOGENEOUS_DIALOGUE_SEQUENCE");

  const trulyConditionalDialogueFrame = frame([
    component("speak-only-later", 1, "social", "scene.visible-dialogue", {
      commitment: "conditional",
      conditions: ["Quand le garde aura baissé son arme."],
      mentionedTargets: [{ surface: "au garde", proposedRef: guardActor }],
      dialogueAct: { act: "MAKE_STATEMENT", contentGoal: "Révéler le code plus tard." }
    })
  ]);
  const trulyConditionalDialoguePlan = buildOpenSemanticExecutionPlanV1({
    frame: trulyConditionalDialogueFrame,
    runtimeContext
  });
  assert.equal(trulyConditionalDialoguePlan.steps[0]?.disposition, "AWAITING_CONDITION");
  assert.equal(
    selectOpenSemanticLegacyOwnerStepsV1({
      frame: trulyConditionalDialogueFrame,
      plan: trulyConditionalDialoguePlan
    }),
    null
  );

  const ambiguousDialogueFrame = frame([
    component("ask-guard", 1, "social", "scene.visible-dialogue", {
      mentionedTargets: [{ surface: "au garde", proposedRef: guardActor }],
      dialogueAct: { act: "ASK_QUESTION", contentGoal: "Interroger le garde." }
    }),
    component("ask-clerk", 2, "social", "scene.visible-dialogue", {
      mentionedTargets: [{ surface: "au clerc", proposedRef: "npc:archive-clerk" }],
      dialogueAct: { act: "ASK_QUESTION", contentGoal: "Interroger le clerc." }
    })
  ]);
  assert.equal(
    selectOpenSemanticLegacyOwnerStepsV1({
      frame: ambiguousDialogueFrame,
      plan: buildOpenSemanticExecutionPlanV1({ frame: ambiguousDialogueFrame, runtimeContext })
    }),
    null,
    "deux interlocuteurs explicites ne doivent jamais être aplatis dans un même groupe social"
  );

  const unknownStagingFrame = frame([
    component("step-1", 1, "scene_resolution", null, {
      mentionedTargets: [{ surface: "l'archiviste", proposedRef: archiveActor }]
    }),
    component("step-2", 2, "social", "scene.visible-dialogue", {
      mentionedTargets: [{ surface: "lui", proposedRef: archiveActor }]
    })
  ]);
  const unknownStagingPlan = buildOpenSemanticExecutionPlanV1({ frame: unknownStagingFrame, runtimeContext });
  assert.equal(
    selectOpenSemanticLegacyOwnerStepsV1({ frame: unknownStagingFrame, plan: unknownStagingPlan }),
    null,
    "une action sans capacité exacte ne doit jamais être absorbée comme simple orientation"
  );

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
