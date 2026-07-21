import { cloneJson } from "../core";
import type { AiCallRequestV1, AiCallTelemetryV1, AiRoleOutputEnvelopeV1 } from "./types";

export interface ContractAiProviderV1 {
  generate(request: AiCallRequestV1): Promise<unknown>;
  takeTelemetry?(attemptId: string): AiCallTelemetryV1 | null;
}

export class FakeContractAiProviderV1 implements ContractAiProviderV1 {
  private readonly outputs = new Map<string, unknown>();

  constructor(outputs: Array<[string, unknown]> = []) {
    for (const [attemptId, output] of outputs) this.outputs.set(attemptId, cloneJson(output));
  }

  setOutput(attemptId: string, output: unknown): void {
    this.outputs.set(attemptId, cloneJson(output));
  }

  async generate(request: AiCallRequestV1): Promise<unknown> {
    if (this.outputs.has(request.attemptId)) return cloneJson(this.outputs.get(request.attemptId));
    return {
      schemaVersion: 1,
      contractVersion: request.contractVersion,
      outputId: `output:${request.attemptId}`,
      callId: request.callId,
      attemptId: request.attemptId,
      packId: request.packId,
      snapshotId: request.snapshotId,
      role: request.role,
      status: "OK",
      payload: {},
      diagnostics: [],
      supersedesOutputId: null
    } satisfies AiRoleOutputEnvelopeV1;
  }
}
