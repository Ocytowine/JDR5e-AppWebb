import type { ContractAiProviderV1 } from "../../narration-module/src/ai/FakeContractAiProvider";
import type { AiCallRequestV1, AiRoleOutputEnvelopeV1 } from "../../narration-module/src/ai/types";

export class ServerOpenAiEnhancementProviderV1 implements ContractAiProviderV1 {
  constructor(private readonly endpoint = "/api/narration/enhance-openai") {}

  async generate(request: AiCallRequestV1): Promise<unknown> {
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ request })
      });
      const data = await response.json().catch(() => null) as { output?: unknown; error?: unknown; issues?: unknown } | null;
      if (!response.ok) {
        if (data?.output) return data.output;
        const detail = Array.isArray(data?.issues)
          ? `HTTP ${response.status}: ${data.issues.filter((entry): entry is string => typeof entry === "string").join("; ")}`
          : `HTTP ${response.status}`;
        return serverErrorEnvelope(request, "SERVER_ROUTE_HTTP_ERROR", detail);
      }
      return data?.output ?? serverErrorEnvelope(request, "SERVER_ROUTE_EMPTY_OUTPUT", "Server route returned no output.");
    } catch (error) {
      return serverErrorEnvelope(
        request,
        "SERVER_ROUTE_FETCH_FAILED",
        error instanceof Error ? error.message : String(error)
      );
    }
  }
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
