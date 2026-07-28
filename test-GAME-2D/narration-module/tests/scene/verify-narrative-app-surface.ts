import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  NarrativeAppSurface,
  createRuntimeFailurePacket,
  narrativeErrorGuidance
} from "../../../src/narration-ui/NarrativeAppSurface";
import type { CoreError } from "../../src/core";

const surfaceHtml = renderToStaticMarkup(React.createElement(NarrativeAppSurface));

assert.match(surfaceHtml, /Surface dédiée au module narration/, "surface narration rendue");
assert.match(surfaceHtml, /Auberge du Seuil/, "amorce de scene jouable rendue");
assert.match(surfaceHtml, /scène est ouverte/, "le fil initial attend une intention joueur");
assert.equal(surfaceHtml.includes("La surface narration est pr"), false, "ancien message prototype absent du fil rendu");
assert.equal(surfaceHtml.includes("Mode prototype"), false, "ancienne notification prototype absente du fil rendu");
assert.match(surfaceHtml, /Fil narratif/, "panneau narratif rendu");
assert.match(surfaceHtml, /Saisie narrative libre/, "saisie libre présente");
assert.match(surfaceHtml, /IA narrative/, "sélecteur IA rendu");
assert.match(surfaceHtml, /Locale/, "mode local rendu");
assert.match(surfaceHtml, /OpenAI/, "mode OpenAI rendu");

const safeError: CoreError = {
  code: "NOT_FOUND",
  category: "INTEGRITY",
  retry: "AFTER_REFRESH",
  messageKey: "campaign-npc.scene-actor-not-found",
  details: { rawInput: "secret player input", privateSourceRef: "secret:hidden-actor" },
  incidentId: null
};
const failurePacket = createRuntimeFailurePacket({
  error: safeError,
  operationId: "operation:error-display",
  sceneId: "scene:test",
  context: "Promotion du PNJ"
});
const failureText = failurePacket.displayBlocks[0]?.text ?? "";
assert.match(failureText, /Un élément nécessaire/, "bulle système explique l'erreur");
assert.match(failureText, /Vérifiez la cible/, "bulle système propose une action");
assert.match(failureText, /campaign-npc\.scene-actor-not-found/, "code diagnostic sûr conservé");
assert.equal(failureText.includes("secret player input"), false, "entrée brute privée non exposée");
assert.equal(failureText.includes("secret:hidden-actor"), false, "détail privé non exposé");
assert.match(narrativeErrorGuidance({ ...safeError, code: "IDEMPOTENCY_CONFLICT" }).summary, /contenu différent/);

const narrativeSurfaceSource = readFileSync(resolve("src/narration-ui/NarrativeAppSurface.tsx"), "utf8");
const turnControllerSource = readFileSync(resolve("narration-module/src/application/NarrativeTurnController.ts"), "utf8");
const openAiRuntimeConfigSource = readFileSync(resolve("src/narration-ui/openAiNarrativeRuntimeConfig.ts"), "utf8");
const presentationVariationSource = readFileSync(resolve("narration-module/src/application/presentationVariation.ts"), "utf8");
const serverOpenAiClientSource = readFileSync(resolve("src/narration-ui/serverOpenAiEnhancementClient.ts"), "utf8");
const appSource = readFileSync(resolve("src/App.tsx"), "utf8");
const mainSource = readFileSync(resolve("src/main.tsx"), "utf8");

assert.equal(narrativeSurfaceSource.includes("GameBoard"), false, "NarrativeAppSurface ne doit pas importer GameBoard");
assert.equal(narrativeSurfaceSource.includes("createBrowserPersistentNarrativeTurnControllerV1"), true, "surface restaure le fil via le contrôleur persistant");
assert.equal(narrativeSurfaceSource.includes("restoreRenderedThread"), true, "surface recharge les projections de rendu persistées");
assert.equal(narrativeSurfaceSource.includes("restorePendingSkillCheck"), true, "surface restaure le jet en attente");
assert.equal(narrativeSurfaceSource.includes("restoreSkillCheckResultPackets"), true, "surface restaure les résultats de jets visibles");
assert.equal(narrativeSurfaceSource.includes("rollPendingSkillCheck"), true, "surface utilise la commande explicite de lancer");
assert.equal(openAiRuntimeConfigSource.includes("player_intent_interpreter"), true, "mode OpenAI configure aussi l'interpreteur d'intention via fournisseur route serveur");
assert.equal(openAiRuntimeConfigSource.includes("AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V5"), true, "contrat de composantes ordonnées V5 explicite dans la config UI partagée");
assert.equal(narrativeSurfaceSource.includes("REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1"), true, "amorce UI issue du PlayableSceneStateV1 de reference");
assert.equal(narrativeSurfaceSource.includes("applyNarrativePresentationVariationV1"), true, "surface délègue la variation de présentation au service applicatif");
assert.equal(narrativeSurfaceSource.includes("function applyLocalPresentationVariation"), false, "surface ne doit pas porter la logique de variation en local");
assert.equal(narrativeSurfaceSource.includes("function countPriorMetaAnswerBlocks"), false, "surface ne doit pas compter elle-même les réponses de contexte");
assert.equal(narrativeSurfaceSource.includes("OpenAI appelé, mais aucune narration utilisable"), true, "surface distingue un appel OpenAI sans bloc MJ exploitable d'un non-appel");
assert.equal(narrativeSurfaceSource.includes("RENDER_AUTHORITY_REJECTION"), true, "surface distingue un rejet sémantique contrôlé d'une panne OpenAI");
assert.equal(narrativeSurfaceSource.includes("Texte IA candidat rejeté par la frontière d'autorité"), true, "surface explique le maintien du rendu autorisé sans faux diagnostic serveur");
assert.equal(narrativeSurfaceSource.includes("Réaction PNJ IA indisponible ou rejetée : réaction locale bornée conservée"), true, "surface rend visible le repli du performer PNJ");
assert.equal(narrativeSurfaceSource.includes("setEnhancementStatus"), false, "le ruban de mode ne conserve plus le diagnostic du dernier tour");
assert.equal(narrativeSurfaceSource.includes("Diagnostic du tour:"), true, "les incidents d'enrichissement pertinents rejoignent la notification système du tour");
assert.equal(narrativeSurfaceSource.includes("IA enrichissement ${metric.role}"), true, "la latence de chaque rôle d'enrichissement rejoint la trace système");
assert.equal(narrativeSurfaceSource.includes("Diagnostic sûr :"), true, "les erreurs runtime rejoignent une bulle système expurgée");
assert.equal(narrativeSurfaceSource.includes("Trace système et mémoire"), true, "trace mémoire intégrée à la notification système existante");
assert.equal(narrativeSurfaceSource.includes("total avant affichage"), true, "latence de bout en bout visible dans la notification système");
assert.equal(narrativeSurfaceSource.includes("Détail contrôleur"), true, "latence interne détaillée dans la notification système existante");
assert.equal(narrativeSurfaceSource.includes("output.aiTelemetry"), true, "métriques fournisseur intégrées à la notification système existante");
assert.equal(turnControllerSource.includes("input.change.aiTelemetry"), true, "les métriques du scene_creator suivent le changement de scène jusqu'à la sortie contrôleur");
assert.equal(
  narrativeSurfaceSource.includes("output.sceneArrival !== null && output.activeScene.sceneId !== output.sceneArrival.scene.sceneId"),
  true,
  "le writer post-commit est refusé seulement si la scène active ne correspond pas à la destination"
);
assert.equal(narrativeSurfaceSource.includes("contexte=${metric.contextChars}"), true, "taille du contexte IA visible sans panneau UI séparé");
assert.equal(narrativeSurfaceSource.includes("Répliques PNJ antérieures visibles"), true, "répliques mémorisées visibles sans panneau UI séparé");
assert.equal(narrativeSurfaceSource.includes("Couples intention → réponse"), true, "continuité conversationnelle visible sous forme de couples dans le bloc système");
assert.equal(presentationVariationSource.includes("presentation-variant:"), true, "projection tracée avec variante de présentation dans le service applicatif");
assert.equal(mainSource.includes("GameBoard"), false, "main.tsx ne doit plus monter GameBoard directement");
assert.equal(appSource.includes("from \"./GameBoard\""), true, "App.tsx monte GameBoard seulement comme surface tactique");
assert.equal(appSource.includes("<GameBoard />"), true, "surface tactique explicite");
assert.equal(appSource.includes("<NarrativeAppSurface />"), true, "surface narration explicite");
assert.equal(appSource.includes("Narration"), true, "shell expose la surface narration");
assert.equal(appSource.includes("Tactique"), true, "shell expose la surface tactique");

for (const forbidden of [
  "fetch(",
  "XMLHttpRequest",
  "localStorage",
  "sessionStorage",
  "/api/narration",
  "/api/enemy-ai",
  "/api/enemy-speech",
  "openaiProvider",
  "process.env"
]) {
  assert.equal(narrativeSurfaceSource.includes(forbidden), false, `forbidden side effect in NarrativeAppSurface: ${forbidden}`);
}

assert.equal(serverOpenAiClientSource.includes("/api/narration/enhance-openai"), true, "client OpenAI utilise uniquement la route narrative dédiée");
assert.equal(serverOpenAiClientSource.includes("api.openai.com"), false, "client navigateur ne doit jamais appeler OpenAI directement");
assert.equal(serverOpenAiClientSource.includes("OPENAI_API_KEY"), false, "client navigateur ne doit jamais référencer la clé");
assert.equal(serverOpenAiClientSource.includes("openaiProvider"), false, "client navigateur ne doit pas importer l'adaptateur serveur OpenAI");
assert.equal(serverOpenAiClientSource.includes("data?.output"), true, "client OpenAI relaie l'enveloppe serveur même en HTTP non-OK");
assert.equal(serverOpenAiClientSource.includes("SERVER_ENVELOPE_VALIDATION_"), true, "client OpenAI propage les issues précises de validation serveur dans les diagnostics visibles");

console.log("narrative-app-surface/1: OK");
