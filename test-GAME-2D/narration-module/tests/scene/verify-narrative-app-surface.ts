import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  NarrativeAppSurface,
  createRuntimeFailurePacket,
  narrativeErrorGuidance,
  sanitizePlayerFacingPacketsV1
} from "../../../src/narration-ui/NarrativeAppSurface";
import type { CoreError } from "../../src/core";

const surfaceHtml = renderToStaticMarkup(React.createElement(NarrativeAppSurface));

assert.match(surfaceHtml, /Décris librement ce que ton personnage/, "surface joueur immersive rendue");
assert.match(surfaceHtml, /Auberge du Seuil/, "amorce de scene jouable rendue");
assert.match(surfaceHtml, /scène est ouverte/, "le fil initial attend une intention joueur");
assert.equal(surfaceHtml.includes("La surface narration est pr"), false, "ancien message prototype absent du fil rendu");
assert.equal(surfaceHtml.includes("Mode prototype"), false, "ancienne notification prototype absente du fil rendu");
assert.match(surfaceHtml, /Fil narratif/, "panneau narratif rendu");
assert.match(surfaceHtml, /Saisie narrative libre/, "saisie libre présente");
assert.match(surfaceHtml, /Options techniques/, "accès explicite au mode développeur rendu");
assert.doesNotMatch(surfaceHtml, /IA narrative|Mode local actif|Mode OpenAI actif/, "options techniques masquées par défaut");

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
  context: "Promotion du PNJ",
  includeDiagnostics: true
});
const failureText = failurePacket.displayBlocks[0]?.text ?? "";
assert.match(failureText, /Un élément nécessaire/, "bulle système explique l'erreur");
assert.match(failureText, /Vérifiez la cible/, "bulle système propose une action");
assert.match(failureText, /campaign-npc\.scene-actor-not-found/, "code diagnostic sûr conservé");
assert.equal(failureText.includes("secret player input"), false, "entrée brute privée non exposée");
assert.equal(failureText.includes("secret:hidden-actor"), false, "détail privé non exposé");
assert.match(narrativeErrorGuidance({ ...safeError, code: "IDEMPOTENCY_CONFLICT" }).summary, /contenu différent/);

const immersivePacket = structuredClone(failurePacket);
immersivePacket.displayBlocks = [{
  ...immersivePacket.displayBlocks[0]!,
  blockId: "operation:immersive:gm",
  kind: "GM_NARRATION",
  speaker: {
    ...immersivePacket.displayBlocks[0]!.speaker,
    speakerId: "speaker-gm",
    kind: "GM",
    displayName: "MJ"
  },
  text: "Tu réduis la distance qui te sépare du clerc.",
  sourceRefs: ["ai-output:scene-writer:approach"]
}, {
  ...immersivePacket.displayBlocks[0]!,
  blockId: "operation:immersive:technical-resolution",
  kind: "SYSTEM_NOTICE",
  text: "Action locale enregistrée - effet borné.",
  sourceRefs: ["resolution:operation:immersive", "resolution-kind:COMMIT_APPLIED"]
}];
const playerFacingImmersive = sanitizePlayerFacingPacketsV1([immersivePacket], false)[0]!;
assert.deepEqual(
  playerFacingImmersive.displayBlocks.map(block => block.text),
  ["Tu réduis la distance qui te sépare du clerc."],
  "le joueur ne voit que la narration finale; le diagnostic de résolution reste hors du fil narratif"
);
assert.deepEqual(
  sanitizePlayerFacingPacketsV1([immersivePacket], true)[0]?.displayBlocks.map(block => block.text),
  ["Tu réduis la distance qui te sépare du clerc."],
  "les options techniques ne réinjectent jamais une notice de moteur dans le fil narratif"
);
const historicalClarificationPacket = structuredClone(immersivePacket);
historicalClarificationPacket.displayBlocks = [{
  ...immersivePacket.displayBlocks[1]!,
  kind: "CLARIFICATION",
  text: "Clarification requise - aucun commit\nIntention canonique: address_visible_actor.",
  sourceRefs: ["resolution-kind:CLARIFICATION_REQUIRED"]
}];
const historicalClarification = sanitizePlayerFacingPacketsV1([historicalClarificationPacket], false)[0]!;
assert.equal(historicalClarification.displayBlocks.length, 1);
assert.match(historicalClarification.displayBlocks[0]?.text ?? "", /préciser ton intention/iu);
assert.doesNotMatch(historicalClarification.displayBlocks[0]?.text ?? "", /commit|Intention canonique/iu);

const validationPacket = createRuntimeFailurePacket({
  error: {
    code: "VALIDATION_FAILED",
    category: "VALIDATION",
    retry: "NEVER",
    messageKey: "core.validation.failed",
    details: {
      issues: [
        "/acceptedCommands/0/commandId must match pattern",
        "Aggregate payload exceeds 2097152 bytes (2097153)."
      ]
    },
    incidentId: null
  },
  operationId: "operation:validation-display",
  sceneId: "scene:test",
  context: "Résolution de l'action",
  rawInput: "Je tente une action précise.",
  includeDiagnostics: true
});
assert.equal(validationPacket.displayBlocks[0]?.kind, "RAW_INPUT");
assert.equal(validationPacket.displayBlocks[0]?.text, "Je tente une action précise.");
assert.match(
  validationPacket.displayBlocks[1]?.text ?? "",
  /Détail validation : \/acceptedCommands\/0\/commandId must match pattern/
);
const playerFailurePacket = createRuntimeFailurePacket({
  error: safeError,
  operationId: "operation:player-error-display",
  sceneId: "scene:test",
  context: "Promotion du PNJ"
});
assert.doesNotMatch(playerFailurePacket.displayBlocks[0]?.text ?? "", /campaign-npc|Diagnostic sûr|code=/u, "le joueur ne voit aucun identifiant technique par défaut");

const postCommitFailurePacket = createRuntimeFailurePacket({
  error: safeError,
  operationId: "operation:post-commit-error",
  sourceOperationId: "confirmed-transition",
  sceneId: "scene:destination",
  context: "Composition du monde à l'entrée de scène",
  primaryActionCommitted: true
});
const postCommitFailureText = postCommitFailurePacket.displayBlocks[0]?.text ?? "";
assert.match(
  postCommitFailureText,
  /Action principale confirmée/,
  "un échec secondaire ne contredit pas le commit principal"
);
assert.equal(
  postCommitFailureText.includes("Action non exécutée"),
  false,
  "un échec post-commit ne qualifie pas l'action principale de refusée"
);
assert.equal(
  postCommitFailurePacket.reconstructionRefs.includes(
    "operation:confirmed-transition:confirmed"
  ),
  true,
  "l'échec secondaire référence explicitement l'opération principale confirmée"
);

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
assert.equal(openAiRuntimeConfigSource.includes("buildOpenAiMjPlannerConfigV1"), true, "mode OpenAI configure le MJ planner via la route serveur");
assert.equal(narrativeSurfaceSource.includes("mjPlan: output.mjPlan"), true, "le plan MJ validé est transmis au scene_writer");
assert.equal(narrativeSurfaceSource.includes('campaignId: "cmp-narrative-prototype"'), false, "le scene_writer reçoit l'identité de la campagne active, jamais celle du pilote en dur");
assert.equal(
  narrativeSurfaceSource.match(/\.processAutomaticBoundaries\(/gu)?.length ?? 0,
  6,
  "monde, transition, repos, tactique et reprise passent par l'orchestration automatique commune"
);
assert.equal(narrativeSurfaceSource.includes("processActiveCausalSceneBoundary"), false, "aucun appel causal dispersé ne reste dans la surface");
assert.equal(narrativeSurfaceSource.includes("processActiveSceneEntrySocialBoundary"), false, "aucun appel social d'entrée dispersé ne reste dans la surface");
assert.equal(narrativeSurfaceSource.includes("processActiveLocalTimeSocialBoundary"), false, "aucun appel social temporel dispersé ne reste dans la surface");
assert.equal(openAiRuntimeConfigSource.includes("AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6"), true, "contrat V6 des demandes libres au compagnon explicite dans la config UI partagée");
assert.equal(narrativeSurfaceSource.includes("REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1"), true, "amorce UI issue du PlayableSceneStateV1 de reference");
assert.equal(
  narrativeSurfaceSource.includes("setOpeningScene(result.value.output.sceneArrival.scene)"),
  false,
  "une arrivée ne doit jamais réécrire rétroactivement la scène d'ouverture du fil"
);
assert.equal(
  narrativeSurfaceSource.includes("setCurrentScene(result.value.output.sceneArrival.scene)"),
  true,
  "une arrivée met à jour la scène courante séparément de l'ouverture immuable"
);
assert.equal(narrativeSurfaceSource.includes("applyNarrativePresentationVariationV1"), true, "surface délègue la variation de présentation au service applicatif");
assert.equal(narrativeSurfaceSource.includes("function applyLocalPresentationVariation"), false, "surface ne doit pas porter la logique de variation en local");
assert.equal(narrativeSurfaceSource.includes("function countPriorMetaAnswerBlocks"), false, "surface ne doit pas compter elle-même les réponses de contexte");
assert.equal(narrativeSurfaceSource.includes("OpenAI appelé, mais aucune narration utilisable"), true, "surface distingue un appel OpenAI sans bloc MJ exploitable d'un non-appel");
assert.equal(narrativeSurfaceSource.includes("RENDER_AUTHORITY_REJECTION"), true, "surface distingue un rejet sémantique contrôlé d'une panne OpenAI");
assert.equal(narrativeSurfaceSource.includes("Texte IA candidat rejeté par la frontière d'autorité"), true, "surface explique le maintien du rendu autorisé sans faux diagnostic serveur");
assert.equal(narrativeSurfaceSource.includes("Réaction PNJ IA indisponible ou rejetée : réaction locale bornée conservée"), true, "surface rend visible le repli du performer PNJ");
assert.equal(narrativeSurfaceSource.includes("setEnhancementStatus"), false, "le ruban de mode ne conserve plus le diagnostic du dernier tour");
assert.equal(narrativeSurfaceSource.includes("Diagnostic sûr :"), true, "les erreurs runtime rejoignent une bulle système expurgée");
assert.equal(narrativeSurfaceSource.includes("function appendNarrativeSystemTrace"), false, "aucune trace technique ne peut plus être injectée dans le fil joueur");
assert.equal(narrativeSurfaceSource.includes("buildNarrativeTechnicalDiagnosticV1"), true, "le diagnostic structuré alimente le panneau développeur séparé");
assert.equal(narrativeSurfaceSource.includes("interpretation-routing-resolution-presentation"), true, "les quatre étapes du diagnostic sont annoncées séparément");
assert.equal(narrativeSurfaceSource.includes("separate-developer-panel"), true, "la surface marque explicitement l'isolation du diagnostic technique");
assert.equal(narrativeSurfaceSource.includes("const packetBeforeProjection = enhancement.displayPacket"), true, "la projection persistée reste sans trace développeur ajoutée");
assert.equal(narrativeSurfaceSource.includes("sanitizePlayerFacingPacketsV1"), true, "les anciennes traces persistées sont filtrées côté joueur");
assert.equal(turnControllerSource.includes("input.change.aiTelemetry"), true, "les métriques du scene_creator suivent le changement de scène jusqu'à la sortie contrôleur");
assert.equal(
  narrativeSurfaceSource.includes("output.sceneArrival !== null && output.activeScene.sceneId !== output.sceneArrival.scene.sceneId"),
  true,
  "le writer post-commit est refusé seulement si la scène active ne correspond pas à la destination"
);
assert.equal(presentationVariationSource.includes("presentation-variant:"), true, "projection tracée avec variante de présentation dans le service applicatif");
assert.equal(mainSource.includes("GameBoard"), false, "main.tsx ne doit plus monter GameBoard directement");
assert.equal(appSource.includes("from \"./GameBoard\""), true, "App.tsx monte GameBoard seulement comme surface tactique");
assert.equal(appSource.includes("<GameBoard"), true, "surface tactique explicite");
assert.equal(appSource.includes("<NarrativeAppSurface"), true, "surface narration explicite");
assert.equal(appSource.includes("<CampaignGateway"), true, "porte d’entrée campagne explicite");
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
