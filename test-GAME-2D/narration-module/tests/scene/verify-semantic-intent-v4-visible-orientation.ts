import assert from "node:assert/strict";
import type {
  AiCallRequestV1,
  AiRoleOutputEnvelopeV1,
  AiSemanticIntentPayloadV4,
  ContractAiProviderV1
} from "../../src/ai";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V4,
  NARRATIVE_RESOLUTION_CONTRACT_VERSION_V1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  adjudicateContextualActionV1,
  createDefaultAiIntentInterpreterConfigV1,
  interpretNarrativeInputWithAiV1,
  isImmediateVisibleOrientationResolutionV1,
  type NarrativeResolutionResultV1,
  resolvePerceptionV1
} from "../../src/application";

const visibleInput = "Je cherche le garde pour lui demander de l'aide.";
const uncertainInput = "Je cherche à voir si le garde dissimule quelque chose sous sa tenue.";

const fixtures = new Map<string, AiSemanticIntentPayloadV4>([
  [visibleInput, semanticPayload(visibleInput, {
    playerGoal: "Repérer le garde visible afin de pouvoir lui demander de l'aide.",
    targetMention: {
      surface: "le garde",
      candidateKind: "npc",
      proposedRef: "npc:npc-garde-blesse",
      contextLink: "EXPLICIT"
    },
    perception: {
      schemaVersion: 1,
      depth: "SEARCH",
      focus: "présence du garde",
      soughtInformation: "localiser le garde visible",
      informationKind: "PRESENCE"
    },
    composition: {
      orientation: {
        kind: "LOCATE_VISIBLE_TARGET",
        playerGoal: "Repérer le garde visible.",
        order: 1
      },
      spatialLeadIn: null,
      communication: null
    }
  })],
  [uncertainInput, semanticPayload(uncertainInput, {
    playerGoal: "Rechercher un signe indiquant que le garde dissimule quelque chose sous sa tenue.",
    targetMention: {
      surface: "le garde",
      candidateKind: "npc",
      proposedRef: "npc:npc-garde-blesse",
      contextLink: "EXPLICIT"
    },
    perception: {
      schemaVersion: 1,
      depth: "SEARCH",
      focus: "ce que le garde pourrait dissimuler sous sa tenue",
      soughtInformation: "un objet dissimulé sous la tenue du garde",
      informationKind: "UNCERTAIN_CLUE"
    },
    composition: {
      orientation: null,
      spatialLeadIn: null,
      communication: null
    }
  })]
]);

const provider: ContractAiProviderV1 = {
  async generate(request: AiCallRequestV1): Promise<unknown> {
    const rawInput = (request.input.task as { rawInput: string }).rawInput;
    const payload = fixtures.get(rawInput);
    if (!payload) throw new Error(`Fixture V4 absente: ${rawInput}`);
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
      payload,
      diagnostics: [],
      supersedesOutputId: null
    } satisfies AiRoleOutputEnvelopeV1<AiSemanticIntentPayloadV4>;
  }
};

async function main(): Promise<void> {
  const base = createDefaultAiIntentInterpreterConfigV1();
  const config = {
    ...base,
    provider,
    contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V4,
    route: {
      ...base.route,
      allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V4],
      outputTokenLimit: 900
    }
  };
  const visible = await interpretNarrativeInputWithAiV1({
    campaignId: "cmp-v4-visible",
    operationId: "op-v4-visible",
    intentId: "intent-v4-visible",
    rawInput: visibleInput,
    config
  });
  const uncertain = await interpretNarrativeInputWithAiV1({
    campaignId: "cmp-v4-uncertain",
    operationId: "op-v4-uncertain",
    intentId: "intent-v4-uncertain",
    rawInput: uncertainInput,
    config
  });

  assert.equal(visible.usedAiInterpretation, true, JSON.stringify(visible.interpretationFailure?.issues ?? []));
  assert.equal(visible.interpretation.semanticIntent.perception?.informationKind, "PRESENCE");
  assert.equal(visible.interpretation.semanticIntent.perception?.depth, "GLANCE", "l'orientation structurée stabilise la présence visible sans relire le texte");
  assert.equal(visible.interpretation.target?.ref, "npc:npc-garde-blesse");
  const visibleAdjudication = adjudicateContextualActionV1({
    interpretation: visible.interpretation,
    scene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
  });
  assert.equal(visibleAdjudication.disposition, "AUTOMATIC_SUCCESS");
  const visiblePerception = resolvePerceptionV1({
    semanticIntent: visible.interpretation.semanticIntent,
    targetRef: visible.interpretation.target?.ref ?? null,
    scene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
  });
  assert.equal(visiblePerception?.status, "AUTOMATIC_RESULT");
  assert.equal(visiblePerception?.checkProposal, null);
  assert.equal(visiblePerception?.revealedTexts.some(text => /garde/iu.test(text)), true);
  assert.equal(isImmediateVisibleOrientationResolutionV1(resolutionFor(
    "visible",
    visible.interpretation as NarrativeResolutionResultV1["interpretation"],
    visibleAdjudication,
    visiblePerception
  )), true, "une présence déjà visible possède un rendu déterministe suffisant");

  assert.equal(uncertain.usedAiInterpretation, true, JSON.stringify(uncertain.interpretationFailure?.issues ?? []));
  assert.equal(uncertain.interpretation.semanticIntent.perception?.informationKind, "UNCERTAIN_CLUE");
  assert.equal(uncertain.interpretation.semanticIntent.perception?.depth, "SEARCH");
  const uncertainAdjudication = adjudicateContextualActionV1({
    interpretation: uncertain.interpretation,
    scene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
  });
  assert.equal(
    uncertainAdjudication.disposition,
    "CHECK_REQUIRED",
    "une information réellement incertaine conserve la proposition de test"
  );
  const uncertainPerception = resolvePerceptionV1({
    semanticIntent: uncertain.interpretation.semanticIntent,
    targetRef: uncertain.interpretation.target?.ref ?? null,
    scene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
  });
  assert.equal(isImmediateVisibleOrientationResolutionV1(resolutionFor(
    "uncertain",
    uncertain.interpretation as NarrativeResolutionResultV1["interpretation"],
    uncertainAdjudication,
    uncertainPerception
  )), false, "un indice incertain ne prend jamais le raccourci d'orientation");
  console.log("semantic-intent-v4/visible-orientation: OK (présence visible automatique, indice incertain vérifié)");
}

function resolutionFor(
  suffix: string,
  interpretation: NarrativeResolutionResultV1["interpretation"],
  actionAdjudication: NarrativeResolutionResultV1["actionAdjudication"],
  perception: NarrativeResolutionResultV1["perception"]
): NarrativeResolutionResultV1 {
  return {
    schemaVersion: 1,
    contractVersion: NARRATIVE_RESOLUTION_CONTRACT_VERSION_V1,
    resolutionId: `resolution-v4-${suffix}`,
    operationId: `operation-v4-${suffix}`,
    resultKind: "NO_COMMIT_RESPONSE",
    interpretation,
    domainCommand: null,
    characterExpression: null,
    preparedEffects: [],
    handoff: null,
    commitId: null,
    noGameTime: true,
    safetyNotes: [],
    actionAdjudication,
    perception
  };
}

function semanticPayload(
  rawInput: string,
  overrides: Pick<AiSemanticIntentPayloadV4["intent"], "playerGoal" | "targetMention" | "perception" | "composition">
): AiSemanticIntentPayloadV4 {
  return {
    rawInputEcho: rawInput,
    intent: {
      kind: "observe_environment",
      commitment: "committed",
      preconditions: [],
      playerGoal: overrides.playerGoal,
      actionHint: "observer",
      domainHint: "perception",
      scope: "PERCEPTION",
      targetMention: overrides.targetMention,
      perception: overrides.perception,
      dialogueAct: null,
      composition: overrides.composition,
      uncertainties: [],
      clarificationPrompt: null,
      confidence: "high"
    }
  };
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
