import path from "node:path";
import {
  buildOpenAiResponsesBodyV1,
  liveOpenAiEnabledV1,
  loadOpenAiApiKeyV1,
  MINIMAL_AI_OUTPUT_JSON_SCHEMA_V1,
  OpenAiContractAiProviderV1,
  OpenAiResponsesProviderV1,
  type AiCallRequestV1,
  type AiRoleOutputEnvelopeV1,
  type OpenAiFetchV1,
  type OpenAiModelRouteV1
} from "../../src/ai";
import { assert } from "../contracts/assertions";

const campaignId = "campaign-openai-001";

function route(overrides: Partial<OpenAiModelRouteV1> = {}): OpenAiModelRouteV1 {
  return {
    schemaVersion: 1,
    routeId: "route-openai-intent",
    role: "intent_interpreter",
    providerKind: "REMOTE_PROVIDER",
    providerId: "openai",
    modelId: "gpt-4.1-mini",
    modelConfigVersion: "ai-provider-openai/1",
    certified: true,
    allowedContractVersions: ["intent-interpreter.v1"],
    inputTokenLimit: 6_000,
    outputTokenLimit: 800,
    timeoutMs: 5_000,
    fallbackRouteIds: [],
    maxRetries: 1,
    structuredOutputSchemaId: "ai_role_output_envelope_v1",
    liveEnabled: true,
    ...overrides
  };
}

function request(overrides: Partial<AiCallRequestV1> = {}): AiCallRequestV1 {
  return {
    schemaVersion: 1,
    callId: "call-openai-intent-001",
    operationId: "operation-openai-001",
    attemptId: "attempt-openai-001",
    campaignId,
    snapshotId: "snapshot-openai-001",
    packId: "pack-openai-001",
    role: "intent_interpreter",
    contractVersion: "intent-interpreter.v1",
    modelRouteId: "route-openai-intent",
    contextFingerprint: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    idempotencyKey: "idem-openai-001",
    input: {
      instructionsRef: "instructions:intent-interpreter:ai-provider-openai/1",
      roleContextPack: { schemaVersion: 1 },
      task: { playerInput: "Est-ce que je pourrais lui voler ses clés ?" }
    },
    limits: {
      inputTokenBudget: 1_000,
      outputTokenBudget: 400,
      timeoutMs: 2_000
    },
    ...overrides
  };
}

function validOutput(): AiRoleOutputEnvelopeV1 {
  return {
    schemaVersion: 1,
    contractVersion: "intent-interpreter.v1",
    outputId: "output-openai-001",
    callId: "call-openai-intent-001",
    attemptId: "attempt-openai-001",
    packId: "pack-openai-001",
    snapshotId: "snapshot-openai-001",
    role: "intent_interpreter",
    status: "OK",
    payload: {
      intents: [{
        intentId: "intent-001",
        order: 1,
        intentType: "possibility_query",
        commitment: "none",
        targets: ["actor:guard-01"],
        coreMeaning: "Question de possibilité.",
        desiredOutcome: null,
        requiredDetails: [],
        openDetails: [],
        forbiddenInterpretations: ["attempt_theft"],
        requiresClarification: false,
        clarificationQuestion: null,
        expectedTimeEffect: "NO_GAME_TIME"
      }],
      suspendedIntent: null
    },
    diagnostics: [],
    supersedesOutputId: null
  };
}

function response(status: number, data: unknown, statusText = "OK") {
  return {
    status,
    statusText,
    async json(): Promise<unknown> {
      return data;
    },
    async text(): Promise<string> {
      return typeof data === "string" ? data : JSON.stringify(data);
    }
  };
}

async function run(): Promise<void> {
  const keyFromEnv = loadOpenAiApiKeyV1({
    env: { OPENAI_API_KEY: "sk-test-env" },
    projectRoot: path.join(process.cwd(), "test-GAME-2D"),
    repositoryRoot: process.cwd()
  });
  assert.equal(keyFromEnv, "sk-test-env");
  assert.equal(liveOpenAiEnabledV1({}), false);
  assert.equal(liveOpenAiEnabledV1({ NARRATION_OPENAI_LIVE: "1" }), true);
  console.log("PASS [openai-provider] key resolution prefers process.env and live tests require explicit opt-in");

  const body = buildOpenAiResponsesBodyV1(request(), route(), MINIMAL_AI_OUTPUT_JSON_SCHEMA_V1);
  assert.equal(body.model, "gpt-4.1-mini");
  const text = body.text as { format?: { type?: string; strict?: boolean; schema?: Record<string, unknown> } };
  assert.equal(text.format?.type, "json_schema");
  assert.equal(text.format?.strict, true);
  assert.equal(text.format?.schema?.additionalProperties, false);
  console.log("PASS [openai-provider] Responses request uses strict structured output schema");

  let called = false;
  const noKeyProvider = new OpenAiResponsesProviderV1({
    apiKey: null,
    fetchImpl: (async () => {
      called = true;
      return response(200, {});
    }) as OpenAiFetchV1
  });
  const noKey = await noKeyProvider.call(request(), route());
  assert.equal(noKey.ok, false);
  assert.equal(called, false);
  if (!noKey.ok) {
    assert.equal(noKey.category, "AUTHORITY_VIOLATION");
    assert.equal(JSON.stringify(noKey.incident.safeDetails).includes("sk-"), false);
  }
  console.log("PASS [openai-provider] missing key fails before network and leaks no key");

  const unauthorizedProvider = new OpenAiResponsesProviderV1({
    apiKey: "sk-test-secret",
    fetchImpl: (async () => response(401, { error: { message: "bad key sk-test-secret" } }, "Unauthorized")) as OpenAiFetchV1
  });
  const unauthorized = await unauthorizedProvider.call(request(), route());
  assert.equal(unauthorized.ok, false);
  if (!unauthorized.ok) {
    assert.equal(unauthorized.category, "AUTHORITY_VIOLATION");
    assert.equal(unauthorized.retryable, false);
    assert.equal(JSON.stringify(unauthorized.incident.safeDetails).includes("sk-test-secret"), false);
  }
  console.log("PASS [openai-provider] 401/403 are blocking authority failures with redacted diagnostics");

  const rateLimitedProvider = new OpenAiResponsesProviderV1({
    apiKey: "sk-test-secret",
    fetchImpl: (async () => response(429, { error: { message: "rate limit" } }, "Too Many Requests")) as OpenAiFetchV1
  });
  const rateLimited = await rateLimitedProvider.call(request(), route());
  assert.equal(rateLimited.ok, false);
  if (!rateLimited.ok) {
    assert.equal(rateLimited.category, "TRANSPORT_FAILURE");
    assert.equal(rateLimited.retryable, true);
  }
  console.log("PASS [openai-provider] 429 is retryable transport failure");

  const invalidProvider = new OpenAiResponsesProviderV1({
    apiKey: "sk-test-secret",
    fetchImpl: (async () => response(200, { output_text: JSON.stringify({ ...validOutput(), unexpected: true }) })) as OpenAiFetchV1
  });
  const invalid = await invalidProvider.call(request(), route());
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.equal(invalid.category, "SCHEMA_VIOLATION");
    assert.equal(invalid.validation?.accepted, false);
  }
  console.log("PASS [openai-provider] provider output with unknown field is rejected by local validators");

  let capturedAuthorization = "";
  const validProvider = new OpenAiResponsesProviderV1({
    apiKey: "sk-test-secret",
    fetchImpl: (async (_url, init) => {
      capturedAuthorization = init.headers.Authorization;
      return response(200, {
        output_text: JSON.stringify(validOutput()),
        usage: { input_tokens: 42, output_tokens: 24, total_tokens: 66 }
      });
    }) as OpenAiFetchV1
  });
  const valid = await validProvider.call(request(), route());
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.output.outputId, "output-openai-001");
    assert.equal(valid.metrics.totalTokens, 66);
  }
  assert.equal(capturedAuthorization, "Bearer sk-test-secret");
  console.log("PASS [openai-provider] valid OpenAI-shaped response is parsed, revalidated and metered");

  const contractRoute = route({
    routeId: "route-openai-expression",
    role: "player_expression_adapter",
    allowedContractVersions: ["narrative-ai-resolution/1"],
    modelConfigVersion: "narrative-ai-resolution/1"
  });
  const contractRequest = request({
    callId: "call-openai-expression-001",
    operationId: "operation-openai-expression-001",
    attemptId: "attempt-openai-expression-001",
    snapshotId: "snapshot-openai-expression-001",
    packId: "pack-openai-expression-001",
    role: "player_expression_adapter",
    contractVersion: "narrative-ai-resolution/1",
    modelRouteId: "route-openai-expression",
    input: {
      instructionsRef: "narrative-ai-resolution/player-expression-adapter/v1",
      roleContextPack: { schemaVersion: 1 },
      task: { rawPlayerText: "Je dis au garde que je cherche les archives" }
    }
  });
  const expressionOutput: AiRoleOutputEnvelopeV1 = {
    schemaVersion: 1,
    contractVersion: "narrative-ai-resolution/1",
    outputId: "output-openai-expression-001",
    callId: "call-openai-expression-001",
    attemptId: "attempt-openai-expression-001",
    packId: "pack-openai-expression-001",
    snapshotId: "snapshot-openai-expression-001",
    role: "player_expression_adapter",
    status: "OK",
    payload: {
      intentId: "intent-openai-expression-001",
      expressionKind: "speech",
      renderedExpression: "Je formule ma demande avec calme: je cherche les archives.",
      meaningCovered: ["chercher les archives"],
      addedMeaning: [],
      omittedMeaning: [],
      styleChoices: ["calme"],
      safeToUse: true
    },
    diagnostics: [],
    supersedesOutputId: null
  };
  const contractProvider = new OpenAiContractAiProviderV1(new OpenAiResponsesProviderV1({
    apiKey: "sk-test-secret",
    fetchImpl: (async () => response(200, { output_text: JSON.stringify(expressionOutput) })) as OpenAiFetchV1
  }), contractRoute);
  const generated = await contractProvider.generate(contractRequest);
  assert.equal((generated as AiRoleOutputEnvelopeV1).role, "player_expression_adapter");
  assert.equal((generated as AiRoleOutputEnvelopeV1).contractVersion, "narrative-ai-resolution/1");
  console.log("PASS [openai-provider] OpenAI provider can be used behind ContractAiProviderV1 for narrative enhancement");
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
