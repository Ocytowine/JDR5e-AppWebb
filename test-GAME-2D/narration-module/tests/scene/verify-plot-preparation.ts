import assert from "node:assert/strict";
import {
  buildPlotPreparationGateV1,
  evaluatePlotPreparationReadinessV1,
  PLOT_PREPARATION_CONTRACT_VERSION_V1,
  type PlotPreparationReadinessInputV1
} from "../../src/application";

function main(): void {
  const gate = buildPlotPreparationGateV1();
  const allCriteria = gate.criteria.map(criterion => criterion.criterionId);

  assert.equal(gate.contractVersion, PLOT_PREPARATION_CONTRACT_VERSION_V1);
  assert.equal(gate.gateId, "i06v-plot-preparation");
  assert.equal(gate.sourceDocRefs.includes("docs/Coherence-intrigues.md"), true);
  assert.equal(gate.criteria.length, 9);
  assert.equal(gate.criteria.every(criterion => criterion.requiredBeforePlotCreation), true);
  assert.equal(gate.forbiddenAtThisStage.includes("texte de vérité cachée"), true);
  assert.equal(gate.forbiddenAtThisStage.includes("création runtime d'intrigue"), true);
  assert.equal(gate.requiredValidatorRefs.includes("coherence_critic"), true);
  assert.equal(gate.requiredValidatorRefs.includes("scene_reveal_gate"), true);

  const ready = evaluatePlotPreparationReadinessV1(input({ satisfiedCriteria: allCriteria }));
  assert.equal(ready.ok, true);
  if (ready.ok) assert.equal(ready.decision, "READY_FOR_FUTURE_PLOT_PROPOSAL_CONTRACT");

  const incomplete = evaluatePlotPreparationReadinessV1(input({
    satisfiedCriteria: allCriteria.filter(criterion => criterion !== "two_independent_clue_paths")
  }));
  assert.equal(incomplete.ok, false);
  if (!incomplete.ok) {
    assert.equal(incomplete.code, "PLOT_PREPARATION_INCOMPLETE");
    assert.deepEqual(incomplete.missingCriteria, ["two_independent_clue_paths"]);
  }

  const secretText = evaluatePlotPreparationReadinessV1(input({
    satisfiedCriteria: allCriteria,
    proposedSecretText: "Le registre disparu est caché sous la troisième arche."
  }));
  assert.equal(secretText.ok, false);
  if (!secretText.ok) assert.equal(secretText.code, "PLOT_SECRET_TEXT_FORBIDDEN");

  const plotSummary = evaluatePlotPreparationReadinessV1(input({
    satisfiedCriteria: allCriteria,
    proposedPlotSummary: "Un archiviste trahit le Collegium pour vendre des actes anciens."
  }));
  assert.equal(plotSummary.ok, false);
  if (!plotSummary.ok) assert.equal(plotSummary.code, "PLOT_CONTENT_FORBIDDEN");

  const clue = evaluatePlotPreparationReadinessV1(input({
    satisfiedCriteria: allCriteria,
    proposedClueTexts: ["Une empreinte de cire rouge mène au coupable."]
  }));
  assert.equal(clue.ok, false);
  if (!clue.ok) assert.equal(clue.code, "PLOT_CONTENT_FORBIDDEN");

  const runtimeCreation = evaluatePlotPreparationReadinessV1(input({
    satisfiedCriteria: allCriteria,
    requestedRuntimeCreation: true
  }));
  assert.equal(runtimeCreation.ok, false);
  if (!runtimeCreation.ok) assert.equal(runtimeCreation.code, "PLOT_RUNTIME_CREATION_FORBIDDEN");

  console.log("plot-preparation-gate/1: OK");
}

function input(overrides: Partial<PlotPreparationReadinessInputV1> = {}): PlotPreparationReadinessInputV1 {
  const gate = buildPlotPreparationGateV1();
  return {
    schemaVersion: 1,
    gate,
    satisfiedCriteria: [],
    proposedSecretText: null,
    proposedPlotSummary: null,
    proposedClueTexts: [],
    requestedRuntimeCreation: false,
    version: 1,
    ...overrides
  };
}

main();
