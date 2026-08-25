import assert from "node:assert/strict";
import {
  MemoryCampaignRepository,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord,
  type RepositoryClock
} from "../../src/core";
import type { AiIntentInterpretationPayloadV1, AiIntentRuntimeHandlingV1, AiStructuredSemanticIntentV1, ContractAiProviderV1 } from "../../src/ai";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
  NarrativeTurnControllerV1,
  createDefaultMjPlannerConfigV1,
  createDefaultNpcPerformerConfigV1,
  createDefaultAiIntentInterpreterConfigV1,
  createPrototypeNarrativeTurnControllerV1,
  buildLocalIntentPayload,
  buildSceneReferentRegistryV1,
  evaluateNarrativeRuntimeDecisionV1,
  interpretNarrativeInputWithAiV1,
  upgradeLegacyNarrativeIntentInterpretationV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  validateCanonicalIntentAuthorityV1,
  validateNarrativeDomainCommandV1,
  type AiIntentInterpreterConfigV1,
  type NpcPerformerConfigV1
} from "../../src/application";

class FixedClock implements RepositoryClock {
  constructor(private readonly instant = new Date("2026-07-08T12:00:00.000Z")) {}
  now(): Date {
    return new Date(this.instant);
  }
}

const speechInputs = [
  "Je demande au garde ce qu’il a vu.",
  "Je lui demande ce qu’il a vu.",
  "Je m’approche du garde et je lui demande ce qu’il a vu.",
  "Je vais vers le garde pour lui demander ce qu’il a vu.",
  "Je questionne le garde sur ce qu’il a vu.",
  "Je demande au garde s’il a remarqué quelque chose.",
  "Je m’approche du garde et je lui demande s’il a vu quelque chose d’étrange.",
  "j'aimerais parler à un garde"
];

const socialPossibilities = [
  "Est-ce que je peux parler au garde ?",
  "Puis-je interroger le garde ?",
  "Ai-je le droit de poser une question au garde ?",
  "Ce serait possible de discuter avec lui ?"
];

const riskyPossibilities = [
  "Est-ce que je peux voler la bourse du garde ?",
  "Puis-je ouvrir la porte sans attirer l'attention ?",
  "Est-ce possible d'entrer dans l'arrière-salle discrètement ?"
];

const explicitActions = [
  "J'ouvre la porte.",
  "Je tente d'ouvrir la porte.",
  "Je m'avance vers l'arrière-salle."
];

const metaQuestions = [
  "Comment fonctionne cette scène côté règles ?",
  "Pause, quel jet faudrait-il normalement ?",
  "Est-ce que l'interface sauvegarde automatiquement ?"
];

const contextQuestions = [
  "Peux-tu me décrire l'auberge ?",
  "Tu peux me dire où je me situe ?",
  "Pourrais-tu me rappeler ce que je vois ?"
];

const ambiguousInputs = [
  "Lui voler quelque chose ?",
  "Et si j'entrais ?",
  "Le garde ?",
  "Je pourrais peut-être..."
];

async function main(): Promise<void> {
  const stabilizedDoorDomain = evaluateNarrativeRuntimeDecisionV1({
    semanticIntent: semanticIntent({
      kind: "manipulate_visible_object",
      playerGoal: "ouvrir la porte visible",
      target: { kind: "object", ref: "poi:back-room-door", label: "Porte du fond" },
      commitment: "committed",
      evidenceFromInput: ["je l'ouvre"],
      forbiddenInterpretations: ["annoncer l'ouverture", "scene_transition"],
      confidence: "high"
    }) as AiStructuredSemanticIntentV1,
    runtimeSuggestion: runtimeHandling({
      status: "UNSUPPORTED_DOMAIN",
      reason: "Suggestion IA instable.",
      requiredDomain: "world",
      canonicalActionHint: "open",
      noCommit: true,
      noGameTime: true
    }) as AiIntentRuntimeHandlingV1,
    requiresClarification: false
  });
  assert.equal(stabilizedDoorDomain.requiredDomain, "scene_resolution");
  assert.equal(stabilizedDoorDomain.status, "SUPPORTED_BY_CURRENT_RUNTIME");

  const config = createDefaultAiIntentInterpreterConfigV1();
  const localReturnScene = {
    ...REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
    sceneId: "arrival:place_des_archives",
    locationName: "Place des Archives",
    pointsOfInterest: [{
      ...REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1.pointsOfInterest[0]!,
      pointId: "return-to-archives",
      label: "Passage de retour",
      keywords: ["retour"],
      destinationAliases: ["Archives de Lysenthe"]
    }]
  };
  const localReturn = buildLocalIntentPayload(
    "Je retourne aux Archives de Lysenthe.",
    [],
    buildSceneReferentRegistryV1(localReturnScene)
  ).intents[0]!;
  assert.equal(localReturn.semanticIntent.kind, "traverse_visible_boundary");
  assert.equal(localReturn.target?.ref, "poi:return-to-archives");
  assert.equal(localReturn.requiresClarification, false);
  const localVisiblePopulation = await interpret(
    "J'observe calmement les personnes présentes.",
    config
  );
  assert.equal(
    localVisiblePopulation.interpretation.semanticIntent.kind,
    "observe_environment"
  );
  assert.equal(
    localVisiblePopulation.interpretation.semanticIntent.perception?.informationKind,
    "PRESENCE"
  );
  assert.equal(
    localVisiblePopulation.interpretation.referentResolution?.ambiguity,
    "none",
    "une observation générale des présences n'exige aucune cible individuelle"
  );
  assert.equal(localVisiblePopulation.interpretation.requiresClarification, false);
  let capturedSemanticHistory: unknown = null;
  let capturedRuntimeContext: unknown = null;
  let capturedContextFingerprint = "";
  const capturingProvider: ContractAiProviderV1 = {
    async generate(request) {
      capturedSemanticHistory = (request.input.task as { recentSemanticTurns?: unknown }).recentSemanticTurns;
      capturedRuntimeContext = (request.input.task as { runtimeContext?: unknown }).runtimeContext;
      capturedContextFingerprint = request.contextFingerprint;
      return config.provider.generate(request);
    }
  };
  await interpretNarrativeInputWithAiV1({
    campaignId: "cmp-semantic-history",
    operationId: "op-semantic-history",
    intentId: "intent-semantic-history",
    rawInput: "Je l'ouvre.",
    config: { ...config, provider: capturingProvider },
    recentSemanticTurns: [{
      schemaVersion: 1,
      operationId: "op-previous-speech",
      semanticKind: "address_visible_actor",
      playerGoal: "demander à la serveuse pourquoi elle regarde la porte du fond",
      primaryTarget: { kind: "npc", ref: "npc:npc-serveuse-nerveuse", label: "Serveuse nerveuse" },
      topic: "la porte du fond",
      commitment: "committed"
    }],
    runtimeContext: {
      schemaVersion: 1,
      contractVersion: "interpreter-runtime-context/1",
      activeTravel: null,
      capabilities: [{
        capabilityId: "rest.process",
        domain: "rest",
        availability: "AVAILABLE",
        playerFacingScope: "Repos validé par son propriétaire."
      }]
    }
  });
  assert.deepEqual(capturedSemanticHistory, [{
    schemaVersion: 1,
    operationId: "op-previous-speech",
    semanticKind: "address_visible_actor",
    playerGoal: "demander à la serveuse pourquoi elle regarde la porte du fond",
    primaryTarget: { kind: "npc", ref: "npc:npc-serveuse-nerveuse", label: "Serveuse nerveuse" },
    topic: "la porte du fond",
    commitment: "committed"
  }], "l'interpréteur doit recevoir le contexte sémantique récent sans réinterprétation locale");

  assert.deepEqual(capturedRuntimeContext, {
    schemaVersion: 1,
    contractVersion: "interpreter-runtime-context/1",
    activeTravel: null,
    capabilities: [{
      capabilityId: "rest.process",
      domain: "rest",
      availability: "AVAILABLE",
      playerFacingScope: "Repos validé par son propriétaire."
    }]
  }, "l'interpréteur doit recevoir les capacités publiques sans autorité métier");
  assert.match(capturedContextFingerprint, /^sha256:[0-9a-f]{64}$/u);
  const availableContextFingerprint = capturedContextFingerprint;
  await interpretNarrativeInputWithAiV1({
    campaignId: "cmp-semantic-history",
    operationId: "op-semantic-history-closed-rest",
    intentId: "intent-semantic-history-closed-rest",
    rawInput: "Je l'ouvre.",
    config: { ...config, provider: capturingProvider },
    recentSemanticTurns: [],
    runtimeContext: {
      schemaVersion: 1,
      contractVersion: "interpreter-runtime-context/1",
      activeTravel: null,
      capabilities: [{
        capabilityId: "rest.process",
        domain: "rest",
        availability: "HANDOFF_ONLY",
        playerFacingScope: "Repos compris mais non raccordé."
      }]
    }
  });
  assert.notEqual(
    capturedContextFingerprint,
    availableContextFingerprint,
    "la mémoire et les capacités doivent participer à l'empreinte du contexte"
  );

  for (const rawInput of speechInputs) {
    const result = await interpret(rawInput, config);
    assert.equal(result.usedAiInterpretation, true, `${rawInput}: IA structurée attendue`);
    if (rawInput === "Je lui demande ce qu’il a vu.") {
      assert.equal(result.interpretation.intentType, "unclear_commitment", `${rawInput}: aucun PNJ par défaut sans référent récent`);
      assert.equal(result.interpretation.requiresClarification, true, `${rawInput}: clarification attendue`);
      continue;
    }
    assert.equal(result.interpretation.intentType, "speech", `${rawInput}: speech attendu`);
    assert.equal(result.interpretation.commitment, "committed", `${rawInput}: engagement attendu`);
    assert.equal(result.interpretation.requiresClarification, false, `${rawInput}: pas de clarification`);
    assert.match(result.interpretation.coreMeaning, /garde/u, `${rawInput}: cible garde conservée`);
  }

  for (const rawInput of socialPossibilities) {
    const result = await interpret(rawInput, config);
    assert.equal(result.interpretation.intentType, "possibility_query", `${rawInput}: possibilité sociale`);
    assert.equal(result.interpretation.commitment, "hypothetical", `${rawInput}: hypothétique`);
    assert.equal(result.interpretation.expectedTimeEffect, "NO_GAME_TIME", `${rawInput}: aucun temps`);
    assert.equal(result.interpretation.requiresClarification, false, `${rawInput}: pas de parole exécutée`);
  }

  for (const rawInput of riskyPossibilities) {
    const result = await interpret(rawInput, config);
    assert.equal(result.interpretation.intentType, "possibility_query", `${rawInput}: possibilité risquée`);
    assert.equal(result.interpretation.commitment, "hypothetical", `${rawInput}: pas de commit`);
    assert.equal(result.interpretation.expectedTimeEffect, "NO_GAME_TIME", `${rawInput}: aucun temps`);
  }

  for (const rawInput of explicitActions) {
    const result = await interpret(rawInput, config);
    assert.equal(result.interpretation.intentType, "action", `${rawInput}: action attendue`);
    assert.equal(result.interpretation.commitment, "committed", `${rawInput}: action engagée`);
  }

  const implicitDoorOpening = await interpret("Je mets la main sur la poignée et pivote le mécanisme.", config);
  assert.equal(implicitDoorOpening.usedAiInterpretation, true, "manipulation implicite: IA structurée attendue");
  assert.equal(implicitDoorOpening.usedFallback, false, "manipulation implicite: aucun fallback");
  assert.equal(implicitDoorOpening.interpretation.intentType, "action", "manipulation implicite: action attendue");
  assert.equal(implicitDoorOpening.interpretation.action, "open", "manipulation implicite: ouverture canonique attendue");
  assert.equal(implicitDoorOpening.interpretation.target?.ref, "poi:back-room-door", "manipulation implicite: porte visible attendue");
  assert.deepEqual(
    implicitDoorOpening.interpretation.semanticIntent,
    (implicitDoorOpening.acceptedOutput?.payload as AiIntentInterpretationPayloadV1).intents[0]?.semanticIntent,
    "manipulation implicite: semanticIntent doit traverser le mapping sans perte"
  );
  const { semanticIntent: _omittedSemanticIntent, ...legacyInterpretation } = implicitDoorOpening.interpretation;
  const upgradedLegacy = upgradeLegacyNarrativeIntentInterpretationV1(legacyInterpretation);
  assert.equal(upgradedLegacy?.semanticIntent.playerGoal, legacyInterpretation.coreMeaning, "relecture legacy: projection sémantique explicite attendue");
  assert.equal(upgradedLegacy?.semanticIntent.target?.ref, legacyInterpretation.target?.ref, "relecture legacy: cible conservée");
  assert.equal((implicitDoorOpening.acceptedOutput?.payload as AiIntentInterpretationPayloadV1).intents[0]?.semanticIntent.kind, "manipulate_visible_object");
  assert.equal((implicitDoorOpening.acceptedOutput?.payload as AiIntentInterpretationPayloadV1).intents[0]?.runtimeHandling.status, "SUPPORTED_BY_CURRENT_RUNTIME");

  const forceUnknownLock = await interpret("Je force la serrure.", config);
  assert.equal(forceUnknownLock.interpretation.intentType, "action", "serrure non visible: sens de l'action conservé pendant la clarification");
  assert.equal(forceUnknownLock.interpretation.requiresClarification, true, "serrure non visible: pas de resolution directe");

  for (const rawInput of metaQuestions) {
    const result = await interpret(rawInput, config);
    assert.equal(result.interpretation.intentType, "meta_question", `${rawInput}: méta attendue`);
    assert.equal(result.interpretation.commitment, "none", `${rawInput}: aucun engagement`);
    assert.equal(result.interpretation.expectedTimeEffect, "NO_GAME_TIME", `${rawInput}: aucun temps`);
  }

  for (const rawInput of contextQuestions) {
    const result = await interpret(rawInput, config);
    assert.equal(result.usedAiInterpretation, true, `${rawInput}: IA structurée attendue`);
    assert.equal(result.interpretation.intentType, "meta_question", `${rawInput}: question de contexte attendue`);
    assert.equal(result.interpretation.commitment, "none", `${rawInput}: aucun engagement`);
    assert.equal(result.interpretation.expectedTimeEffect, "NO_GAME_TIME", `${rawInput}: aucun temps`);
    assert.equal(result.interpretation.requiresClarification, false, `${rawInput}: pas de clarification`);
  }

  for (const rawInput of ambiguousInputs) {
    const result = await interpret(rawInput, config);
    assert.equal(result.interpretation.intentType, "unclear_commitment", `${rawInput}: ambiguïté attendue`);
    assert.equal(result.interpretation.requiresClarification, true, `${rawInput}: clarification attendue`);
  }

  const invalidConfig = invalidCommittedPossibilityConfig();
  const invalid = await interpret("Est-ce que je peux voler la bourse du garde ?", invalidConfig);
  assert.equal(invalid.usedAiInterpretation, false, "sortie IA invalide rejetée");
  assert.equal(invalid.usedFallback, false, "aucun fallback narratif sur sortie invalide");
  assert.equal(invalid.interpretation.intentType, "meta_question", "diagnostic technique attendu");
  assert.equal(invalid.interpretationFailure?.category, "AI_OUTPUT_INVALID");

  const invalidSocialSpeech = await interpret("j'aimerais parler a un garde", invalidUnusableConfig());
  assert.equal(invalidSocialSpeech.usedAiInterpretation, false, "sortie IA vide rejetee");
  assert.equal(invalidSocialSpeech.usedFallback, false, "aucun fallback narratif sur sortie vide");
  assert.equal(invalidSocialSpeech.interpretation.intentType, "meta_question", "diagnostic technique attendu");
  assert.equal(invalidSocialSpeech.interpretation.commitment, "none", "aucun engagement sur diagnostic");
  assert.equal(invalidSocialSpeech.interpretationFailure?.category, "AI_OUTPUT_INVALID");
  assert.equal(validateCanonicalIntentAuthorityV1(invalidSocialSpeech.interpretation).ok, true, "un diagnostic AI_INTERPRETATION_FAILED doit traverser le resolver sans devenir une intention de jeu");

  const diagnosticController = await createPrototypeNarrativeTurnControllerV1({ intentInterpreterConfig: invalidUnusableConfig() });
  const diagnosticTurn = await diagnosticController.submit({
    schemaVersion: 1,
    clientRequestId: "req-ai-interpretation-diagnostic-render",
    rawInput: "Je regarde la serveuse."
  });
  if (!diagnosticTurn.ok) throw new Error(diagnosticTurn.error.messageKey);
  const diagnosticBlocks = diagnosticTurn.value.output.displayPacket.displayBlocks;
  assert.equal(diagnosticBlocks.some(block => block.kind === "GM_NARRATION"), false, "un échec IA ne doit pas produire une fausse réponse MJ de contexte");
  const diagnosticNotice = diagnosticBlocks.find(block => block.kind === "CLARIFICATION")?.text ?? "";
  assert.match(diagnosticNotice, /reformuler/u);
  assert.doesNotMatch(diagnosticNotice, /question de contexte/iu);
  assert.doesNotMatch(diagnosticNotice, /Issue:|transport|provider/iu, "la cause technique ne doit pas fuir dans la narration joueur");

  let absentConfigDomainCalls = 0;
  const absentConfigController = await createPrototypeNarrativeTurnControllerV1({
    intentInterpreterConfig: null,
    inventoryAccessRuntime: {
      canHandle() {
        absentConfigDomainCalls += 1;
        return true;
      },
      async execute() {
        absentConfigDomainCalls += 1;
        throw new Error("un domaine ne doit pas exécuter une saisie non interprétée");
      }
    }
  });
  const absentConfigTurn = await absentConfigController.submit({
    schemaVersion: 1,
    clientRequestId: "req-ai-interpreter-config-absent",
    rawInput: "Je prends la bourse du garde."
  });
  if (!absentConfigTurn.ok) throw new Error(absentConfigTurn.error.messageKey);
  assert.equal(absentConfigTurn.value.output.noCommit, true);
  assert.equal(absentConfigTurn.value.output.noGameTime, true);
  assert.equal(absentConfigTurn.value.output.resolution.resultKind, "CLARIFICATION_REQUIRED");
  assert.equal(absentConfigDomainCalls, 0, "configuration absente: aucun propriétaire de domaine appelé");

  const invalidImplicitPossibility = await interpret("quel temps fait il ?", invalidImplicitPossibilityConfig());
  assert.equal(invalidImplicitPossibility.usedAiInterpretation, false, "possibility_query sans demande explicite rejetee");
  assert.equal(invalidImplicitPossibility.usedFallback, false, "aucun fallback narratif sur sortie invalide");
  assert.equal(invalidImplicitPossibility.interpretation.intentType, "meta_question", "diagnostic technique attendu");
  assert.equal(invalidImplicitPossibility.interpretation.commitment, "none", "aucun engagement attendu");
  assert.equal(invalidImplicitPossibility.interpretationFailure?.category, "AI_OUTPUT_INVALID");

  const invalidApproachRuntime = await interpret("je me dirige vers la femme", invalidApproachRuntimeConfig());
  assert.equal(invalidApproachRuntime.usedAiInterpretation, true, "approche PNJ: suggestion runtime non autoritaire stabilisée");
  assert.equal(invalidApproachRuntime.usedFallback, false, "approche PNJ stabilisée sans fallback");
  assert.equal(invalidApproachRuntime.interpretationFailure, null, "approche PNJ stabilisée sans faux rejet");
  assert.equal(invalidApproachRuntime.interpretation.runtimeHandling?.requiredDomain, "scene_resolution");
  assert.equal(invalidApproachRuntime.interpretation.runtimeHandling?.noCommit, false);
  assert.equal(invalidApproachRuntime.interpretation.runtimeHandling?.noGameTime, true);
  assert.equal(invalidApproachRuntime.interpretation.runtimeDecision.requiredDomain, "scene_resolution");
  assert.equal(invalidApproachRuntime.interpretation.runtimeDecision.noCommit, false);
  assert.equal(invalidApproachRuntime.interpretation.runtimeDecision.noGameTime, true);

  const stabilizedApproachController = await createPrototypeNarrativeTurnControllerV1({ intentInterpreterConfig: invalidApproachRuntimeConfig() });
  const stabilizedApproachTurn = await stabilizedApproachController.submit({
    schemaVersion: 1,
    clientRequestId: "req-runtime-stabilized-approach-waitress",
    rawInput: "Je m'approche de la serveuse"
  });
  if (!stabilizedApproachTurn.ok) throw new Error(stabilizedApproachTurn.error.messageKey);
  assert.equal(stabilizedApproachTurn.value.output.resolution.resultKind, "COMMIT_APPLIED", "approche stabilisée: commit local attendu");
  assert.equal(stabilizedApproachTurn.value.output.resolution.preparedEffects[0]?.effectType, "LOCAL_SCENE_ACTION_RECORDED");
  assert.equal(stabilizedApproachTurn.value.output.noGameTime, true, "approche stabilisée: aucun temps de jeu");
  assert.equal(stabilizedApproachTurn.value.output.npcPerformance, null, "approche stabilisée: aucune parole PNJ automatique");

  const invalidSpeechAction = await interpret("je la salue, et je lui demande ce qu'il ce passe", invalidSpeechActionConfig());
  assert.equal(invalidSpeechAction.usedAiInterpretation, false, "parole avec action force rejetee");
  assert.equal(invalidSpeechAction.usedFallback, false, "aucun fallback narratif sur action de parole incoherente");
  assert.equal(invalidSpeechAction.interpretationFailure?.category, "AI_OUTPUT_INVALID");

  const approachOnly = await runControllerApproachOnlyCase();
  assert.equal(approachOnly.output.interpretation.intentType, "action", "approche seule: action locale attendue");
  assert.equal(approachOnly.output.resolution.resultKind, "COMMIT_APPLIED", "approche seule: action locale bornée exécutée");
  assert.equal(approachOnly.output.resolution.preparedEffects[0]?.effectType, "LOCAL_SCENE_ACTION_RECORDED", "approche seule: effet local attendu");
  assert.equal(approachOnly.output.noCommit, false, "approche seule: commit local attendu");
  assert.equal(approachOnly.output.npcPerformance, null, "approche seule: aucune réaction PNJ automatique");
  assert.equal(approachOnly.output.displayPacket.displayBlocks.some(block => block.kind === "NPC_SPEECH"), false, "approche seule: aucune réplique PNJ");
  assert.equal(approachOnly.output.displayPacket.displayBlocks.some(block => /Parole enregistrée/u.test(block.text)), false, "approche seule: pas de parole enregistrée");
  assert.equal(approachOnly.output.displayPacket.displayBlocks.some(block => /Action locale enregistrée/u.test(block.text)), true, "approche seule: notification d'action locale attendue");

  const directedApproach = await runControllerDirectedApproachCase();
  assert.equal(directedApproach.output.interpretation.target?.ref, "npc:npc-garde-blesse", "direction garde: cible visible attendue");
  assert.equal(directedApproach.output.interpretation.runtimeHandling?.requiredDomain, "scene_resolution", "direction garde: domaine scene attendu");
  assert.equal(directedApproach.output.resolution.resultKind, "COMMIT_APPLIED", "direction garde: commit local attendu malgré coreMeaning reformulé");
  assert.deepEqual(
    directedApproach.output.resolution.interpretation.semanticIntent,
    directedApproach.output.interpretation.semanticIntent,
    "direction garde: résolution et contrôleur doivent conserver la même intention sémantique"
  );
  assert.equal(directedApproach.output.resolution.preparedEffects[0]?.effectType, "LOCAL_SCENE_ACTION_RECORDED", "direction garde: effet local attendu");
  assert.equal(directedApproach.output.domainCommand?.commandType, "SCENE_INTERACTION_REQUEST", "direction garde: commande de scène typée attendue");
  assert.equal(directedApproach.output.domainCommand?.commitAuthority, false, "direction garde: la commande ne possède aucune autorité de commit");
  assert.equal(directedApproach.output.resolution.preparedEffects[0]?.sourceCommandId, directedApproach.output.domainCommand?.commandId, "direction garde: l'effet doit citer sa commande source");
  assert.equal(directedApproach.output.mjPlan?.planningBasis.semanticGoal, directedApproach.output.interpretation.semanticIntent.playerGoal, "planner: objectif sémantique canonique attendu");
  assert.notEqual(directedApproach.output.mjPlan?.planningBasis.semanticGoal, directedApproach.output.interpretation.coreMeaning, "planner: coreMeaning legacy ne doit plus faire autorité");

  const approachWaitressThenAsk = await runControllerApproachWaitressThenAskCase();
  assert.equal(approachWaitressThenAsk.approach.output.interpretation.target?.ref, "npc:npc-serveuse-nerveuse", "approche serveuse: cible visible attendue");
  assert.equal(approachWaitressThenAsk.approach.output.resolution.resultKind, "COMMIT_APPLIED", "approche serveuse: commit local attendu");
  assert.equal(approachWaitressThenAsk.ask.output.interpretation.intentType, "speech", "pronom lui après approche: parole attendue");
  assert.equal(approachWaitressThenAsk.ask.output.interpretation.target?.ref, "npc:npc-serveuse-nerveuse", "pronom lui après approche: serveuse attendue");
  assert.notEqual(approachWaitressThenAsk.ask.output.npcPerformance, null, "question à la serveuse: npc_performer attendu");
  assert.equal(approachWaitressThenAsk.ask.output.displayPacket.displayBlocks.some(block => block.kind === "NPC_SPEECH"), true, "question à la serveuse: réponse PNJ attendue");
  assert.equal(approachWaitressThenAsk.ask.output.displayPacket.displayBlocks.some(block =>
    block.kind === "NPC_SPEECH" && /Je vous ai déjà dit/u.test(block.text)
  ), false, "la première parole à la serveuse ne doit pas utiliser la variante de répétition");

  const approachWomanThenAsk = await runControllerApproachWomanThenAskCase();
  assert.equal(approachWomanThenAsk.approach.output.interpretation.target?.ref, "npc:npc-serveuse-nerveuse", "approche femme: serveuse visible attendue");
  assert.equal(approachWomanThenAsk.approach.output.resolution.resultKind, "COMMIT_APPLIED", "approche femme: commit local attendu");
  assert.equal(approachWomanThenAsk.approach.output.displayPacket.displayBlocks.some(block =>
    block.kind === "SYSTEM_NOTICE" && /Cible résolue: Serveuse nerveuse \(npc:npc-serveuse-nerveuse\)/u.test(block.text)
  ), true, "approche femme: notification système doit exposer la cible résolue");
  assert.equal(approachWomanThenAsk.ask.output.interpretation.target?.ref, "npc:npc-serveuse-nerveuse", "pronom lui après femme: serveuse attendue");
  assert.equal(approachWomanThenAsk.ask.output.displayPacket.displayBlocks.some(block =>
    block.kind === "NPC_SPEECH" && block.speaker.displayName === "Serveuse nerveuse"
  ), true, "question après approche femme: réponse de la serveuse attendue");

  const unprefixedWaitress = await runControllerUnprefixedWaitressCase();
  assert.equal(unprefixedWaitress.call.output.interpretation.target?.ref, "npc:npc-serveuse-nerveuse", "appel serveuse IA: ref PNJ canonique attendue");
  assert.equal(unprefixedWaitress.ask.output.interpretation.target?.ref, "npc:npc-serveuse-nerveuse", "question serveuse IA: ref PNJ canonique attendue");
  assert.equal(unprefixedWaitress.ask.output.displayPacket.displayBlocks.some(block =>
    block.kind === "NPC_SPEECH" && block.speaker.displayName === "Serveuse nerveuse"
  ), true, "question serveuse IA: le rendu doit conserver la serveuse, pas le garde");
  assert.equal(unprefixedWaitress.ask.output.sceneState.shortTermNpcMemory.some(memory =>
    memory.actorId === "npc-serveuse-nerveuse"
  ), true, "question serveuse IA: la mémoire courte doit conserver la serveuse");

  const dialogueActConfig = unprefixedWaitressConfig();
  const greeting = await interpret("je la salue", dialogueActConfig);
  assert.equal(greeting.interpretation.semanticIntent.dialogueAct?.act, "INITIATE_CONVERSATION", "salutation: prise de contact attendue");
  const statement = await interpret("je lui dis que j'attends quelqu'un", dialogueActConfig);
  assert.equal(statement.interpretation.semanticIntent.dialogueAct?.act, "MAKE_STATEMENT", "déclaration: acte déclaratif attendu");
  const actionRequest = await interpret("je lui demande de poser le gobelet", dialogueActConfig);
  assert.equal(actionRequest.interpretation.semanticIntent.dialogueAct?.act, "REQUEST_ACTION", "demande d'action: acte dédié attendu");
  const greetingController = await createPrototypeNarrativeTurnControllerV1({ intentInterpreterConfig: dialogueActConfig });
  const greetingTurn = await greetingController.submit({
    schemaVersion: 1,
    clientRequestId: "req-dialogue-act-greeting",
    rawInput: "je la salue"
  });
  if (!greetingTurn.ok) throw new Error(greetingTurn.error.messageKey);
  assert.equal(greetingTurn.value.output.interpretation.semanticIntent.dialogueAct?.act, "INITIATE_CONVERSATION");
  assert.equal(greetingTurn.value.output.displayPacket.displayBlocks.some(block =>
    block.kind === "NPC_SPEECH" && /« Bonjour\. »/u.test(block.text) && !/question|confirmer/iu.test(block.text)
  ), true, "salutation locale: réponse de prise de contact sans question inventée");
  assert.equal(greetingTurn.value.output.displayPacket.displayBlocks.some(block =>
    block.kind === "SYSTEM_NOTICE" && /Acte de dialogue: INITIATE_CONVERSATION/u.test(block.text)
  ), true, "salutation: acte visible dans le diagnostic système");
  let simpleStatementProviderCalls = 0;
  const simpleStatementNpcConfig = createDefaultNpcPerformerConfigV1();
  const simpleStatementController = await createPrototypeNarrativeTurnControllerV1({
    intentInterpreterConfig: dialogueActConfig,
    npcPerformerConfig: {
      ...simpleStatementNpcConfig,
      provider: {
        async generate(request) {
          simpleStatementProviderCalls += 1;
          return simpleStatementNpcConfig.provider.generate(request);
        }
      }
    }
  });
  const simpleStatementTurn = await simpleStatementController.submit({
    schemaVersion: 1,
    clientRequestId: "req-dialogue-act-simple-statement",
    rawInput: "je lui dis bonjour"
  });
  if (!simpleStatementTurn.ok) throw new Error(simpleStatementTurn.error.messageKey);
  assert.equal(simpleStatementTurn.value.output.interpretation.semanticIntent.dialogueAct?.act, "INITIATE_CONVERSATION");
  assert.equal(simpleStatementProviderCalls, 1, "salutation formulée comme déclaration: le npc_performer reste responsable de l'incarnation du PNJ");
  assert.equal(simpleStatementTurn.value.output.displayPacket.displayBlocks.some(block =>
    block.kind === "NPC_SPEECH" && /Bonjour/u.test(block.text) && !/question|confirmer/iu.test(block.text)
  ), true, "salutation formulée comme déclaration: réponse de prise de contact sans question inventée");
  const failingPlannerBaseConfig = createDefaultMjPlannerConfigV1();
  let performerCallsAfterPlannerFailure = 0;
  const performerAfterPlannerFailureConfig = createDefaultNpcPerformerConfigV1();
  const plannerFailureController = await createPrototypeNarrativeTurnControllerV1({
    intentInterpreterConfig: dialogueActConfig,
    mjPlannerConfig: {
      ...failingPlannerBaseConfig,
      provider: {
        async generate() {
          return { invalid: true };
        }
      }
    },
    npcPerformerConfig: {
      ...performerAfterPlannerFailureConfig,
      provider: {
        async generate(request) {
          performerCallsAfterPlannerFailure += 1;
          return performerAfterPlannerFailureConfig.provider.generate(request);
        }
      }
    }
  });
  const plannerFailureTurn = await plannerFailureController.submit({
    schemaVersion: 1,
    clientRequestId: "req-dialogue-planner-failure",
    rawInput: "je la salue"
  });
  if (!plannerFailureTurn.ok) throw new Error(plannerFailureTurn.error.messageKey);
  assert.notEqual(plannerFailureTurn.value.output.mjPlannerFailure, null, "planner distant invalide: échec conservé pour diagnostic");
  assert.equal(plannerFailureTurn.value.output.mjPlan?.actorAssignments.some(assignment => assignment.role === "npc_performer"), true, "planner distant invalide: plan local doit préserver l'assignation PNJ");
  assert.equal(performerCallsAfterPlannerFailure, 1, "planner distant invalide: le npc_performer doit tout de même être appelé");
  assert.equal(plannerFailureTurn.value.output.displayPacket.displayBlocks.some(block =>
    block.kind === "NPC_SPEECH" && /« Bonjour\. »/u.test(block.text)
  ), true, "planner distant invalide: réaction du performer conservée");
  const mismatchedFrameBaseConfig = createDefaultNpcPerformerConfigV1();
  const mismatchedFrameController = await createPrototypeNarrativeTurnControllerV1({
    intentInterpreterConfig: dialogueActConfig,
    npcPerformerConfig: {
      ...mismatchedFrameBaseConfig,
      provider: {
        async generate(request) {
          const generated = await mismatchedFrameBaseConfig.provider.generate(request) as Record<string, unknown>;
          const payload = generated.payload as Record<string, unknown>;
          return {
            ...generated,
            payload: {
              ...payload,
              reactionFrame: {
                ...(payload.reactionFrame as Record<string, unknown>),
                responseMode: "ANSWER_QUESTION"
              }
            }
          };
        }
      }
    }
  });
  const mismatchedFrameTurn = await mismatchedFrameController.submit({
    schemaVersion: 1,
    clientRequestId: "req-dialogue-act-mismatched-frame",
    rawInput: "je lui dis bonjour"
  });
  if (!mismatchedFrameTurn.ok) throw new Error(mismatchedFrameTurn.error.messageKey);
  assert.equal(mismatchedFrameTurn.value.output.npcPerformance, null, "cadre de réaction: mode incompatible rejeté localement");
  assert.equal(mismatchedFrameTurn.value.output.npcPerformanceFailure?.issues.some(issue => /responseMode mismatch/u.test(issue)), true);
  assert.equal(mismatchedFrameTurn.value.output.displayPacket.displayBlocks.some(block =>
    block.kind === "NPC_SPEECH" && /Bonjour/u.test(block.text) && !/question/iu.test(block.text)
  ), true, "cadre rejeté: fallback fondé sur INITIATE_CONVERSATION, jamais sur une question générique");
  assert.equal(mismatchedFrameTurn.value.output.displayPacket.displayBlocks.some(block =>
    block.kind === "SYSTEM_NOTICE" && /Réaction PNJ IA rejetée/u.test(block.text)
  ), true, "cadre rejeté: motif visible dans la notification système");
  const rejectedGreetingController = await createPrototypeNarrativeTurnControllerV1({
    intentInterpreterConfig: dialogueActConfig,
    npcPerformerConfig: dialogueCriticRejectingNpcConfig()
  });
  const rejectedGreetingTurn = await rejectedGreetingController.submit({
    schemaVersion: 1,
    clientRequestId: "req-dialogue-act-greeting-rejected",
    rawInput: "je la salue"
  });
  if (!rejectedGreetingTurn.ok) throw new Error(rejectedGreetingTurn.error.messageKey);
  assert.equal(rejectedGreetingTurn.value.output.npcPerformance, null, "critique: performance incohérente non appliquée");
  assert.notEqual(rejectedGreetingTurn.value.output.npcPerformanceFailure, null, "critique: rejet visible dans la sortie technique");
  assert.equal(rejectedGreetingTurn.value.output.displayPacket.displayBlocks.some(block =>
    block.kind === "NPC_SPEECH" && /« Bonjour\. »/u.test(block.text) && !/question|confirmer/iu.test(block.text)
  ), true, "critique: salutation rejetée remplacée par un fallback de salutation cohérent");

  const approachWoundedManThenAsk = await runControllerApproachWoundedManThenAskCase();
  assert.equal(approachWoundedManThenAsk.approach.output.interpretation.target?.ref, "npc:npc-garde-blesse", "approche homme blessé: garde visible attendu");
  assert.equal(approachWoundedManThenAsk.approach.output.resolution.resultKind, "COMMIT_APPLIED", "approche homme blessé: commit local attendu");
  assert.equal(approachWoundedManThenAsk.approach.output.displayPacket.displayBlocks.some(block =>
    block.kind === "SYSTEM_NOTICE" && /Cible résolue: Garde blessé \(npc:npc-garde-blesse\)/u.test(block.text)
  ), true, "approche homme blessé: notification système doit exposer la cible résolue");
  assert.equal(approachWoundedManThenAsk.ask.output.interpretation.target?.ref, "npc:npc-garde-blesse", "pronom lui après homme blessé: garde attendu");
  assert.equal(approachWoundedManThenAsk.ask.output.displayPacket.displayBlocks.some(block =>
    block.kind === "NPC_SPEECH" && block.speaker.displayName === "Garde blessé"
  ), true, "question après approche homme blessé: réponse du garde attendue");

  const controllerResult = await runControllerSpeechCase();
  assert.equal(controllerResult.output.interpretation.intentType, "speech");
  assert.equal(controllerResult.output.mjPlan?.planningBasis.intentId, controllerResult.output.interpretation.intentId, "mj_planner doit planifier depuis l'intention structurée");
  assert.equal(controllerResult.output.mjPlan?.sceneBeats[0]?.kind, "ACTOR_REACTION_EXPECTED", "parole: réaction PNJ attendue au niveau plan");
  assert.equal(controllerResult.output.mjPlan?.commandProposals.every(proposal => proposal.commitAuthority === false), true, "mj_planner sans autorité de commit");
  assert.equal(controllerResult.output.resolution.resultKind, "COMMIT_APPLIED");
  assert.equal(controllerResult.output.suspendedIntent, null);
  assert.equal(controllerResult.output.noCommit, false);
  assert.equal(controllerResult.output.displayPacket.displayBlocks.some(block =>
    block.kind === "NPC_SPEECH" && /entendu|confirmer|question/u.test(block.text)
  ), true, "la parole claire doit produire une réponse PNJ prudente sans fait hors question");

  const localReferentResult = await runControllerLocalReferentCase();
  assert.equal(localReferentResult.focus.output.interpretation.target?.ref, "poi:back-room-door", "le focus initial doit porter la porte visible");
  assert.equal(localReferentResult.open.output.interpretation.intentType, "action", "l'ellipse doit rester une action");
  assert.equal(localReferentResult.open.output.mjPlan?.sceneBeats[0]?.kind, "LOCAL_ACTION_ATTEMPT", "action locale: beat de tentative attendu");
  assert.equal(localReferentResult.open.output.mjPlan?.forbiddenOutcomes.includes("narrate_unvalidated_success"), true, "planner interdit le succès narré non validé");
  assert.equal(localReferentResult.open.output.interpretation.target?.ref, "poi:back-room-door", "le pronom doit être résolu vers le référent récent");
  assert.equal(localReferentResult.open.output.interpretation.referentResolution?.source, "recent_visible_focus", "la source du référent doit être le focus récent");
  assert.equal(localReferentResult.open.output.resolution.resultKind, "COMMIT_APPLIED", "l'action locale bornée doit être enregistrée");
  assert.equal(localReferentResult.open.output.noCommit, false, "le commit local borné doit être visible côté contrôleur");
  assert.equal(localReferentResult.open.output.resolution.preparedEffects[0]?.effectType, "LOCAL_SCENE_ACTION_RECORDED");
  assert.equal(localReferentResult.open.output.displayPacket.displayBlocks.some(block =>
    /référent visible/u.test(block.text)
  ), true, "le rendu doit expliquer que seul le référent visible est validé");

  const restoredContext = await runRestoredInterpreterContextCase();
  assert.equal(
    Array.isArray(restoredContext.recentSemanticTurns)
      && restoredContext.recentSemanticTurns.length > 0,
    true,
    "un nouveau contrôleur doit restaurer les intentions récentes avant le tour suivant"
  );
  assert.equal(
    restoredContext.result.output.interpretation.target?.ref,
    "npc:npc-garde-blesse",
    "le focus visible restauré doit permettre de comprendre le pronom après rechargement"
  );

  const nonCanonicalAction = await interpret("J'ouvre la porte du fond", nonCanonicalActionConfig());
  assert.equal(nonCanonicalAction.usedAiInterpretation, false, "une action IA non canonique doit etre rejetee");
  assert.equal(nonCanonicalAction.usedFallback, false, "une action IA non canonique ne doit pas degrader vers fallback");
  assert.equal(nonCanonicalAction.interpretationFailure?.category, "AI_OUTPUT_INVALID");

  const noContextOpen = await interpret("je l'ouvre", config);
  assert.equal(noContextOpen.interpretation.intentType, "action", "sans contexte, le sens de l'action reste conservé pendant la clarification");
  assert.equal(noContextOpen.interpretation.requiresClarification, true, "sans referent fiable, clarification obligatoire");

  const incompatibleReferent = await runControllerIncompatibleReferentCase();
  assert.equal(incompatibleReferent.open.output.interpretation.intentType, "action", "le sens engagé reste conservé pendant la clarification de cible");
  assert.equal(incompatibleReferent.open.output.resolution.resultKind, "CLARIFICATION_REQUIRED", "referent incompatible: pas de commit");
  assert.equal(incompatibleReferent.open.output.noCommit, true, "referent incompatible: aucun commit");

  const unsupportedRuntime = await runControllerUnsupportedRuntimeCase();
  assert.equal(unsupportedRuntime.output.interpretation.runtimeHandling?.status, "SUPPORTED_BY_CURRENT_RUNTIME", "suggestion IA volontairement permissive attendue");
  assert.equal(unsupportedRuntime.output.interpretation.runtimeDecision.status, "UNSUPPORTED_DOMAIN", "le registre local doit fermer inventory malgré la suggestion IA");
  assert.equal(unsupportedRuntime.output.interpretation.runtimeDecision.aiSuggestionMatched, false, "la divergence IA/runtime doit être tracée");
  assert.equal(unsupportedRuntime.output.mjPlan?.sceneBeats[0]?.kind, "DOMAIN_BLOCKED", "planner doit arrêter le domaine fermé");
  assert.equal(unsupportedRuntime.output.mjPlan?.planningBasis.requiredDomain, "inventory", "planner doit conserver le domaine requis");
  assert.equal(unsupportedRuntime.output.mjPlan?.creationProposals.length, 0, "planner minimal ne crée rien");
  assert.equal(unsupportedRuntime.output.resolution.resultKind, "HANDOFF_REQUIRED", "domaine runtime non ouvert: handoff requis");
  assert.equal(unsupportedRuntime.output.resolution.handoff?.target, "INVENTORY", "domaine inventory attendu depuis la décision runtime locale");
  assert.equal(unsupportedRuntime.output.noCommit, true, "domaine non ouvert: aucun commit");
  assert.equal(unsupportedRuntime.output.resolution.preparedEffects[0]?.effectType, "BLOCKED_UNOPENED_DOMAIN");
  assert.equal(unsupportedRuntime.output.domainCommand?.commandType, "DOMAIN_HANDOFF_REQUEST", "domaine fermé: commande de handoff typée attendue");
  assert.equal(unsupportedRuntime.output.domainCommand?.commitPolicy, "FORBIDDEN", "domaine fermé: commit interdit dans la commande");

  const validCommand = directedApproach.output.domainCommand;
  assert.notEqual(validCommand, null, "commande valide attendue pour le test de corrélation");
  if (validCommand !== null) {
    const invalidCommand = { ...validCommand, semanticGoal: "objectif altéré" };
    const invalidCommandValidation = validateNarrativeDomainCommandV1(invalidCommand, directedApproach.output.interpretation);
    assert.equal(invalidCommandValidation.ok, false, "une commande désalignée de semanticIntent doit être rejetée");
  }

  const ambiguousReferent = await interpret("je l'ouvre", ambiguousReferentConfig());
  assert.equal(ambiguousReferent.interpretation.intentType, "action", "référent ambigu: sens engagé conservé pendant la clarification");
  assert.equal(ambiguousReferent.interpretation.requiresClarification, true, "referent ambigu: pas de resolution directe");

  console.log("ai-intent-interpretation/1: OK");
}

async function interpret(rawInput: string, config: AiIntentInterpreterConfigV1) {
  return interpretNarrativeInputWithAiV1({
    campaignId: "cmp-ai-intent-test",
    operationId: `op-${Math.abs(hash(rawInput))}`,
    intentId: `intent-${Math.abs(hash(rawInput))}`,
    rawInput,
    config
  });
}

function invalidCommittedPossibilityConfig(): AiIntentInterpreterConfigV1 {
  const config = createDefaultAiIntentInterpreterConfigV1();
  return {
    ...config,
    provider: {
      async generate(request) {
        return {
          schemaVersion: 1,
          contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
          outputId: "output-invalid-possibility",
          callId: request.callId,
          attemptId: request.attemptId,
          packId: request.packId,
          snapshotId: request.snapshotId,
          role: request.role,
          status: "OK",
          payload: {
            rawInputEcho: "Est-ce que je peux voler la bourse du garde ?",
            intents: [{
              intentId: "intent:1",
              order: 1,
              intentType: "possibility_query",
              commitment: "committed",
              target: { kind: "npc", ref: "npc:npc-garde-blesse", label: "garde" },
              action: "steal",
              topic: "voler la bourse du garde",
              coreMeaning: "Le personnage tente de voler la bourse du garde.",
              playerImposedDetails: [],
              openDetails: [],
              forbiddenInterpretations: [],
              requiresClarification: false,
              clarificationQuestion: null,
              riskFlags: [],
              expectedTimeEffect: "NO_GAME_TIME",
              confidence: "high",
              semanticIntent: semanticIntent({
                kind: "hypothetical_action",
                playerGoal: "Demander si voler la bourse du garde serait possible.",
                target: { kind: "npc", ref: "npc:npc-garde-blesse", label: "garde" },
                commitment: "hypothetical",
                evidenceFromInput: ["Est-ce que je peux", "voler la bourse du garde"],
                confidence: "high"
              }),
              runtimeHandling: runtimeHandling({
                status: "SUPPORTED_BY_CURRENT_RUNTIME",
                reason: "Question hypothétique sans commit.",
                requiredDomain: null,
                canonicalActionHint: "ask_possibility",
                noCommit: true,
                noGameTime: true
              })
            }]
          },
          diagnostics: [],
          supersedesOutputId: null
        };
      }
    } satisfies ContractAiProviderV1
  };
}

function invalidUnusableConfig(): AiIntentInterpreterConfigV1 {
  const config = createDefaultAiIntentInterpreterConfigV1();
  return {
    ...config,
    provider: {
      async generate(request) {
        return {
          schemaVersion: 1,
          contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
          outputId: "output-invalid-empty",
          callId: request.callId,
          attemptId: request.attemptId,
          packId: request.packId,
          snapshotId: request.snapshotId,
          role: request.role,
          status: "OK",
          payload: {
            rawInputEcho: "",
            intents: []
          },
          diagnostics: [],
          supersedesOutputId: null
        };
      }
    } satisfies ContractAiProviderV1
  };
}

function invalidImplicitPossibilityConfig(): AiIntentInterpreterConfigV1 {
  const config = createDefaultAiIntentInterpreterConfigV1();
  return {
    ...config,
    provider: {
      async generate(request) {
        return {
          schemaVersion: 1,
          contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
          outputId: "output-invalid-implicit-possibility",
          callId: request.callId,
          attemptId: request.attemptId,
          packId: request.packId,
          snapshotId: request.snapshotId,
          role: request.role,
          status: "OK",
          payload: {
            rawInputEcho: "quel temps fait il ?",
            intents: [{
              intentId: "intent:1",
              order: 1,
              intentType: "possibility_query",
              commitment: "hypothetical",
              target: null,
              action: "ask_possibility",
              topic: "temps actuel",
              coreMeaning: "Demander s'il est possible qu'il fasse beau.",
              playerImposedDetails: [],
              openDetails: [],
              forbiddenInterpretations: [],
              requiresClarification: false,
              clarificationQuestion: null,
              riskFlags: [],
              expectedTimeEffect: "NO_GAME_TIME",
              confidence: "high",
              semanticIntent: semanticIntent({
                kind: "context_question",
                playerGoal: "Demander le temps actuel.",
                target: null,
                commitment: "none",
                evidenceFromInput: ["quel temps fait il"],
                confidence: "high"
              }),
              runtimeHandling: runtimeHandling({
                status: "SUPPORTED_BY_CURRENT_RUNTIME",
                reason: "Question de contexte sans commit.",
                requiredDomain: null,
                canonicalActionHint: "ask",
                noCommit: true,
                noGameTime: true
              })
            }]
          },
          diagnostics: [],
          supersedesOutputId: null
        };
      }
    } satisfies ContractAiProviderV1
  };
}

function invalidApproachRuntimeConfig(): AiIntentInterpreterConfigV1 {
  const config = createDefaultAiIntentInterpreterConfigV1();
  return {
    ...config,
    provider: {
      async generate(request) {
        return {
          schemaVersion: 1,
          contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
          outputId: "output-invalid-approach-runtime",
          callId: request.callId,
          attemptId: request.attemptId,
          packId: request.packId,
          snapshotId: request.snapshotId,
          role: request.role,
          status: "OK",
          payload: {
            rawInputEcho: "je me dirige vers la femme",
            intents: [{
              intentId: "intent:1",
              order: 1,
              intentType: "action",
              commitment: "committed",
              target: { kind: "npc", ref: "npc:npc-serveuse-nerveuse", label: "Serveuse nerveuse" },
              action: "act",
              referentResolution: {
                schemaVersion: 1,
                usedPreviousContext: false,
                source: "current_input",
                resolvedTarget: { kind: "npc", ref: "npc:npc-serveuse-nerveuse", label: "Serveuse nerveuse" },
                evidence: ["je me dirige vers la femme"],
                ambiguity: "none",
                confidence: "high"
              },
              topic: "se placer près de la serveuse",
              coreMeaning: "Le personnage se place près de la serveuse.",
              playerImposedDetails: ["je me dirige vers la femme"],
              openDetails: [],
              forbiddenInterpretations: ["faire parler le PNJ automatiquement"],
              requiresClarification: false,
              clarificationQuestion: null,
              riskFlags: [],
              expectedTimeEffect: "DOMAIN_TO_DECIDE",
              confidence: "high",
              semanticIntent: semanticIntent({
                kind: "nonverbal_signal",
                playerGoal: "Se placer près de la serveuse.",
                target: { kind: "npc", ref: "npc:npc-serveuse-nerveuse", label: "Serveuse nerveuse" },
                commitment: "committed",
                evidenceFromInput: ["je me dirige vers la femme"],
                forbiddenInterpretations: ["faire parler le PNJ automatiquement"],
                confidence: "high"
              }),
              runtimeHandling: runtimeHandling({
                status: "SUPPORTED_BY_CURRENT_RUNTIME",
                reason: "Domaine incohérent volontaire pour test.",
                requiredDomain: "rest",
                canonicalActionHint: "act",
                noCommit: false,
                noGameTime: false
              })
            }]
          },
          diagnostics: [],
          supersedesOutputId: null
        };
      }
    } satisfies ContractAiProviderV1
  };
}

function invalidSpeechActionConfig(): AiIntentInterpreterConfigV1 {
  const config = createDefaultAiIntentInterpreterConfigV1();
  return {
    ...config,
    provider: {
      async generate(request) {
        return {
          schemaVersion: 1,
          contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
          outputId: "output-invalid-speech-action",
          callId: request.callId,
          attemptId: request.attemptId,
          packId: request.packId,
          snapshotId: request.snapshotId,
          role: request.role,
          status: "OK",
          payload: {
            rawInputEcho: "je la salue, et je lui demande ce qu'il ce passe",
            intents: [{
              intentId: "intent:1",
              order: 1,
              intentType: "speech",
              commitment: "committed",
              target: { kind: "npc", ref: "npc:npc-serveuse-nerveuse", label: "Serveuse nerveuse" },
              action: "force",
              referentResolution: {
                schemaVersion: 1,
                usedPreviousContext: true,
                source: "recent_visible_focus",
                resolvedTarget: { kind: "npc", ref: "npc:npc-serveuse-nerveuse", label: "Serveuse nerveuse" },
                evidence: ["je lui demande"],
                ambiguity: "none",
                confidence: "high"
              },
              topic: "ce qu'il se passe",
              coreMeaning: "Le personnage demande à la serveuse ce qu'il se passe.",
              playerImposedDetails: ["je la salue", "je lui demande ce qu'il se passe"],
              openDetails: [],
              forbiddenInterpretations: ["forcer une action", "accorder un succès social"],
              requiresClarification: false,
              clarificationQuestion: null,
              riskFlags: [],
              expectedTimeEffect: "DOMAIN_TO_DECIDE",
              confidence: "high",
              semanticIntent: semanticIntent({
                kind: "address_visible_actor",
                playerGoal: "Demander à la serveuse ce qu'il se passe.",
                target: { kind: "npc", ref: "npc:npc-serveuse-nerveuse", label: "Serveuse nerveuse" },
                commitment: "committed",
                evidenceFromInput: ["je lui demande"],
                forbiddenInterpretations: ["forcer une action", "accorder un succès social"],
                confidence: "high"
              }),
              runtimeHandling: runtimeHandling({
                status: "SUPPORTED_BY_CURRENT_RUNTIME",
                reason: "Parole bornée vers un PNJ visible.",
                requiredDomain: "social",
                canonicalActionHint: "force",
                noCommit: false,
                noGameTime: false
              })
            }]
          },
          diagnostics: [],
          supersedesOutputId: null
        };
      }
    } satisfies ContractAiProviderV1
  };
}

function ambiguousReferentConfig(): AiIntentInterpreterConfigV1 {
  const config = createDefaultAiIntentInterpreterConfigV1();
  return {
    ...config,
    provider: {
      async generate(request) {
        return {
          schemaVersion: 1,
          contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
          outputId: "output-ambiguous-referent",
          callId: request.callId,
          attemptId: request.attemptId,
          packId: request.packId,
          snapshotId: request.snapshotId,
          role: request.role,
          status: "OK",
          payload: {
            rawInputEcho: "je l'ouvre",
            intents: [{
              intentId: "intent:1",
              order: 1,
              intentType: "action",
              commitment: "committed",
              target: { kind: "object", ref: "poi:back-room-door", label: "porte du fond" },
              action: "open",
              referentResolution: {
                schemaVersion: 1,
                usedPreviousContext: true,
                source: "recent_visible_focus",
                resolvedTarget: { kind: "object", ref: "poi:back-room-door", label: "porte du fond" },
                evidence: ["porte du fond", "autre objet visible possible"],
                ambiguity: "multiple_candidates",
                confidence: "medium"
              },
              topic: "ouvrir le referent local",
              coreMeaning: "Le personnage veut ouvrir un referent local ambigu.",
              playerImposedDetails: ["je l'ouvre"],
              openDetails: [],
              forbiddenInterpretations: ["choisir un referent ambigu sans clarification"],
              requiresClarification: false,
              clarificationQuestion: null,
              riskFlags: [],
              expectedTimeEffect: "DOMAIN_TO_DECIDE",
              confidence: "high",
              semanticIntent: semanticIntent({
                kind: "manipulate_visible_object",
                playerGoal: "Ouvrir un référent local ambigu.",
                target: { kind: "object", ref: "poi:back-room-door", label: "porte du fond" },
                commitment: "committed",
                evidenceFromInput: ["je l'ouvre"],
                forbiddenInterpretations: ["choisir un referent ambigu sans clarification"],
                confidence: "medium"
              }),
              runtimeHandling: runtimeHandling({
                status: "SUPPORTED_BY_CURRENT_RUNTIME",
                reason: "Action locale possible si le référent est fiable.",
                requiredDomain: "scene_resolution",
                canonicalActionHint: "open",
                noCommit: false,
                noGameTime: false
              })
            }]
          },
          diagnostics: [],
          supersedesOutputId: null
        };
      }
    } satisfies ContractAiProviderV1
  };
}

function nonCanonicalActionConfig(): AiIntentInterpreterConfigV1 {
  const config = createDefaultAiIntentInterpreterConfigV1();
  return {
    ...config,
    provider: {
      async generate(request) {
        return {
          schemaVersion: 1,
          contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
          outputId: "output-non-canonical-action",
          callId: request.callId,
          attemptId: request.attemptId,
          packId: request.packId,
          snapshotId: request.snapshotId,
          role: request.role,
          status: "OK",
          payload: {
            rawInputEcho: "J'ouvre la porte du fond",
            intents: [{
              intentId: "intent:1",
              order: 1,
              intentType: "action",
              commitment: "committed",
              target: { kind: "object", ref: "poi:back-room-door", label: "porte du fond" },
              action: "ouvrir",
              referentResolution: {
                schemaVersion: 1,
                usedPreviousContext: false,
                source: "current_input",
                resolvedTarget: { kind: "object", ref: "poi:back-room-door", label: "porte du fond" },
                evidence: ["J'ouvre la porte du fond", "porte du fond"],
                ambiguity: "none",
                confidence: "high"
              },
              topic: "ouvrir la porte du fond",
              coreMeaning: "Le personnage tente d'ouvrir la porte du fond.",
              playerImposedDetails: ["J'ouvre la porte du fond"],
              openDetails: [],
              forbiddenInterpretations: ["reveler l'arriere-salle", "faire avancer le temps"],
              requiresClarification: false,
              clarificationQuestion: null,
              riskFlags: [],
              expectedTimeEffect: "DOMAIN_TO_DECIDE",
              confidence: "high",
              semanticIntent: semanticIntent({
                kind: "manipulate_visible_object",
                playerGoal: "Ouvrir la porte du fond.",
                target: { kind: "object", ref: "poi:back-room-door", label: "porte du fond" },
                commitment: "committed",
                evidenceFromInput: ["J'ouvre la porte du fond"],
                forbiddenInterpretations: ["reveler l'arriere-salle", "faire avancer le temps"],
                confidence: "high"
              }),
              runtimeHandling: runtimeHandling({
                status: "SUPPORTED_BY_CURRENT_RUNTIME",
                reason: "Action locale visible.",
                requiredDomain: "scene_resolution",
                canonicalActionHint: "open",
                noCommit: false,
                noGameTime: false
              })
            }]
          },
          diagnostics: [],
          supersedesOutputId: null
        };
      }
    } satisfies ContractAiProviderV1
  };
}

function directedApproachConfig(): AiIntentInterpreterConfigV1 {
  const config = createDefaultAiIntentInterpreterConfigV1();
  return {
    ...config,
    provider: {
      async generate(request) {
        return {
          schemaVersion: 1,
          contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
          outputId: "output-directed-approach",
          callId: request.callId,
          attemptId: request.attemptId,
          packId: request.packId,
          snapshotId: request.snapshotId,
          role: request.role,
          status: "OK",
          payload: {
            rawInputEcho: "je me dirige vers le garde",
            intents: [{
              intentId: "intent:1",
              order: 1,
              intentType: "action",
              commitment: "committed",
              target: { kind: "npc", ref: "npc:npc-garde-blesse", label: "garde" },
              action: "act",
              referentResolution: {
                schemaVersion: 1,
                usedPreviousContext: false,
                source: "current_input",
                resolvedTarget: { kind: "npc", ref: "npc:npc-garde-blesse", label: "garde" },
                evidence: ["je me dirige vers le garde", "garde"],
                ambiguity: "none",
                confidence: "high"
              },
              topic: "se placer près du garde",
              coreMeaning: "Le personnage change de position vers le PNJ visible.",
              playerImposedDetails: ["je me dirige vers le garde"],
              openDetails: [],
              forbiddenInterpretations: ["faire parler le PNJ automatiquement", "résoudre un effet social"],
              requiresClarification: false,
              clarificationQuestion: null,
              riskFlags: [],
              expectedTimeEffect: "DOMAIN_TO_DECIDE",
              confidence: "high",
              semanticIntent: semanticIntent({
                kind: "nonverbal_signal",
                playerGoal: "Se placer près du garde sans parole explicite.",
                target: { kind: "npc", ref: "npc:npc-garde-blesse", label: "garde" },
                commitment: "committed",
                evidenceFromInput: ["je me dirige vers le garde"],
                forbiddenInterpretations: ["faire parler le PNJ automatiquement", "résoudre un effet social"],
                confidence: "high"
              }),
              runtimeHandling: runtimeHandling({
                status: "SUPPORTED_BY_CURRENT_RUNTIME",
                reason: "Positionnement local auprès d'un PNJ visible, sans parole explicite.",
                requiredDomain: "scene_resolution",
                canonicalActionHint: "act",
                noCommit: false,
                noGameTime: true
              })
            }]
          },
          diagnostics: [],
          supersedesOutputId: null
        };
      }
    } satisfies ContractAiProviderV1
  };
}

function unprefixedWaitressConfig(): AiIntentInterpreterConfigV1 {
  const config = createDefaultAiIntentInterpreterConfigV1();
  return {
    ...config,
    provider: {
      async generate(request) {
        const rawInput = String((request.input.task as { rawInput?: unknown }).rawInput ?? "");
        const isActionRequest = /demande de/u.test(rawInput);
        const isStatement = /lui dis/u.test(rawInput);
        const isQuestion = /demande/u.test(rawInput) && !isActionRequest;
        const dialogueAct = isActionRequest ? "REQUEST_ACTION" : isQuestion ? "ASK_QUESTION" : isStatement ? "MAKE_STATEMENT" : "INITIATE_CONVERSATION";
        const playerGoal = isActionRequest
          ? "Demander à la serveuse de poser le gobelet."
          : isQuestion
            ? "Demander à la serveuse si elle va bien."
            : isStatement
              ? "Dire à la serveuse que le personnage attend quelqu'un."
              : "Saluer ou appeler la serveuse.";
        return {
          schemaVersion: 1,
          contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
          outputId: `output-unprefixed-waitress-${isQuestion ? "ask" : "call"}`,
          callId: request.callId,
          attemptId: request.attemptId,
          packId: request.packId,
          snapshotId: request.snapshotId,
          role: request.role,
          status: "OK",
          payload: {
            rawInputEcho: rawInput,
            intents: [{
              intentId: "intent:1",
              order: 1,
              intentType: "speech",
              commitment: "committed",
              target: { kind: "npc", ref: "npc-serveuse-nerveuse", label: "Serveuse nerveuse" },
              action: isQuestion ? "ask" : "act",
              referentResolution: {
                schemaVersion: 1,
                usedPreviousContext: isQuestion,
                source: isQuestion ? "recent_visible_focus" : "current_input",
                resolvedTarget: { kind: "npc", ref: "npc-serveuse-nerveuse", label: "Serveuse nerveuse" },
                evidence: [rawInput],
                ambiguity: "none",
                confidence: "high"
              },
              topic: playerGoal,
              coreMeaning: playerGoal,
              playerImposedDetails: [rawInput],
              openDetails: [],
              forbiddenInterpretations: ["répondre à la place du PNJ", "accorder un succès social"],
              requiresClarification: false,
              clarificationQuestion: null,
              riskFlags: [],
              expectedTimeEffect: "DOMAIN_TO_DECIDE",
              confidence: "high",
              semanticIntent: semanticIntent({
                kind: "address_visible_actor",
                playerGoal,
                target: { kind: "npc", ref: "npc-serveuse-nerveuse", label: "Serveuse nerveuse" },
                commitment: "committed",
                evidenceFromInput: [rawInput],
                forbiddenInterpretations: ["répondre à la place du PNJ", "accorder un succès social"],
                confidence: "high",
                dialogueAct
              }),
              runtimeHandling: runtimeHandling({
                status: "SUPPORTED_BY_CURRENT_RUNTIME",
                reason: "Parole bornée vers un PNJ visible.",
                requiredDomain: "social",
                canonicalActionHint: isQuestion ? "ask" : "act",
                noCommit: false,
                noGameTime: false
              })
            }]
          },
          diagnostics: [],
          supersedesOutputId: null
        };
      }
    } satisfies ContractAiProviderV1
  };
}

function dialogueCriticRejectingNpcConfig(): NpcPerformerConfigV1 {
  const config = createDefaultNpcPerformerConfigV1();
  return {
    ...config,
    coherenceCriticRoute: {
      schemaVersion: 1,
      routeId: "test-npc-dialogue-critic",
      role: "coherence_critic",
      providerKind: "FAKE_CONTRACT",
      providerId: "test",
      modelId: "test-dialogue-critic",
      modelConfigVersion: "test",
      certified: true,
      allowedContractVersions: ["narrative-ai-resolution/1"],
      inputTokenLimit: 1_000,
      outputTokenLimit: 700,
      timeoutMs: 1_000,
      fallbackRouteIds: []
    },
    provider: {
      async generate(request) {
        if (request.role === "coherence_critic") {
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
              verdict: "REJECT",
              findings: [{
                findingId: "dialogue-act-mismatch",
                severity: "BLOCKING",
                category: "PLOT_COHERENCE",
                affectedRefs: ["dialogueAct:INITIATE_CONVERSATION"],
                explanation: "La réplique répond à une question absente de la salutation."
              }],
              correctionConstraints: ["Répondre uniquement à la prise de contact."]
            },
            diagnostics: [],
            supersedesOutputId: null
          };
        }
        const generated = await config.provider.generate(request) as Record<string, unknown>;
        const payload = generated.payload as Record<string, unknown>;
        const utterances = payload.utterances as Array<Record<string, unknown>>;
        return {
          ...generated,
          payload: {
            ...payload,
            utterances: [{
              ...utterances[0],
              text: "La serveuse écoute votre question et refuse de répondre.",
              speechActs: [{
                type: "refusal",
                content: "Elle refuse de répondre à la question.",
                epistemicBasis: "known",
                sourceRefs: (utterances[0]?.speechActs as Array<{ sourceRefs: string[] }>)[0]?.sourceRefs ?? []
              }, {
                type: "assertion",
                content: "Elle prétend qu'une question a été posée.",
                epistemicBasis: "known",
                sourceRefs: (utterances[0]?.speechActs as Array<{ sourceRefs: string[] }>)[0]?.sourceRefs ?? []
              }]
            }]
          }
        };
      }
    }
  };
}

function unsupportedInventoryRuntimeConfig(): AiIntentInterpreterConfigV1 {
  const config = createDefaultAiIntentInterpreterConfigV1();
  return {
    ...config,
    provider: {
      async generate(request) {
        return {
          schemaVersion: 1,
          contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
          outputId: "output-runtime-unsupported-inventory",
          callId: request.callId,
          attemptId: request.attemptId,
          packId: request.packId,
          snapshotId: request.snapshotId,
          role: request.role,
          status: "OK",
          payload: {
            rawInputEcho: "Je glisse deux doigts vers la bourse accrochée à sa ceinture.",
            intents: [{
              intentId: "intent:1",
              order: 1,
              intentType: "action",
              commitment: "committed",
              target: { kind: "object", ref: null, label: "bourse du garde" },
              action: "act",
              referentResolution: {
                schemaVersion: 1,
                usedPreviousContext: false,
                source: "current_input",
                resolvedTarget: { kind: "object", ref: null, label: "bourse du garde" },
                evidence: ["bourse accrochée à sa ceinture"],
                ambiguity: "none",
                confidence: "medium"
              },
              topic: "atteindre la bourse du garde",
              coreMeaning: "Le personnage tente d'interagir avec la bourse portée par le garde.",
              playerImposedDetails: ["Je glisse deux doigts vers la bourse accrochée à sa ceinture."],
              openDetails: ["issue de l'action", "réaction du garde"],
              forbiddenInterpretations: ["accorder l'objet", "résoudre le vol", "modifier l'inventaire"],
              requiresClarification: false,
              clarificationQuestion: null,
              riskFlags: ["inventory_mutation"],
              expectedTimeEffect: "DOMAIN_TO_DECIDE",
              confidence: "high",
              semanticIntent: semanticIntent({
                kind: "manipulate_visible_object",
                playerGoal: "Interagir avec la bourse portée par le garde.",
                target: { kind: "object", ref: null, label: "bourse du garde" },
                commitment: "committed",
                evidenceFromInput: ["glisse deux doigts", "bourse accrochée à sa ceinture"],
                forbiddenInterpretations: ["accorder l'objet", "résoudre le vol", "modifier l'inventaire"],
                confidence: "high"
              }),
              runtimeHandling: runtimeHandling({
                status: "SUPPORTED_BY_CURRENT_RUNTIME",
                reason: "Suggestion IA volontairement permissive pour prouver l'autorité du registre local.",
                requiredDomain: "inventory",
                canonicalActionHint: "act",
                noCommit: false,
                noGameTime: true
              })
            }]
          },
          diagnostics: [],
          supersedesOutputId: null
        };
      }
    } satisfies ContractAiProviderV1
  };
}

async function runRestoredInterpreterContextCase() {
  const clock = new FixedClock();
  const repository = new MemoryCampaignRepository({ clock });
  const campaignId = opaqueId<CampaignId>("cmp-ai-intent-restored-context");
  const clockAggregateId = opaqueId<AggregateId>("agg-ai-intent-restored-context-clock");
  const now = clock.now().toISOString();
  const created = await repository.createCampaign({
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId,
    dependencies: {
      contentPackageId: "prototype.narration",
      contentPackageVersion: 1,
      rulesetId: "prototype.rules",
      rulesetVersion: 1,
      calendarId: "prototype.calendar",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: now,
    updatedAt: now
  }, {
    elapsedGameSeconds: 0,
    calendarId: "prototype.calendar",
    calendarVersion: 1
  });
  if (!created.ok) throw new Error(created.error.messageKey);

  const firstController = new NarrativeTurnControllerV1({
    repository,
    campaignId,
    clock,
    idPrefix: "restored-context:first",
    intentInterpreterConfig: createDefaultAiIntentInterpreterConfigV1()
  });
  const focus = await firstController.submit({
    schemaVersion: 1,
    clientRequestId: "req-restored-context-focus",
    rawInput: "Je regarde le garde blessé."
  });
  if (!focus.ok) throw new Error(focus.error.messageKey);

  const baseConfig = createDefaultAiIntentInterpreterConfigV1();
  let recentSemanticTurns: unknown = null;
  const secondController = new NarrativeTurnControllerV1({
    repository,
    campaignId,
    clock,
    idPrefix: "restored-context:second",
    intentInterpreterConfig: {
      ...baseConfig,
      provider: {
        async generate(request) {
          recentSemanticTurns =
            (request.input.task as { recentSemanticTurns?: unknown })
              .recentSemanticTurns;
          return baseConfig.provider.generate(request);
        }
      }
    }
  });
  const restored = await secondController.restoreRenderedThread();
  if (!restored.ok) throw new Error(restored.error.messageKey);
  const result = await secondController.submit({
    schemaVersion: 1,
    clientRequestId: "req-restored-context-follow-up",
    rawInput: "Je lui demande ce qu'il a vu."
  });
  if (!result.ok) throw new Error(result.error.messageKey);
  return { recentSemanticTurns, result: result.value };
}

async function runControllerSpeechCase() {
  const clock = new FixedClock();
  const repository = new MemoryCampaignRepository({ clock });
  const campaignId = opaqueId<CampaignId>("cmp-ai-intent-controller");
  const clockAggregateId = opaqueId<AggregateId>("agg-ai-intent-clock");
  const now = clock.now().toISOString();
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId,
    dependencies: {
      contentPackageId: "prototype.narration",
      contentPackageVersion: 1,
      rulesetId: "prototype.rules",
      rulesetVersion: 1,
      calendarId: "prototype.calendar",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: now,
    updatedAt: now
  };
  const created = await repository.createCampaign(campaign, {
    elapsedGameSeconds: 0,
    calendarId: "prototype.calendar",
    calendarVersion: 1
  });
  if (!created.ok) throw new Error(created.error.messageKey);

  const controller = new NarrativeTurnControllerV1({
    repository,
    campaignId,
    clock,
    idPrefix: "i06x",
    intentInterpreterConfig: createDefaultAiIntentInterpreterConfigV1()
  });
  const submitted = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-i06x-guard-pronoun",
    rawInput: "Je m’approche du garde et je lui demande s’il a vu quelque chose d’étrange."
  });
  if (!submitted.ok) throw new Error(submitted.error.messageKey);
  return submitted.value;
}

async function runControllerLocalReferentCase() {
  const clock = new FixedClock();
  const repository = new MemoryCampaignRepository({ clock });
  const campaignId = opaqueId<CampaignId>("cmp-ai-intent-referent");
  const clockAggregateId = opaqueId<AggregateId>("agg-ai-intent-referent-clock");
  const now = clock.now().toISOString();
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId,
    dependencies: {
      contentPackageId: "prototype.narration",
      contentPackageVersion: 1,
      rulesetId: "prototype.rules",
      rulesetVersion: 1,
      calendarId: "prototype.calendar",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: now,
    updatedAt: now
  };
  const created = await repository.createCampaign(campaign, {
    elapsedGameSeconds: 0,
    calendarId: "prototype.calendar",
    calendarVersion: 1
  });
  if (!created.ok) throw new Error(created.error.messageKey);

  const controller = new NarrativeTurnControllerV1({
    repository,
    campaignId,
    clock,
    idPrefix: "i06ze",
    intentInterpreterConfig: createDefaultAiIntentInterpreterConfigV1()
  });
  const focus = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-i06ze-focus-door",
    rawInput: "Je me dirige vers la porte du fond"
  });
  if (!focus.ok) throw new Error(focus.error.messageKey);
  const open = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-i06ze-open-it",
    rawInput: "je l'ouvre"
  });
  if (!open.ok) throw new Error(open.error.messageKey);
  return { focus: focus.value, open: open.value };
}

async function runControllerApproachOnlyCase() {
  const controller = await createPrototypeNarrativeTurnControllerV1({
    intentInterpreterConfig: createDefaultAiIntentInterpreterConfigV1()
  });
  const submitted = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-i06zk-approach-only",
    rawInput: "Je m'approche du garde"
  });
  if (!submitted.ok) throw new Error(submitted.error.messageKey);
  return submitted.value;
}

async function runControllerDirectedApproachCase() {
  const controller = await createPrototypeNarrativeTurnControllerV1({ intentInterpreterConfig: directedApproachConfig() });
  const submitted = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-i06zl-directed-approach",
    rawInput: "je me dirige vers le garde"
  });
  if (!submitted.ok) throw new Error(submitted.error.messageKey);
  return submitted.value;
}

async function runControllerApproachWaitressThenAskCase() {
  const controller = await createPrototypeNarrativeTurnControllerV1({
    intentInterpreterConfig: createDefaultAiIntentInterpreterConfigV1()
  });
  const approach = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-i06zl-approach-waitress",
    rawInput: "je m'approche de la serveuse"
  });
  if (!approach.ok) throw new Error(approach.error.messageKey);
  const ask = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-i06zl-ask-waitress",
    rawInput: "je lui demande ce qui ne va pas"
  });
  if (!ask.ok) throw new Error(ask.error.messageKey);
  return { approach: approach.value, ask: ask.value };
}

async function runControllerApproachWomanThenAskCase() {
  const controller = await createPrototypeNarrativeTurnControllerV1({
    intentInterpreterConfig: createDefaultAiIntentInterpreterConfigV1()
  });
  const approach = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-i06zl-approach-woman",
    rawInput: "je m'avance vers la femme"
  });
  if (!approach.ok) throw new Error(approach.error.messageKey);
  const ask = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-i06zl-ask-woman",
    rawInput: "je lui demande comment elle va"
  });
  if (!ask.ok) throw new Error(ask.error.messageKey);
  return { approach: approach.value, ask: ask.value };
}

async function runControllerUnprefixedWaitressCase() {
  const controller = await createPrototypeNarrativeTurnControllerV1({ intentInterpreterConfig: unprefixedWaitressConfig() });
  const call = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-i06zl-call-waitress-unprefixed",
    rawInput: "j'appel la serveuse"
  });
  if (!call.ok) throw new Error(call.error.messageKey);
  const ask = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-i06zl-ask-waitress-unprefixed",
    rawInput: "je lui demande si elle va bien ?"
  });
  if (!ask.ok) throw new Error(ask.error.messageKey);
  return { call: call.value, ask: ask.value };
}

async function runControllerApproachWoundedManThenAskCase() {
  const controller = await createPrototypeNarrativeTurnControllerV1({
    intentInterpreterConfig: createDefaultAiIntentInterpreterConfigV1()
  });
  const approach = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-i06zl-approach-wounded-man",
    rawInput: "je me dirige vers l'homme blessé"
  });
  if (!approach.ok) throw new Error(approach.error.messageKey);
  const ask = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-i06zl-ask-wounded-man",
    rawInput: "je lui demande ce qu'il a"
  });
  if (!ask.ok) throw new Error(ask.error.messageKey);
  return { approach: approach.value, ask: ask.value };
}

async function runControllerUnsupportedRuntimeCase() {
  const clock = new FixedClock();
  const repository = new MemoryCampaignRepository({ clock });
  const campaignId = opaqueId<CampaignId>("cmp-ai-intent-runtime-unsupported");
  const clockAggregateId = opaqueId<AggregateId>("agg-ai-intent-runtime-unsupported-clock");
  const now = clock.now().toISOString();
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId,
    dependencies: {
      contentPackageId: "prototype.narration",
      contentPackageVersion: 1,
      rulesetId: "prototype.rules",
      rulesetVersion: 1,
      calendarId: "prototype.calendar",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: now,
    updatedAt: now
  };
  const created = await repository.createCampaign(campaign, {
    elapsedGameSeconds: 0,
    calendarId: "prototype.calendar",
    calendarVersion: 1
  });
  if (!created.ok) throw new Error(created.error.messageKey);

  const controller = new NarrativeTurnControllerV1({
    repository,
    campaignId,
    clock,
    idPrefix: "i06zg",
    intentInterpreterConfig: unsupportedInventoryRuntimeConfig()
  });
  const submitted = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-i06zg-runtime-inventory",
    rawInput: "Je glisse deux doigts vers la bourse accrochée à sa ceinture."
  });
  if (!submitted.ok) throw new Error(submitted.error.messageKey);
  return submitted.value;
}

async function runControllerIncompatibleReferentCase() {
  const clock = new FixedClock();
  const repository = new MemoryCampaignRepository({ clock });
  const campaignId = opaqueId<CampaignId>("cmp-ai-intent-incompatible-referent");
  const clockAggregateId = opaqueId<AggregateId>("agg-ai-intent-incompatible-clock");
  const now = clock.now().toISOString();
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId,
    dependencies: {
      contentPackageId: "prototype.narration",
      contentPackageVersion: 1,
      rulesetId: "prototype.rules",
      rulesetVersion: 1,
      calendarId: "prototype.calendar",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: now,
    updatedAt: now
  };
  const created = await repository.createCampaign(campaign, {
    elapsedGameSeconds: 0,
    calendarId: "prototype.calendar",
    calendarVersion: 1
  });
  if (!created.ok) throw new Error(created.error.messageKey);

  const controller = new NarrativeTurnControllerV1({
    repository,
    campaignId,
    clock,
    idPrefix: "i06ze-neg",
    intentInterpreterConfig: createDefaultAiIntentInterpreterConfigV1()
  });
  const focus = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-i06ze-focus-waitress",
    rawInput: "Je regarde la serveuse"
  });
  if (!focus.ok) throw new Error(focus.error.messageKey);
  const open = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-i06ze-open-waitress",
    rawInput: "je l'ouvre"
  });
  if (!open.ok) throw new Error(open.error.messageKey);
  return { focus: focus.value, open: open.value };
}

function hash(value: string): number {
  let output = 0;
  for (const char of value) output = ((output << 5) - output + char.charCodeAt(0)) | 0;
  return output;
}

function semanticIntent(input: {
  kind: string;
  playerGoal: string;
  target: { kind: string; ref: string | null; label: string | null } | null;
  commitment: string;
  evidenceFromInput: string[];
  uncertainties?: string[];
  forbiddenInterpretations?: string[];
  confidence: string;
  perception?: { schemaVersion: 1; depth: "GLANCE" | "FOCUSED" | "SEARCH"; focus: string; soughtInformation: string | null } | null;
  dialogueAct?: "INITIATE_CONVERSATION" | "ASK_QUESTION" | "MAKE_STATEMENT" | "REQUEST_ACTION" | "OTHER";
}) {
  return {
    schemaVersion: 1,
    kind: input.kind,
    playerGoal: input.playerGoal,
    target: input.target,
    commitment: input.commitment,
    evidenceFromInput: input.evidenceFromInput,
    uncertainties: input.uncertainties ?? [],
    forbiddenInterpretations: input.forbiddenInterpretations ?? [],
    confidence: input.confidence,
    perception: input.perception ?? null,
    dialogueAct: input.kind === "address_visible_actor"
      ? {
          schemaVersion: 1,
          act: input.dialogueAct ?? "ASK_QUESTION",
          contentGoal: input.playerGoal,
          addresseeRef: input.target?.ref ?? null
        }
      : null
  };
}

function runtimeHandling(input: {
  status: string;
  reason: string;
  requiredDomain: string | null;
  canonicalActionHint: string | null;
  noCommit: boolean;
  noGameTime: boolean;
}) {
  return {
    schemaVersion: 1,
    status: input.status,
    reason: input.reason,
    requiredDomain: input.requiredDomain,
    canonicalActionHint: input.canonicalActionHint,
    noCommit: input.noCommit,
    noGameTime: input.noGameTime
  };
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
