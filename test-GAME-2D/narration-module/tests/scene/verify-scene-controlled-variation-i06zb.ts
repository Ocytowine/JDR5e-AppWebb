import assert from "node:assert/strict";
import {
  buildReferenceSceneBlocksV1,
  type NarrativeIntentInterpretationV1,
  type NarrativeResolutionResultV1
} from "../../src/application";
import type { JsonObject } from "../../src/core";

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
    characterExpression: null,
    preparedEffects: [],
    handoff: null,
    commitId: null,
    noGameTime: true,
    safetyNotes: []
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

console.log("scene-controlled-variation/i06zb: OK");

function hash(value: string): number {
  let output = 0;
  for (const char of value) output = ((output << 5) - output + char.charCodeAt(0)) | 0;
  return output;
}
