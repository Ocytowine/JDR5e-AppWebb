import {
  FakeContractAiProviderV1,
  AiCircuitBreakerV1,
  intentAllowsMutationV1,
  renderDeterministicPostCommitFallbackV1,
  runAiPipelineCallV1,
  validateAiModelRouteV1,
  validateAiRoleOutputEnvelopeV1,
  type AiCallRequestV1,
  type AiModelRouteV1,
  type AiRetryPolicyV1,
  type AiRoleOutputEnvelopeV1,
  type IntentInterpreterPayloadV1,
  type SceneWriterPayloadV1
} from "../../src/ai";
import { assert } from "../contracts/assertions";

const campaignId = "campaign-ai-001";

function route(overrides: Partial<AiModelRouteV1> = {}): AiModelRouteV1 {
  return {
    schemaVersion: 1,
    routeId: "route-intent-fake",
    role: "intent_interpreter",
    providerKind: "FAKE_CONTRACT",
    providerId: "fake-contract",
    modelId: "fake-contract-v1",
    modelConfigVersion: "ai-pipeline/1",
    certified: true,
    allowedContractVersions: ["intent-interpreter.v1"],
    inputTokenLimit: 6_000,
    outputTokenLimit: 800,
    timeoutMs: 5_000,
    fallbackRouteIds: [],
    ...overrides
  };
}

function request(overrides: Partial<AiCallRequestV1> = {}): AiCallRequestV1 {
  return {
    schemaVersion: 1,
    callId: "call-intent-001",
    operationId: "operation-001",
    attemptId: "attempt-001",
    campaignId,
    snapshotId: "snapshot-001",
    packId: "pack-001",
    role: "intent_interpreter",
    contractVersion: "intent-interpreter.v1",
    modelRouteId: "route-intent-fake",
    contextFingerprint: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    idempotencyKey: "idem-operation-001",
    input: {
      instructionsRef: "instructions:intent-interpreter:ai-pipeline/1",
      roleContextPack: {},
      task: { playerInput: "Est-ce que je pourrais lui voler ses clés ?" }
    },
    limits: {
      inputTokenBudget: 2_000,
      outputTokenBudget: 400,
      timeoutMs: 2_000
    },
    ...overrides
  };
}

function retryPolicy(): AiRetryPolicyV1 {
  return {
    schemaVersion: 1,
    role: "intent_interpreter",
    maxTechnicalRetries: 0,
    maxTargetedCorrections: 1,
    maxFullRegenerations: 1,
    allowFallback: false
  };
}

function output(payload: IntentInterpreterPayloadV1, overrides: Partial<AiRoleOutputEnvelopeV1<IntentInterpreterPayloadV1>> = {}): AiRoleOutputEnvelopeV1<IntentInterpreterPayloadV1> {
  return {
    schemaVersion: 1,
    contractVersion: "intent-interpreter.v1",
    outputId: "output-intent-001",
    callId: "call-intent-001",
    attemptId: "attempt-001",
    packId: "pack-001",
    snapshotId: "snapshot-001",
    role: "intent_interpreter",
    status: "OK",
    payload,
    diagnostics: [],
    supersedesOutputId: null,
    ...overrides
  };
}

const possibilityPayload: IntentInterpreterPayloadV1 = {
  intents: [{
    intentId: "intent-possibility-theft",
    order: 1,
    intentType: "possibility_query",
    commitment: "none",
    targets: ["actor:guard-01"],
    coreMeaning: "Demander si voler les clés du garde serait possible.",
    desiredOutcome: null,
    requiredDetails: ["question hypothétique", "clés du garde"],
    openDetails: [],
    forbiddenInterpretations: ["attempt_theft", "touch_keys", "trigger_guard_reaction"],
    requiresClarification: false,
    clarificationQuestion: null,
    expectedTimeEffect: "NO_GAME_TIME"
  }],
  suspendedIntent: null
};

async function run(): Promise<void> {
  const accepted = output(possibilityPayload);
  const validation = validateAiRoleOutputEnvelopeV1(accepted, request());
  assert.equal(validation.accepted, true);
  assert.equal(intentAllowsMutationV1(possibilityPayload), false);
  assert.equal(possibilityPayload.intents[0].expectedTimeEffect, "NO_GAME_TIME");
  console.log("PASS [ai-pipeline] NAR-ACC-001 hypothetical guard question produces no mutation or game time");

  const unusableValidation = validateAiRoleOutputEnvelopeV1(output(possibilityPayload, {
    status: "PARTIAL_UNUSABLE",
    diagnostics: [{
      code: "PROVIDER_REFUSED",
      severity: "BLOCKING",
      message: "Provider refused usable output.",
      sourceRefs: ["operation:operation-001"]
    }]
  }), request());
  assert.equal(unusableValidation.accepted, false);
  assert.ok(unusableValidation.issues.some(issue => issue.includes("status")));
  console.log("PASS [ai-pipeline] non-OK role output status is rejected even with a valid payload");

  const provider = new FakeContractAiProviderV1([
    ["attempt-001", { ...accepted, unexpected: "field" }],
    ["attempt-001:retry-1", output(possibilityPayload, {
      outputId: "output-intent-corrected",
      attemptId: "attempt-001:retry-1",
      supersedesOutputId: "output-intent-001"
    })]
  ]);
  const runResult = await runAiPipelineCallV1({
    request: request(),
    route: route(),
    retryPolicy: retryPolicy(),
    provider
  });
  assert.equal(runResult.acceptedOutput?.outputId, "output-intent-corrected");
  assert.deepEqual(runResult.attempts.map(attempt => attempt.status), ["REJECTED", "ACCEPTED"]);
  assert.equal(runResult.incidents.length, 1);
  assert.equal(runResult.incidents[0].safeDetails.rawProviderOutput, "[REDACTED]");
  assert.deepEqual(runResult.incidents[0].safeDetails.outputDiagnosticMessages, []);
  console.log("PASS [ai-pipeline] NAR-ACC-014 invalid output is rejected then corrected with redacted incident");

  const diagnosticProvider = new FakeContractAiProviderV1([
    ["attempt-001", output(possibilityPayload, {
      status: "PARTIAL_UNUSABLE",
      diagnostics: [{
        code: "OPENAI_INVALID_JSON",
        severity: "BLOCKING",
        message: "OpenAI output was not parseable JSON. Preview: texte non JSON.",
        sourceRefs: ["operation:operation-001"]
      }]
    })]
  ]);
  const diagnosticRun = await runAiPipelineCallV1({
    request: request(),
    route: route(),
    retryPolicy: { ...retryPolicy(), maxTargetedCorrections: 0, maxFullRegenerations: 0 },
    provider: diagnosticProvider
  });
  assert.equal(diagnosticRun.acceptedOutput, null);
  assert.deepEqual(diagnosticRun.incidents[0].safeDetails.outputDiagnostics, ["OPENAI_INVALID_JSON"]);
  assert.deepEqual(diagnosticRun.incidents[0].safeDetails.outputDiagnosticMessages, ["OpenAI output was not parseable JSON. Preview: texte non JSON."]);
  console.log("PASS [ai-pipeline] provider diagnostic messages are preserved in safe incident details");

  const failedProvider = new FakeContractAiProviderV1([
    ["attempt-001", "not-json-object"],
    ["attempt-001:retry-1", { schemaVersion: 1 }],
    ["attempt-001:retry-2", { ...accepted, role: "scene_writer" }]
  ]);
  const failed = await runAiPipelineCallV1({
    request: request(),
    route: route(),
    retryPolicy: retryPolicy(),
    provider: failedProvider
  });
  assert.equal(failed.acceptedOutput, null);
  assert.equal(failed.attempts.length, 3);
  assert.equal(failed.attempts.every(attempt => attempt.status === "REJECTED"), true);
  console.log("PASS [ai-pipeline] bounded correction and full regeneration stop without pre-commit mutation");

  const remoteRoute = validateAiModelRouteV1(route({
    routeId: "route-real-forbidden",
    providerKind: "REMOTE_PROVIDER",
    providerId: "openai",
    fallbackRouteIds: ["fallback-uncertified"]
  }));
  assert.equal(remoteRoute.ok, false);
  const breaker = new AiCircuitBreakerV1({ schemaVersion: 1, failureThreshold: 2, halfOpenProbeLimit: 1 });
  assert.equal(breaker.canAttempt("intent_interpreter", "route-intent-fake"), true);
  assert.equal(breaker.recordFailure("intent_interpreter", "route-intent-fake").state, "CLOSED");
  assert.equal(breaker.recordFailure("intent_interpreter", "route-intent-fake").state, "OPEN");
  assert.equal(breaker.canAttempt("intent_interpreter", "route-intent-fake"), false);
  assert.equal(breaker.canAttempt("scene_writer", "route-scene-fake"), true);
  assert.equal(breaker.moveToHalfOpen("intent_interpreter", "route-intent-fake").state, "HALF_OPEN");
  assert.equal(breaker.canAttempt("intent_interpreter", "route-intent-fake"), true);
  breaker.recordHalfOpenProbe("intent_interpreter", "route-intent-fake");
  assert.equal(breaker.canAttempt("intent_interpreter", "route-intent-fake"), false);
  assert.equal(breaker.recordSuccess("intent_interpreter", "route-intent-fake").state, "CLOSED");
  console.log("PASS [ai-pipeline] remote provider, uncertified fallback and role-scoped circuit breaker are enforced in I-05A");

  const fallback = renderDeterministicPostCommitFallbackV1({
    operationId: "operation-render-001",
    committed: true,
    facts: ["L'accès est refusé par le garde."],
    utterances: ["Le garde dit : Sans mandat, personne ne franchit cette porte."],
    elapsedGameTimeSeconds: 45
  });
  assert.ok(fallback.includes("L'accès est refusé"));
  assert.ok(fallback.includes("45 secondes"));

  const sceneOutput: AiRoleOutputEnvelopeV1<SceneWriterPayloadV1> = {
    schemaVersion: 1,
    contractVersion: "scene-writer.v1",
    outputId: "output-scene-001",
    callId: "call-scene-001",
    attemptId: "attempt-scene-001",
    packId: "pack-scene-001",
    snapshotId: "snapshot-001",
    role: "scene_writer",
    status: "OK",
    payload: {
      narrationBlocks: [{
        slotId: "narration-001",
        blockKind: "MJ_NARRATION",
        content: "Le garde reste devant la porte.",
        groundedIn: ["commit:operation-render-001"],
        usesCreativeTexture: false
      }]
    },
    diagnostics: [],
    supersedesOutputId: null
  };
  const sceneValidation = validateAiRoleOutputEnvelopeV1(sceneOutput, request({
    callId: "call-scene-001",
    attemptId: "attempt-scene-001",
    packId: "pack-scene-001",
    role: "scene_writer",
    contractVersion: "scene-writer.v1",
    modelRouteId: "route-scene-fake"
  }));
  assert.equal(sceneValidation.accepted, true);
  console.log("PASS [ai-pipeline] post-commit render can fall back deterministically without replaying business resolution");
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
