import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as {
  scripts: Record<string, string>;
};
const matrix = readFileSync(
  resolve("narration-module/docs/Matrice-certification-transverse-J10H6.md"),
  "utf8"
);
const continuousSource = readFileSync(
  resolve("narration-module/tests/scene/verify-j9b-full-local-gate.ts"),
  "utf8"
);
const focusSource = readFileSync(
  resolve("narration-module/src/application/localInteractionFocus.ts"),
  "utf8"
);

const matrixRows = [
  "dialogue → inventaire",
  "dialogue → mission",
  "dialogue → intrigue",
  "dialogue → voyage",
  "dialogue → tactique"
];
for (const row of matrixRows) assert.match(matrix, new RegExp(escapeRegExp(row), "u"));

const requiredScripts = [
  "narration-module:test:j10h5-diagnostics",
  "narration-module:test:complete-conversations",
  "narration-module:test:knowledge-claims",
  "narration-module:test:plot-authority",
  "narration-module:test:plot-candidate-j5",
  "narration-module:test:mission-dialogue-j4",
  "narration-module:test:mission-relation-authority",
  "narration-module:test:companion-j7",
  "narration-module:test:j10c-companions",
  "narration-module:test:inventory-access",
  "narration-module:test:inventory-commerce-j3",
  "narration-module:test:j10b-travel",
  "narration-module:test:narrative-rest-runtime",
  "narration-module:test:world-scene-events",
  "narration-module:test:tactical-access",
  "narration-module:test:tactical-rest-handoff",
  "narration-module:test:tactical-checkpoint",
  "narration-module:test:j9b-full-local",
  "narration-module:test:j10h1-submission",
  "narration-module:test:indexeddb",
  "narration-module:test:j9c-browser"
];
for (const script of requiredScripts) {
  assert.equal(typeof packageJson.scripts[script], "string", `script H6 manquant: ${script}`);
}

const dialogueIndex = continuousSource.indexOf("j9b:dialogue:archivist");
const inventoryIndex = continuousSource.indexOf("j9b:inventory:give");
const missionIndex = continuousSource.indexOf("j9b:recruitment");
const plotIndex = continuousSource.indexOf("j9b:plot-search");
const travelIndex = continuousSource.indexOf("j9b:travel-departure");
assert.ok(dialogueIndex >= 0 && dialogueIndex < inventoryIndex, "dialogue puis inventaire doivent partager la verticale J9-B");
assert.ok(inventoryIndex < missionIndex && missionIndex < plotIndex && plotIndex < travelIndex, "l'ordre composé J3 à J6 doit rester observable");
assert.match(continuousSource, /const resumed =/u, "la verticale doit restaurer le contrôleur");
assert.match(continuousSource, /await submit\(resumed,/u, "la verticale restaurée doit rejouer les requêtes critiques");
assert.match(focusSource, /TACTICAL_HANDOFF/u, "un handoff tactique doit fermer le focus conversationnel");
assert.match(focusSource, /SCENE_CHANGED/u, "un changement de scène doit fermer le focus conversationnel");

for (const root of [
  "narration-module:test:j10h6-owners",
  "narration-module:test:j10h6-browser",
  "narration-module:test:j10h6-certification"
]) {
  assertNoLiveDependency(root, new Set());
}

console.log("transverse-owner-matrix/J10-H6: OK (5 compositions, autorités, rejeu et zéro commande live)");

function assertNoLiveDependency(scriptName: string, visited: Set<string>): void {
  if (visited.has(scriptName)) return;
  visited.add(scriptName);
  const command = packageJson.scripts[scriptName];
  assert.equal(typeof command, "string", `script introuvable: ${scriptName}`);
  assert.doesNotMatch(scriptName, /openai-live/u, `script live interdit dans H6: ${scriptName}`);
  assert.doesNotMatch(command, /openai-live/u, `commande live interdite dans H6: ${scriptName}`);
  for (const match of command.matchAll(/npm run (?<name>[\w:-]+)/gu)) {
    if (match.groups?.name !== undefined) assertNoLiveDependency(match.groups.name, visited);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
