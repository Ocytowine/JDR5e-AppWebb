import type { AiCallTelemetryV1, AiIncidentRecordV1 } from "../../narration-module/src/ai/types";
import type { JsonObject } from "../../narration-module/src/core";
import {
  buildNarrativeAiRoleStrategyV1,
  type AiNarrativeEnhancementResultV1,
  type NarrativeTurnControllerOutputV1,
  type NarrativeTurnControllerOutputWithSemanticFidelityV1
} from "../../narration-module/src/application";

export const NARRATIVE_TECHNICAL_DIAGNOSTIC_V1 =
  "narrative-technical-diagnostic/1" as const;

export interface NarrativeTechnicalDiagnosticV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof NARRATIVE_TECHNICAL_DIAGNOSTIC_V1;
  generatedAt: string;
  operationId: string;
  clientRequestId: string;
  rawInput: string;
  interpretation: JsonObject;
  routing: JsonObject;
  resolution: JsonObject;
  presentation: JsonObject;
  failuresByRole: JsonObject[];
  telemetry: JsonObject;
  timings: JsonObject;
  playerFacingIsolation: "SEPARATE_DEVELOPER_PANEL_ONLY";
}

export function buildNarrativeTechnicalDiagnosticV1(input: {
  generatedAt: string;
  rawInput: string;
  output: NarrativeTurnControllerOutputV1;
  enhancementStatus: string;
  finalEnhancement: AiNarrativeEnhancementResultV1;
  attemptedEnhancement: AiNarrativeEnhancementResultV1 | null;
  timings: { controllerMs: number; enhancementMs: number; projectionMs: number; totalMs: number };
}): NarrativeTechnicalDiagnosticV1 {
  const faithful = input.output as Partial<NarrativeTurnControllerOutputWithSemanticFidelityV1>;
  const originalInterpretation = input.output.interpretation;
  const ownerInterpretation = input.output.resolution.interpretation;
  const controllerTelemetry = input.output.aiTelemetry ?? [];
  const attemptedPresentationTelemetry = input.attemptedEnhancement?.telemetry ?? [];
  const presentationTelemetry = input.finalEnhancement.telemetry ?? [];
  const allTelemetry = deduplicateTelemetry([
    ...controllerTelemetry,
    ...attemptedPresentationTelemetry,
    ...presentationTelemetry
  ]);
  const presentationIncidents = deduplicateIncidents([
    ...(input.attemptedEnhancement?.incidents ?? []),
    ...input.finalEnhancement.incidents
  ]);
  const failuresByRole = [
    ...(input.output.interpretation.runtimeDecision.status === "AI_INTERPRETATION_FAILED"
      ? [{
          schemaVersion: 1,
          role: "player_intent_interpreter",
          stage: "INTERPRETATION",
          actorRef: null,
          status: "FAILED",
          issues: [input.output.interpretation.runtimeDecision.reason]
        }]
      : []),
    ...(input.output.mjPlannerFailure === null ? [] : [{
      schemaVersion: 1,
      role: input.output.mjPlannerFailure.role,
      stage: input.output.mjPlannerFailure.stage,
      actorRef: null,
      status: input.output.mjPlannerFailure.status,
      issues: [...input.output.mjPlannerFailure.issues]
    }]),
    ...(input.output.npcPerformanceFailure === null ? [] : [{
      schemaVersion: 1,
      role: input.output.npcPerformanceFailure.role,
      stage: input.output.npcPerformanceFailure.stage,
      actorRef: input.output.npcPerformanceFailure.actorId,
      status: input.output.npcPerformanceFailure.status,
      issues: [...input.output.npcPerformanceFailure.issues]
    }]),
    ...presentationIncidents.map(incident => incidentAttribution(incident))
  ] as JsonObject[];
  return {
    schemaVersion: 1,
    contractVersion: NARRATIVE_TECHNICAL_DIAGNOSTIC_V1,
    generatedAt: input.generatedAt,
    operationId: input.output.operationId,
    clientRequestId: input.output.clientRequestId,
    rawInput: input.rawInput,
    interpretation: {
      stage: "INTERPRETATION",
      status: originalInterpretation.openSemanticFrame?.understandingStatus
        ?? originalInterpretation.runtimeDecision.status,
      compatibilityProjectionStatus: originalInterpretation.runtimeDecision.status,
      compatibilityProjectionReason: originalInterpretation.runtimeDecision.reason,
      original: originalInterpretation,
      openSemanticFrame: originalInterpretation.openSemanticFrame === null
        ? null
        : originalInterpretation.openSemanticFrame as unknown as JsonObject
    },
    routing: {
      stage: "ROUTING",
      status: ownerInterpretation.runtimeDecision.status,
      ownerProjectionStatus: ownerInterpretation.runtimeDecision.status,
      ownerProjectionReason: ownerInterpretation.runtimeDecision.reason,
      roleStrategy: buildNarrativeAiRoleStrategyV1(originalInterpretation),
      executionPlan: originalInterpretation.openSemanticRuntime?.executionPlan ?? null,
      domainCommand: input.output.domainCommand,
      fidelityReceipt: faithful.openSemanticFidelity ?? null
    },
    resolution: {
      stage: "RESOLUTION",
      resultKind: input.output.resolution.resultKind,
      ownerInterpretation: input.output.resolution.interpretation,
      result: input.output.resolution,
      mjPlan: input.output.mjPlan,
      npcPerformance: input.output.npcPerformance,
      fallbackUsed: input.output.npcPerformance === null && input.output.npcPerformanceFailure !== null
    },
    presentation: {
      stage: "PRESENTATION",
      status: input.enhancementStatus,
      enhanced: input.finalEnhancement.enhanced,
      fallbackKind: input.finalEnhancement.fallbackKind,
      incidents: presentationIncidents.map(incidentAttribution),
      safetyNotes: input.finalEnhancement.safetyNotes,
      displayPacket: input.finalEnhancement.displayPacket
    },
    failuresByRole,
    telemetry: {
      stage: "AI_TELEMETRY",
      calls: allTelemetry.map(telemetryReceipt),
      callCountWithMetrics: allTelemetry.length,
      rolesWithMetrics: [...new Set(allTelemetry.map(metric => metric.role))],
      plannerMetricsPresent: allTelemetry.some(metric => metric.role === "mj_planner"),
      semantics: {
        configuredInputBudget: "Limite déclarée pour l'entrée de l'appel.",
        actualInputTokens: "Usage réellement rapporté par le fournisseur, ou null.",
        configuredOutputLimit: "Plafond de génération, distinct des tokens réellement produits.",
        actualOutputTokens: "Usage réellement rapporté par le fournisseur, ou null."
      }
    },
    timings: {
      stage: "TIMINGS",
      controllerStages: input.output.stageTimings,
      ui: input.timings
    },
    playerFacingIsolation: "SEPARATE_DEVELOPER_PANEL_ONLY"
  };
}

function telemetryReceipt(metric: AiCallTelemetryV1): JsonObject {
  const outputLimitStatus = metric.finishReason === "length"
    ? "REACHED"
    : metric.outputTokens === null
      ? "UNKNOWN"
      : metric.outputTokens < metric.outputTokenBudget
        ? "NOT_REACHED"
        : "POSSIBLY_REACHED";
  return {
    schemaVersion: 1,
    role: metric.role,
    attemptId: metric.attemptId,
    providerId: metric.providerId,
    modelId: metric.modelId,
    reasoningEffort: metric.reasoningEffort,
    latencyMs: metric.latencyMs,
    configuredInputBudget: metric.inputTokenBudget,
    actualInputTokens: metric.inputTokens,
    configuredOutputLimit: metric.outputTokenBudget,
    actualOutputTokens: metric.outputTokens,
    actualTotalTokens: metric.totalTokens,
    outputLimitStatus,
    finishReason: metric.finishReason,
    contextCharacters: metric.contextChars,
    schemaCharacters: metric.schemaChars
  };
}

function incidentAttribution(incident: AiIncidentRecordV1): JsonObject {
  return {
    schemaVersion: 1,
    role: incident.role ?? "unattributed_runtime",
    stage: incident.stage,
    actorRef: null,
    status: incident.outcome,
    incidentId: incident.incidentId,
    category: incident.category,
    severity: incident.severity,
    issues: incident.safeDetails as unknown as JsonObject
  };
}

function deduplicateTelemetry(metrics: AiCallTelemetryV1[]): AiCallTelemetryV1[] {
  const byAttempt = new Map<string, AiCallTelemetryV1>();
  for (const metric of metrics) byAttempt.set(metric.attemptId, metric);
  return [...byAttempt.values()];
}

function deduplicateIncidents(incidents: AiIncidentRecordV1[]): AiIncidentRecordV1[] {
  const byIncident = new Map<string, AiIncidentRecordV1>();
  for (const incident of incidents) byIncident.set(incident.incidentId, incident);
  return [...byIncident.values()];
}
