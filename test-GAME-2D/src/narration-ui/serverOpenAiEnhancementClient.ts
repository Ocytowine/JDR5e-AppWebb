import type { ContractAiProviderV1 } from "../../narration-module/src/ai/FakeContractAiProvider";
import type { AiCallRequestV1, AiCallTelemetryV1, AiRoleOutputEnvelopeV1 } from "../../narration-module/src/ai/types";

export class ServerOpenAiEnhancementProviderV1 implements ContractAiProviderV1 {
  private readonly telemetryByAttempt = new Map<string, AiCallTelemetryV1>();
  constructor(private readonly endpoint = "/api/narration/enhance-openai") {}

  async generate(request: AiCallRequestV1): Promise<unknown> {
    const startedAt = Date.now();
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ request }),
        // The server owns the provider deadline; keep a transport margin so its diagnostic can arrive.
        signal: AbortSignal.timeout(request.limits.timeoutMs + (request.role === "scene_creator" ? 5_000 : 1_000))
      });
      const data = await response.json().catch(() => null) as { output?: unknown; error?: unknown; issues?: unknown; metrics?: Omit<AiCallTelemetryV1, "schemaVersion" | "attemptId"> } | null;
      if (data?.metrics) this.telemetryByAttempt.set(request.attemptId, { schemaVersion: 1, attemptId: request.attemptId, ...data.metrics } as AiCallTelemetryV1);
      else this.recordLocalTelemetry(request, Date.now() - startedAt, response.ok ? "missing_server_metrics" : `http_${response.status}`);
      if (!response.ok) {
        if (data?.output) return data.output;
        const detail = Array.isArray(data?.issues)
          ? `HTTP ${response.status}: ${data.issues.filter((entry): entry is string => typeof entry === "string").join("; ")}`
          : `HTTP ${response.status}`;
        return serverErrorEnvelope(request, "SERVER_ROUTE_HTTP_ERROR", detail);
      }
      if (data?.output) return withServerValidationIssues(data.output, data.issues, request);
      return serverErrorEnvelope(request, "SERVER_ROUTE_EMPTY_OUTPUT", "Server route returned no output.");
    } catch (error) {
      this.recordLocalTelemetry(request, Date.now() - startedAt, error instanceof Error ? error.name : "transport_error");
      return serverErrorEnvelope(
        request,
        "SERVER_ROUTE_FETCH_FAILED",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  takeTelemetry(attemptId: string): AiCallTelemetryV1 | null {
    const telemetry = this.telemetryByAttempt.get(attemptId) ?? null;
    this.telemetryByAttempt.delete(attemptId);
    return telemetry;
  }

  private recordLocalTelemetry(request: AiCallRequestV1, latencyMs: number, finishReason: string): void {
    this.telemetryByAttempt.set(request.attemptId, {
      schemaVersion: 1,
      providerId: "server-openai-route",
      modelId: request.modelRouteId,
      reasoningEffort: null,
      role: request.role,
      attemptId: request.attemptId,
      latencyMs,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      finishReason,
      inputTokenBudget: request.limits.inputTokenBudget,
      outputTokenBudget: request.limits.outputTokenBudget,
      contextChars: JSON.stringify(request.input).length,
      schemaChars: null
    });
  }
}

function withServerValidationIssues(output: unknown, issues: unknown, request: AiCallRequestV1): unknown {
  if (!Array.isArray(issues) || issues.length === 0 || output === null || typeof output !== "object" || Array.isArray(output)) return output;
  const typed = output as Partial<AiRoleOutputEnvelopeV1>;
  const diagnostics = Array.isArray(typed.diagnostics) ? typed.diagnostics : [];
  const validationIssues = issues
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .slice(0, 20)
    .map((message, index) => ({
      code: `SERVER_ENVELOPE_VALIDATION_${index + 1}`,
      severity: "BLOCKING" as const,
      message,
      sourceRefs: [`operation:${request.operationId}`]
    }));
  return { ...typed, diagnostics: [...diagnostics, ...validationIssues] };
}

function serverErrorEnvelope(request: AiCallRequestV1, code: string, message: string): AiRoleOutputEnvelopeV1 {
  return {
    schemaVersion: 1,
    contractVersion: request.contractVersion,
    outputId: `server-route-error:${request.attemptId}`,
    callId: request.callId,
    attemptId: request.attemptId,
    packId: request.packId,
    snapshotId: request.snapshotId,
    role: request.role,
    status: "PARTIAL_UNUSABLE",
    payload: {},
    diagnostics: [{
      code,
      severity: "BLOCKING",
      message,
      sourceRefs: [`operation:${request.operationId}`]
    }],
    supersedesOutputId: null
  };
}
