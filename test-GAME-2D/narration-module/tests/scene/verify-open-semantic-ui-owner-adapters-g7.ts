import assert from "node:assert/strict";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8,
  buildOpenSemanticLegacyOwnerAdapterProjectionV1,
  createDefaultNpcPerformerConfigV1,
  createPrototypeNarrativeTurnControllerV1,
  interpretNarrativeInputWithAiV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  validateCanonicalIntentAuthorityV1,
  type InterpreterCharacterContextV1,
  type NarrativeInventoryTransactionRuntimeV1
} from "../../src/application";
import { buildOpenAiIntentInterpreterConfigV1 } from "../../../src/narration-ui/openAiNarrativeRuntimeConfig";
import {
  OPEN_SEMANTIC_CORPUS_G6,
  OPEN_SEMANTIC_CORPUS_G6_VERSION,
  OPEN_SEMANTIC_CORPUS_RUNTIME_CONTEXT_G6
} from "../fixtures/open-semantic-corpus-g6";
import {
  createSimulatedOpenAiSemanticConfigG6,
  SimulatedOpenAiSemanticProviderG6
} from "../fixtures/simulated-openai-semantic-provider-g6";

const inventoryCase = requiredCase("inventory-transfer");
const composedCase = requiredCase("composed-ordered-actions");
const dialogueCase = requiredCase("dialogue-implicit");

async function main(): Promise<void> {
  const interpreted = await interpretNarrativeInputWithAiV1({
    campaignId: "campaign:g7-adapter",
    operationId: "operation:g7-adapter",
    intentId: "intent:g7-adapter",
    rawInput: inventoryCase.rawInput,
    config: createSimulatedOpenAiSemanticConfigG6([inventoryCase]),
    runtimeContext: OPEN_SEMANTIC_CORPUS_RUNTIME_CONTEXT_G6
  });
  const projection = buildOpenSemanticLegacyOwnerAdapterProjectionV1(interpreted.interpretation);
  assert.ok(projection, "Une composante V8 routable unique doit produire un pont propriétaire.");
  assert.equal(projection.rawInputAccess, "FORBIDDEN");
  assert.equal(projection.semanticInputText, inventoryCase.frame.components[0]?.meaning);
  assert.notEqual(projection.semanticInputText, inventoryCase.rawInput);
  assert.equal(projection.capabilityId, "inventory.mutation");
  assert.equal(projection.domainCommand.domain, "inventory");
  assert.equal(projection.domainCommand.payload.capabilityId, "inventory.mutation");
  assert.equal(validateCanonicalIntentAuthorityV1(projection.interpretation).ok, true);
  assert.equal(interpreted.interpretation.semanticSource, "OPEN_SEMANTIC_FRAME_V8");
  assert.deepEqual(interpreted.interpretation.openSemanticFrame, inventoryCase.frame);

  const approachCase = {
    schemaVersion: 1 as const,
    corpusVersion: OPEN_SEMANTIC_CORPUS_G6_VERSION,
    caseId: "visible-actor-approach",
    coverage: ["visible_actor_approach"],
    paraphraseFamily: null,
    rawInput: "Formulation arbitraire d'approche.",
    frame: {
      schemaVersion: 1 as const,
      understandingStatus: "UNDERSTOOD" as const,
      overallMeaning: "Le personnage se place près de l'acteur visible.",
      overallCommitment: "committed" as const,
      globalConditions: [],
      components: [{
        componentId: "approach-visible-actor",
        order: 1,
        meaning: "Le personnage se place près de l'acteur visible.",
        commitment: "committed" as const,
        conditions: [],
        negated: false,
        quoted: false,
        relationToPrevious: "NONE" as const,
        alternativeGroupId: null,
        dependsOnComponentIds: [],
        simultaneousWithComponentIds: [],
        supersedesComponentIds: [],
        mentionedTargets: [],
        suggestedDomain: "scene_resolution",
        suggestedAction: "se placer près de l'acteur visible",
        suggestedCapabilityId: "scene.visible-actor-approach"
      }],
      ambiguities: [],
      clarificationQuestion: null,
      confidence: "high" as const
    },
    expected: {
      understandingStatus: "UNDERSTOOD" as const,
      overallCommitment: "committed" as const,
      componentCommitments: ["committed" as const],
      relations: ["NONE" as const],
      dispositions: ["ROUTABLE" as const],
      targetRefs: [[]],
      ambiguityCount: 0,
      requiresClarification: false,
      noCommitBeforeOwnerValidation: true as const,
      noGameTimeBeforeOwnerValidation: true as const
    }
  };
  const approachRuntime = {
    schemaVersion: 1 as const,
    contractVersion: "interpreter-runtime-context/1" as const,
    capabilities: [{
      capabilityId: "scene.visible-actor-approach",
      domain: "scene_resolution" as const,
      availability: "AVAILABLE" as const,
      playerFacingScope: "Se placer près d'un acteur visible sans lui parler."
    }],
    activeTravel: null
  };
  const approached = await interpretNarrativeInputWithAiV1({
    campaignId: "campaign:g7-approach",
    operationId: "operation:g7-approach",
    intentId: "intent:g7-approach",
    rawInput: approachCase.rawInput,
    config: createSimulatedOpenAiSemanticConfigG6([approachCase]),
    runtimeContext: approachRuntime
  });
  const approachProjection = buildOpenSemanticLegacyOwnerAdapterProjectionV1(approached.interpretation);
  assert.ok(approachProjection);
  assert.equal(approachProjection.capabilityId, "scene.visible-actor-approach");
  assert.equal(approachProjection.interpretation.semanticIntent.kind, "move_near_visible_actor");

  const archivesScene = structuredClone(REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1);
  archivesScene.sceneId = "wiki-location:archives-test";
  archivesScene.locationName = "Archives de Lysenthe";
  archivesScene.presentNpc = [];
  archivesScene.ambientPopulation = [{
    schemaVersion: 1,
    actorId: "archive-clerk",
    displayName: "Clerc des archives",
    publicRole: "clerc",
    visibleActivity: "il circule d'un poste à l'autre",
    visibleAppearance: "une silhouette au pas pressé",
    demeanor: "réservé",
    immediateGoal: "porter les actes en attente",
    currentPressure: "la surveillance du lieu",
    speechStyle: ["bref"],
    conversationalHooks: ["actes"],
    boundaries: ["archives privées"],
    knowledgeRefs: ["wiki-location:archives-test"],
    keywords: ["clerc"],
    version: 1
  }];
  const archiveCase = {
    ...approachCase,
    caseId: "archives-clerk-approach",
    rawInput: "je m'approche du clerc",
    frame: {
      ...approachCase.frame,
      overallMeaning: "Le personnage s'approche du clerc visible.",
      components: [{
        ...approachCase.frame.components[0]!,
        meaning: "Le personnage se place près du clerc visible.",
        mentionedTargets: [{ surface: "le clerc", proposedRef: "npc:archive-clerk" }]
      }]
    },
    expected: {
      ...approachCase.expected,
      targetRefs: [["npc:archive-clerk"]]
    }
  };
  const characterContext: InterpreterCharacterContextV1 = {
    schemaVersion: 1,
    contractVersion: "interpreter-character-context/1",
    character: { ref: "player-character:test", label: "Personnage" },
    references: [],
    ambiguities: [],
    authority: "INTERPRETATION_ONLY",
    ownerValidationRequired: true,
    embodiedProfile: null,
    deliberatelyExcluded: []
  };
  const archiveFollowUpCase = {
    ...archiveCase,
    caseId: "archives-clerk-pronoun-follow-up",
    rawInput: "je lui demande ou puis je trouver des documents important",
    frame: {
      ...archiveCase.frame,
      overallMeaning: "Le personnage demande au clerc où trouver des documents importants.",
      components: [{
        ...archiveCase.frame.components[0]!,
        componentId: "ask-clerk-for-important-documents",
        meaning: "Le personnage demande au clerc où trouver des documents importants.",
        mentionedTargets: [{ surface: "lui", proposedRef: "npc:archive-clerk" }],
        suggestedDomain: "social",
        suggestedAction: "demander au clerc où trouver des documents importants",
        suggestedCapabilityId: "scene.visible-dialogue"
      }]
    },
    expected: {
      ...archiveCase.expected,
      targetRefs: [["npc:archive-clerk"]]
    }
  };
  const archiveInterpreterConfig = createSimulatedOpenAiSemanticConfigG6([
    archiveCase,
    archiveFollowUpCase
  ]);
  const archiveProvider = archiveInterpreterConfig.provider as SimulatedOpenAiSemanticProviderG6;
  const archiveController = await createPrototypeNarrativeTurnControllerV1({
    intentInterpreterConfig: archiveInterpreterConfig,
    mjPlannerConfig: null,
    npcPerformerConfig: createDefaultNpcPerformerConfigV1(),
    sceneTransitionRuntime: null,
    initialScene: { scene: archivesScene, locationRef: "location:archives-test" },
    activeSceneResolver: {
      async resolve() {
        return { ok: true as const, value: archivesScene };
      }
    },
    interpreterCharacterContextResolver: {
      async resolve() {
        return { ok: true as const, value: characterContext };
      }
    }
  });
  const archiveApproach = await archiveController.submit({
    schemaVersion: 1,
    clientRequestId: "g7-archives-clerk-approach",
    rawInput: archiveCase.rawInput
  });
  if (!archiveApproach.ok) throw new Error(archiveApproach.error.messageKey);
  assert.equal(archiveApproach.value.output.interpretation.semanticSource, "OPEN_SEMANTIC_FRAME_V8");
  assert.equal(archiveApproach.value.output.domainCommand?.semanticKind, "move_near_visible_actor");
  assert.deepEqual(archiveApproach.value.output.domainCommand?.targetRefs, ["npc:archive-clerk"]);
  assert.equal(archiveApproach.value.output.resolution.resultKind, "COMMIT_APPLIED");
  assert.match(
    archiveApproach.value.output.displayPacket.displayBlocks.find(block => block.kind === "GM_NARRATION")?.text ?? "",
    /clerc/iu,
    "l'approche validée doit produire une narration en jeu, pas une notification technique"
  );
  const archiveFollowUp = await archiveController.submit({
    schemaVersion: 1,
    clientRequestId: "g7-archives-clerk-pronoun-follow-up",
    rawInput: archiveFollowUpCase.rawInput
  });
  if (!archiveFollowUp.ok) throw new Error(archiveFollowUp.error.messageKey);
  const followUpRequest = archiveProvider.requests.find(request =>
    (request.input.task as { rawInput?: unknown }).rawInput === archiveFollowUpCase.rawInput
  );
  const embodiedContext = (followUpRequest?.input.task as {
    embodiedContext?: {
      recentFocus?: Array<{ targetRef?: string }>;
      recentIntentions?: Array<{ targetRef?: string | null }>;
    };
  } | undefined)?.embodiedContext;
  assert.ok(embodiedContext, JSON.stringify(followUpRequest?.input.task));
  assert.equal(embodiedContext?.recentIntentions?.[0]?.targetRef, "npc:archive-clerk");
  assert.equal(archiveFollowUp.value.output.resolution.resultKind, "COMMIT_APPLIED");
  assert.ok(
    archiveFollowUp.value.output.npcPerformance,
    "le PNJ ciblé par la capacité sociale V8 doit être joué sans dépendre d'une assignation du planner"
  );
  assert.deepEqual(
    archiveFollowUp.value.output.domainCommand?.targetRefs,
    ["npc:archive-clerk"],
    "une reprise pronominale conserve le focus sémantique du tour précédent"
  );

  let capturedOwnerInput: string | null = null;
  let capturedOwnerSource: string | null = null;
  let executeCalls = 0;
  const rejectingOwner: NarrativeInventoryTransactionRuntimeV1 = {
    canHandle(input) {
      capturedOwnerInput = input.rawInput;
      capturedOwnerSource = input.interpretation.semanticSource ?? null;
      assert.equal(input.domainCommand?.payload.capabilityId, "inventory.mutation");
      return false;
    },
    async execute() {
      executeCalls += 1;
      throw new Error("Le propriétaire rejeté ne doit pas être exécuté.");
    }
  };
  const singleController = await createPrototypeNarrativeTurnControllerV1({
    intentInterpreterConfig: createSimulatedOpenAiSemanticConfigG6([inventoryCase]),
    mjPlannerConfig: null,
    npcPerformerConfig: null,
    sceneTransitionRuntime: null,
    interpreterCharacterContextResolver: null,
    inventoryTransactionRuntime: rejectingOwner
  });
  const single = await singleController.submit({
    schemaVersion: 1,
    clientRequestId: "g7-owner-single",
    rawInput: inventoryCase.rawInput
  });
  if (!single.ok) throw new Error(single.error.messageKey);
  assert.equal(capturedOwnerInput, inventoryCase.frame.components[0]?.meaning);
  assert.notEqual(capturedOwnerInput, inventoryCase.rawInput);
  assert.equal(capturedOwnerSource, "OPEN_SEMANTIC_OWNER_ADAPTER_V1");
  assert.equal(executeCalls, 0);
  assert.equal(single.value.output.interpretation.semanticSource, "OPEN_SEMANTIC_FRAME_V8");
  assert.deepEqual(single.value.output.interpretation.openSemanticFrame, inventoryCase.frame);
  assert.equal(
    single.value.output.displayPacket.displayBlocks.find(block => block.kind === "RAW_INPUT")?.text,
    inventoryCase.rawInput,
    "La présentation conserve le texte original sans le rendre aux propriétaires."
  );

  let composedOwnerCalls = 0;
  const composedGuard: NarrativeInventoryTransactionRuntimeV1 = {
    canHandle() {
      composedOwnerCalls += 1;
      return false;
    },
    async execute() {
      composedOwnerCalls += 1;
      throw new Error("Une composition V8 ne doit pas entrer dans un propriétaire V1.");
    }
  };
  const composedController = await createPrototypeNarrativeTurnControllerV1({
    intentInterpreterConfig: createSimulatedOpenAiSemanticConfigG6([composedCase]),
    mjPlannerConfig: null,
    npcPerformerConfig: null,
    sceneTransitionRuntime: null,
    interpreterCharacterContextResolver: null,
    inventoryTransactionRuntime: composedGuard
  });
  const composed = await composedController.submit({
    schemaVersion: 1,
    clientRequestId: "g7-owner-composed",
    rawInput: composedCase.rawInput
  });
  if (!composed.ok) throw new Error(composed.error.messageKey);
  assert.equal(composedOwnerCalls, 0, "Sans coordinateur multi-opérations, aucun propriétaire V1 ne reçoit la saisie brute.");
  assert.equal(composed.value.output.noCommit, true);
  assert.equal(composed.value.output.interpretation.semanticSource, "OPEN_SEMANTIC_FRAME_V8");

  const dialogueController = await createPrototypeNarrativeTurnControllerV1({
    intentInterpreterConfig: createSimulatedOpenAiSemanticConfigG6([dialogueCase]),
    sceneTransitionRuntime: null,
    interpreterCharacterContextResolver: null
  });
  const dialogue = await dialogueController.submit({
    schemaVersion: 1,
    clientRequestId: "g7-owner-dialogue",
    rawInput: dialogueCase.rawInput
  });
  if (!dialogue.ok) throw new Error(dialogue.error.messageKey);
  assert.notEqual(dialogue.value.output.mjPlan, null, "Le planificateur doit recevoir le sens V8, pas être supprimé pour un dialogue routable.");
  assert.notEqual(dialogue.value.output.npcPerformance, null, "Le PNJ visible doit pouvoir répondre à un dialogue V8 routable.");
  assert.equal(dialogue.value.output.interpretation.semanticSource, "OPEN_SEMANTIC_FRAME_V8");
  assert.equal(
    dialogue.value.output.displayPacket.displayBlocks.find(block => block.kind === "RAW_INPUT")?.text,
    dialogueCase.rawInput
  );

  const productConfig = buildOpenAiIntentInterpreterConfigV1();
  assert.equal(productConfig.contractVersion, AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8);
  assert.ok(productConfig.route.allowedContractVersions.includes(AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8));

  console.log("Open semantic owner adapters/UI G7: V8 product config, semantic-only owner input and composed-turn suspension passed.");
}

function requiredCase(caseId: string) {
  const found = OPEN_SEMANTIC_CORPUS_G6.find(entry => entry.caseId === caseId);
  if (found === undefined) throw new Error(`Missing G6 corpus case: ${caseId}`);
  return found;
}

void main();
