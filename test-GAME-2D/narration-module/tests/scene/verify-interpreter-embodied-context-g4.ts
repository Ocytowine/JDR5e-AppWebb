import assert from "node:assert/strict";
import type { ContractAiProviderV1 } from "../../src/ai/FakeContractAiProvider";
import type { AiCallRequestV1, AiOpenSemanticFrameV8 } from "../../src/ai/types";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8,
  buildInterpreterEmbodiedPublicContextV1,
  interpretNarrativeInputWithAiV1,
  type AiIntentInterpreterConfigV1,
  type InterpreterCharacterContextV1,
  type PlayerPublicContextV1
} from "../../src/application";
import { buildInterpreterRuntimeContextV1 } from "../../src/application/runtimeCapabilityRouting";

const PRIVATE_CANARIES = [
  "PRIVATE_MECHANICAL_CANARY_G4",
  "PRIVATE_PLOT_CANARY_G4",
  "PRIVATE_RECENT_TURN_CANARY_G4",
  "PRIVATE_NOTEBOOK_CANARY_G4"
];

const characterContext = {
  schemaVersion: 1,
  contractVersion: "interpreter-character-context/2",
  character: { ref: "player-character:aryn", label: "Aryn" },
  references: [
    {
      schemaVersion: 1,
      ref: "character-reference:spell:lueur-des-cendres",
      kind: "SPELL",
      label: "Lueur des cendres",
      aliases: ["lueur", "cendres"],
      availability: "REFERENCE_ONLY",
      inventoryState: null,
      quantity: null,
      containerRef: null
    },
    {
      schemaVersion: 1,
      ref: "character-inventory-item:amulette",
      kind: "INVENTORY_ITEM",
      label: "Amulette de cuivre",
      aliases: ["amulette"],
      availability: "REFERENCE_ONLY",
      inventoryState: "STORED",
      quantity: 1,
      containerRef: "character-inventory-item:sac"
    }
  ],
  ambiguities: [],
  embodiedProfile: {
    schemaVersion: 1,
    identity: {
      characterRef: "player-character:aryn",
      label: "Aryn",
      raceRef: "race:humain",
      backgroundRef: "background:veilleur"
    },
    selfNarrative: {
      biography: "Aryn a grandi près des anciennes tours de guet.",
      personality: "Prudent avec les inconnus, attentif aux détails.",
      objectives: "Retrouver la personne qui a laissé le sceau brisé.",
      flaws: "Hésite à faire confiance aux autorités.",
      physicalDescription: "Une cicatrice claire traverse son menton."
    },
    classification: "PLAYER_AUTHORED_PUBLIC_SELF_CONTEXT"
  },
  authority: "INTERPRETATION_ONLY",
  ownerValidationRequired: true,
  deliberatelyExcluded: [],
  privateMechanicalCanary: PRIVATE_CANARIES[0]
} as unknown as InterpreterCharacterContextV1;

const playerPublicContext = {
  schemaVersion: 1,
  contractVersion: "player-public-context/1",
  character: { ref: "player-character:aryn", actorRef: "actor:aryn", label: "Aryn" },
  location: { sceneId: "scene:archives", label: "Archives de Lysent", sourceRef: "scene:archives" },
  presentActors: [
    {
      schemaVersion: 1,
      actorRef: "npc:maelis",
      label: "Maelis",
      publicRole: "Archiviste",
      visibleState: "debout près du registre",
      sourceRef: "scene:archives:actor:maelis"
    },
    {
      schemaVersion: 1,
      actorRef: "npc:seren",
      label: "Seren",
      publicRole: "Compagne de voyage",
      visibleState: "observe les rayonnages",
      sourceRef: "scene:archives:actor:seren"
    }
  ],
  visibleEquipmentRefs: [],
  knownFacts: Array.from({ length: 25 }, (_, index) => ({
    schemaVersion: 1 as const,
    factRef: `fact:${index + 1}`,
    subjectRef: null,
    subjectLabel: null,
    statement: index === 0 ? "Le sceau brisé porte le symbole des veilleurs." : `Information publique ${index + 1}`,
    status: "CONFIRMED" as const,
    attributedSpeakerRefs: index === 0 ? ["actor:maelis"] : [],
    sourceRefs: [`source:${index + 1}`],
    assertsObjectiveTruth: false as const
  })),
  sourceVersions: { scene: 1, testimonyRegistry: 2, actorKnowledgeRegistry: 3 },
  authority: "PLAYER_VISIBLE_READ_ONLY",
  noCommit: true,
  noGameTime: true,
  deliberatelyExcluded: [],
  privatePlotCanary: PRIVATE_CANARIES[1]
} as unknown as PlayerPublicContextV1;

const runtimeContext = buildInterpreterRuntimeContextV1({
  sceneTransition: true,
  dynamicPlace: true,
  rest: true,
  inventoryAccess: true,
  inventoryMutation: true,
  tacticalAccess: false,
  travel: true,
  activeTravel: {
    status: "INTERRUPTED",
    destinationLocationId: "location:halles",
    awaitingPlayerDecision: true
  }
});

const recentTurns = Array.from({ length: 6 }, (_, index) => ({
  schemaVersion: 1 as const,
  operationId: `operation:recent:${index + 1}`,
  semanticKind: "address_visible_actor" as const,
  playerGoal: index === 0 ? "Demander à Maelis ce qu'elle sait du sceau." : `Intention publique récente ${index + 1}`,
  primaryTarget: { kind: "npc" as const, ref: "npc:maelis", label: "Maelis" },
  topic: null,
  commitment: "committed" as const,
  privateCanary: PRIVATE_CANARIES[2]
}));

const recentFocus = Array.from({ length: 4 }, (_, index) => ({
  schemaVersion: 1 as const,
  sceneId: "scene:archives",
  sceneVersion: 1,
  target: { kind: "object" as const, ref: `poi:focus-${index + 1}`, label: `Focus ${index + 1}` },
  sourceOperationId: `operation:focus:${index + 1}`,
  sourceText: "",
  confidence: "high" as const
}));

const embodied = buildInterpreterEmbodiedPublicContextV1({
  characterContext,
  playerPublicContext,
  recentSemanticTurns: recentTurns,
  recentFocus,
  activeInterlocutor: {
    target: { ref: "npc:maelis", label: "Maelis" },
    sourceOperationId: "operation:recent:1"
  },
  activeCompanionRefs: ["npc:seren"],
  runtimeContext
});

assert.notEqual(embodied, null);
if (embodied === null) throw new Error("embodied context should be available");
assert.equal(embodied.contractVersion, "interpreter-embodied-public-context/1");
assert.equal(embodied.character.biography, characterContext.embodiedProfile?.selfNarrative.biography);
assert.equal(embodied.character.objectives, characterContext.embodiedProfile?.selfNarrative.objectives);
assert.equal(embodied.namedReferences.some(reference => reference.label === "Lueur des cendres"), true);
assert.equal(embodied.namedReferences.some(reference => reference.label === "Amulette de cuivre"), true);
assert.equal(embodied.currentScene.label, "Archives de Lysent");
assert.equal(embodied.activeInterlocutor?.actorRef, "npc:maelis");
assert.deepEqual(embodied.presentCompanions, [{ actorRef: "npc:seren", label: "Seren" }]);
assert.equal(embodied.activeProcess?.status, "INTERRUPTED");
assert.equal(embodied.acquiredKnowledge.length, 16);
assert.equal(embodied.recentIntentions.length, 4);
assert.equal(embodied.recentFocus.length, 3);
assert.equal(embodied.authority, "INTERPRETATION_ONLY_PUBLIC_CONTEXT");
assert.equal(embodied.noCommit, true);
assert.equal(embodied.noGameTime, true);

const serializedEmbodied = JSON.stringify(embodied);
for (const canary of PRIVATE_CANARIES) {
  assert.equal(serializedEmbodied.includes(canary), false, `${canary} must remain outside embodied context`);
}
for (const forbiddenKey of ["quantity", "containerRef", "privateMechanicalCanary", "sourceRefs"]) {
  assert.equal(Object.hasOwn(embodied.namedReferences[0], forbiddenKey), false);
}

const semanticFrame: AiOpenSemanticFrameV8 = {
  schemaVersion: 1,
  understandingStatus: "UNDERSTOOD",
  overallMeaning: "Aryn relie le symbole à son passé de veilleur et interroge Maelis.",
  overallCommitment: "committed",
  globalConditions: [],
  components: [{
    componentId: "ask-maelis",
    order: 1,
    meaning: "Aryn demande à Maelis ce qu'elle sait du symbole des veilleurs.",
    commitment: "committed",
    conditions: [],
    negated: false,
    quoted: false,
    relationToPrevious: "NONE",
    alternativeGroupId: null,
    dependsOnComponentIds: [],
    simultaneousWithComponentIds: [],
    supersedesComponentIds: [],
    mentionedTargets: [{ surface: "Maelis", proposedRef: "npc:maelis" }],
    suggestedDomain: "dialogue",
    suggestedAction: "questionner Maelis à partir du passé public d'Aryn",
    suggestedCapabilityId: "scene.visible-dialogue"
  }],
  ambiguities: [],
  clarificationQuestion: null,
  confidence: "high"
};

let capturedRequest: AiCallRequestV1 | null = null;
class CapturingProvider implements ContractAiProviderV1 {
  async generate(request: AiCallRequestV1): Promise<unknown> {
    capturedRequest = request;
    return {
      schemaVersion: 1,
      contractVersion: request.contractVersion,
      outputId: `output:${request.attemptId}`,
      callId: request.callId,
      attemptId: request.attemptId,
      packId: request.packId,
      snapshotId: request.snapshotId,
      role: request.role,
      status: "OK",
      payload: {
        rawInputEcho: (request.input.task as { rawInput: string }).rawInput,
        semanticFrame
      },
      diagnostics: [],
      supersedesOutputId: null
    };
  }
}

const config: AiIntentInterpreterConfigV1 = {
  provider: new CapturingProvider(),
  contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8,
  route: {
    schemaVersion: 1,
    routeId: "route:g4",
    role: "player_intent_interpreter",
    providerKind: "FAKE_CONTRACT",
    providerId: "fixture:g4",
    modelId: "fixture:g4",
    modelConfigVersion: "g4",
    certified: true,
    allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8],
    inputTokenLimit: 5_000,
    outputTokenLimit: 4_000,
    timeoutMs: 1_000,
    fallbackRouteIds: []
  },
  retryPolicy: {
    schemaVersion: 1,
    role: "player_intent_interpreter",
    maxTechnicalRetries: 0,
    maxTargetedCorrections: 0,
    maxFullRegenerations: 0,
    allowFallback: false
  }
};

async function main(): Promise<void> {
  const interpreted = await interpretNarrativeInputWithAiV1({
    campaignId: "campaign:g4",
    operationId: "operation:g4",
    intentId: "intent:g4",
    rawInput: "Je lui demande si ce symbole lui rappelle les anciennes tours.",
    config,
    characterContext,
    playerPublicContext,
    recentSemanticTurns: recentTurns,
    localReferentHints: recentFocus,
    runtimeContext,
    activeCompanionRefs: ["npc:seren"]
  });
  assert.equal(interpreted.usedAiInterpretation, true);
  assert.equal(interpreted.interpretationFailure, null);
  assert.equal(
    interpreted.interpretation.openSemanticFrame?.components[0]?.mentionedTargets[0]?.proposedRef,
    "npc:maelis",
    "une référence d'acteur visible fournie dans le contexte public doit être acceptée par V8"
  );
  assert.notEqual(capturedRequest, null);
  const task = capturedRequest?.input.task as Record<string, unknown>;
  assert.deepEqual(Object.keys(task).sort(), ["embodiedContext", "forbiddenAuthority", "outputContract", "rawInput"]);
  assert.deepEqual(task.embodiedContext, embodied);
  for (const legacyDuplicate of ["characterContext", "playerPublicContext", "recentSemanticTurns", "activeDialogueTarget", "runtimeContext", "activeCompanionRefs"]) {
    assert.equal(Object.hasOwn(task, legacyDuplicate), false, `${legacyDuplicate} must not duplicate V8 context`);
  }
  const serializedRequest = JSON.stringify(capturedRequest);
  for (const canary of PRIVATE_CANARIES) assert.equal(serializedRequest.includes(canary), false);
  assert.equal(capturedRequest?.limits.inputTokenBudget, 4_000);
  assert.match(capturedRequest?.contextFingerprint ?? "", /^sha256:[a-f0-9]{64}$/u);
  const firstFingerprint = capturedRequest?.contextFingerprint;
  const changedCharacterContext = structuredClone(characterContext);
  if (changedCharacterContext.embodiedProfile !== null) {
    changedCharacterContext.embodiedProfile.selfNarrative.objectives = "Protéger Maelis avant de retrouver le sceau.";
  }
  await interpretNarrativeInputWithAiV1({
    campaignId: "campaign:g4",
    operationId: "operation:g4:changed-public-objective",
    intentId: "intent:g4:changed-public-objective",
    rawInput: "Je lui demande si ce symbole lui rappelle les anciennes tours.",
    config,
    characterContext: changedCharacterContext,
    playerPublicContext,
    recentSemanticTurns: recentTurns,
    localReferentHints: recentFocus,
    runtimeContext,
    activeCompanionRefs: ["npc:seren"]
  });
  assert.notEqual(capturedRequest?.contextFingerprint, firstFingerprint, "Une évolution du contexte public incarné doit modifier l'empreinte.");
  console.log("Interpreter embodied context G4: bounded public context and privacy canaries passed.");
}

void main();
