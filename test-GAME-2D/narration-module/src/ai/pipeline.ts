import { cloneJson } from "../core";
import type { ContractAiProviderV1 } from "./FakeContractAiProvider";
import {
  createAiIncidentRecordV1,
  validateAiCallRequestV1,
  validateAiModelRouteV1,
  validateAiRoleOutputEnvelopeV1
} from "./validation";
import type {
  AiAttemptRecordV1,
  AiCallRequestV1,
  AiCallTelemetryV1,
  AiIncidentRecordV1,
  AiModelRouteV1,
  AiOutputValidationResultV1,
  AiRetryPolicyV1,
  AiRoleOutputEnvelopeV1
} from "./types";
import { consumeAiCallBudgetV1 } from "./callBudget";

export interface AiPipelineRunInputV1 {
  request: AiCallRequestV1;
  route: AiModelRouteV1;
  retryPolicy: AiRetryPolicyV1;
  provider: ContractAiProviderV1;
}

export interface AiPipelineRunResultV1 {
  acceptedOutput: AiRoleOutputEnvelopeV1 | null;
  validation: AiOutputValidationResultV1;
  attempts: AiAttemptRecordV1[];
  incidents: AiIncidentRecordV1[];
  telemetry: AiCallTelemetryV1[];
}

function attemptRequest(base: AiCallRequestV1, attemptId: string, kind: AiAttemptRecordV1["attemptKind"]): AiCallRequestV1 {
  const cloned = { ...cloneJson(base), attemptId };
  return kind === "TECHNICAL_RETRY"
    ? { ...cloned, limits: { ...cloned.limits, timeoutMs: Math.min(cloned.limits.timeoutMs, 15_000) } }
    : cloned;
}

function attemptKind(index: number, policy: AiRetryPolicyV1): AiAttemptRecordV1["attemptKind"] {
  if (index === 0) return "INITIAL";
  if (index <= policy.maxTechnicalRetries) return "TECHNICAL_RETRY";
  if (index <= policy.maxTechnicalRetries + policy.maxTargetedCorrections) return "TARGETED_CORRECTION";
  return "FULL_REGENERATION";
}

export async function runAiPipelineCallV1(input: AiPipelineRunInputV1): Promise<AiPipelineRunResultV1> {
  const routeValidation = validateAiModelRouteV1(input.route);
  const requestValidation = validateAiCallRequestV1(input.request, input.route);
  const preIssues = [
    ...(routeValidation.ok ? [] : routeValidation.issues),
    ...(requestValidation.ok ? [] : requestValidation.issues)
  ];
  if (preIssues.length > 0) {
    const validation: AiOutputValidationResultV1 = {
      schemaVersion: 1,
      outputId: null,
      accepted: false,
      failureCategory: "AUTHORITY_VIOLATION",
      issues: preIssues
    };
    return {
      acceptedOutput: null,
      validation,
      attempts: [],
      incidents: [createAiIncidentRecordV1({
        incidentId: `incident:${input.request.operationId}:preflight`,
        campaignId: input.request.campaignId,
        operationId: input.request.operationId,
        callId: input.request.callId,
        attemptIds: [],
        role: input.request.role,
        category: "AUTHORITY_VIOLATION",
        severity: "BLOCKING",
        stage: "CONTEXT_BUILD",
        commitState: "NO_COMMIT",
        outcome: "SUSPENDED",
        unsafeDetails: { issues: preIssues }
      })],
      telemetry: []
    };
  }

  const maxAttempts = 1 + input.retryPolicy.maxTechnicalRetries + input.retryPolicy.maxTargetedCorrections + input.retryPolicy.maxFullRegenerations;
  const attempts: AiAttemptRecordV1[] = [];
  const incidents: AiIncidentRecordV1[] = [];
  const telemetry: AiCallTelemetryV1[] = [];
  let lastValidation: AiOutputValidationResultV1 = {
    schemaVersion: 1,
    outputId: null,
    accepted: false,
    failureCategory: "INVALID_ENVELOPE",
    issues: ["not attempted"]
  };

  for (let index = 0; index < maxAttempts; index += 1) {
    const kind = attemptKind(index, input.retryPolicy);
    const request = attemptRequest(input.request, index === 0 ? input.request.attemptId : `${input.request.attemptId}:retry-${index}`, kind);
    const budget = consumeAiCallBudgetV1({
      operationId: request.operationId,
      attemptId: request.attemptId,
      route: input.route
    });
    if (!budget.allowed) {
      lastValidation = {
        schemaVersion: 1,
        outputId: null,
        accepted: false,
        failureCategory: "BUDGET_EXCEEDED",
        issues: [
          `billable AI call budget exhausted: ${budget.snapshot.consumedAttemptIds.length}/${budget.snapshot.maxBillableCalls}`
        ]
      };
      incidents.push(createAiIncidentRecordV1({
        incidentId: `incident:${request.operationId}:${request.attemptId}:budget`,
        campaignId: request.campaignId,
        operationId: request.operationId,
        callId: request.callId,
        attemptIds: [request.attemptId],
        role: request.role,
        category: "BUDGET_EXCEEDED",
        severity: "BLOCKING",
        stage: "PROVIDER_CALL",
        commitState: "NO_COMMIT",
        outcome: "SUSPENDED",
        unsafeDetails: {
          maxBillableCalls: budget.snapshot.maxBillableCalls,
          consumedAttemptIds: budget.snapshot.consumedAttemptIds,
          deniedAttemptId: request.attemptId
        }
      }));
      break;
    }
    const rawOutput = await input.provider.generate(request);
    const callTelemetry = input.provider.takeTelemetry?.(request.attemptId) ?? null;
    if (callTelemetry !== null) telemetry.push(callTelemetry);
    const validation = validateAiRoleOutputEnvelopeV1(rawOutput, request);
    lastValidation = validation;
    attempts.push({
      schemaVersion: 1,
      attemptId: request.attemptId,
      callId: request.callId,
      role: request.role,
      attemptKind: kind,
      status: validation.accepted ? "ACCEPTED" : "REJECTED",
      failureCategory: validation.failureCategory
    });

    if (validation.accepted) {
      return {
        acceptedOutput: cloneJson(rawOutput) as AiRoleOutputEnvelopeV1,
        validation,
        attempts,
        incidents,
        telemetry
      };
    }

    incidents.push(createAiIncidentRecordV1({
      incidentId: `incident:${request.operationId}:${request.attemptId}`,
      campaignId: request.campaignId,
      operationId: request.operationId,
      callId: request.callId,
      attemptIds: [request.attemptId],
      role: request.role,
      category: validation.failureCategory ?? "INVALID_ENVELOPE",
      severity: "WARNING",
      stage: "OUTPUT_VALIDATE",
      commitState: "NO_COMMIT",
      outcome: index + 1 < maxAttempts ? "RECOVERED" : "SUSPENDED",
      unsafeDetails: {
        issues: validation.issues,
        outputDiagnostics: extractOutputDiagnosticCodes(rawOutput),
        outputDiagnosticMessages: extractOutputDiagnosticMessages(rawOutput),
        rawProviderOutput: rawOutput
      }
    }));
    const nextKind = index + 1 < maxAttempts ? attemptKind(index + 1, input.retryPolicy) : null;
    if (nextKind === "TECHNICAL_RETRY" && !isTechnicalProviderFailure(rawOutput)) break;
  }

  return { acceptedOutput: null, validation: lastValidation, attempts, incidents, telemetry };
}

function isTechnicalProviderFailure(output: unknown): boolean {
  const codes = extractOutputDiagnosticCodes(output);
  return codes.some(code => /FETCH_FAILED|HTTP_ERROR|OUTPUT_INCOMPLETE|TRANSPORT|TIMEOUT|RATE_LIMIT|SERVER_ROUTE_/iu.test(code));
}

function extractOutputDiagnosticCodes(output: unknown): string[] {
  if (!output || typeof output !== "object" || Array.isArray(output)) return [];
  const diagnostics = (output as { diagnostics?: unknown }).diagnostics;
  if (!Array.isArray(diagnostics)) return [];
  return diagnostics
    .map(entry => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const code = (entry as { code?: unknown }).code;
      return typeof code === "string" && code.trim().length > 0 ? code : null;
    })
    .filter((code): code is string => code !== null);
}

function extractOutputDiagnosticMessages(output: unknown): string[] {
  if (!output || typeof output !== "object" || Array.isArray(output)) return [];
  const diagnostics = (output as { diagnostics?: unknown }).diagnostics;
  if (!Array.isArray(diagnostics)) return [];
  return diagnostics
    .map(entry => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const message = (entry as { message?: unknown }).message;
      return typeof message === "string" && message.trim().length > 0 ? message.trim().slice(0, 300) : null;
    })
    .filter((message): message is string => message !== null);
}

export interface DeterministicRenderFallbackInputV1 {
  operationId: string;
  committed: true;
  facts: string[];
  utterances: string[];
  elapsedGameTimeSeconds: number;
}

export function renderDeterministicPostCommitFallbackV1(input: DeterministicRenderFallbackInputV1): string {
  const parts = [
    `Résultat validé de l'opération ${input.operationId}.`,
    ...input.facts,
    ...input.utterances,
    `Temps écoulé : ${input.elapsedGameTimeSeconds} secondes.`
  ];
  return parts.join(" ");
}
