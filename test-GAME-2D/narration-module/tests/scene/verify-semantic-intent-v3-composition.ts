import assert from "node:assert/strict";
import type {
  AiCallRequestV1,
  AiRoleOutputEnvelopeV1,
  AiSemanticIntentPayloadV3,
  ContractAiProviderV1
} from "../../src/ai";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V3,
  createDefaultAiIntentInterpreterConfigV1,
  interpretNarrativeInputWithAiV1
} from "../../src/application";

const rawInput = "Je m'avance vers le garde, puis je le salue.";
const payload: AiSemanticIntentPayloadV3 = {
  rawInputEcho: rawInput,
  intent: {
    kind: "move_near_visible_actor",
    commitment: "committed",
    preconditions: [],
    playerGoal: "S'approcher du garde puis le saluer.",
    actionHint: "approcher_et_saluer",
    domainHint: "scene_resolution",
    scope: "LOCAL_INTERACTION",
    targetMention: {
      surface: "le garde",
      candidateKind: "npc",
      proposedRef: "npc:npc-garde-blesse",
      contextLink: "EXPLICIT"
    },
    perception: null,
    dialogueAct: null,
    composition: {
      spatialLeadIn: {
        kind: "APPROACH_TARGET",
        playerGoal: "S'approcher du garde.",
        order: 1
      },
      communication: {
        mode: "SPEECH",
        act: "INITIATE_CONVERSATION",
        contentGoal: "Saluer le garde.",
        order: 2
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
    } satisfies AiRoleOutputEnvelopeV1<AiSemanticIntentPayloadV3>;
  }
};

async function main(): Promise<void> {
  const base = createDefaultAiIntentInterpreterConfigV1();
  const result = await interpretNarrativeInputWithAiV1({
    campaignId: "cmp-v3-composition",
    operationId: "op-v3-composition",
    intentId: "intent-v3-composition",
    rawInput,
    config: {
      ...base,
      provider,
      contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V3,
      route: {
        ...base.route,
        allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V3],
        outputTokenLimit: 900
      }
    }
  });

  assert.equal(result.usedAiInterpretation, true, JSON.stringify(result.interpretationFailure?.issues ?? []));
  assert.equal(result.interpretation.semanticIntent.kind, "address_visible_actor", "la communication devient l'intention principale");
  assert.equal(result.interpretation.semanticIntent.dialogueAct?.act, "INITIATE_CONVERSATION");
  assert.equal(result.interpretation.runtimeHandling?.requiredDomain, "social");
  assert.equal(result.interpretation.target?.ref, "npc:npc-garde-blesse");
  assert.deepEqual(
    result.interpretation.semanticIntent.composition?.orderedComponents.map(component => component.kind),
    ["APPROACH_TARGET", "SPEECH"],
    "l'approche n'est pas perdue lorsque la salutation pilote la réaction PNJ"
  );
  console.log("semantic-intent-v3/composition: OK (approche puis salutation conservées, interaction sociale routée)");
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
