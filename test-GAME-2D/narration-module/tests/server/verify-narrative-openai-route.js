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

function intentRequest(overrides = {}) {
  return request({
    callId: "call-route-intent-001",
    operationId: "operation-route-intent-001",
    attemptId: "attempt-route-intent-001",
    snapshotId: "snapshot-route-intent-001",
    packId: "pack-route-intent-001",
    role: "player_intent_interpreter",
    contractVersion: "ai-intent-interpretation/1",
    input: {
      instructionsRef: "ai-intent-interpretation/player-intent-interpreter/v1",
      roleContextPack: {
        sceneId: "reference-inn-rain-001",
        presentNpc: [{ actorId: "npc-garde-blesse", displayName: "Garde blessé", keywords: ["garde", "lui"] }]
      },
      task: {
        rawInput: "Je m'approche du garde et je lui demande s'il a vu quelque chose d'étrange.",
        allowedIntentTypes: ["meta_question", "possibility_query", "memory_recall", "speech", "action", "mixed", "unclear_commitment"],
        forbiddenAuthority: ["commit", "time", "inventory", "tactical", "durable_lore", "social_success"]
      }
    },
    ...overrides
  });
}

function intentOutputFor(req, overrides = {}) {
  return {
    schemaVersion: 1,
    contractVersion: req.contractVersion,
    outputId: "output-route-intent-001",
    callId: req.callId,
    attemptId: req.attemptId,
    packId: req.packId,
    snapshotId: req.snapshotId,
    role: req.role,
    status: "OK",
    payload: {
      rawInputEcho: req.input.task.rawInput,
      intents: [{
        intentId: "intent:1",
        order: 1,
        intentType: "speech",
        commitment: "committed",
        target: { kind: "npc", ref: "npc:npc-garde-blesse", label: "garde" },
        action: "ask",
        topic: "s'il a vu quelque chose d'étrange",
        coreMeaning: "Le personnage demande au garde s'il a vu quelque chose d'étrange.",
        playerImposedDetails: ["s'approcher du garde", "poser une question"],
        openDetails: [],
        forbiddenInterpretations: ["le garde répond", "un succès social est acquis"],
        requiresClarification: false,
        clarificationQuestion: null,
        riskFlags: [],
        expectedTimeEffect: "DOMAIN_TO_DECIDE",
        confidence: "high",
        ...overrides.intent
      }]
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
  const normalizedIntent = normalizeAiCallRequest(intentRequest());
  assert.equal(normalizedIntent.ok, true);
  const rejectedIntentContract = normalizeAiCallRequest(intentRequest({ contractVersion: "narrative-ai-resolution/1" }));
  assert.equal(rejectedIntentContract.ok, false);

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

  const intentBody = buildOpenAiResponsesBody(intentRequest(), { modelId: "gpt-4.1-mini" });
  assert.equal(intentBody.text.format.schema.properties.contractVersion.enum[0], "ai-intent-interpretation/1");
  assert.equal(intentBody.text.format.schema.properties.role.enum[0], "player_intent_interpreter");
  assert.equal(intentBody.text.format.schema.properties.payload.properties.intents.items.required.includes("expectedTimeEffect"), true);
  assert.equal(intentBody.input[0].content[0].text.includes("transformer une possibilite en action executee"), true);

  const dangerousExpression = validateEnvelope({ ...outputFor(request()), payload: { ...outputFor(request()).payload, addedMeaning: ["promesse de payer"] } }, request());
  assert.equal(dangerousExpression.ok, false);
  assert.equal(dangerousExpression.issues.includes("payload.addedMeaning must be empty."), true);
  const dangerousIntent = validateEnvelope(
    intentOutputFor(intentRequest(), { intent: { intentType: "possibility_query", commitment: "committed" } }),
    intentRequest()
  );
  assert.equal(dangerousIntent.ok, false);
  assert.equal(dangerousIntent.issues.includes("payload.intents[0] possibility_query must stay hypothetical."), true);
  const socialSpeechReq = intentRequest({
    input: {
      ...intentRequest().input,
      task: {
        ...intentRequest().input.task,
        rawInput: "j'aimerais parler a un garde"
      }
    }
  });
  const dangerousSocialSpeechIntent = validateEnvelope(
    intentOutputFor(socialSpeechReq, { intent: { intentType: "action", action: "act", coreMeaning: "Le personnage agit vers le garde." } }),
    socialSpeechReq
  );
  assert.equal(dangerousSocialSpeechIntent.ok, false);
  assert.equal(dangerousSocialSpeechIntent.issues.includes("payload.intents[0] social speech request must not be action."), true);

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
  let capturedBody = null;
  const liveApi = createNarrativeOpenAiEnhancementApi({
    env: { NARRATION_OPENAI_LIVE: "1", NARRATION_OPENAI_MODEL: "gpt-4.1-mini", NARRATION_OPENAI_INTENT_MODEL: "gpt-4.1-intent-test" },
    apiKey: "sk-test-secret",
    fetchImpl: async (_url, init) => {
      capturedAuth = init.headers.Authorization;
      capturedBody = JSON.parse(init.body);
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
  assert.equal(capturedBody.model, "gpt-4.1-mini");

  const liveIntentApi = createNarrativeOpenAiEnhancementApi({
    env: { NARRATION_OPENAI_LIVE: "1", NARRATION_OPENAI_MODEL: "gpt-4.1-mini", NARRATION_OPENAI_INTENT_MODEL: "gpt-4.1-intent-test" },
    apiKey: "sk-test-secret",
    fetchImpl: async (_url, init) => {
      capturedBody = JSON.parse(init.body);
      return {
        status: 200,
        statusText: "OK",
        async json() {
          return { output_text: JSON.stringify(intentOutputFor(intentRequest())), usage: { input_tokens: 11, output_tokens: 21, total_tokens: 32 } };
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
  const liveIntent = await runRoute(liveIntentApi, { request: intentRequest() });
  assert.equal(liveIntent.statusCode, 200);
  assert.equal(liveIntent.payload.ok, true);
  assert.equal(liveIntent.payload.output.role, "player_intent_interpreter");
  assert.equal(liveIntent.payload.output.contractVersion, "ai-intent-interpretation/1");
  assert.equal(capturedBody.model, "gpt-4.1-intent-test");

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
