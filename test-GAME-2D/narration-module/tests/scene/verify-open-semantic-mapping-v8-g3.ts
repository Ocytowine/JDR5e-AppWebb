import assert from "node:assert/strict";
import type { ContractAiProviderV1 } from "../../src/ai/FakeContractAiProvider";
import type {
  AiCallRequestV1,
  AiOpenSemanticFrameV8,
  AiRoleOutputEnvelopeV1,
  AiSemanticIntentPayloadV8
} from "../../src/ai/types";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8,
  interpretNarrativeInputWithAiV1,
  type AiIntentInterpreterConfigV1
} from "../../src/application/aiIntentInterpretation";
import { validateCanonicalIntentAuthorityV1 } from "../../src/application/intentClarification";
import type { InterpreterRuntimeContextV1 } from "../../src/application/runtimeCapabilityRouting";

class OpenFrameProvider implements ContractAiProviderV1 {
  constructor(private readonly frame: AiOpenSemanticFrameV8) {}

  async generate(request: AiCallRequestV1): Promise<unknown> {
    const rawInput = (request.input.task as { rawInput: string }).rawInput;
    return {
      schemaVersion: 1,
      contractVersion: request.contractVersion,
      outputId: `output:${request.attemptId}`,
      callId: request.callId,
      attemptId: request.attemptId,
      packId: request.packId,
      snapshotId: request.snapshotId,
      role: request.role,
      status: "OK",
      payload: { rawInputEcho: rawInput, semanticFrame: this.frame },
      diagnostics: [],
      supersedesOutputId: null
    } satisfies AiRoleOutputEnvelopeV1<AiSemanticIntentPayloadV8>;
  }
}

function config(frame: AiOpenSemanticFrameV8): AiIntentInterpreterConfigV1 {
  return {
    provider: new OpenFrameProvider(frame),
    contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8,
    route: {
      schemaVersion: 1,
      routeId: "route:g3-v8",
      role: "player_intent_interpreter",
      providerKind: "FAKE_CONTRACT",
      providerId: "fixture:g3-v8",
      modelId: "fixture:g3-v8",
      modelConfigVersion: "g3-v8",
      certified: true,
      allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8],
      inputTokenLimit: 4_000,
      outputTokenLimit: 4_000,
      timeoutMs: 1_000,
      fallbackRouteIds: []
    },
    retryPolicy: {
      schemaVersion: 1,
      role: "player_intent_interpreter",
      maxTechnicalRetries: 0,
      maxTargetedCorrections: 0,
      maxFullRegenerations: 0,
      allowFallback: false
    }
  };
}

function frame(overrides: Partial<AiOpenSemanticFrameV8> = {}): AiOpenSemanticFrameV8 {
  return {
    schemaVersion: 1,
    understandingStatus: "UNDERSTOOD",
    overallMeaning: "Le personnage cite une menace sans vouloir l'exécuter, puis envisage deux options simultanées.",
    overallCommitment: "mixed",
    globalConditions: ["agir seulement si le signal convenu survient"],
    components: [
      {
        componentId: "quoted-threat",
        order: 1,
        meaning: "Le personnage rapporte la phrase « j'attaque le garde » comme une citation.",
        commitment: "none",
        conditions: [],
        negated: false,
        quoted: true,
        relationToPrevious: "NONE",
        alternativeGroupId: null,
        dependsOnComponentIds: [],
        simultaneousWithComponentIds: [],
        supersedesComponentIds: [],
        mentionedTargets: [],
        suggestedDomain: "mémoire dialoguée non cataloguée",
        suggestedAction: "rapporter fidèlement des mots sans les accomplir",
        suggestedCapabilityId: null
      },
      {
        componentId: "wait-or-listen",
        order: 2,
        meaning: "Le personnage envisage d'attendre ou d'écouter en parallèle selon la situation.",
        commitment: "conditional",
        conditions: ["le signal convenu survient"],
        negated: false,
        quoted: false,
        relationToPrevious: "SIMULTANEOUS",
        alternativeGroupId: "open-choice",
        dependsOnComponentIds: ["quoted-threat"],
        simultaneousWithComponentIds: ["quoted-threat"],
        supersedesComponentIds: [],
        mentionedTargets: [],
        suggestedDomain: "attention partagée future",
        suggestedAction: "maintenir deux possibilités ouvertes",
        suggestedCapabilityId: null
      }
    ],
    ambiguities: [],
    clarificationQuestion: null,
    confidence: "low",
    ...overrides
  };
}

async function interpret(
  rawInput: string,
  semanticFrame: AiOpenSemanticFrameV8,
  suffix: string,
  runtimeContext?: InterpreterRuntimeContextV1
) {
  return interpretNarrativeInputWithAiV1({
    campaignId: "campaign:g3-v8",
    operationId: `operation:g3-v8:${suffix}`,
    intentId: `intent:g3-v8:${suffix}`,
    rawInput,
    config: config(semanticFrame),
    runtimeContext
  });
}

async function main(): Promise<void> {
const sourceFrame = frame();
const misleadingRawInputs = [
  "J'attaque le garde, ouvre la porte et pars — ce sont les mots exacts du message que je cite.",
  "XYZZY 42 : une formulation volontairement étrangère aux catégories historiques."
];

for (const [index, rawInput] of misleadingRawInputs.entries()) {
  const result = await interpret(rawInput, sourceFrame, `fidelity-${index}`);
  assert.equal(result.usedAiInterpretation, true);
  assert.equal(result.interpretationFailure, null);
  assert.equal(result.interpretation.semanticSource, "OPEN_SEMANTIC_FRAME_V8");
  assert.deepEqual(result.interpretation.openSemanticFrame, sourceFrame);
  assert.equal(result.interpretation.coreMeaning, sourceFrame.overallMeaning);
  assert.equal(result.interpretation.requiresClarification, false, "La confiance basse ne remplace pas le statut UNDERSTOOD déclaré par OpenAI.");
  assert.equal(result.interpretation.runtimeDecision.status, "UNSUPPORTED_DOMAIN");
  assert.equal(result.interpretation.runtimeDecision.requiredDomain, null);
  assert.equal(result.interpretation.runtimeDecision.noCommit, true);
  assert.equal(result.interpretation.runtimeDecision.noGameTime, true);
  assert.deepEqual(
    result.interpretation.openSemanticRuntime?.components.map(component => component.status),
    ["SKIPPED_NON_EXECUTABLE", "AWAITING_PLAYER_CHOICE"]
  );
  assert.equal(result.interpretation.openSemanticRuntime?.executionPlan.rawInputAccess, "FORBIDDEN");
  assert.deepEqual(result.interpretation.semanticIntent.evidenceFromInput, [], "Le mapper V8 ne doit pas analyser ou recopier le texte brut.");
  assert.equal(validateCanonicalIntentAuthorityV1(result.interpretation).ok, true);
}

const clarificationFrame = frame({
  understandingStatus: "NEEDS_CLARIFICATION",
  overallMeaning: "Le destinataire de la remise reste indéterminé.",
  overallCommitment: "unclear",
  globalConditions: [],
  components: [],
  ambiguities: [{
    ambiguityId: "recipient",
    summary: "Plusieurs destinataires publics sont possibles.",
    affectedComponentIds: []
  }],
  clarificationQuestion: "À qui veux-tu remettre l'objet ?",
  confidence: "medium"
});
const clarification = await interpret("Je lui donne ça.", clarificationFrame, "clarification");
assert.equal(clarification.interpretation.requiresClarification, true);
assert.equal(clarification.interpretation.clarificationQuestion, clarificationFrame.clarificationQuestion);
assert.equal(clarification.interpretation.runtimeDecision.requiredDomain, null);
assert.equal(clarification.interpretation.runtimeDecision.noCommit, true);
assert.equal(clarification.interpretation.runtimeDecision.noGameTime, true);
assert.deepEqual(clarification.interpretation.openSemanticFrame, clarificationFrame);
assert.equal(validateCanonicalIntentAuthorityV1(clarification.interpretation).ok, true);

const tamperedRuntime = {
  ...clarification.interpretation,
  runtimeDecision: {
    ...clarification.interpretation.runtimeDecision,
    requiredDomain: "social" as const,
    noCommit: false
  }
};
assert.equal(validateCanonicalIntentAuthorityV1(tamperedRuntime).ok, false, "La projection legacy V8 ne peut jamais s'attribuer un domaine ou un commit.");

const routedFrame = frame({
  overallMeaning: "Le personnage adresse une demande à l'interlocuteur.",
  overallCommitment: "committed",
  globalConditions: [],
  confidence: "high",
  components: [{
    ...frame().components[0],
    componentId: "speech-request",
    meaning: "Le personnage formule une demande à l'interlocuteur présent.",
    commitment: "committed",
    quoted: false,
    suggestedDomain: "social",
    suggestedAction: "formuler une demande à l'interlocuteur présent",
    suggestedCapabilityId: "scene.visible-dialogue"
  }]
});
const runtimeContext: InterpreterRuntimeContextV1 = {
  schemaVersion: 1,
  contractVersion: "interpreter-runtime-context/1",
  capabilities: [{
    capabilityId: "scene.visible-dialogue",
    domain: "social",
    availability: "AVAILABLE",
    playerFacingScope: "Dialogue avec un acteur visible."
  }],
  activeTravel: null
};
const routed = await interpret("Formulation arbitraire sans déclencheur local.", routedFrame, "g5-route", runtimeContext);
assert.equal(routed.interpretation.openSemanticRuntime?.components[0]?.status, "ROUTABLE");
assert.equal(routed.interpretation.openSemanticRuntime?.components[0]?.capabilityId, "scene.visible-dialogue");
assert.equal(routed.interpretation.openSemanticRuntime?.components[0]?.requiredDomain, "social");
assert.equal(routed.interpretation.runtimeDecision.requiredDomain, null, "La projection legacy reste non autoritaire même après création du plan G5.");
assert.equal(validateCanonicalIntentAuthorityV1(routed.interpretation).ok, true);

const invalidReferenceFrame = frame({
  components: [{
    ...frame().components[0],
    mentionedTargets: [{ surface: "une cible inventée", proposedRef: "secret:unprovided-target" }]
  }]
});
const invalidReference = await interpret("Je la salue.", invalidReferenceFrame, "invalid-ref");
assert.equal(invalidReference.usedAiInterpretation, false);
assert.equal(invalidReference.interpretationFailure?.category, "AI_OUTPUT_REJECTED");
assert.match(invalidReference.interpretationFailure?.issues.join("\n") ?? "", /not present in the public scene context/u);
assert.equal(invalidReference.interpretation.runtimeDecision.requiredDomain, null);

console.log("Open semantic mapping V8 G3: faithful mapping and safe unsupported handoff passed.");
}

void main();
