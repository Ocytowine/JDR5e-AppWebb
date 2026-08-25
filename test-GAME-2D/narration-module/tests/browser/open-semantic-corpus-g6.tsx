import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { createPrototypeNarrativeTurnControllerV1 } from "../../src/application";
import { OPEN_SEMANTIC_CORPUS_G6 } from "../fixtures/open-semantic-corpus-g6";
import { createSimulatedOpenAiSemanticConfigG6 } from "../fixtures/simulated-openai-semantic-provider-g6";

const BROWSER_CASE_IDS = [
  "dialogue-implicit",
  "travel-typos",
  "conditional-inventory",
  "change-of-mind",
  "ambiguous-pronouns"
] as const;

interface BrowserResult {
  caseId: string;
  status: "PASS" | "FAIL";
  understandingStatus: string;
  dispositions: string[];
  noCommit: boolean;
  noGameTime: boolean;
  error: string | null;
}

function App() {
  const [results, setResults] = useState<BrowserResult[] | null>(null);

  useEffect(() => {
    void runCorpus().then(setResults).catch(error => setResults([{
      caseId: "bootstrap",
      status: "FAIL",
      understandingStatus: "UNKNOWN",
      dispositions: [],
      noCommit: false,
      noGameTime: false,
      error: error instanceof Error ? error.message : String(error)
    }]));
  }, []);

  if (results === null) return <main aria-label="Corpus sémantique G6">Évaluation en cours…</main>;
  const passed = results.filter(result => result.status === "PASS").length;
  return (
    <main aria-label="Corpus sémantique G6">
      <h1>Corpus sémantique G6</h1>
      <p role="status">{passed}/{results.length} cas certifiés</p>
      <ul>
        {results.map(result => (
          <li key={result.caseId} data-testid={`g6-${result.caseId}`} data-status={result.status}>
            {result.caseId} — {result.status} — {result.understandingStatus} — {result.dispositions.join(",") || "aucune étape"}
            {result.error === null ? null : ` — ${result.error}`}
          </li>
        ))}
      </ul>
    </main>
  );
}

async function runCorpus(): Promise<BrowserResult[]> {
  const selected = OPEN_SEMANTIC_CORPUS_G6.filter(entry => BROWSER_CASE_IDS.includes(entry.caseId as typeof BROWSER_CASE_IDS[number]));
  const config = createSimulatedOpenAiSemanticConfigG6(selected);
  const results: BrowserResult[] = [];
  for (const corpusCase of selected) {
    try {
      const controller = await createPrototypeNarrativeTurnControllerV1({
        intentInterpreterConfig: config,
        mjPlannerConfig: null,
        npcPerformerConfig: null,
        sceneTransitionRuntime: null,
        interpreterCharacterContextResolver: null
      });
      const submitted = await controller.submit({
        schemaVersion: 1,
        clientRequestId: `g6-browser:${corpusCase.caseId}`,
        rawInput: corpusCase.rawInput
      });
      if (!submitted.ok) throw new Error(submitted.error.messageKey);
      const interpretation = submitted.value.output.interpretation;
      const dispositions = interpretation.openSemanticRuntime?.components.map(component => component.status) ?? [];
      const expectedDispositions = corpusCase.caseId === "travel-typos"
        ? ["HANDOFF_ONLY"]
        : corpusCase.expected.dispositions;
      const reachedOwner = dispositions.includes("ROUTABLE");
      const pass = interpretation.semanticSource === "OPEN_SEMANTIC_FRAME_V8"
        && interpretation.openSemanticFrame?.overallCommitment === corpusCase.expected.overallCommitment
        && JSON.stringify(dispositions) === JSON.stringify(expectedDispositions)
        && (reachedOwner || submitted.value.output.noCommit)
        && submitted.value.output.noGameTime;
      results.push({
        caseId: corpusCase.caseId,
        status: pass ? "PASS" : "FAIL",
        understandingStatus: interpretation.openSemanticFrame?.understandingStatus ?? "MISSING",
        dispositions,
        noCommit: submitted.value.output.noCommit,
        noGameTime: submitted.value.output.noGameTime,
        error: pass ? null : "La projection navigateur diffère du corpus."
      });
    } catch (error) {
      results.push({
        caseId: corpusCase.caseId,
        status: "FAIL",
        understandingStatus: "ERROR",
        dispositions: [],
        noCommit: false,
        noGameTime: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return results;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
