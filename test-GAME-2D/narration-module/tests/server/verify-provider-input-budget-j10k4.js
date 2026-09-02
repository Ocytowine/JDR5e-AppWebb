"use strict";

const assert = require("node:assert/strict");
const {
  buildServerRoute,
  createNarrativeOpenAiEnhancementApi,
  measureOpenAiInputBudget,
  prepareOpenAiInputWithinBudget
} = require("../../server/narrativeOpenAiEnhancementRoute");

function request(overrides = {}) {
  return {
    schemaVersion: 1,
    callId: "call:j10k4",
    operationId: "operation:j10k4",
    attemptId: "attempt:j10k4",
    campaignId: "campaign:j10k4",
    snapshotId: "snapshot:j10k4",
    packId: "pack:j10k4",
    role: "player_expression_adapter",
    contractVersion: "narrative-ai-resolution/1",
    modelRouteId: "route:j10k4",
    contextFingerprint: `sha256:${"4".repeat(64)}`,
    idempotencyKey: "idempotency:j10k4",
    input: {
      instructionsRef: "narrative-ai-resolution/player-expression-adapter/v1",
      roleContextPack: { schemaVersion: 1, authority: "EXPRESSION_ONLY" },
      task: {
        rawPlayerText: "Je salue le garde.",
        deterministicExpression: "Le personnage salue le garde.",
        coreMeaning: "Saluer le garde visible.",
        forbidden: ["added_goal"]
      }
    },
    limits: { inputTokenBudget: 3_000, outputTokenBudget: 800, timeoutMs: 1_000 },
    ...overrides
  };
}

function outputFor(req) {
  return {
    schemaVersion: 1,
    contractVersion: req.contractVersion,
    outputId: "output:j10k4",
    callId: req.callId,
    attemptId: req.attemptId,
    packId: req.packId,
    snapshotId: req.snapshotId,
    role: req.role,
    status: "OK",
    payload: {
      intentId: "intent:j10k4",
      expressionKind: "speech",
      renderedExpression: "Je salue le garde.",
      meaningCovered: ["Saluer le garde visible."],
      addedMeaning: [],
      omittedMeaning: [],
      styleChoices: [],
      safeToUse: true
    },
    diagnostics: [],
    supersedesOutputId: null
  };
}

function api(fetchImpl) {
  return createNarrativeOpenAiEnhancementApi({
    env: { NARRATION_OPENAI_LIVE: "1" },
    apiKey: "sk-test-j10k4",
    fetchImpl,
    parseJsonBody: async req => req.body,
    sendJson: (res, statusCode, data) => {
      res.statusCode = statusCode;
      res.payload = data;
    }
  });
}

async function run(routeApi, req) {
  const res = { statusCode: null, payload: null };
  await routeApi.tryHandle({ method: "POST", url: "/api/narration/enhance-openai", body: { request: req } }, res);
  return res.payload;
}

async function main() {
  const baseline = request();
  const route = buildServerRoute(baseline, {});
  const report = measureOpenAiInputBudget(baseline, route);
  assert.equal(report.contractVersion, "narrative-provider-input-budget/1");
  assert.equal(report.withinBudget, true);
  assert.equal(report.serializedBodyChars,
    Object.values(report.sections).reduce((sum, section) => sum + section.chars, 0));
  assert.ok(report.estimatedInputTokens > report.baseEstimatedTokens);
  assert.ok(report.sections.instructions.chars > 0);
  assert.ok(report.sections.taskAndContext.chars > 0);
  assert.ok(report.sections.structuredOutputSchema.chars > 0);
  assert.ok(report.sections.providerEnvelope.chars > 0);

  const roleProfiles = [{ id: "expression", role: "player_expression_adapter", contractVersion: "narrative-ai-resolution/1", budget: 3_000 },
    { id: "interpreter-v8", role: "player_intent_interpreter", contractVersion: "ai-intent-semantic/8", budget: 8_000 },
    { id: "mj-planner", role: "mj_planner", contractVersion: "mj-planner/1", budget: 4_000 },
    { id: "npc-performer", role: "npc_performer", contractVersion: "npc-performer/1", budget: 8_000 },
    { id: "scene-writer", role: "scene_writer", contractVersion: "narrative-ai-resolution/1", budget: 4_000 },
    { id: "coherence-critic", role: "coherence_critic", contractVersion: "narrative-ai-resolution/1", budget: 4_000 },
    { id: "fact-creator", role: "scene_creator", contractVersion: "missing-information-fact-proposal/1", budget: 4_000 },
    { id: "plot-creator", role: "scene_creator", contractVersion: "plot-candidate/1", budget: 8_000 }
  ].map(profile => {
    const profileRequest = request({
      role: profile.role,
      contractVersion: profile.contractVersion,
      input: {
        instructionsRef: `j10k4/${profile.id}/v1`,
        roleContextPack: { schemaVersion: 1, authority: "NON_COMMITTABLE" },
        task: profile.id === "fact-creator"
          ? { context: { target: { propertyRef: "property:j10k4", valueKind: "IDENTITY" } } }
          : { context: { sourceRefs: ["source:j10k4"], authority: "NON_COMMITTABLE" } }
      },
      limits: { ...baseline.limits, inputTokenBudget: profile.budget }
    });
    const measured = measureOpenAiInputBudget(profileRequest, buildServerRoute(profileRequest, {}));
    assert.equal(measured.withinBudget, true, `${profile.id} fixture must fit its role ceiling`);
    return { id: profile.id, budget: profile.budget, estimatedInputTokens: measured.estimatedInputTokens };
  });

  let rejectedFetches = 0;
  const rejected = await run(api(async () => {
    rejectedFetches += 1;
    throw new Error("budget rejection must happen before fetch");
  }), request({ limits: { ...baseline.limits, inputTokenBudget: 1 } }));
  assert.equal(rejectedFetches, 0);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error, "OPENAI_INPUT_BUDGET_EXCEEDED");
  assert.equal(rejected.metrics.inputBudgetStatus, "REJECTED_OVER_BUDGET");
  assert.equal(rejected.metrics.inputTokens, null);
  assert.match(rejected.output.diagnostics[0].message, /aucun contenu autoritaire n'a été tronqué/u);

  const reducible = request({
    input: {
      ...baseline.input,
      task: { ...baseline.input.task, packetReceipt: { diagnostic: "x".repeat(1_200) } }
    },
    limits: { ...baseline.limits, inputTokenBudget: report.estimatedInputTokens + 8 }
  });
  const prepared = prepareOpenAiInputWithinBudget(reducible, buildServerRoute(reducible, {}));
  assert.equal(prepared.ok, true);
  assert.deepEqual(prepared.report.appliedReductions, ["input.task.packetReceipt"]);
  assert.equal(Object.prototype.hasOwnProperty.call(prepared.request.input.task, "packetReceipt"), false);

  let sentBody = null;
  const accepted = await run(api(async (_url, init) => {
    sentBody = JSON.parse(init.body);
    return {
      status: 200,
      statusText: "OK",
      async json() {
        return { output_text: JSON.stringify(outputFor(reducible)), usage: { input_tokens: 700, output_tokens: 50, total_tokens: 750 }, status: "completed" };
      },
      async text() { return ""; }
    };
  }), reducible);
  assert.equal(accepted.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(JSON.parse(sentBody.input[1].content[0].text).task, "packetReceipt"), false);
  assert.equal(JSON.parse(sentBody.input[1].content[0].text).task.rawPlayerText, "Je salue le garde.");
  assert.equal(accepted.metrics.inputBudgetStatus, "WITHIN_BUDGET");
  assert.deepEqual(accepted.metrics.appliedInputReductions, ["input.task.packetReceipt"]);
  assert.equal(accepted.metrics.actualInputTokenDelta, 700 - accepted.metrics.estimatedInputTokens);

  console.log(JSON.stringify({
    contractVersion: report.contractVersion,
    status: "OK",
    estimatedInputTokens: report.estimatedInputTokens,
    roleProfiles,
    sectionCharacters: Object.fromEntries(Object.entries(report.sections).map(([key, value]) => [key, value.chars])),
    preflightRefusalWithoutFetch: true,
    deterministicReduction: "input.task.packetReceipt",
    providerUsageDeltaExposed: true
  }, null, 2));
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
