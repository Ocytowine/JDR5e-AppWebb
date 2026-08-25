import type { ContractAiProviderV1 } from "../../src/ai/FakeContractAiProvider";
import type {
  AiCallRequestV1,
  AiRoleOutputEnvelopeV1,
  AiSemanticIntentPayloadV8
} from "../../src/ai/types";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8,
  type AiIntentInterpreterConfigV1
} from "../../src/application/aiIntentInterpretation";
import type { OpenSemanticCorpusCaseG6 } from "./open-semantic-corpus-g6";

/**
 * Fixture de transport seulement : la correspondance exacte restitue une sortie
 * OpenAI pré-écrite. Elle n'interprète jamais le texte et ne doit pas être
 * importée par le code produit.
 */
export class SimulatedOpenAiSemanticProviderG6 implements ContractAiProviderV1 {
  private readonly casesByInput: ReadonlyMap<string, OpenSemanticCorpusCaseG6>;
  readonly requests: AiCallRequestV1[] = [];

  constructor(cases: readonly OpenSemanticCorpusCaseG6[]) {
    this.casesByInput = new Map(cases.map(entry => [entry.rawInput, entry]));
  }

  async generate(request: AiCallRequestV1): Promise<unknown> {
    this.requests.push(structuredClone(request));
    const rawInputValue = (request.input.task as { rawInput?: unknown }).rawInput;
    const rawInput = typeof rawInputValue === "string" ? rawInputValue : null;
    const corpusCase = rawInput === null ? undefined : this.casesByInput.get(rawInput);
    if (corpusCase === undefined) throw new Error("G6 simulated provider has no exact fixture for this input.");
    if (rawInput === null) throw new Error("G6 simulated provider requires a string input.");
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
      payload: { rawInputEcho: rawInput, semanticFrame: structuredClone(corpusCase.frame) },
      diagnostics: [],
      supersedesOutputId: null
    } satisfies AiRoleOutputEnvelopeV1<AiSemanticIntentPayloadV8>;
  }
}

export function createSimulatedOpenAiSemanticConfigG6(
  cases: readonly OpenSemanticCorpusCaseG6[]
): AiIntentInterpreterConfigV1 {
  return {
    provider: new SimulatedOpenAiSemanticProviderG6(cases),
    contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8,
    route: {
      schemaVersion: 1,
      routeId: "route:g6-openai-simulated",
      role: "player_intent_interpreter",
      providerKind: "FAKE_CONTRACT",
      providerId: "fixture:g6-openai-simulated",
      modelId: "fixture:g6-open-semantic-v8",
      modelConfigVersion: "g6-corpus-1",
      certified: true,
      allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8],
      inputTokenLimit: 8_000,
      outputTokenLimit: 8_000,
      timeoutMs: 1_000,
      fallbackRouteIds: []
    },
    retryPolicy: {
      schemaVersion: 1,
      role: "player_intent_interpreter",
      maxTechnicalRetries: 0,
      maxTargetedCorrections: 0,
      maxFullRegenerations: 0,
      allowFallback: false
    }
  };
}
