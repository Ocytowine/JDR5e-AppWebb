import assert from "node:assert/strict";
import type {
  AiCallRequestV1,
  AiRoleOutputEnvelopeV1,
  AiSemanticIntentPayloadV5,
  ContractAiProviderV1
} from "../../src/ai";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V5,
  NARRATIVE_RESOLUTION_CONTRACT_VERSION_V1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  buildLocalMjPlanPayload,
  buildReferenceSceneBlocksV1,
  createDefaultAiIntentInterpreterConfigV1,
  interpretNarrativeInputWithAiV1,
  semanticIntentReleasesFocusV1,
  type NarrativeResolutionResultV1
} from "../../src/application";

const rawInput = "Je m'approche du garde, je le remercie puis je m'écarte pour le laisser travailler.";
const payload: AiSemanticIntentPayloadV5 = {
  rawInputEcho: rawInput,
  intent: {
    kind: "address_visible_actor",
    commitment: "committed",
    preconditions: [],
    playerGoal: "S'approcher du garde, le remercier puis s'en éloigner.",
    actionHint: "remercier_puis_s_ecarter",
    domainHint: "social",
    scope: "SOCIAL_EXCHANGE",
    targetMention: {
      surface: "le garde",
      candidateKind: "npc",
      proposedRef: "npc:npc-garde-blesse",
      contextLink: "EXPLICIT"
    },
    perception: null,
    dialogueAct: {
      act: "MAKE_STATEMENT",
      contentGoal: "Remercier le garde."
    },
    composition: {
      orientation: null,
      spatialLeadIn: {
        kind: "APPROACH_TARGET",
        playerGoal: "S'approcher du garde.",
        order: 1
      },
      communication: {
        mode: "SPEECH",
        act: "MAKE_STATEMENT",
        contentGoal: "Remercier le garde.",
        order: 2
      },
      spatialFollowUp: {
        kind: "REPOSITION_AWAY",
        playerGoal: "S'écarter du garde pour le laisser travailler.",
        order: 3
      }
    },
    uncertainties: [],
    clarificationPrompt: null,
    confidence: "high"
  }
};

const provider: ContractAiProviderV1 = {
  async generate(request: AiCallRequestV1): Promise<unknown> {
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
    } satisfies AiRoleOutputEnvelopeV1<AiSemanticIntentPayloadV5>;
  }
};

async function main(): Promise<void> {
  const base = createDefaultAiIntentInterpreterConfigV1();
  const result = await interpretNarrativeInputWithAiV1({
    campaignId: "cmp-v5-components",
    operationId: "op-v5-components",
    intentId: "intent-v5-components",
    rawInput,
    config: {
      ...base,
      provider,
      contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V5,
      route: {
        ...base.route,
        allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V5],
        outputTokenLimit: 900
      }
    }
  });

  assert.equal(result.usedAiInterpretation, true, JSON.stringify(result.interpretationFailure?.issues ?? []));
  assert.deepEqual(
    result.interpretation.semanticIntent.composition?.orderedComponents.map(component => component.kind),
    ["APPROACH_TARGET", "SPEECH", "REPOSITION_AWAY"]
  );
  assert.equal(semanticIntentReleasesFocusV1(result.interpretation.semanticIntent), true);

  const plan = buildLocalMjPlanPayload(rawInput, result.interpretation);
  assert.deepEqual(
    plan.sceneBeats.map(beat => beat.kind),
    ["LOCAL_ACTION_ATTEMPT", "ACTOR_REACTION_EXPECTED", "LOCAL_ACTION_ATTEMPT"],
    "le plan MJ conserve l'ordre spatial, social, spatial"
  );

  const resolution: NarrativeResolutionResultV1 = {
    schemaVersion: 1,
    contractVersion: NARRATIVE_RESOLUTION_CONTRACT_VERSION_V1,
    resolutionId: "resolution-v5-components",
    operationId: "op-v5-components",
    resultKind: "COMMIT_PREPARED",
    interpretation: result.interpretation as NarrativeResolutionResultV1["interpretation"],
    domainCommand: null,
    characterExpression: null,
    preparedEffects: [],
    handoff: null,
    commitId: "commit-v5-components",
    noGameTime: true,
    safetyNotes: [],
    actionAdjudication: null,
    perception: null
  };
  const blocks = buildReferenceSceneBlocksV1({
    operationId: "op-v5-components",
    rawInput,
    interpretation: result.interpretation,
    resolution,
    playableScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
  });
  assert.deepEqual(blocks.map(block => block.kind), ["GM_NARRATION", "NPC_SPEECH", "GM_NARRATION"]);
  assert.match(blocks[0]?.text ?? "", /rapproches/iu);
  assert.match(blocks[2]?.text ?? "", /écartes/iu);
  assert.equal(blocks.some(block => /APPROACH_TARGET|REPOSITION_AWAY|playerGoal/iu.test(block.text)), false);
  console.log("semantic-intent-v5/ordered-execution: OK (approche → parole → éloignement)");
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
