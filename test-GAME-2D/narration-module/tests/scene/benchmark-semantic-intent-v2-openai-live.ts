import {
  interpretNarrativeInputWithAiV1,
  type LocalReferentHintV1,
  type RecentSemanticTurnV1
} from "../../src/application";
import { buildOpenAiIntentInterpreterConfigV1 } from "../../../src/narration-ui/openAiNarrativeRuntimeConfig";

const endpoint = process.env.NARRATIVE_OPENAI_ENDPOINT ?? "http://127.0.0.1:5175/api/narration/enhance-openai";
const waitress = targetHint("npc", "npc:npc-serveuse-nerveuse", "Serveuse nerveuse", "prior-waitress");
const guard = targetHint("npc", "npc:npc-garde-blesse", "Garde blessé", "prior-guard");

const cases = [
  { id: "explicit-greeting", input: "Je dis bonjour à la serveuse.", hints: [], expectedKind: "address_visible_actor", expectedTarget: waitress.target.ref, expectedAct: "INITIATE_CONVERSATION" },
  { id: "pronoun-question", input: "Je lui demande pourquoi elle regarde la porte.", hints: [waitress], recent: [recentTurn(waitress, "Comprendre pourquoi la serveuse regarde la porte.")], expectedKind: "address_visible_actor", expectedTarget: waitress.target.ref, expectedAct: "ASK_QUESTION" },
  { id: "explicit-approach", input: "Je m'approche du garde sans rien dire.", hints: [waitress], expectedKind: "move_near_visible_actor", expectedTarget: guard.target.ref },
  { id: "pronoun-health", input: "Je lui demande s'il a mal.", hints: [guard], recent: [recentTurn(guard, "Observer l'état du garde blessé.")], expectedKind: "address_visible_actor", expectedTarget: guard.target.ref, expectedAct: "ASK_QUESTION" },
  { id: "descriptive-target", input: "Je demande à celui qui garde une main sur son flanc ce qu'il a vu.", hints: [], expectedKind: "address_visible_actor", expectedTarget: guard.target.ref, expectedAct: "ASK_QUESTION" },
  { id: "silent-signal", input: "Je fais comprendre à la serveuse, sans parler, que nous devrions partir.", hints: [guard], expectedKind: "nonverbal_signal", expectedTarget: waitress.target.ref },
  { id: "conditional-object", input: "Si la porte paraît sûre, j'essaie de l'entrouvrir.", hints: [waitress], expectedKind: "manipulate_visible_object", expectedTarget: "poi:back-room-door", expectedCommitment: "conditional" },
  { id: "scene-transition", input: "J'entre dans l'arrière-salle discrètement.", hints: [waitress], expectedKind: "traverse_visible_boundary", expectedTarget: "poi:back-room-door", expectedRuntime: "UNSUPPORTED_DOMAIN" }
] as const;

async function main(): Promise<void> {
  const config = buildOpenAiIntentInterpreterConfigV1(endpoint);
  const reports = [];
  for (const [index, fixture] of cases.entries()) {
    const startedAt = Date.now();
    const result = await interpretNarrativeInputWithAiV1({
      campaignId: "benchmark-semantic-intent-v2",
      operationId: `benchmark-op-${index + 1}`,
      intentId: `benchmark-intent-${index + 1}`,
      rawInput: fixture.input,
      config,
      localReferentHints: [...fixture.hints],
      recentSemanticTurns: "recent" in fixture ? [...fixture.recent] : []
    });
    const semantic = result.interpretation.semanticIntent;
    const target = result.interpretation.referentResolution?.resolvedTarget?.ref ?? semantic.target?.ref ?? null;
    const checks = {
      accepted: result.usedAiInterpretation,
      kind: semantic.kind === fixture.expectedKind,
      target: target === fixture.expectedTarget,
      dialogueAct: !("expectedAct" in fixture) || semantic.dialogueAct?.act === fixture.expectedAct,
      commitment: !("expectedCommitment" in fixture) || semantic.commitment === fixture.expectedCommitment,
      runtime: !("expectedRuntime" in fixture) || result.interpretation.runtimeDecision.status === fixture.expectedRuntime
    };
    const telemetry = result.telemetry;
    reports.push({
      id: fixture.id,
      input: fixture.input,
      passed: Object.values(checks).every(Boolean),
      checks,
      actual: { kind: semantic.kind, target, dialogueAct: semantic.dialogueAct?.act ?? null, commitment: semantic.commitment, runtime: result.interpretation.runtimeDecision.status },
      wallMs: Date.now() - startedAt,
      attempts: telemetry.length,
      telemetry,
      issues: result.interpretationFailure?.issues ?? []
    });
    process.stdout.write(`BENCH_PROGRESS ${fixture.id} ${reports.at(-1)?.wallMs}ms ${reports.at(-1)?.passed ? "PASS" : "FAIL"}\n`);
  }

  const latencies = reports.flatMap(report => report.telemetry.map(metric => metric.latencyMs)).sort((a, b) => a - b);
  const summary = {
    endpoint,
    cases: reports.length,
    passed: reports.filter(report => report.passed).length,
    retries: reports.reduce((sum, report) => sum + Math.max(0, report.attempts - 1), 0),
    p50Ms: percentile(latencies, 0.5),
    p95Ms: percentile(latencies, 0.95),
    maxMs: latencies.at(-1) ?? null,
    inputTokens: reports.reduce((sum, report) => sum + report.telemetry.reduce((subtotal, metric) => subtotal + (metric.inputTokens ?? 0), 0), 0),
    outputTokens: reports.reduce((sum, report) => sum + report.telemetry.reduce((subtotal, metric) => subtotal + (metric.outputTokens ?? 0), 0), 0),
    model: reports.flatMap(report => report.telemetry.map(metric => `${metric.modelId}/${metric.reasoningEffort ?? "standard"}`))[0] ?? "unknown"
  };
  process.stdout.write(`BENCH_RESULTS ${JSON.stringify({ summary, reports }, null, 2)}\n`);
  if (summary.passed !== summary.cases) process.exitCode = 1;
}

function targetHint(kind: "npc" | "object", ref: string, label: string, sourceOperationId: string): LocalReferentHintV1 {
  return { schemaVersion: 1, sceneId: "reference-inn-rain-001", sceneVersion: 1, target: { kind, ref, label }, sourceOperationId, sourceText: label, confidence: "high" };
}

function recentTurn(hint: LocalReferentHintV1, playerGoal: string): RecentSemanticTurnV1 {
  return { schemaVersion: 1, operationId: hint.sourceOperationId, semanticKind: "address_visible_actor", playerGoal, primaryTarget: hint.target, topic: playerGoal, commitment: "committed" };
}

function percentile(values: number[], fraction: number): number | null {
  return values.length === 0 ? null : values[Math.max(0, Math.ceil(values.length * fraction) - 1)] ?? null;
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
