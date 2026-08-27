import assert from "node:assert/strict";
import type {
  AiCallRequestV1,
  AiInformationNeedV8,
  AiRoleOutputEnvelopeV1,
  AiSemanticIntentPayloadV8
} from "../../src/ai";
import { validateAiRoleOutputEnvelopeV1 } from "../../src/ai";
import {
  createPrototypeNarrativeTurnControllerV1,
  type NarrativeTurnControllerOutputWithSemanticFidelityV1
} from "../../src/application";
import {
  createConversationSemanticConfigH0,
  dialogueFixtureH0
} from "../fixtures/conversation-semantic-fixtures-h0";
import { NPC_INFORMATION_CORPUS_J10I0 } from "../fixtures/npc-information-corpus-j10i0";

const targetRef = "npc:npc-garde-blesse";

async function main(): Promise<void> {
  verifyStrictLocalValidation();

  const factualInput = "Qui dirige la ville ?";
  const factualNeed = need("h0:j10i1-factual", "la ville", "dirigeant actuel", "IDENTITY");
  const personalInput = "Je lui demande s'il va bien.";
  const invalidInput = "Qui dirige le domaine interdit ?";
  const invalidNeed = {
    ...need("h0:j10i1-invalid-ref", "le domaine interdit", "dirigeant actuel", "IDENTITY"),
    proposedSubjectRef: "place:private-forbidden"
  };
  const config = createConversationSemanticConfigH0([
    dialogueFixtureH0({
      fixtureId: "j10i1-factual",
      rawInput: factualInput,
      meaning: "Le personnage demande au garde qui dirige la ville.",
      targetRef,
      targetSurface: "le garde",
      dialogueAct: "ASK_QUESTION",
      informationNeed: factualNeed
    }),
    dialogueFixtureH0({
      fixtureId: "j10i1-personal",
      rawInput: personalInput,
      meaning: "Le personnage demande au garde comment il se sent.",
      targetRef,
      targetSurface: "lui",
      dialogueAct: "ASK_QUESTION",
      informationNeed: null
    }),
    dialogueFixtureH0({
      fixtureId: "j10i1-invalid-ref",
      rawInput: invalidInput,
      meaning: "Le personnage demande au garde qui dirige le domaine interdit.",
      targetRef,
      targetSurface: "le garde",
      dialogueAct: "ASK_QUESTION",
      informationNeed: invalidNeed
    })
  ]);
  const controller = await createPrototypeNarrativeTurnControllerV1({
    intentInterpreterConfig: config,
    mjPlannerConfig: null,
    npcPerformerConfig: null,
    sceneTransitionRuntime: null
  });

  const factual = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "j10i1-factual",
    rawInput: factualInput
  });
  if (!factual.ok) throw new Error(factual.error.messageKey);
  const factualOutput = factual.value.output as NarrativeTurnControllerOutputWithSemanticFidelityV1;
  assert.equal(factualOutput.resolution.resultKind, "COMMIT_APPLIED");
  assert.deepEqual(factualOutput.interpretation.openSemanticFrame?.components[0]?.informationNeed, factualNeed);
  assert.deepEqual(factualOutput.interpretation.openSemanticRuntime?.executionPlan.steps[0]?.informationNeed, factualNeed);
  const orderedDialogueActs = factualOutput.domainCommand?.payload.orderedDialogueActs as Array<{
    informationNeed?: AiInformationNeedV8 | null;
  }> | undefined;
  assert.deepEqual(orderedDialogueActs?.[0]?.informationNeed, factualNeed);
  assert.deepEqual(factualOutput.openSemanticFidelity?.orderedComponents[0]?.informationNeed, factualNeed);
  assert.deepEqual(factualOutput.openSemanticFidelity?.informationNeeds, [factualNeed]);
  assert.equal(factualOutput.openSemanticFidelity?.rawInputAccessByOwner, "FORBIDDEN");

  const personal = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "j10i1-personal",
    rawInput: personalInput
  });
  if (!personal.ok) throw new Error(personal.error.messageKey);
  const personalOutput = personal.value.output as NarrativeTurnControllerOutputWithSemanticFidelityV1;
  assert.equal(personalOutput.resolution.resultKind, "COMMIT_APPLIED");
  assert.equal(personalOutput.interpretation.openSemanticFrame?.components[0]?.informationNeed, null);
  assert.deepEqual(personalOutput.openSemanticFidelity?.informationNeeds, []);

  const invalid = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "j10i1-invalid-ref",
    rawInput: invalidInput
  });
  if (!invalid.ok) throw new Error(invalid.error.messageKey);
  assert.equal(invalid.value.output.noCommit, true, "une référence de sujet non publique ne doit atteindre aucun propriétaire");
  assert.equal(invalid.value.output.interpretation.requiresClarification, true);
  assert.equal(invalid.value.output.domainCommand, null);

  console.log("information-need-v8/J10-I1: OK (schema, validation, public refs, G3, G5, owner payload and fidelity receipt)");
}

function need(
  sourceComponentId: string,
  subjectMention: string,
  requestedDimension: string,
  requestedAnswerShape: AiInformationNeedV8["requestedAnswerShape"]
): AiInformationNeedV8 {
  return {
    schemaVersion: 1,
    contractVersion: "information-need/1",
    subjectMention,
    proposedSubjectRef: null,
    requestedDimension,
    temporalScope: "CURRENT",
    requestedAnswerShape,
    sourceComponentId
  };
}

function verifyStrictLocalValidation(): void {
  const request: AiCallRequestV1 = {
    schemaVersion: 1,
    callId: "call:j10i1",
    operationId: "operation:j10i1",
    attemptId: "attempt:j10i1",
    campaignId: "campaign:j10i1",
    snapshotId: "snapshot:j10i1",
    packId: "pack:j10i1",
    role: "player_intent_interpreter",
    contractVersion: "ai-intent-semantic/8",
    modelRouteId: "route:j10i1",
    contextFingerprint: `sha256:${"1".repeat(64)}`,
    idempotencyKey: "idempotency:j10i1",
    input: { instructionsRef: "j10i1", roleContextPack: {}, task: { rawInput: "Qui dirige la ville ?" } },
    limits: { inputTokenBudget: 2_000, outputTokenBudget: 2_000, timeoutMs: 10_000 }
  };
  const validNeed = need("component:j10i1", "la ville", "dirigeant actuel", "IDENTITY");
  const payload = semanticPayload(validNeed);
  assert.equal(validateAiRoleOutputEnvelopeV1(envelope(request, payload), request).accepted, true);
  const wrongSource = semanticPayload({ ...validNeed, sourceComponentId: "component:other" });
  assert.equal(validateAiRoleOutputEnvelopeV1(envelope(request, wrongSource), request).accepted, false);
  const nonQuestion = semanticPayload(validNeed);
  nonQuestion.semanticFrame.components[0]!.dialogueAct = {
    act: "MAKE_STATEMENT",
    contentGoal: "Le personnage affirme quelque chose."
  };
  assert.equal(validateAiRoleOutputEnvelopeV1(envelope(request, nonQuestion), request).accepted, false);

  const factualCases = NPC_INFORMATION_CORPUS_J10I0.filter(entry => entry.expectsInformationNeed);
  const counterExamples = NPC_INFORMATION_CORPUS_J10I0.filter(entry => !entry.expectsInformationNeed);
  assert.equal(factualCases.length, 10);
  assert.equal(counterExamples.length, 4);
  for (const entry of factualCases) {
    assert.ok(entry.subjectMention);
    assert.ok(entry.requestedDimension);
    assert.ok(entry.temporalScope);
    const corpusNeed: AiInformationNeedV8 = {
      ...need("component:j10i1", entry.subjectMention, entry.requestedDimension, "OPEN"),
      temporalScope: entry.temporalScope
    };
    assert.equal(
      validateAiRoleOutputEnvelopeV1(envelope(request, semanticPayload(corpusNeed)), request).accepted,
      true,
      entry.caseId
    );
  }
  for (const entry of counterExamples) {
    assert.equal(entry.subjectMention, null, entry.caseId);
    assert.equal(entry.requestedDimension, null, entry.caseId);
    assert.equal(entry.temporalScope, null, entry.caseId);
    assert.equal(
      validateAiRoleOutputEnvelopeV1(envelope(request, semanticPayload(null)), request).accepted,
      true,
      entry.caseId
    );
  }
}

function semanticPayload(informationNeed: AiInformationNeedV8 | null): AiSemanticIntentPayloadV8 {
  return {
    rawInputEcho: "Qui dirige la ville ?",
    semanticFrame: {
      schemaVersion: 1,
      understandingStatus: "UNDERSTOOD",
      overallMeaning: "Le personnage demande qui dirige la ville.",
      overallCommitment: "committed",
      globalConditions: [],
      components: [{
        componentId: "component:j10i1",
        order: 1,
        meaning: "Le personnage demande qui dirige la ville.",
        commitment: "committed",
        conditions: [],
        negated: false,
        quoted: false,
        relationToPrevious: "NONE",
        alternativeGroupId: null,
        dependsOnComponentIds: [],
        simultaneousWithComponentIds: [],
        supersedesComponentIds: [],
        mentionedTargets: [{ surface: "le garde", proposedRef: targetRef }],
        suggestedDomain: "social",
        suggestedAction: "demander qui dirige la ville",
        suggestedCapabilityId: "scene.visible-dialogue",
        dialogueAct: { act: "ASK_QUESTION", contentGoal: "Demander qui dirige la ville." },
        informationNeed
      }],
      ambiguities: [],
      clarificationQuestion: null,
      confidence: "high"
    }
  };
}

function envelope(
  request: AiCallRequestV1,
  payload: AiSemanticIntentPayloadV8
): AiRoleOutputEnvelopeV1<AiSemanticIntentPayloadV8> {
  return {
    schemaVersion: 1,
    contractVersion: request.contractVersion,
    outputId: "output:j10i1",
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

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
