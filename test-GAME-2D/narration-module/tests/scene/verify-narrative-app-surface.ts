import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NarrativeAppSurface } from "../../../src/narration-ui/NarrativeAppSurface";

const surfaceHtml = renderToStaticMarkup(React.createElement(NarrativeAppSurface));

assert.match(surfaceHtml, /Surface dédiée au module narration/, "surface narration rendue");
assert.match(surfaceHtml, /Mode prototype/, "limite prototype affichée");
assert.match(surfaceHtml, /Fil narratif/, "panneau narratif rendu");
assert.match(surfaceHtml, /Saisie narrative libre/, "saisie libre présente");
assert.match(surfaceHtml, /IA narrative/, "sélecteur IA rendu");
assert.match(surfaceHtml, /Locale/, "mode local rendu");
assert.match(surfaceHtml, /OpenAI/, "mode OpenAI rendu");

const narrativeSurfaceSource = readFileSync(resolve("src/narration-ui/NarrativeAppSurface.tsx"), "utf8");
const serverOpenAiClientSource = readFileSync(resolve("src/narration-ui/serverOpenAiEnhancementClient.ts"), "utf8");
const appSource = readFileSync(resolve("src/App.tsx"), "utf8");
const mainSource = readFileSync(resolve("src/main.tsx"), "utf8");

assert.equal(narrativeSurfaceSource.includes("GameBoard"), false, "NarrativeAppSurface ne doit pas importer GameBoard");
assert.equal(narrativeSurfaceSource.includes("createBrowserPersistentNarrativeTurnControllerV1"), true, "surface restaure le fil via le contrôleur persistant");
assert.equal(narrativeSurfaceSource.includes("restoreRenderedThread"), true, "surface recharge les projections de rendu persistées");
assert.equal(narrativeSurfaceSource.includes("player_intent_interpreter"), true, "mode OpenAI configure aussi l'interpreteur d'intention via fournisseur route serveur");
assert.equal(narrativeSurfaceSource.includes("AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1"), true, "contrat intention OpenAI explicite dans la config UI");
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

console.log("narrative-app-surface/1: OK");
