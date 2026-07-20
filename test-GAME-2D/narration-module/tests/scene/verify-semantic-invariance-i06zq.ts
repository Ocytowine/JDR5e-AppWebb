import assert from "node:assert/strict";
import type { AiIntentRuntimeHandlingV1, AiStructuredSemanticIntentV1 } from "../../src/ai";
import {
  buildNarrativeDomainCommandV1,
  buildSceneReferentRegistryV1,
  evaluateNarrativeRuntimeDecisionV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  WATCHTOWER_DAWN_PLAYABLE_SCENE_V1,
  type NarrativeIntentInterpretationV1,
  type PlayableSceneStateV1,
  type SceneInteractionCapabilityV1,
  type SceneReferentRegistryV1
} from "../../src/application";

type FamilyId = "speech" | "approach" | "implicit_manipulation" | "observation" | "possibility" | "clarification" | "closed_domain";

interface SemanticInvarianceFamilyV1 {
  schemaVersion: 1;
  familyId: FamilyId;
  formulations: [string, string, string, string, string];
  semanticKind: AiStructuredSemanticIntentV1["kind"];
  semanticGoal: string;
  commitment: AiStructuredSemanticIntentV1["commitment"];
  intentType: NarrativeIntentInterpretationV1["intentType"];
  targetCapability: SceneInteractionCapabilityV1 | null;
  requiredDomain: NonNullable<AiIntentRuntimeHandlingV1["requiredDomain"]> | null;
  requiresClarification: boolean;
  expected: SemanticSystemFingerprintV1;
}

interface SemanticSystemFingerprintV1 {
  semanticKind: AiStructuredSemanticIntentV1["kind"];
  semanticGoal: string;
  commitment: AiStructuredSemanticIntentV1["commitment"];
  targetSlot: string | null;
  runtimeStatus: AiIntentRuntimeHandlingV1["status"];
  runtimeDomain: AiIntentRuntimeHandlingV1["requiredDomain"];
  commandType: string | null;
  commitPolicy: string | null;
  commitAuthority: false | null;
  noGameTime: true;
  forbiddenResults: string[];
}

const MARKET_SCENE: PlayableSceneStateV1 = {
  ...WATCHTOWER_DAWN_PLAYABLE_SCENE_V1,
  sceneId: "market-invariance-001",
  locationName: "Marché des Lanternes",
  presentNpc: [{
    ...WATCHTOWER_DAWN_PLAYABLE_SCENE_V1.presentNpc[0]!,
    actorId: "npc-guide-cuivre",
    displayName: "Guide au manteau cuivre",
    publicRole: "Guide du marché",
    keywords: ["guide", "manteau cuivre"]
  }],
  pointsOfInterest: [{
    ...WATCHTOWER_DAWN_PLAYABLE_SCENE_V1.pointsOfInterest[0]!,
    pointId: "stall-copper-lock",
    label: "Étal au verrou de cuivre",
    keywords: ["étal", "verrou", "cuivre"]
  }]
};

const families: SemanticInvarianceFamilyV1[] = [
  family("speech", [
    "Je demande au garde ce qu'il a vu.",
    "Au garde, je voudrais poser une question sur ce qu'il a vu.",
    "Ce qu'il a vu, j'aimerais que le garde me le raconte.",
    "Je m'adresse à lui : qu'avez-vous aperçu ?",
    "Une question pour le garde, concernant ses observations."
  ], "address_visible_actor", "obtenir le témoignage de l'interlocuteur visible", "committed", "speech", "speech", "social", false,
  expected("address_visible_actor", "obtenir le témoignage de l'interlocuteur visible", "committed", "SUPPORTED_BY_CURRENT_RUNTIME", "social", "SCENE_SPEECH_REQUEST", "DOMAIN_VALIDATED", ["social_success", "secret_reveal"])),
  family("approach", [
    "Je m'approche du garde.",
    "Quelques pas en direction du garde.",
    "Sans parler, je réduis la distance qui nous sépare.",
    "Près de lui, voilà où je me place.",
    "Le garde devant moi ; je viens à sa hauteur."
  ], "nonverbal_signal", "se positionner près de l'interlocuteur visible", "committed", "action", "nonverbal_signal", "scene_resolution", false,
  expected("nonverbal_signal", "se positionner près de l'interlocuteur visible", "committed", "SUPPORTED_BY_CURRENT_RUNTIME", "scene_resolution", "SCENE_INTERACTION_REQUEST", "DOMAIN_VALIDATED", ["npc_reaction", "scene_transition"])),
  family("implicit_manipulation", [
    "Ma main se referme sur la poignée et la tourne.",
    "Du bout des doigts, j'abaisse le mécanisme visible.",
    "Le verrou de la porte, je le fais pivoter.",
    "Sans annoncer mon geste : pression sur le loquet.",
    "Je teste le battant par son mécanisme."
  ], "manipulate_visible_object", "manipuler le mécanisme visible", "committed", "action", "manipulate", "scene_resolution", false,
  expected("manipulate_visible_object", "manipuler le mécanisme visible", "committed", "SUPPORTED_BY_CURRENT_RUNTIME", "scene_resolution", "SCENE_INTERACTION_REQUEST", "DOMAIN_VALIDATED", ["automatic_success", "hidden_reveal", "scene_transition"])),
  family("observation", [
    "J'observe la salle.",
    "Un regard circulaire sur ce qui m'entoure.",
    "Sans bouger, je prends connaissance des lieux.",
    "Les environs d'abord : que puis-je percevoir ?",
    "Je laisse mes yeux parcourir la scène."
  ], "observe_environment", "examiner l'environnement visible", "committed", "action", "observe", "perception", false,
  expected("observe_environment", "examiner l'environnement visible", "committed", "SUPPORTED_BY_CURRENT_RUNTIME", "perception", "PERCEPTION_REQUEST", "FORBIDDEN", ["hidden_reveal", "automatic_discovery"])),
  family("possibility", [
    "Est-ce que je pourrais ouvrir cette porte ?",
    "Cette porte serait-elle ouvrable ?",
    "Sans agir : ai-je la possibilité de passer par là ?",
    "Ouvrir le passage, ce serait envisageable ?",
    "Je m'interroge seulement sur la faisabilité du mécanisme."
  ], "hypothetical_action", "évaluer la possibilité de manipuler l'objet visible", "hypothetical", "possibility_query", "manipulate", "scene_resolution", false,
  expected("hypothetical_action", "évaluer la possibilité de manipuler l'objet visible", "hypothetical", "SUPPORTED_BY_CURRENT_RUNTIME", "scene_resolution", null, null, ["execute_action", "consume_time"])),
  family("clarification", [
    "La porte ?",
    "Et si je le faisais...",
    "Lui, peut-être.",
    "Je pourrais tenter quelque chose avec ça.",
    "Quant à ce mécanisme..."
  ], "unclear_intent", "intention insuffisamment déterminée", "unclear", "unclear_commitment", null, null, true,
  expected("unclear_intent", "intention insuffisamment déterminée", "unclear", "NEEDS_CLARIFICATION", null, null, null, ["execute_without_confirmation"])),
  family("closed_domain", [
    "Je range cet objet dans mon sac.",
    "Dans l'inventaire, cet objet désormais.",
    "Je prends possession de ce qui est devant moi.",
    "Cet objet, je souhaite le conserver sur moi.",
    "Sans le laisser ici, je l'emporte."
  ], "manipulate_visible_object", "transférer l'objet visible dans l'inventaire", "committed", "action", "manipulate", "inventory", false,
  expected("manipulate_visible_object", "transférer l'objet visible dans l'inventaire", "committed", "UNSUPPORTED_DOMAIN", "inventory", "DOMAIN_HANDOFF_REQUEST", "FORBIDDEN", ["inventory_mutation", "automatic_success"])),
];

function main(): void {
  const registries = [REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1, WATCHTOWER_DAWN_PLAYABLE_SCENE_V1, MARKET_SCENE]
    .map(buildSceneReferentRegistryV1);
  assert.equal(families.length, 7);
  for (const familyValue of families) {
    assert.equal(new Set(familyValue.formulations).size, 5, `${familyValue.familyId}: cinq formulations distinctes`);
    for (const registry of registries) {
      const fingerprints = familyValue.formulations.map((rawInput, index) => fingerprint(familyValue, registry, rawInput, index));
      for (const actual of fingerprints) assert.deepEqual(actual, familyValue.expected, `${familyValue.familyId}/${registry.sceneId}: empreinte invariante`);
      assert.equal(new Set(fingerprints.map(value => JSON.stringify(value))).size, 1, `${familyValue.familyId}/${registry.sceneId}: convergence des cinq formulations`);
    }
  }
  const engaged = families.find(entry => entry.familyId === "implicit_manipulation")!;
  const ambiguous = families.find(entry => entry.familyId === "clarification")!;
  assert.notDeepEqual(engaged.expected, ambiguous.expected, "une ambiguïté réelle reste une famille distincte de l'action engagée");
  console.log(`semantic-invariance/i06zq: OK (${families.length} familles, ${registries.length} scènes, ${families.length * registries.length * 5} cas)`);
}

function fingerprint(familyValue: SemanticInvarianceFamilyV1, registry: SceneReferentRegistryV1, rawInput: string, index: number): SemanticSystemFingerprintV1 {
  const targetReferent = familyValue.targetCapability === null
    ? null
    : registry.referents.find(entry =>
      entry.interactionCapabilities.includes(familyValue.targetCapability!) &&
      (familyValue.semanticKind === "address_visible_actor" || familyValue.semanticKind === "nonverbal_signal" ? entry.kind === "npc" : entry.kind === "object")
    ) ?? null;
  assert.equal(familyValue.targetCapability === null || targetReferent !== null, true, `${familyValue.familyId}/${registry.sceneId}: cible compatible disponible`);
  const target = targetReferent === null ? null : { kind: targetReferent.kind, ref: targetReferent.canonicalRef, label: targetReferent.displayName };
  const suggestion = familyValue.requiredDomain === null ? null : runtimeSuggestion(familyValue.requiredDomain);
  const semanticIntent: AiStructuredSemanticIntentV1 = {
    schemaVersion: 1,
    kind: familyValue.semanticKind,
    playerGoal: familyValue.semanticGoal,
    target,
    commitment: familyValue.commitment,
    evidenceFromInput: [rawInput],
    uncertainties: familyValue.requiresClarification ? ["meaning"] : [],
    forbiddenInterpretations: [...familyValue.expected.forbiddenResults],
    confidence: familyValue.requiresClarification ? "medium" : "high",
    perception: familyValue.semanticKind === "observe_environment"
      ? { schemaVersion: 1, depth: "GLANCE", focus: familyValue.semanticGoal, soughtInformation: null }
      : null
  };
  const runtimeDecision = evaluateNarrativeRuntimeDecisionV1({ semanticIntent, runtimeSuggestion: suggestion, requiresClarification: familyValue.requiresClarification });
  const interpretation: NarrativeIntentInterpretationV1 = {
    schemaVersion: 1,
    contractVersion: "intent-clarification/1",
    intentId: `${familyValue.familyId}:${registry.sceneId}:${index}`,
    intentType: familyValue.intentType,
    commitment: familyValue.commitment,
    target,
    action: null,
    semanticIntent,
    runtimeHandling: suggestion,
    runtimeDecision,
    referentResolution: target === null ? null : {
      schemaVersion: 1,
      usedPreviousContext: index === 3,
      source: index === 3 ? "recent_visible_focus" : "current_input",
      resolvedTarget: target,
      evidence: [rawInput],
      ambiguity: "none",
      confidence: "high"
    },
    coreMeaning: `legacy variant ${index}`,
    requiresClarification: familyValue.requiresClarification,
    clarificationQuestion: familyValue.requiresClarification ? "Que veux-tu faire exactement ?" : null,
    expectedTimeEffect: familyValue.commitment === "committed" ? "DOMAIN_TO_DECIDE" : "NO_GAME_TIME",
    safetyNotes: []
  };
  const command = buildNarrativeDomainCommandV1(interpretation);
  return {
    semanticKind: semanticIntent.kind,
    semanticGoal: semanticIntent.playerGoal,
    commitment: semanticIntent.commitment,
    targetSlot: target === null ? null : `$TARGET:${target.kind}`,
    runtimeStatus: runtimeDecision.status,
    runtimeDomain: runtimeDecision.requiredDomain,
    commandType: command?.commandType ?? null,
    commitPolicy: command?.commitPolicy ?? null,
    commitAuthority: command?.commitAuthority ?? null,
    noGameTime: true,
    forbiddenResults: [...semanticIntent.forbiddenInterpretations]
  };
}

function runtimeSuggestion(domain: NonNullable<AiIntentRuntimeHandlingV1["requiredDomain"]>): AiIntentRuntimeHandlingV1 {
  return { schemaVersion: 1, status: domain === "inventory" ? "UNSUPPORTED_DOMAIN" : "SUPPORTED_BY_CURRENT_RUNTIME", reason: "fixture déterministe I-06ZQ", requiredDomain: domain, canonicalActionHint: null, noCommit: domain === "inventory" || domain === "perception", noGameTime: true };
}

function family(
  familyId: FamilyId,
  formulations: SemanticInvarianceFamilyV1["formulations"],
  semanticKind: AiStructuredSemanticIntentV1["kind"],
  semanticGoal: string,
  commitment: AiStructuredSemanticIntentV1["commitment"],
  intentType: NarrativeIntentInterpretationV1["intentType"],
  targetCapability: SceneInteractionCapabilityV1 | null,
  requiredDomain: SemanticInvarianceFamilyV1["requiredDomain"],
  requiresClarification: boolean,
  expectedValue: SemanticSystemFingerprintV1
): SemanticInvarianceFamilyV1 {
  return { schemaVersion: 1, familyId, formulations, semanticKind, semanticGoal, commitment, intentType, targetCapability, requiredDomain, requiresClarification, expected: expectedValue };
}

function expected(
  semanticKind: AiStructuredSemanticIntentV1["kind"], semanticGoal: string, commitment: AiStructuredSemanticIntentV1["commitment"],
  runtimeStatus: AiIntentRuntimeHandlingV1["status"], runtimeDomain: AiIntentRuntimeHandlingV1["requiredDomain"],
  commandType: string | null, commitPolicy: string | null, forbiddenResults: string[]
): SemanticSystemFingerprintV1 {
  return { semanticKind, semanticGoal, commitment, targetSlot: semanticKind === "unclear_intent" ? null : `$TARGET:${semanticKind === "address_visible_actor" || semanticKind === "nonverbal_signal" ? "npc" : "object"}`, runtimeStatus, runtimeDomain, commandType, commitPolicy, commitAuthority: commandType === null ? null : false, noGameTime: true, forbiddenResults };
}

main();
