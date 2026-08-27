import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AiCallTelemetryV1, AiIncidentRecordV1 } from "../../src/ai/types";
import type {
  AiNarrativeEnhancementResultV1,
  NarrativeIntentInterpretationV1,
  NarrativeTurnControllerOutputV1
} from "../../src/application";
import { buildNarrativeTechnicalDiagnosticV1 } from "../../../src/narration-ui/narrativeTechnicalDiagnostic";

const plannerMetric = telemetry("mj_planner", "attempt:planner", 2_000, 600, 1_000, 1_000, "length");
const interpreterMetric = telemetry("player_intent_interpreter", "attempt:interpreter", 4_000, 720, 900, 210, "stop");
const writerMetric = telemetry("scene_writer", "attempt:writer", 3_000, null, 2_500, null, null);
const writerIncident: AiIncidentRecordV1 = {
  schemaVersion: 1,
  incidentId: "incident:writer",
  campaignId: "campaign:h5",
  operationId: "operation:h5",
  callId: "call:writer",
  attemptIds: ["attempt:writer"],
  role: "scene_writer",
  category: "TRANSPORT_FAILURE",
  severity: "WARNING",
  stage: "POST_COMMIT_RENDER",
  commitState: "COMMIT_CONFIRMED",
  redacted: true,
  redactedFields: [],
  safeDetails: { message: "Présentation distante indisponible." },
  outcome: "DEGRADED"
};
const interpretation = buildInterpretation();
const ownerInterpretation = {
  ...interpretation,
  runtimeDecision: {
    ...interpretation.runtimeDecision,
    status: "SUPPORTED_BY_CURRENT_RUNTIME",
    requiredDomain: "social",
    reason: "Dialogue visible.",
    noCommit: false
  }
} as NarrativeIntentInterpretationV1;
const output = {
  schemaVersion: 1,
  contractVersion: "narrative-turn-controller/1",
  operationId: "operation:h5",
  clientRequestId: "request:h5",
  interpretation,
  domainCommand: null,
  mjPlan: null,
  mjPlannerFailure: {
    schemaVersion: 1,
    stage: "MJ_PLANNING",
    role: "mj_planner",
    status: "FAILED",
    rawInput: "Je salue le garde.",
    issues: ["Plan rejeté."],
    noCommit: true,
    noGameTime: true
  },
  npcPerformance: null,
  npcPerformanceFailure: {
    schemaVersion: 1,
    stage: "NPC_PERFORMANCE",
    role: "npc_performer",
    status: "FAILED",
    actorId: "npc:garde",
    issues: ["Réplique rejetée."],
    noCommit: true,
    noGameTime: true
  },
  resolution: {
    resultKind: "ACTION_RESOLUTION",
    interpretation: ownerInterpretation
  },
  stageTimings: {
    interpretationMs: 120,
    planningMs: 80,
    resolutionMs: 15,
    npcPerformanceMs: 210
  },
  aiTelemetry: [interpreterMetric, plannerMetric]
} as unknown as NarrativeTurnControllerOutputV1;
const enhancement = {
  schemaVersion: 1,
  contractVersion: "narrative-ai-resolution/1",
  enhanced: false,
  usedFallback: true,
  fallbackKind: "TECHNICAL_INCIDENT",
  displayPacket: { schemaVersion: 1, displayBlocks: [] },
  incidents: [writerIncident],
  telemetry: [],
  safetyNotes: ["Rendu local conservé."]
} as unknown as AiNarrativeEnhancementResultV1;
const attemptedEnhancement = {
  ...enhancement,
  incidents: [writerIncident],
  telemetry: [writerMetric]
} as AiNarrativeEnhancementResultV1;

const diagnostic = buildNarrativeTechnicalDiagnosticV1({
  generatedAt: "2026-08-26T08:00:00.000Z",
  rawInput: "Je salue le garde.",
  output,
  enhancementStatus: "fallback local",
  finalEnhancement: enhancement,
  attemptedEnhancement,
  timings: { controllerMs: 430, enhancementMs: 250, projectionMs: 10, totalMs: 690 }
});

assert.equal(diagnostic.contractVersion, "narrative-technical-diagnostic/1");
assert.equal(diagnostic.interpretation.stage, "INTERPRETATION");
assert.equal(diagnostic.interpretation.status, "UNDERSTOOD");
assert.equal(diagnostic.interpretation.compatibilityProjectionStatus, "UNSUPPORTED_DOMAIN");
assert.equal(diagnostic.routing.stage, "ROUTING");
assert.equal(diagnostic.routing.ownerProjectionStatus, "SUPPORTED_BY_CURRENT_RUNTIME");
assert.equal(diagnostic.resolution.stage, "RESOLUTION");
assert.equal(diagnostic.presentation.stage, "PRESENTATION");
assert.equal(diagnostic.playerFacingIsolation, "SEPARATE_DEVELOPER_PANEL_ONLY");
assert.equal(diagnostic.failuresByRole.length, 3, "un incident tenté puis conservé ne doit pas être dupliqué");
assert.ok(diagnostic.failuresByRole.some(failure => failure.role === "mj_planner"));
assert.ok(diagnostic.failuresByRole.some(failure => failure.role === "npc_performer" && failure.actorRef === "npc:garde"));
assert.ok(diagnostic.failuresByRole.some(failure => failure.role === "scene_writer"));

const telemetryBlock = diagnostic.telemetry as { plannerMetricsPresent: boolean; calls: Array<Record<string, unknown>> };
assert.equal(telemetryBlock.plannerMetricsPresent, true);
const plannerReceipt = telemetryBlock.calls.find(call => call.role === "mj_planner");
assert.equal(plannerReceipt?.configuredInputBudget, 2_000);
assert.equal(plannerReceipt?.actualInputTokens, 600);
assert.equal(plannerReceipt?.configuredOutputLimit, 1_000);
assert.equal(plannerReceipt?.actualOutputTokens, 1_000);
assert.equal(plannerReceipt?.outputLimitStatus, "REACHED");
const writerReceipt = telemetryBlock.calls.find(call => call.role === "scene_writer");
assert.equal(writerReceipt?.outputLimitStatus, "UNKNOWN");
assert.equal(telemetryBlock.calls.length, 3, "les métriques de la tentative rejetée doivent survivre au fallback final");

const surfaceSource = readFileSync(resolve("src/narration-ui/NarrativeAppSurface.tsx"), "utf8");
assert.doesNotMatch(surfaceSource, /function appendNarrativeSystemTrace/u);
assert.match(surfaceSource, /data-narrative-technical-diagnostic="separate-developer-panel"/u);
const plannerSource = readFileSync(resolve("narration-module/src/application/mjPlanning.ts"), "utf8");
assert.match(plannerSource, /telemetry: run\.telemetry/u, "le planificateur doit exposer ses métriques réelles");
const controllerSource = readFileSync(resolve("narration-module/src/application/NarrativeTurnController.ts"), "utf8");
assert.match(controllerSource, /\.\.\.\(planning\?\.telemetry \?\? \[\]\)/u, "le contrôleur doit conserver les métriques du planificateur");

console.log("narrative-technical-diagnostic/J10-H5: OK (étapes, rôles, budgets et isolation joueur)");

function telemetry(
  role: AiCallTelemetryV1["role"],
  attemptId: string,
  inputTokenBudget: number,
  inputTokens: number | null,
  outputTokenBudget: number,
  outputTokens: number | null,
  finishReason: string | null
): AiCallTelemetryV1 {
  return {
    schemaVersion: 1,
    providerId: "openai",
    modelId: "gpt-test",
    reasoningEffort: "medium",
    role,
    attemptId,
    latencyMs: 100,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens === null || outputTokens === null ? null : inputTokens + outputTokens,
    finishReason,
    inputTokenBudget,
    outputTokenBudget,
    contextChars: 2_400,
    schemaChars: 500
  };
}

function buildInterpretation(): NarrativeIntentInterpretationV1 {
  return {
    schemaVersion: 1,
    contractVersion: "intent-clarification/1",
    intentId: "intent:h5",
    semanticSource: "OPEN_SEMANTIC_FRAME_V8",
    runtimeDecision: {
      schemaVersion: 1,
      source: "LOCAL_CAPABILITY_REGISTRY",
      status: "UNSUPPORTED_DOMAIN",
      requiredDomain: null,
      reason: "Projection historique non autoritaire.",
      noCommit: true,
      noGameTime: true,
      aiSuggestionMatched: true
    },
    openSemanticFrame: {
      schemaVersion: 1,
      understandingStatus: "UNDERSTOOD",
      overallMeaning: "Saluer le garde.",
      overallCommitment: "committed",
      globalConditions: [],
      components: [],
      ambiguities: [],
      clarificationQuestion: null,
      confidence: "high"
    },
    openSemanticRuntime: {
      schemaVersion: 1,
      components: [],
      executionPlan: {
        schemaVersion: 1,
        contractVersion: "open-semantic-execution-plan/1",
        understandingStatus: "UNDERSTOOD",
        overallMeaning: "Saluer le garde.",
        steps: [{ capabilityId: "scene.visible-dialogue" }]
      }
    }
  } as unknown as NarrativeIntentInterpretationV1;
}
