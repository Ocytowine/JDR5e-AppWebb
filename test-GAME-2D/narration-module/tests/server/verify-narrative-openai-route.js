"use strict";

const assert = require("node:assert/strict");
const {
  buildOpenAiResponsesBody,
  buildStrictAiOutputSchema,
  createNarrativeOpenAiEnhancementApi,
  normalizeAiCallRequest,
  validateEnvelope
} = require("../../server/narrativeOpenAiEnhancementRoute");

function request(overrides = {}) {
  return {
    schemaVersion: 1,
    callId: "call-route-expression-001",
    operationId: "operation-route-expression-001",
    attemptId: "attempt-route-expression-001",
    campaignId: "campaign-route-001",
    snapshotId: "snapshot-route-001",
    packId: "pack-route-001",
    role: "player_expression_adapter",
    contractVersion: "narrative-ai-resolution/1",
    modelRouteId: "client-route-placeholder",
    contextFingerprint: "sha256:route-fixture",
    idempotencyKey: "idem-route-expression-001",
    input: {
      instructionsRef: "narrative-ai-resolution/player-expression-adapter/v1",
      roleContextPack: {},
      task: { rawPlayerText: "Je dis au garde que je cherche les archives" }
    },
    limits: {
      inputTokenBudget: 800,
      outputTokenBudget: 400,
      timeoutMs: 1_000
    },
    ...overrides
  };
}

function outputFor(req) {
  return {
    schemaVersion: 1,
    contractVersion: req.contractVersion,
    outputId: "output-route-expression-001",
    callId: req.callId,
    attemptId: req.attemptId,
    packId: req.packId,
    snapshotId: req.snapshotId,
    role: req.role,
    status: "OK",
    payload: {
      intentId: "intent-route-expression-001",
      expressionKind: "speech",
      renderedExpression: "Je formule calmement ma demande au garde: je cherche les archives.",
      meaningCovered: ["chercher les archives"],
      addedMeaning: [],
      omittedMeaning: [],
      styleChoices: ["calme"],
      safeToUse: true
    },
    diagnostics: [],
    supersedesOutputId: null
  };
}

function mockReq(body) {
  return {
    method: "POST",
    url: "/api/narration/enhance-openai",
    body
  };
}

function mockRes() {
  return {
    statusCode: null,
    payload: null
  };
}

async function runRoute(api, body) {
  const res = mockRes();
  await api.tryHandle(mockReq(body), res);
  return res;
}

async function main() {
  const normalized = normalizeAiCallRequest(request());
  assert.equal(normalized.ok, true);
  const rejected = normalizeAiCallRequest(request({ role: "mj_planner" }));
  assert.equal(rejected.ok, false);

  const body = buildOpenAiResponsesBody(request(), { modelId: "gpt-4.1-mini" });
  assert.equal(body.text.format.type, "json_schema");
  assert.equal(body.text.format.strict, true);
  assert.equal(body.store, false);
  assert.deepEqual(body.text.format.schema.properties.callId.enum, [request().callId]);
  assert.deepEqual(body.text.format.schema.properties.role.enum, ["player_expression_adapter"]);
  assert.deepEqual(body.text.format.schema.properties.supersedesOutputId.type, ["string", "null"]);
  assert.equal(body.text.format.schema.properties.payload.required.includes("addedMeaning"), true);
  assert.equal(body.input[0].content[0].text.includes("addedMeaning doit rester []"), true);

  const sceneReq = request({
    callId: "call-route-scene-001",
    attemptId: "attempt-route-scene-001",
    role: "scene_writer",
    input: {
      instructionsRef: "narrative-ai-resolution/scene-writer/v1",
      roleContextPack: {},
      task: { resolutionIds: ["resolution-route-001"] }
    }
  });
  const sceneSchema = buildStrictAiOutputSchema(sceneReq);
  assert.deepEqual(sceneSchema.schema.properties.role.enum, ["scene_writer"]);
  assert.equal(sceneSchema.schema.properties.payload.required.includes("narrationBlocks"), true);
  assert.equal(sceneSchema.schema.properties.payload.properties.narrationBlocks.items.required.includes("groundedIn"), true);

  const dangerousExpression = validateEnvelope({ ...outputFor(request()), payload: { ...outputFor(request()).payload, addedMeaning: ["promesse de payer"] } }, request());
  assert.equal(dangerousExpression.ok, false);
  assert.equal(dangerousExpression.issues.includes("payload.addedMeaning must be empty."), true);

  let sendCount = 0;
  const disabledApi = createNarrativeOpenAiEnhancementApi({
    env: {},
    apiKey: "sk-test-secret",
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    },
    parseJsonBody: async req => req.body,
    sendJson: (res, statusCode, data) => {
      sendCount += 1;
      res.statusCode = statusCode;
      res.payload = data;
    }
  });
  const disabled = await runRoute(disabledApi, { request: request() });
  assert.equal(sendCount, 1);
  assert.equal(disabled.statusCode, 200);
  assert.equal(disabled.payload.ok, false);
  assert.equal(disabled.payload.error, "OPENAI_NOT_ENABLED");

  let called = false;
  const missingKeyApi = createNarrativeOpenAiEnhancementApi({
    env: { NARRATION_OPENAI_LIVE: "1" },
    apiKey: null,
    fetchImpl: async () => {
      called = true;
      throw new Error("fetch should not be called");
    },
    parseJsonBody: async req => req.body,
    sendJson: (res, statusCode, data) => {
      res.statusCode = statusCode;
      res.payload = data;
    }
  });
  const missingKey = await runRoute(missingKeyApi, { request: request() });
  assert.equal(called, false);
  assert.equal(missingKey.payload.error, "OPENAI_API_KEY_MISSING");

  let capturedAuth = "";
  const liveApi = createNarrativeOpenAiEnhancementApi({
    env: { NARRATION_OPENAI_LIVE: "1", NARRATION_OPENAI_MODEL: "gpt-4.1-mini" },
    apiKey: "sk-test-secret",
    fetchImpl: async (_url, init) => {
      capturedAuth = init.headers.Authorization;
      return {
        status: 200,
        statusText: "OK",
        async json() {
          return { output_text: JSON.stringify(outputFor(request())), usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 } };
        },
        async text() {
          return "";
        }
      };
    },
    parseJsonBody: async req => req.body,
    sendJson: (res, statusCode, data) => {
      res.statusCode = statusCode;
      res.payload = data;
    }
  });
  const live = await runRoute(liveApi, { request: request() });
  assert.equal(live.statusCode, 200);
  assert.equal(live.payload.ok, true);
  assert.equal(live.payload.output.role, "player_expression_adapter");
  assert.equal(capturedAuth, "Bearer sk-test-secret");

  const invalidOutputApi = createNarrativeOpenAiEnhancementApi({
    env: { NARRATION_OPENAI_LIVE: "1" },
    apiKey: "sk-test-secret",
    fetchImpl: async () => ({
      status: 200,
      statusText: "OK",
      async json() {
        return { output_text: JSON.stringify({ ...outputFor(request()), role: "scene_writer" }) };
      },
      async text() {
        return "";
      }
    }),
    parseJsonBody: async req => req.body,
    sendJson: (res, statusCode, data) => {
      res.statusCode = statusCode;
      res.payload = data;
    }
  });
  const invalidOutput = await runRoute(invalidOutputApi, { request: request() });
  assert.equal(invalidOutput.payload.ok, false);
  assert.equal(invalidOutput.payload.error, "OPENAI_INVALID_ENVELOPE");

  const httpErrorApi = createNarrativeOpenAiEnhancementApi({
    env: { NARRATION_OPENAI_LIVE: "1" },
    apiKey: "sk-test-secret",
    fetchImpl: async () => ({
      status: 400,
      statusText: "Bad Request",
      async json() {
        throw new Error("json should not be called");
      },
      async text() {
        return "{\"error\":{\"message\":\"Invalid schema sk-test-redacted\"}}";
      }
    }),
    parseJsonBody: async req => req.body,
    sendJson: (res, statusCode, data) => {
      res.statusCode = statusCode;
      res.payload = data;
    }
  });
  const httpError = await runRoute(httpErrorApi, { request: request() });
  assert.equal(httpError.payload.ok, false);
  assert.equal(httpError.payload.error, "OPENAI_HTTP_ERROR");
  assert.equal(httpError.payload.output.diagnostics[0].message.includes("[REDACTED_KEY]"), true);

  console.log("narrative-openai-route/1: OK");
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
