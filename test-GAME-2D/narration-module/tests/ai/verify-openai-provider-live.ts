import {
  liveOpenAiEnabledV1,
  loadOpenAiApiKeyV1,
  OpenAiResponsesProviderV1,
  type AiCallRequestV1,
  type OpenAiModelRouteV1
} from "../../src/ai";
import { assert } from "../contracts/assertions";

const repositoryRoot = process.cwd().replace(/\\test-GAME-2D$/u, "");

function route(): OpenAiModelRouteV1 {
  return {
    schemaVersion: 1,
    routeId: "route-openai-live-intent",
    role: "intent_interpreter",
    providerKind: "REMOTE_PROVIDER",
    providerId: "openai",
    modelId: process.env.NARRATION_OPENAI_MODEL || "gpt-4.1-mini",
    modelConfigVersion: "ai-provider-openai/1",
    certified: true,
    allowedContractVersions: ["intent-interpreter.v1"],
    inputTokenLimit: 6_000,
    outputTokenLimit: 800,
    timeoutMs: 10_000,
    fallbackRouteIds: [],
    maxRetries: 0,
    structuredOutputSchemaId: "ai_role_output_envelope_v1",
    liveEnabled: true
  };
}

function request(): AiCallRequestV1 {
  return {
    schemaVersion: 1,
    callId: "call-openai-live-intent-001",
    operationId: "operation-openai-live-001",
    attemptId: "attempt-openai-live-001",
    campaignId: "campaign-openai-live",
    snapshotId: "snapshot-openai-live",
    packId: "pack-openai-live",
    role: "intent_interpreter",
    contractVersion: "intent-interpreter.v1",
    modelRouteId: "route-openai-live-intent",
    contextFingerprint: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    idempotencyKey: "idem-openai-live-001",
    input: {
      instructionsRef: "Réponds uniquement avec l'enveloppe JSON demandée. Classe la phrase comme question hypothétique, sans action.",
      roleContextPack: { schemaVersion: 1, note: "fixture live sans secret de campagne" },
      task: { playerInput: "Est-ce que je pourrais lui voler ses clés ?" }
    },
    limits: {
      inputTokenBudget: 1_000,
      outputTokenBudget: 400,
      timeoutMs: 10_000
    }
  };
}

async function run(): Promise<void> {
  if (!liveOpenAiEnabledV1(process.env)) {
    console.log("SKIP [openai-provider-live] NARRATION_OPENAI_LIVE is not 1.");
    return;
  }
  const apiKey = loadOpenAiApiKeyV1({
    env: process.env,
    projectRoot: process.cwd(),
    repositoryRoot
  });
  if (!apiKey) {
    console.log("SKIP [openai-provider-live] OPENAI_API_KEY is unavailable.");
    return;
  }
  const provider = new OpenAiResponsesProviderV1({
    apiKey,
    fetchImpl: fetch
  });
  const result = await provider.call(request(), route());
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.output.role, "intent_interpreter");
    assert.equal(result.validation.accepted, true);
  }
  console.log("PASS [openai-provider-live] OpenAI Responses smoke test returned a locally valid envelope");
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
