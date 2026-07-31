import assert from "node:assert/strict";
import type { AiCallRequestV1, AiRoleOutputEnvelopeV1, AiSemanticIntentPayloadV2, ContractAiProviderV1 } from "../../src/ai";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V2,
  adjudicateContextualActionV1,
  createDefaultAiIntentInterpreterConfigV1,
  interpretNarrativeInputWithAiV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
} from "../../src/application";

const cases: Array<{ input: string; payload: AiSemanticIntentPayloadV2 }> = [
  semanticCase("Je m'approche du garde sans rien dire.", {
    kind: "move_near_visible_actor", commitment: "committed", playerGoal: "Se placer près du garde sans communiquer avec lui.", actionHint: "approcher", domainHint: "scene_resolution", scope: "LOCAL_INTERACTION",
    targetMention: { surface: "du garde", candidateKind: "npc", proposedRef: "npc:npc-garde-blesse", contextLink: "EXPLICIT" }, perception: null, dialogueAct: null, uncertainties: [], clarificationPrompt: null, confidence: "high"
  }),
  semanticCase("J'entre dans l'arrière-salle discrètement.", {
    kind: "traverse_visible_boundary", commitment: "committed", playerGoal: "Franchir discrètement la porte vers l'arrière-salle.", actionHint: "franchir", domainHint: "world", scope: "SCENE_TRANSITION",
    targetMention: { surface: "dans l'arrière-salle", candidateKind: "object", proposedRef: null, contextLink: "EXPLICIT" }, perception: null, dialogueAct: null, uncertainties: [], clarificationPrompt: null, confidence: "high"
  }),
  semanticCase("Je fais comprendre à la serveuse, sans parler, que nous devrions partir.", {
    kind: "nonverbal_signal", commitment: "committed", playerGoal: "Signaler silencieusement à la serveuse qu'un départ serait souhaitable.", actionHint: "signal_depart", domainHint: "scene_resolution", scope: "LOCAL_INTERACTION",
    targetMention: { surface: "à la serveuse", candidateKind: "npc", proposedRef: "npc:npc-serveuse-nerveuse", contextLink: "EXPLICIT" }, perception: null, dialogueAct: null, uncertainties: [], clarificationPrompt: null, confidence: "high"
  }),
  semanticCase("Je demande à celui qui garde une main sur son flanc ce qu'il a vu.", {
    kind: "address_visible_actor", commitment: "committed", playerGoal: "Questionner l'acteur visible qui garde une main sur son flanc sur ce qu'il a vu.", actionHint: "questionner", domainHint: "social", scope: "SOCIAL_EXCHANGE",
    targetMention: { surface: "celui qui garde une main sur son flanc", candidateKind: "npc", proposedRef: "npc:npc-garde-blesse", contextLink: "SCENE_DESCRIPTION" }, perception: null,
    dialogueAct: { act: "ASK_QUESTION", contentGoal: "Savoir ce que cet acteur a vu." }, uncertainties: [], clarificationPrompt: null, confidence: "medium"
  }),
  semanticCase("Si la porte paraît sûre, j'essaie de l'entrouvrir.", {
    kind: "manipulate_visible_object", commitment: "committed", preconditions: ["La porte paraît sûre."], playerGoal: "Entrouvrir la porte visible à condition qu'elle paraisse sûre.", actionHint: "entrouvrir", domainHint: "scene_resolution", scope: "LOCAL_INTERACTION",
    targetMention: { surface: "la porte", candidateKind: "object", proposedRef: "poi:back-room-door", contextLink: "EXPLICIT" }, perception: null, dialogueAct: null,
    uncertainties: ["La condition de sûreté doit être évaluée avant la tentative."], clarificationPrompt: null, confidence: "high"
  }),
  semanticCase("Je fais semblant de partir, puis je surveille sa réaction du coin de l'œil.", {
    kind: "observe_environment", commitment: "committed", playerGoal: "Feindre un départ tout en surveillant discrètement la réaction de la personne récemment ciblée.", actionHint: "observer_reaction", domainHint: "perception", scope: "PERCEPTION",
    targetMention: { surface: "sa réaction", candidateKind: "npc", proposedRef: null, contextLink: "RECENT_FOCUS" },
    perception: { schemaVersion: 1, depth: "FOCUSED", focus: "réaction de la personne récemment ciblée", soughtInformation: "réaction au faux départ" }, dialogueAct: null,
    uncertainties: [], clarificationPrompt: null, confidence: "high"
  }),
  semanticCase("est ce que je percois des gens non loin de moi ?", {
    kind: "observe_environment", commitment: "committed", playerGoal: "Percevoir les personnes présentes à proximité.", actionHint: "observer", domainHint: "perception", scope: "PERCEPTION",
    targetMention: { surface: "des gens non loin de moi", candidateKind: "npc", proposedRef: null, contextLink: "EXPLICIT" },
    perception: { schemaVersion: 1, depth: "GLANCE", focus: "personnes présentes à proximité", soughtInformation: "présences humaines perceptibles alentour" }, dialogueAct: null,
    uncertainties: [], clarificationPrompt: null, confidence: "high"
  })
];

const provider: ContractAiProviderV1 = {
  async generate(request: AiCallRequestV1): Promise<unknown> {
    const rawInput = (request.input.task as { rawInput: string }).rawInput;
    const fixture = cases.find(entry => entry.input === rawInput);
    if (!fixture) throw new Error(`Fixture V2 absente: ${rawInput}`);
    return {
      schemaVersion: 1, contractVersion: request.contractVersion, outputId: `output:${request.attemptId}`,
      callId: request.callId, attemptId: request.attemptId, packId: request.packId, snapshotId: request.snapshotId,
      role: request.role, status: "OK", payload: fixture.payload, diagnostics: [], supersedesOutputId: null
    } satisfies AiRoleOutputEnvelopeV1<AiSemanticIntentPayloadV2>;
  }
};

async function main(): Promise<void> {
  const base = createDefaultAiIntentInterpreterConfigV1();
  const config = {
    ...base,
    provider,
    contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V2,
    route: { ...base.route, allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V2], outputTokenLimit: 900 }
  };
  const priorTarget = { schemaVersion: 1 as const, sceneId: "reference-inn-rain-001", sceneVersion: 1, target: { kind: "npc" as const, ref: "npc:npc-serveuse-nerveuse", label: "Serveuse nerveuse" }, sourceOperationId: "prior", sourceText: "serveuse", confidence: "high" as const };
  const results = [];
  for (const [index, fixture] of cases.entries()) {
    results.push(await interpretNarrativeInputWithAiV1({ campaignId: "cmp-v2", operationId: `op-v2-${index}`, intentId: `intent-v2-${index}`, rawInput: fixture.input, config, localReferentHints: [priorTarget] }));
  }
  assert.equal(results.every(result => result.usedAiInterpretation && !result.usedFallback), true, JSON.stringify(results.map(result => result.interpretationFailure?.issues ?? [])));
  assert.equal(results[0]?.interpretation.semanticIntent.kind, "move_near_visible_actor");
  assert.equal(results[0]?.interpretation.runtimeDecision.status, "SUPPORTED_BY_CURRENT_RUNTIME");
  assert.equal(results[1]?.interpretation.semanticIntent.kind, "traverse_visible_boundary");
  assert.equal(results[1]?.interpretation.runtimeDecision.status, "UNSUPPORTED_DOMAIN");
  assert.equal(results[2]?.interpretation.semanticIntent.kind, "nonverbal_signal");
  assert.equal(results[2]?.interpretation.target?.ref, "npc:npc-serveuse-nerveuse");
  assert.equal(results[3]?.interpretation.semanticIntent.dialogueAct?.act, "ASK_QUESTION");
  assert.equal(results[4]?.interpretation.semanticIntent.commitment, "conditional");
  assert.deepEqual(results[4]?.interpretation.semanticIntent.preconditions, ["La porte paraît sûre."], "la précondition survit à la stabilisation locale de l'engagement");
  assert.equal(results[4]?.interpretation.action, "entrouvrir", "un concept d'action inédit traverse le V2 sans liste fermée");
  assert.equal(results[5]?.interpretation.target?.ref, "npc:npc-serveuse-nerveuse", "une ellipse peut utiliser le focus récent validé");
  assert.equal(results[6]?.interpretation.semanticIntent.kind, "observe_environment");
  assert.equal(results[6]?.interpretation.referentResolution?.resolvedTarget, null, "une population générique n'est pas inventée comme référent");
  assert.equal(results[6]?.interpretation.referentResolution?.ambiguity, "none", "une cible perceptive facultative non résolue ne bloque pas l'observation");
  assert.equal(results[6]?.interpretation.requiresClarification, false);
  assert.equal(adjudicateContextualActionV1({
    interpretation: results[6]!.interpretation,
    scene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
  }).disposition, "AUTOMATIC_SUCCESS", "la question perceptive présente atteint effectivement la résolution");
  assert.equal(results.every(result => result.interpretation.runtimeHandling?.noGameTime === true), true);
  const archiveBoundaryScene = {
    ...REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
    sceneId: "wiki-location:archives_de_lysenthe",
    locationName: "Archives de Lysenthe",
    pointsOfInterest: [{
      schemaVersion: 1 as const,
      pointId: "archives_de_lysenthe:poi:2",
      label: "Place des archives",
      visibleDescription: "Un passage visible mène vers place des archives.",
      keywords: ["place des archives", "place_des_archives"],
      destinationAliases: ["place des archives"],
      version: 1 as const
    }]
  };
  const destinationInput = "je me dirige vers la places des Archives";
  const destinationPayload = semanticCase(destinationInput, {
    kind: "move_near_visible_actor",
    commitment: "committed",
    playerGoal: "Se diriger vers la place des Archives.",
    actionHint: "se_diriger",
    domainHint: "scene_resolution",
    scope: "LOCAL_INTERACTION",
    targetMention: {
      surface: "la places des Archives",
      candidateKind: "place",
      proposedRef: "poi:archives_de_lysenthe:poi:2",
      contextLink: "SCENE_DESCRIPTION"
    },
    perception: null,
    dialogueAct: null,
    uncertainties: [],
    clarificationPrompt: null,
    confidence: "high"
  }).payload;
  const destinationResult = await interpretNarrativeInputWithAiV1({
    campaignId: "cmp-player-archives",
    operationId: "op-player-archives-transition",
    intentId: "intent-player-archives-transition",
    rawInput: destinationInput,
    playableScene: archiveBoundaryScene,
    config: {
      ...config,
      provider: {
        async generate(request: AiCallRequestV1): Promise<unknown> {
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
            payload: destinationPayload,
            diagnostics: [],
            supersedesOutputId: null
          } satisfies AiRoleOutputEnvelopeV1<AiSemanticIntentPayloadV2>;
        }
      }
    }
  });
  assert.equal(destinationResult.usedAiInterpretation, true);
  assert.equal(
    destinationResult.interpretation.semanticIntent.kind,
    "traverse_visible_boundary",
    "une destination publique structurée ne doit jamais devenir une approche d'acteur"
  );
  assert.equal(destinationResult.interpretation.runtimeHandling?.requiredDomain, "world");
  assert.equal(
    destinationResult.interpretation.target?.ref,
    "poi:archives_de_lysenthe:poi:2"
  );
  assert.equal(destinationResult.interpretation.requiresClarification, false);
  let retryCalls = 0;
  const retryFixture = cases[0]!;
  const retryConfig = {
    ...config,
    provider: {
      async generate(request: AiCallRequestV1): Promise<unknown> {
        retryCalls += 1;
        if (retryCalls === 1) return {
          schemaVersion: 1, contractVersion: request.contractVersion, outputId: `failed:${request.attemptId}`,
          callId: request.callId, attemptId: request.attemptId, packId: request.packId, snapshotId: request.snapshotId,
          role: request.role, status: "PARTIAL_UNUSABLE", payload: {},
          diagnostics: [{ code: "SERVER_ROUTE_FETCH_FAILED", severity: "BLOCKING", message: "transient", sourceRefs: [`operation:${request.operationId}`] }], supersedesOutputId: null
        };
        return provider.generate(request);
      }
    },
    retryPolicy: { ...config.retryPolicy, maxTechnicalRetries: 1 }
  };
  const retried = await interpretNarrativeInputWithAiV1({ campaignId: "cmp-v2", operationId: "op-v2-retry", intentId: "intent-v2-retry", rawInput: retryFixture.input, config: retryConfig });
  assert.equal(retryCalls, 2, "un incident technique autorise exactement un retry");
  assert.equal(retried.usedAiInterpretation, true, "le retry technique peut récupérer sans fallback narratif");
  console.log("semantic-intent-v2/flexibility: OK (7 formulations ouvertes, perception générique non bloquante)");
}

function semanticCase(
  input: string,
  intent: Omit<AiSemanticIntentPayloadV2["intent"], "preconditions"> & { preconditions?: string[] }
): { input: string; payload: AiSemanticIntentPayloadV2 } {
  return { input, payload: { rawInputEcho: input, intent: { ...intent, preconditions: intent.preconditions ?? [] } } };
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
