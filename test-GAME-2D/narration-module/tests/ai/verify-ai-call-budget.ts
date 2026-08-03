import {
  activateAiCallBudgetV1,
  clearAiCallBudgetForTestV1,
  inspectAiCallBudgetV1,
  runAiPipelineCallV1,
  type AiCallRequestV1,
  type AiModelRouteV1,
  type AiRetryPolicyV1,
  type AiRoleV1,
  type ContractAiProviderV1
} from "../../src/ai";
import { assert } from "../contracts/assertions";

class CountingProvider implements ContractAiProviderV1 {
  calls = 0;

  async generate(): Promise<unknown> {
    this.calls += 1;
    return {
      diagnostics: [{
        code: "HTTP_ERROR",
        severity: "BLOCKING",
        message: "Synthetic technical failure.",
        sourceRefs: ["operation:budget-test"]
      }]
    };
  }
}

function route(providerId = "server-openai-route"): AiModelRouteV1 {
  return {
    schemaVersion: 1,
    routeId: `route:${providerId}`,
    role: "intent_interpreter",
    providerKind: "FAKE_CONTRACT",
    providerId,
    modelId: "budget-test-model",
    modelConfigVersion: "budget-test/1",
    certified: true,
    allowedContractVersions: ["intent-interpreter.v1"],
    inputTokenLimit: 2_000,
    outputTokenLimit: 500,
    timeoutMs: 1_000,
    fallbackRouteIds: []
  };
}

function request(operationId: string): AiCallRequestV1 {
  return {
    schemaVersion: 1,
    callId: `${operationId}:call`,
    operationId,
    attemptId: `${operationId}:attempt:1`,
    campaignId: "campaign:budget-test",
    snapshotId: `${operationId}:snapshot`,
    packId: `${operationId}:pack`,
    role: "intent_interpreter",
    contractVersion: "intent-interpreter.v1",
    modelRouteId: "route:server-openai-route",
    contextFingerprint: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    idempotencyKey: `${operationId}:idempotency`,
    input: {
      instructionsRef: "instructions:budget-test",
      roleContextPack: {},
      task: { playerInput: "Test du plafond." }
    },
    limits: {
      inputTokenBudget: 500,
      outputTokenBudget: 200,
      timeoutMs: 1_000
    }
  };
}

function retryPolicy(maxTechnicalRetries: number): AiRetryPolicyV1 {
  return {
    schemaVersion: 1,
    role: "intent_interpreter",
    maxTechnicalRetries,
    maxTargetedCorrections: 0,
    maxFullRegenerations: 0,
    allowFallback: true
  };
}

async function main(): Promise<void> {
  const operationId = "operation:budget-test";
  clearAiCallBudgetForTestV1(operationId);
  activateAiCallBudgetV1(operationId, 3);
  const provider = new CountingProvider();
  const result = await runAiPipelineCallV1({
    request: request(operationId),
    route: route(),
    retryPolicy: retryPolicy(3),
    provider
  });
  assert.equal(provider.calls, 3, "The fourth billable attempt must never reach the provider.");
  assert.equal(result.attempts.length, 3);
  assert.equal(result.validation.failureCategory, "BUDGET_EXCEEDED");
  assert.equal(result.incidents.at(-1)?.category, "BUDGET_EXCEEDED");
  const snapshot = inspectAiCallBudgetV1(operationId);
  assert.equal(snapshot?.consumedAttemptIds.length, 3);
  assert.equal(snapshot?.deniedAttemptIds.length, 1);
  assert.equal(snapshot?.remainingBillableCalls, 0);

  const crossRoleOperationId = "operation:budget-cross-role";
  clearAiCallBudgetForTestV1(crossRoleOperationId);
  activateAiCallBudgetV1(crossRoleOperationId, 3);
  const crossRoleProvider = new CountingProvider();
  const roles: AiRoleV1[] = ["intent_interpreter", "mj_planner", "npc_performer", "scene_writer"];
  for (const [index, role] of roles.entries()) {
    const roleRoute = { ...route(), role, routeId: `route:cross-role:${role}` } as AiModelRouteV1;
    const roleRequest = {
      ...request(crossRoleOperationId),
      callId: `${crossRoleOperationId}:call:${index}`,
      attemptId: `${crossRoleOperationId}:attempt:${index}`,
      role,
      modelRouteId: roleRoute.routeId,
      idempotencyKey: `${crossRoleOperationId}:idempotency:${index}`
    } as AiCallRequestV1;
    await runAiPipelineCallV1({
      request: roleRequest,
      route: roleRoute,
      retryPolicy: { ...retryPolicy(0), role },
      provider: crossRoleProvider
    });
  }
  assert.equal(crossRoleProvider.calls, 3, "The cap must be shared by interpreter, planner, performer and writer.");
  assert.equal(inspectAiCallBudgetV1(crossRoleOperationId)?.deniedAttemptIds.length, 1);

  const localOperationId = "operation:budget-local";
  clearAiCallBudgetForTestV1(localOperationId);
  activateAiCallBudgetV1(localOperationId, 3);
  const localProvider = new CountingProvider();
  await runAiPipelineCallV1({
    request: { ...request(localOperationId), modelRouteId: "route:local-fixture" },
    route: route("local-fixture"),
    retryPolicy: retryPolicy(3),
    provider: localProvider
  });
  assert.equal(localProvider.calls, 4, "Local deterministic/fake calls do not consume the billed OpenAI budget.");
  assert.equal(inspectAiCallBudgetV1(localOperationId)?.consumedAttemptIds.length, 0);

  console.log("ai call budget: three billable attempts maximum across retries; local calls excluded.");
}

void main();
