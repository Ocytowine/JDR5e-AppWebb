import assert from "node:assert/strict";
import {
  interpretNarrativeInputWithAiV1,
  validateCanonicalIntentAuthorityV1
} from "../../src/application";
import {
  OPEN_SEMANTIC_CORPUS_G6,
  OPEN_SEMANTIC_CORPUS_G6_VERSION,
  OPEN_SEMANTIC_CORPUS_RUNTIME_CONTEXT_G6,
  type OpenSemanticCorpusCaseG6
} from "../fixtures/open-semantic-corpus-g6";
import { createSimulatedOpenAiSemanticConfigG6 } from "../fixtures/simulated-openai-semantic-provider-g6";

const REQUIRED_COVERAGE = [
  "dialogue_direct",
  "dialogue_implicit",
  "perception",
  "voyage",
  "inventaire",
  "repos",
  "magie",
  "tactique",
  "compagnon_autonome",
  "question_mj",
  "pronoms",
  "ellipses",
  "negations",
  "citations",
  "conditions",
  "hypotheses",
  "actions_composees",
  "changements_avis",
  "fautes",
  "formulation_inedite"
] as const;

interface SemanticEvaluationProjectionG6 {
  understandingStatus: string;
  overallCommitment: string;
  componentCommitments: string[];
  relations: string[];
  dispositions: string[];
  targetRefs: string[][];
  ambiguityCount: number;
}

async function main(): Promise<void> {
  assert.ok(OPEN_SEMANTIC_CORPUS_G6.length >= 20, "Le corpus permanent G6 doit conserver une couverture large.");
  assert.equal(new Set(OPEN_SEMANTIC_CORPUS_G6.map(entry => entry.caseId)).size, OPEN_SEMANTIC_CORPUS_G6.length);
  assert.equal(new Set(OPEN_SEMANTIC_CORPUS_G6.map(entry => entry.rawInput)).size, OPEN_SEMANTIC_CORPUS_G6.length);
  for (const coverage of REQUIRED_COVERAGE) {
    assert.ok(OPEN_SEMANTIC_CORPUS_G6.some(entry => entry.coverage.includes(coverage)), `Couverture G6 absente : ${coverage}.`);
  }

  const config = createSimulatedOpenAiSemanticConfigG6(OPEN_SEMANTIC_CORPUS_G6);
  const projections = new Map<string, SemanticEvaluationProjectionG6>();
  for (const [index, corpusCase] of OPEN_SEMANTIC_CORPUS_G6.entries()) {
    assert.equal(corpusCase.corpusVersion, OPEN_SEMANTIC_CORPUS_G6_VERSION);
    const result = await interpretNarrativeInputWithAiV1({
      campaignId: "campaign:g6-corpus",
      operationId: `operation:g6:${corpusCase.caseId}:${index}`,
      intentId: `intent:g6:${corpusCase.caseId}`,
      rawInput: corpusCase.rawInput,
      config,
      runtimeContext: OPEN_SEMANTIC_CORPUS_RUNTIME_CONTEXT_G6
    });
    assert.equal(result.usedAiInterpretation, true, corpusCase.caseId);
    assert.equal(result.usedFallback, false, corpusCase.caseId);
    assert.equal(result.interpretationFailure, null, corpusCase.caseId);
    assert.equal(result.contractVersion, "ai-intent-semantic/8", corpusCase.caseId);
    assert.equal(result.interpretation.semanticSource, "OPEN_SEMANTIC_FRAME_V8", corpusCase.caseId);
    assert.equal(result.interpretation.coreMeaning, corpusCase.frame.overallMeaning, `${corpusCase.caseId}: le sens global doit traverser le mapping.`);
    assert.equal(result.interpretation.semanticIntent.evidenceFromInput.length, 0, `${corpusCase.caseId}: le mapper ne relit pas le texte.`);
    assert.equal(result.interpretation.runtimeDecision.requiredDomain, null, corpusCase.caseId);
    assert.equal(result.interpretation.runtimeDecision.noCommit, true, corpusCase.caseId);
    assert.equal(result.interpretation.runtimeDecision.noGameTime, true, corpusCase.caseId);
    assert.equal(validateCanonicalIntentAuthorityV1(result.interpretation).ok, true, corpusCase.caseId);

    const frame = result.interpretation.openSemanticFrame;
    const plan = result.interpretation.openSemanticRuntime?.executionPlan;
    if (frame === null || frame === undefined) throw new Error(`${corpusCase.caseId}: cadre V8 absent.`);
    if (plan === undefined) throw new Error(`${corpusCase.caseId}: plan G5 absent.`);
    assert.equal(frame.understandingStatus, corpusCase.expected.understandingStatus, corpusCase.caseId);
    assert.equal(frame.overallCommitment, corpusCase.expected.overallCommitment, corpusCase.caseId);
    assert.equal(frame.ambiguities.length, corpusCase.expected.ambiguityCount, corpusCase.caseId);
    assert.equal(result.interpretation.requiresClarification, corpusCase.expected.requiresClarification, corpusCase.caseId);
    assert.deepEqual(frame.components.map(component => component.commitment), corpusCase.expected.componentCommitments, corpusCase.caseId);
    assert.deepEqual(frame.components.map(component => component.relationToPrevious), corpusCase.expected.relations, corpusCase.caseId);
    assert.deepEqual(plan.steps.map(step => step.disposition), corpusCase.expected.dispositions, corpusCase.caseId);
    assert.deepEqual(plan.steps.map(step => step.targetRefs), corpusCase.expected.targetRefs, corpusCase.caseId);
    assert.equal(plan.rawInputAccess, "FORBIDDEN", corpusCase.caseId);
    assert.ok(plan.steps.every(step => step.noCommitBeforeOwnerValidation), corpusCase.caseId);
    assert.ok(plan.steps.every(step => step.noGameTimeBeforeOwnerValidation), corpusCase.caseId);

    const projection = project(corpusCase, frame, plan.steps.map(step => step.disposition));
    if (corpusCase.paraphraseFamily !== null) {
      const previous = projections.get(corpusCase.paraphraseFamily);
      if (previous === undefined) projections.set(corpusCase.paraphraseFamily, projection);
      else assert.deepEqual(projection, previous, `${corpusCase.caseId}: une paraphrase a changé la structure sémantique attendue.`);
    }
  }

  console.log(`Open semantic corpus G6: OK (${OPEN_SEMANTIC_CORPUS_G6.length} cas, ${REQUIRED_COVERAGE.length} axes, sans appel live).`);
}

function project(
  corpusCase: OpenSemanticCorpusCaseG6,
  frame: NonNullable<Awaited<ReturnType<typeof interpretNarrativeInputWithAiV1>>["interpretation"]["openSemanticFrame"]>,
  dispositions: string[]
): SemanticEvaluationProjectionG6 {
  return {
    understandingStatus: frame.understandingStatus,
    overallCommitment: frame.overallCommitment,
    componentCommitments: frame.components.map(component => component.commitment),
    relations: frame.components.map(component => component.relationToPrevious),
    dispositions,
    targetRefs: corpusCase.expected.targetRefs,
    ambiguityCount: frame.ambiguities.length
  };
}

void main();
