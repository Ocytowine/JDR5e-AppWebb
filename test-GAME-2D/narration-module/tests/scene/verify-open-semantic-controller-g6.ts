import assert from "node:assert/strict";
import { createPrototypeNarrativeTurnControllerV1 } from "../../src/application";
import { OPEN_SEMANTIC_CORPUS_G6 } from "../fixtures/open-semantic-corpus-g6";
import { createSimulatedOpenAiSemanticConfigG6 } from "../fixtures/simulated-openai-semantic-provider-g6";

const CONTROLLER_CASE_IDS = [
  "dialogue-implicit",
  "negated-action",
  "quoted-threat",
  "ambiguous-pronouns",
  "novel-unsupported"
] as const;

async function main(): Promise<void> {
  const selected = OPEN_SEMANTIC_CORPUS_G6.filter(entry => CONTROLLER_CASE_IDS.includes(entry.caseId as typeof CONTROLLER_CASE_IDS[number]));
  assert.equal(selected.length, CONTROLLER_CASE_IDS.length);
  const config = createSimulatedOpenAiSemanticConfigG6(selected);

  for (const corpusCase of selected) {
    const controller = await createPrototypeNarrativeTurnControllerV1({
      intentInterpreterConfig: config,
      mjPlannerConfig: null,
      npcPerformerConfig: null,
      sceneTransitionRuntime: null,
      interpreterCharacterContextResolver: null
    });
    const result = await controller.submit({
      schemaVersion: 1,
      clientRequestId: `g6-controller:${corpusCase.caseId}`,
      rawInput: corpusCase.rawInput
    });
    if (!result.ok) throw new Error(`${corpusCase.caseId}: ${result.error.messageKey}`);
    const interpretation = result.value.output.interpretation;
    assert.equal(interpretation.semanticSource, "OPEN_SEMANTIC_FRAME_V8", corpusCase.caseId);
    assert.equal(interpretation.openSemanticFrame?.overallMeaning, corpusCase.frame.overallMeaning, corpusCase.caseId);
    assert.equal(interpretation.openSemanticFrame?.overallCommitment, corpusCase.expected.overallCommitment, corpusCase.caseId);
    assert.deepEqual(interpretation.openSemanticRuntime?.components.map(component => component.status), corpusCase.expected.dispositions, corpusCase.caseId);
    const hasRoutableOwnerStep = corpusCase.expected.dispositions.includes("ROUTABLE");
    if (!hasRoutableOwnerStep) {
      assert.equal(result.value.output.noCommit, true, `${corpusCase.caseId}: une composante non routable ne doit jamais committer.`);
    }
    assert.equal(result.value.output.noGameTime, true, corpusCase.caseId);
  }

  console.log(`Open semantic controller G6: OK (${selected.length} sorties OpenAI simulées, préflight V8 préservé).`);
}

void main();
