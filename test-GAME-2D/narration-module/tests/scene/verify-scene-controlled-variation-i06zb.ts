import assert from "node:assert/strict";
import {
  applyNarrativePresentationVariationV1,
  buildReferenceSceneBlocksV1,
  createInitialReferenceSceneStateV1,
  NARRATIVE_PRESENTATION_VARIATION_CONTRACT_VERSION_V1,
  buildCompatibleSemanticIntentV1,
  evaluateNarrativeRuntimeDecisionV1,
  type NarrativeIntentInterpretationV1,
  type NarrativeResolutionResultV1,
  type NarrativeTurnControllerOutputV1
} from "../../src/application";
import type { JsonObject } from "../../src/core";
import type { DisplayPacketV1 } from "../../src/scene";

function interpretation(
  intentType: NarrativeIntentInterpretationV1["intentType"],
  coreMeaning: string
): NarrativeIntentInterpretationV1 {
  return {
    schemaVersion: 1,
    contractVersion: "intent-clarification/1",
    intentId: `intent:${intentType}:${Math.abs(hash(coreMeaning))}`,
    intentType,
    commitment: intentType === "possibility_query" ? "hypothetical" : intentType === "meta_question" ? "none" : "committed",
    semanticIntent: buildCompatibleSemanticIntentV1({
      intentType,
      commitment: intentType === "possibility_query" ? "hypothetical" : intentType === "meta_question" ? "none" : "committed",
      coreMeaning,
      requiresClarification: false
    }),
    runtimeDecision: evaluateNarrativeRuntimeDecisionV1({
      semanticIntent: buildCompatibleSemanticIntentV1({ intentType, commitment: intentType === "possibility_query" ? "hypothetical" : intentType === "meta_question" ? "none" : "committed", coreMeaning, requiresClarification: false }),
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
  operationId: string,
  interp: NarrativeIntentInterpretationV1
): NarrativeResolutionResultV1 {
  return {
    schemaVersion: 1,
    contractVersion: "narrative-resolution/1",
    resolutionId: `${operationId}:resolution`,
    operationId,
    resultKind: "NO_COMMIT_RESPONSE",
    interpretation: interp as NarrativeIntentInterpretationV1 & JsonObject,
    domainCommand: null,
    characterExpression: null,
    preparedEffects: [],
    handoff: null,
    commitId: null,
    noGameTime: true,
    safetyNotes: [],
    perception: null
  };
}

function gmText(operationId: string, rawInput: string, interp: NarrativeIntentInterpretationV1): string {
  const blocks = buildReferenceSceneBlocksV1({
    operationId,
    rawInput,
    interpretation: interp,
    resolution: resolution(operationId, interp)
  });
  const gm = blocks.find(block => block.kind === "GM_NARRATION");
  assert.ok(gm, `${rawInput}: bloc MJ attendu`);
  return gm.text;
}

function packet(operationId: string, rawInput: string, interp: NarrativeIntentInterpretationV1): DisplayPacketV1 {
  return {
    schemaVersion: 1,
    contractVersion: "scene-social-ui/1",
    operationId,
    sceneId: "reference-inn-rain-001",
    displayBlocks: [{
      blockId: `${operationId}:raw`,
      kind: "RAW_INPUT",
      speaker: {
        speakerId: "speaker-player",
        kind: "PLAYER_CHARACTER",
        displayName: "Joueur",
        roleLabel: "Entrée originale",
        ariaLabel: "Entrée originale",
        visualToken: "speaker-player"
      },
      text: rawInput,
      ariaLabel: "Joueur: RAW_INPUT",
      roleLabel: "Entrée originale",
      visualStyleToken: "speaker-player",
      sourceRefs: [`operation:${operationId}:raw`],
      isDegradedFallback: false
    }, ...buildReferenceSceneBlocksV1({
      operationId,
      rawInput,
      interpretation: interp,
      resolution: resolution(operationId, interp)
    })],
    rawInputAccess: { available: true, operationId },
    rhythmDiagnostics: "test",
    reconstructionRefs: [`operation:${operationId}:raw`],
    version: 1
  };
}

function controllerOutput(operationId: string, rawInput: string, interp: NarrativeIntentInterpretationV1): NarrativeTurnControllerOutputV1 {
  const res = resolution(operationId, interp);
  return {
    schemaVersion: 1,
    contractVersion: "narrative-turn-controller/1",
    operationId,
    clientRequestId: `${operationId}:request`,
    noCommit: true,
    noGameTime: true,
    interpretation: interp as NarrativeIntentInterpretationV1 & JsonObject,
    domainCommand: null,
    mjPlan: null,
    mjPlannerFailure: null,
    npcPerformance: null,
    npcPerformanceFailure: null,
    suspendedIntent: null,
    resolution: res,
    sceneState: createInitialReferenceSceneStateV1(),
    displayPacket: packet(operationId, rawInput, interp) as DisplayPacketV1 & JsonObject
  };
}

function assertStableFacts(text: string, requiredFacts: RegExp[], label: string): void {
  for (const fact of requiredFacts) assert.match(text, fact, `${label}: fait stable manquant ${fact}`);
}

function assertNoForbiddenMutation(text: string, label: string): void {
  const normalized = text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  assert.equal(
    /\b(tu reussis|tu echoues|tu prends|tu voles|combat termine|nouveau pnj|indice secret)\b/u.test(normalized),
    false,
    `${label}: la variation ne doit pas inventer de résultat métier`
  );
}

const weatherIntent = interpretation("meta_question", "demander le temps qu'il fait");
const weatherA = gmText("op-weather-1", "quel temps fait il ?", weatherIntent);
const weatherB = gmText("op-weather-2", "quel temps fait il ?", weatherIntent);
assert.notEqual(weatherA, weatherB, "deux demandes météo successives ne doivent pas produire une copie stricte");
assertStableFacts(weatherA, [/pluie|pleut/u, /Auberge du Seuil/u, /garde blessé/u], "météo A");
assertStableFacts(weatherB, [/pluie|pleut/u, /Auberge du Seuil/u, /garde blessé/u], "météo B");
assertNoForbiddenMutation(weatherA, "météo A");
assertNoForbiddenMutation(weatherB, "météo B");

const contextIntent = interpretation("meta_question", "rappeler ce que le personnage voit");
const contextA = gmText("op-context-1", "tu peux me rappeler ce que je vois ?", contextIntent);
const contextB = gmText("op-context-2", "tu peux me rappeler ce que je vois ?", contextIntent);
assert.notEqual(contextA, contextB, "deux rappels de perception ne doivent pas produire une copie stricte");
assertStableFacts(contextA, [/pluie/u, /garde blessé/u, /serveuse/u, /porte du fond/u], "contexte A");
assertStableFacts(contextB, [/pluie/u, /garde blessé/u, /serveuse/u, /porte du fond/u], "contexte B");
assertNoForbiddenMutation(contextA, "contexte A");
assertNoForbiddenMutation(contextB, "contexte B");

const buildingIntent = interpretation("meta_question", "demander le type de bâtiment");
const buildingA = gmText("op-building-1", "je suis dans quel type de batiment ?", buildingIntent);
const buildingB = gmText("op-building-2", "je suis dans quel type de batiment ?", buildingIntent);
assert.notEqual(buildingA, buildingB, "deux demandes sur le type de bâtiment ne doivent pas produire une copie stricte");
assertStableFacts(buildingA, [/auberge/u, /lieu|bâtiment|etablissement|établissement/u], "bâtiment A");
assertStableFacts(buildingB, [/auberge/u, /lieu|bâtiment|etablissement|établissement/u], "bâtiment B");
assertNoForbiddenMutation(buildingA, "bâtiment A");
assertNoForbiddenMutation(buildingB, "bâtiment B");

const outputA = controllerOutput("op-presentation-a", "tu peux me rappeler ce que je vois ?", contextIntent);
const outputB = controllerOutput("op-presentation-b", "tu peux me rappeler ce que je vois ?", contextIntent);
const variedA = applyNarrativePresentationVariationV1({
  schemaVersion: 1,
  displayPacket: outputA.displayPacket,
  output: outputA,
  priorPackets: []
});
const variedB = applyNarrativePresentationVariationV1({
  schemaVersion: 1,
  displayPacket: outputB.displayPacket,
  output: outputB,
  priorPackets: [variedA.displayPacket]
});
assert.equal(variedA.contractVersion, NARRATIVE_PRESENTATION_VARIATION_CONTRACT_VERSION_V1);
assert.equal(variedA.applied, true, "variation applicative appliquée au premier paquet de contexte");
assert.equal(variedA.variantIndex, 0);
assert.equal(variedB.variantIndex, 1);
const variedTextA = variedA.displayPacket.displayBlocks.find(block => block.kind === "GM_NARRATION")?.text ?? "";
const variedTextB = variedB.displayPacket.displayBlocks.find(block => block.kind === "GM_NARRATION")?.text ?? "";
assert.notEqual(variedTextA, variedTextB, "le service applicatif varie selon l'historique visible");
assert.equal(variedB.displayPacket.reconstructionRefs.includes("presentation-variant:1"), true);

const aiPacket = {
  ...outputA.displayPacket,
  displayBlocks: outputA.displayPacket.displayBlocks.map(block =>
    block.kind === "GM_NARRATION"
      ? { ...block, text: "Texte IA conservé.", sourceRefs: [...block.sourceRefs, "ai-output:test-scene-writer"] }
      : block
  )
};
const preservedAi = applyNarrativePresentationVariationV1({
  schemaVersion: 1,
  displayPacket: aiPacket,
  output: outputA,
  priorPackets: []
});
assert.equal(preservedAi.applied, false, "la variation locale ne doit pas écraser une narration déjà enrichie par IA");
assert.equal(preservedAi.displayPacket.displayBlocks.find(block => block.kind === "GM_NARRATION")?.text, "Texte IA conservé.");

console.log("scene-controlled-variation/i06zb: OK");

function hash(value: string): number {
  let output = 0;
  for (const char of value) output = ((output << 5) - output + char.charCodeAt(0)) | 0;
  return output;
}
