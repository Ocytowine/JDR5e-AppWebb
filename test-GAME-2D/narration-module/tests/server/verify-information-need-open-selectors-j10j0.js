"use strict";

const assert = require("node:assert/strict");
const {
  buildRoleInstructions,
  buildStrictAiOutputSchema,
  validateEnvelope
} = require("../../server/narrativeOpenAiEnhancementRoute");

const request = {
  schemaVersion: 1,
  callId: "call:j10j0-server",
  operationId: "operation:j10j0-server",
  attemptId: "attempt:j10j0-server",
  campaignId: "campaign:j10j0-server",
  snapshotId: "snapshot:j10j0-server",
  packId: "pack:j10j0-server",
  role: "player_intent_interpreter",
  contractVersion: "ai-intent-semantic/8",
  modelRouteId: "route:j10j0-server",
  contextFingerprint: `sha256:${"5".repeat(64)}`,
  idempotencyKey: "idempotency:j10j0-server",
  input: {
    instructionsRef: "ai-intent-semantic/player-intent-interpreter/v8",
    roleContextPack: {},
    task: { rawInput: "Formulation libre" }
  },
  limits: { inputTokenBudget: 2_000, outputTokenBudget: 2_000, timeoutMs: 10_000 }
};

const need = {
  schemaVersion: 1,
  contractVersion: "information-need/2",
  subjectMention: "un sujet quelconque",
  proposedSubjectRef: null,
  proposedScopeRefs: ["public-scope:s-8"],
  proposedPropertyRefs: ["semantic-property:p-17"],
  proposedRelationRefs: ["semantic-relation:r-4"],
  completionPropertyRefs: ["semantic-property:p-17", "semantic-property:p-18"],
  requestedDimension: "une dimension ouverte",
  temporalScope: "CURRENT",
  requestedAnswerShape: "OPEN",
  sourceComponentId: "component:j10j0-server"
};

function output(informationNeed) {
  return {
    schemaVersion: 1,
    contractVersion: request.contractVersion,
    outputId: "output:j10j0-server",
    callId: request.callId,
    attemptId: request.attemptId,
    packId: request.packId,
    snapshotId: request.snapshotId,
    role: request.role,
    status: "OK",
    payload: {
      rawInputEcho: request.input.task.rawInput,
      semanticFrame: {
        schemaVersion: 1,
        understandingStatus: "UNDERSTOOD",
        overallMeaning: "Le personnage demande une information.",
        overallCommitment: "committed",
        globalConditions: [],
        components: [{
          componentId: "component:j10j0-server",
          order: 1,
          meaning: "Le personnage demande une information.",
          commitment: "committed",
          conditions: [],
          negated: false,
          quoted: false,
          relationToPrevious: "NONE",
          alternativeGroupId: null,
          dependsOnComponentIds: [],
          simultaneousWithComponentIds: [],
          supersedesComponentIds: [],
          mentionedTargets: [],
          suggestedDomain: null,
          suggestedAction: null,
          suggestedCapabilityId: null,
          dialogueAct: { act: "ASK_QUESTION", contentGoal: "Obtenir une information." },
          informationNeed
        }],
        ambiguities: [],
        clarificationQuestion: null,
        confidence: "high"
      }
    },
    diagnostics: [],
    supersedesOutputId: null
  };
}

assert.equal(validateEnvelope(output(need), request).ok, true);
assert.equal(validateEnvelope(output({ ...need, contractVersion: "information-need/1" }), request).ok, false);
assert.equal(validateEnvelope(output({ ...need, proposedRelationRefs: ["not-a-ref"] }), request).ok, false);
assert.equal(validateEnvelope(output({ ...need, proposedPropertyRefs: ["semantic-property:p-17", "semantic-property:p-17"] }), request).ok, false);
assert.equal(validateEnvelope(output({
  ...need,
  proposedScopeRefs: [],
  proposedPropertyRefs: [],
  proposedRelationRefs: [],
  completionPropertyRefs: []
}), request).ok, false, "an understood factual need must never cross the route with empty selectors");

const informationSchema = buildStrictAiOutputSchema(request).schema.properties.payload
  .properties.semanticFrame.properties.components.items.properties.informationNeed.anyOf[0];
assert.deepEqual(informationSchema.properties.contractVersion.enum, ["information-need/2"]);
for (const key of ["proposedScopeRefs", "proposedPropertyRefs", "proposedRelationRefs", "completionPropertyRefs"]) {
  assert.equal(informationSchema.required.includes(key), true);
  assert.equal(informationSchema.properties[key].items.pattern, "^[a-z][a-z0-9_-]*:.+");
}
const instructions = buildRoleInstructions(request);
assert.match(instructions, /n'invente jamais une référence/iu);
assert.match(instructions, /ni une taxonomie depuis les mots du joueur/u);
assert.match(instructions, /NEEDS_CLARIFICATION/u);

console.log("information-need/J10-J0 server: OK (strict V2 schema, canonical open refs, no lexical taxonomy)");
