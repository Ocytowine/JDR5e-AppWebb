import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const applicationDirectory = resolve("narration-module/src/application");
const expectedAiEgressBuilders = [
  "aiIntentInterpretation.ts",
  "aiNarrativeEnhancement.ts",
  "catalogPlotCreationRuntime.ts",
  "destinationPlausibilityArbitration.ts",
  "loreGuidedPlaceCandidateGeneration.ts",
  "mjPlanning.ts",
  "npcPerforming.ts",
  "plotCandidateGeneration.ts"
].sort();

const actualAiEgressBuilders = readdirSync(applicationDirectory, {
  withFileTypes: true
})
  .filter(entry => entry.isFile() && entry.name.endsWith(".ts"))
  .map(entry => join(applicationDirectory, entry.name))
  .filter(path => readFileSync(path, "utf8").includes("runAiPipelineCallV1("))
  .map(path => basename(path))
  .sort();

assert.deepEqual(
  actualAiEgressBuilders,
  expectedAiEgressBuilders,
  "every AI egress builder must be added deliberately to the J10 privacy audit"
);

const forbiddenNotebookDependencies = [
  /PlayerPrivateNotebookRepository/u,
  /playerPrivateNotebook/u,
  /privateNotebook/u,
  /notebookDocument/u,
  /notebookTabs/u,
  /from\s+["'][^"']*player-private-notebook[^"']*["']/u
];

for (const relativeDirectory of [
  "narration-module/src/application",
  "narration-module/src/ai",
  "narration-module/src/core/repository"
]) {
  const directory = resolve(relativeDirectory);
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.(?:ts|js)$/u.test(entry.name)) continue;
    const source = readFileSync(join(directory, entry.name), "utf8");
    for (const forbidden of forbiddenNotebookDependencies) {
      assert.equal(
        forbidden.test(source),
        false,
        `${relativeDirectory}/${entry.name} must not depend on the private notebook`
      );
    }
  }
}

console.log(
  `j10a-boundaries: ${actualAiEgressBuilders.length} AI egress builders inventoried; private notebook absent from application, AI and campaign repositories`
);
