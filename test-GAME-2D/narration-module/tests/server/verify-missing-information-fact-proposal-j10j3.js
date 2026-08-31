"use strict";

const assert = require("node:assert/strict");
const {
  buildRoleInstructions,
  buildStrictAiOutputSchema,
  normalizeAiCallRequest,
  validateEnvelope
} = require("../../server/narrativeOpenAiEnhancementRoute");

const request = {
  schemaVersion: 1,
  callId: "call:j10j3",
  operationId: "operation:j10j3",
  attemptId: "attempt:j10j3",
  campaignId: "campaign:j10j3",
  snapshotId: "snapshot:j10j3",
  packId: "pack:j10j3",
  role: "scene_creator",
  contractVersion: "missing-information-fact-proposal/1",
  modelRouteId: "route:j10j3",
  contextFingerprint: `sha256:${"7".repeat(64)}`,
  idempotencyKey: "idempotency:j10j3",
  input: {
    instructionsRef: "scene-creator/missing-information-fact/v1",
    roleContextPack: {
      authority: "PROPOSE_ONLY_NO_COMMIT",
      target: {
        propertyRef: "lore-property:opaque:p-19",
        subjectRef: "lore-entity:opaque",
        publicLabel: "élément public opaque",
        valueKind: "IDENTITY",
        identityRole: "Rôle public opaque"
      },
      publicContextFacts: [],
      constraints: []
    },
    task: { requiredOutput: "missing-information-fact-proposal/1" }
  },
  limits: { inputTokenBudget: 2_000, outputTokenBudget: 600, timeoutMs: 10_000 }
};

function envelope(payload) {
  return {
    schemaVersion: 1,
    contractVersion: request.contractVersion,
    outputId: "output:j10j3",
    callId: request.callId,
    attemptId: request.attemptId,
    packId: request.packId,
    snapshotId: request.snapshotId,
    role: request.role,
    status: "OK",
    payload,
    diagnostics: [],
    supersedesOutputId: null
  };
}

const valid = {
  proposalId: "proposal:j10j3",
  propertyRef: "lore-property:opaque:p-19",
  valueKind: "IDENTITY",
  generatedValue: "Valeur publique proposée",
  authority: "PROPOSE_ONLY_NO_COMMIT"
};

assert.equal(normalizeAiCallRequest(request).ok, true);
assert.equal(validateEnvelope(envelope(valid), request).ok, true);
assert.equal(validateEnvelope(envelope({ ...valid, propertyRef: "lore-property:escape:x" }), request).ok, false);
assert.equal(validateEnvelope(envelope({ ...valid, authority: "COMMIT" }), request).ok, false);
const payloadSchema = buildStrictAiOutputSchema(request).schema.properties.payload;
assert.equal(payloadSchema.properties.propertyRef.const, request.input.roleContextPack.target.propertyRef);
assert.equal(payloadSchema.properties.valueKind.const, "IDENTITY");
assert.equal(payloadSchema.properties.authority.const, "PROPOSE_ONLY_NO_COMMIT");
const instructions = buildRoleInstructions(request);
assert.match(instructions, /aucune autorité de commit/u);
assert.match(instructions, /uniquement un nom personnel/u);

console.log("missing-information-fact-proposal/J10-J3 server: OK (strict target, proposal-only authority, no commit)");

