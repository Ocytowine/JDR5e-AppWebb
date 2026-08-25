"use strict";

const assert = require("node:assert/strict");
const {
  buildRoleInstructions,
  buildStrictAiOutputSchema,
  normalizeAiCallRequest,
  normalizeProviderEnvelope,
  validateEnvelope
} = require("../../server/narrativeOpenAiEnhancementRoute");

const req = {
  schemaVersion: 1,
  callId: "call:g2-server",
  operationId: "operation:g2-server",
  attemptId: "attempt:g2-server",
  campaignId: "campaign:g2-server",
  snapshotId: "snapshot:g2-server",
  packId: "pack:g2-server",
  role: "player_intent_interpreter",
  contractVersion: "ai-intent-semantic/8",
  modelRouteId: "route:g2-server",
  contextFingerprint: `sha256:${"2".repeat(64)}`,
  idempotencyKey: "idem:g2-server",
  input: {
    instructionsRef: "ai-intent-semantic/player-intent-interpreter/v8",
    roleContextPack: {},
    task: { rawInput: "J'observe puis j'attends." }
  },
  limits: { inputTokenBudget: 1_200, outputTokenBudget: 1_200, timeoutMs: 10_000 }
};

const components = Array.from({ length: 6 }, (_, index) => ({
  componentId: `component-${index + 1}`,
  order: index + 1,
  meaning: `Composante sémantique ouverte ${index + 1}.`,
  commitment: "committed",
  conditions: [],
  negated: false,
  quoted: false,
  relationToPrevious: index === 0 ? "NONE" : "THEN",
  alternativeGroupId: null,
  dependsOnComponentIds: [],
  simultaneousWithComponentIds: [],
  supersedesComponentIds: [],
  mentionedTargets: [],
  suggestedDomain: index === 5 ? "un domaine futur non encore raccordé" : null,
  suggestedAction: index === 5 ? "une action nouvelle non cataloguée" : null,
  suggestedCapabilityId: null
}));

const output = {
  schemaVersion: 1,
  contractVersion: req.contractVersion,
  outputId: "output:g2-server",
  callId: req.callId,
  attemptId: req.attemptId,
  packId: req.packId,
  snapshotId: req.snapshotId,
  role: req.role,
  status: "OK",
  payload: {
    rawInputEcho: req.input.task.rawInput,
    semanticFrame: {
      schemaVersion: 1,
      understandingStatus: "UNDERSTOOD",
      overallMeaning: "Le personnage enchaîne six composantes comprises.",
      overallCommitment: "committed",
      globalConditions: [],
      components,
      ambiguities: [],
      clarificationQuestion: null,
      confidence: "high"
    }
  },
  diagnostics: [],
  supersedesOutputId: null
};

assert.equal(normalizeAiCallRequest(req).ok, true, "La route doit accepter le contrat V8.");
assert.equal(validateEnvelope(output, req).ok, true, "La route doit valider une sortie V8 ouverte.");
assert.deepEqual(
  normalizeProviderEnvelope(structuredClone(output), req),
  output,
  "La route ne doit pas recanonicaliser le cadre V8."
);

const schema = buildStrictAiOutputSchema(req).schema;
const componentSchema = schema.properties.payload.properties.semanticFrame.properties.components;
assert.equal(Object.hasOwn(componentSchema, "maxItems"), false, "Le nombre de composantes ne doit pas être plafonné.");
assert.equal(
  Object.hasOwn(componentSchema.items.properties.suggestedAction.anyOf[0], "enum"),
  false,
  "L'action suggérée doit rester une chaîne ouverte."
);
assert.deepEqual(
  componentSchema.items.properties.suggestedCapabilityId,
  { type: "null" },
  "Sans capacité publiée, aucun identifiant technique ne doit être routable."
);
const routedReq = structuredClone(req);
routedReq.input.task.embodiedContext = {
  runtimeCapabilities: [
    { capabilityId: "scene.visible-dialogue", availability: "AVAILABLE" },
    { capabilityId: "scene.inventory-handoff", availability: "HANDOFF_ONLY" },
    { capabilityId: "scene.external-only", availability: "EXTERNAL_TRIGGER_ONLY" }
  ]
};
const routedCapabilitySchema = buildStrictAiOutputSchema(routedReq).schema
  .properties.payload.properties.semanticFrame.properties.components.items.properties.suggestedCapabilityId;
assert.deepEqual(
  routedCapabilitySchema.anyOf[0].enum,
  ["scene.visible-dialogue", "scene.inventory-handoff"],
  "Le champ technique doit être borné aux seules capacités publiées et routables."
);
assert.equal(
  Object.hasOwn(componentSchema.items.properties.suggestedDomain.anyOf[0], "enum"),
  false,
  "Le domaine suggéré doit rester une chaîne ouverte."
);

const instructions = buildRoleInstructions(req);
assert.match(instructions, /aucune liste fermée d'actions/u);
assert.match(instructions, /activeInterlocutor et recentIntentions/u);
assert.match(instructions, /ne doit jamais suspendre rétroactivement/u);
assert.doesNotMatch(instructions, /kind=move_near_visible_actor/u);

console.log("Open semantic frame V8 G2: server schema and non-canonicalization passed.");
