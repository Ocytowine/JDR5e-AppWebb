import assert from "node:assert/strict";
import {
  buildReferenceSceneBlocksV1,
  buildReferenceSceneLocalNarrationV1,
  buildCompatibleSemanticIntentV1,
  evaluateNarrativeRuntimeDecisionV1,
  type NarrativeIntentInterpretationV1,
  type NarrativeResolutionResultV1
} from "../../src/application";
import type { JsonObject } from "../../src/core";

function interpretation(
  intentType: NarrativeIntentInterpretationV1["intentType"],
  coreMeaning = "intention de test"
): NarrativeIntentInterpretationV1 {
  return {
    schemaVersion: 1,
    contractVersion: "intent-clarification/1",
    intentId: `intent:${intentType}`,
    intentType,
    commitment: intentType === "meta_question" ? "none" : intentType === "possibility_query" ? "hypothetical" : "committed",
    semanticIntent: buildCompatibleSemanticIntentV1({
      intentType,
      commitment: intentType === "meta_question" ? "none" : intentType === "possibility_query" ? "hypothetical" : "committed",
      coreMeaning,
      requiresClarification: false
    }),
    runtimeDecision: evaluateNarrativeRuntimeDecisionV1({
      semanticIntent: buildCompatibleSemanticIntentV1({ intentType, commitment: intentType === "meta_question" ? "none" : intentType === "possibility_query" ? "hypothetical" : "committed", coreMeaning, requiresClarification: false }),
      runtimeSuggestion: null,
      requiresClarification: false
    }),
    coreMeaning,
    requiresClarification: false,
    clarificationQuestion: null,
    expectedTimeEffect: intentType === "meta_question" || intentType === "possibility_query" ? "NO_GAME_TIME" : "DOMAIN_TO_DECIDE",
    safetyNotes: []
  };
}

function resolution(
  resultKind: NarrativeResolutionResultV1["resultKind"],
  interp: NarrativeIntentInterpretationV1
): NarrativeResolutionResultV1 {
  return {
    schemaVersion: 1,
    contractVersion: "narrative-resolution/1",
    resolutionId: `resolution:${interp.intentType}`,
    operationId: `operation:${interp.intentType}`,
    resultKind,
    interpretation: interp as NarrativeIntentInterpretationV1 & JsonObject,
    domainCommand: null,
    characterExpression: null,
    preparedEffects: [],
    handoff: null,
    commitId: resultKind === "COMMIT_PREPARED" ? `commit:${interp.intentType}` : null,
    noGameTime: true,
    safetyNotes: []
  };
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function assertNoGenericFog(text: string, label: string): void {
  assert.equal(
    /\b(tout reste possible|tension palpable|le monde retenait son souffle|choix restent en suspens)\b/u.test(normalize(text)),
    false,
    `${label}: pas de narration générique de remplissage`
  );
}

const weatherIntent = interpretation("meta_question", "demander le temps qu'il fait");
const weather = buildReferenceSceneLocalNarrationV1({
  rawInput: "quelle temps fait il ?",
  interpretation: weatherIntent,
  resolution: resolution("NO_COMMIT_RESPONSE", weatherIntent)
});
assert.match(weather, /pluie|Auberge du Seuil|garde blessé/u);
assertNoGenericFog(weather, "météo");

const riskyPossibilityIntent = interpretation("possibility_query", "demander si voler la bourse est possible");
const riskyPossibility = buildReferenceSceneLocalNarrationV1({
  rawInput: "est-ce que je peux voler la bourse du garde ?",
  interpretation: riskyPossibilityIntent,
  resolution: resolution("NO_COMMIT_RESPONSE", riskyPossibilityIntent)
});
assert.match(riskyPossibility, /possibilité risquée|pas une action encore lancée|garde/u);
assertNoGenericFog(riskyPossibility, "possibilité risquée");

const speechIntent = interpretation("speech", "demander au garde ce qu'il a vu");
const speech = buildReferenceSceneLocalNarrationV1({
  rawInput: "je lui demande s'il a vu quelque chose d'étrange",
  interpretation: speechIntent,
  resolution: resolution("COMMIT_PREPARED", speechIntent)
});
assert.match(speech, /parole|pluie|garde blessé/u);
assertNoGenericFog(speech, "parole");

const mixedIntent = interpretation("mixed", "approcher le garde et lui parler");
const mixedBlocks = buildReferenceSceneBlocksV1({
  operationId: "operation:mixed-quality",
  rawInput: "je m'approche du garde et je lui demande s'il a vu quelque chose d'étrange",
  interpretation: mixedIntent,
  resolution: resolution("RESOLUTION_PROPOSED", mixedIntent)
});
assert.equal(
  mixedBlocks.some(block => block.kind === "NPC_SPEECH" && block.speaker.displayName.includes("Garde")),
  true,
  "une intention sociale mixed doit produire un bloc de dialogue PNJ borné"
);

const weatherBlocks = buildReferenceSceneBlocksV1({
  operationId: "operation:weather-quality",
  rawInput: "quelle temps fait il ?",
  interpretation: weatherIntent,
  resolution: resolution("NO_COMMIT_RESPONSE", weatherIntent)
});
assert.equal(
  weatherBlocks.some(block => block.kind === "GM_NARRATION" && /pluie|Auberge du Seuil/u.test(block.text)),
  true,
  "la météo doit produire une réponse de scène concrète sans commit"
);

const sunnyQuestionIntent = interpretation("meta_question", "demander s'il fait beau aujourd'hui");
const sunnyQuestion = buildReferenceSceneLocalNarrationV1({
  rawInput: "aujourd'hui fait il beau ?",
  interpretation: sunnyQuestionIntent,
  resolution: resolution("NO_COMMIT_RESPONSE", sunnyQuestionIntent)
});
assert.match(sunnyQuestion, /pluie|Auberge du Seuil|garde blessé/u);
assertNoGenericFog(sunnyQuestion, "fait-il beau");

const innDescriptionIntent = interpretation("meta_question", "demander une description de l'auberge");
const innDescription = buildReferenceSceneLocalNarrationV1({
  rawInput: "peux tu me décrire l'auberge ?",
  interpretation: innDescriptionIntent,
  resolution: resolution("NO_COMMIT_RESPONSE", innDescriptionIntent)
});
assert.match(innDescription, /Auberge du Seuil|garde blessé|serveuse|porte du fond/u);
assertNoGenericFog(innDescription, "description auberge");

const innDescriptionBlocks = buildReferenceSceneBlocksV1({
  operationId: "operation:inn-description-quality",
  rawInput: "peux tu me décrire l'auberge ?",
  interpretation: innDescriptionIntent,
  resolution: resolution("NO_COMMIT_RESPONSE", innDescriptionIntent)
});
assert.equal(
  innDescriptionBlocks.some(block => block.kind === "GM_NARRATION" && /Auberge du Seuil|porte du fond/u.test(block.text)),
  true,
  "une question de contexte fictionnel doit produire une narration MJ concrète même sans commit"
);

const guardDescriptionIntent = interpretation("meta_question", "demander une description du garde blessé");
const guardDescription = buildReferenceSceneLocalNarrationV1({
  rawInput: "peut tu décrire le garde ?",
  interpretation: guardDescriptionIntent,
  resolution: resolution("NO_COMMIT_RESPONSE", guardDescriptionIntent)
});
assert.match(guardDescription, /garde blessé|cuirasse|flanc|boue|blessure/u);
assert.equal(/Auberge du Seuil est basse de plafond|salle commune est resserree|auberge de passage tendue/iu.test(guardDescription), false);
assertNoGenericFog(guardDescription, "description garde");

const guardDescriptionBlocks = buildReferenceSceneBlocksV1({
  operationId: "operation:guard-description-quality",
  rawInput: "je te demande de décrire le garde",
  interpretation: guardDescriptionIntent,
  resolution: resolution("NO_COMMIT_RESPONSE", guardDescriptionIntent)
});
assert.equal(
  guardDescriptionBlocks.some(block => block.kind === "GM_NARRATION" && /garde blessé|cuirasse|flanc|boue|blessure/u.test(block.text)),
  true,
  "la description d'un PNJ ciblé doit primer sur la description générale du lieu"
);

const locationNaturalIntent = interpretation("meta_question", "demander où se situe le personnage");
const locationNatural = buildReferenceSceneLocalNarrationV1({
  rawInput: "peut tu me dire ou je suis ?",
  interpretation: locationNaturalIntent,
  resolution: resolution("NO_COMMIT_RESPONSE", locationNaturalIntent)
});
assert.match(locationNatural, /Auberge du Seuil|salle commune|auberge/u);
assertNoGenericFog(locationNatural, "localisation naturelle");

const buildingTypeIntent = interpretation("meta_question", "demander le type de bâtiment");
const buildingType = buildReferenceSceneLocalNarrationV1({
  rawInput: "je suis dans quel type de batiment ?",
  interpretation: buildingTypeIntent,
  resolution: resolution("NO_COMMIT_RESPONSE", buildingTypeIntent)
});
assert.match(buildingType, /auberge de passage|bâtiment public|lieu de halte/u);
assertNoGenericFog(buildingType, "type bâtiment");

console.log("scene-playable-quality/i06za: OK");
