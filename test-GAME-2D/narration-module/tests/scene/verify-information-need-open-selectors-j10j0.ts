import assert from "node:assert/strict";
import type {
  AiCallRequestV1,
  AiInformationNeedV2,
  AiRoleOutputEnvelopeV1,
  AiSemanticIntentPayloadV8
} from "../../src/ai";
import { validateAiRoleOutputEnvelopeV1 } from "../../src/ai";
import {
  createPrototypeNarrativeTurnControllerV1,
  type LoreInformationSemanticCatalogV1,
  type NarrativeTurnControllerOutputWithSemanticFidelityV1,
  validateInformationNeedV1
} from "../../src/application";
import {
  createConversationSemanticConfigH0,
  dialogueFixtureH0
} from "../fixtures/conversation-semantic-fixtures-h0";

const targetRef = "npc:npc-garde-blesse";
const validNeed: AiInformationNeedV2 = {
  schemaVersion: 1,
  contractVersion: "information-need/2",
  subjectMention: "l'institution évoquée par le personnage",
  proposedSubjectRef: null,
  proposedScopeRefs: [targetRef],
  proposedPropertyRefs: ["semantic-property:p-17"],
  proposedRelationRefs: ["semantic-relation:r-4"],
  completionPropertyRefs: ["semantic-property:p-17", "semantic-property:p-18"],
  requestedDimension: "l'identité publique demandée",
  temporalScope: "CURRENT",
  requestedAnswerShape: "IDENTITY",
  sourceComponentId: "h0:j10j0-valid"
};

const informationCatalog: LoreInformationSemanticCatalogV1 = {
  schemaVersion: 1,
  contractVersion: "lore-information-semantic-catalog/1",
  anchorSubjectRef: targetRef,
  subjects: [{ ref: targetRef, label: "Interlocuteur public", entityType: "actor" }],
  properties: [
    { ref: "semantic-property:p-17", subjectRef: targetRef, fieldPath: "/p-17", label: "P 17", availability: "PRESENT", knowledgeLevel: "COMMUN", creationMode: "FORBIDDEN", identityRolePropertyRef: null },
    { ref: "semantic-property:p-18", subjectRef: targetRef, fieldPath: "/p-18", label: "P 18", availability: "DECLARED_MISSING", knowledgeLevel: "COMMUN", creationMode: "FORBIDDEN", identityRolePropertyRef: null }
  ],
  relations: [{ ref: "semantic-relation:r-4", sourceSubjectRef: targetRef, targetSubjectRef: targetRef, label: "R 4" }],
  authority: "REFERENCE_ONLY_NO_FACT_VALUES",
  noCommit: true,
  version: 1
};

async function main(): Promise<void> {
  verifyStrictContract();

  const validInput = "Formulation libre A";
  const invalidInput = "Formulation libre B";
  const privateScopeNeed: AiInformationNeedV2 = {
    ...validNeed,
    sourceComponentId: "h0:j10j0-private",
    proposedScopeRefs: ["private-scope:unpublished"]
  };
  const intentInterpreterConfig = createConversationSemanticConfigH0([
      dialogueFixtureH0({
        fixtureId: "j10j0-valid",
        rawInput: validInput,
        meaning: "Le personnage demande une identité publique dans une portée établie.",
        targetRef,
        targetSurface: "l'interlocuteur",
        dialogueAct: "ASK_QUESTION",
        informationNeed: validNeed
      }),
      dialogueFixtureH0({
        fixtureId: "j10j0-private",
        rawInput: invalidInput,
        meaning: "Le personnage formule une demande fondée sur une portée non publiée.",
        targetRef,
        targetSurface: "l'interlocuteur",
        dialogueAct: "ASK_QUESTION",
        informationNeed: privateScopeNeed
      })
    ]);
  intentInterpreterConfig.informationCatalogForScene = () => informationCatalog;
  const controller = await createPrototypeNarrativeTurnControllerV1({
    intentInterpreterConfig,
    mjPlannerConfig: null,
    npcPerformerConfig: null,
    sceneTransitionRuntime: null
  });

  const valid = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "j10j0-valid",
    rawInput: validInput
  });
  if (!valid.ok) throw new Error(valid.error.messageKey);
  const output = valid.value.output as NarrativeTurnControllerOutputWithSemanticFidelityV1;
  assert.equal(output.resolution.resultKind, "COMMIT_APPLIED");
  assert.deepEqual(output.interpretation.openSemanticFrame?.components[0]?.informationNeed, validNeed);
  assert.deepEqual(output.interpretation.openSemanticRuntime?.executionPlan.steps[0]?.informationNeed, validNeed);
  const orderedActs = output.domainCommand?.payload.orderedDialogueActs as Array<{
    informationNeed?: AiInformationNeedV2 | null;
  }> | undefined;
  assert.deepEqual(orderedActs?.[0]?.informationNeed, validNeed);
  assert.deepEqual(output.openSemanticFidelity?.orderedComponents[0]?.informationNeed, validNeed);
  assert.deepEqual(output.openSemanticFidelity?.informationNeeds, [validNeed]);

  const invalid = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "j10j0-private",
    rawInput: invalidInput
  });
  if (!invalid.ok) throw new Error(invalid.error.messageKey);
  assert.equal(invalid.value.output.noCommit, true);
  assert.equal(invalid.value.output.interpretation.requiresClarification, true);
  assert.equal(invalid.value.output.domainCommand, null);

  console.log("information-need/J10-J0: OK (open refs, public scope, V8, G5, owner payload and fidelity)");
}

function verifyStrictContract(): void {
  assert.equal(validateInformationNeedV1(validNeed).ok, true);
  assert.equal(validateInformationNeedV1({
    ...validNeed,
    proposedPropertyRefs: ["not-a-reference"]
  }).ok, false);
  assert.equal(validateInformationNeedV1({
    ...validNeed,
    proposedRelationRefs: ["semantic-relation:r-4", "semantic-relation:r-4"]
  }).ok, false);

  const request: AiCallRequestV1 = {
    schemaVersion: 1,
    callId: "call:j10j0",
    operationId: "operation:j10j0",
    attemptId: "attempt:j10j0",
    campaignId: "campaign:j10j0",
    snapshotId: "snapshot:j10j0",
    packId: "pack:j10j0",
    role: "player_intent_interpreter",
    contractVersion: "ai-intent-semantic/8",
    modelRouteId: "route:j10j0",
    contextFingerprint: `sha256:${"4".repeat(64)}`,
    idempotencyKey: "idempotency:j10j0",
    input: { instructionsRef: "j10j0", roleContextPack: {}, task: { rawInput: "Formulation libre A" } },
    limits: { inputTokenBudget: 2_000, outputTokenBudget: 2_000, timeoutMs: 10_000 }
  };
  assert.equal(
    validateAiRoleOutputEnvelopeV1(envelope(request, payload(validNeed)), request).accepted,
    true
  );
  assert.equal(
    validateAiRoleOutputEnvelopeV1(envelope(request, payload({
      ...validNeed,
      completionPropertyRefs: ["invalid"]
    })), request).accepted,
    false
  );
  assert.equal(
    validateAiRoleOutputEnvelopeV1(envelope(request, payload({
      ...validNeed,
      proposedSubjectRef: null,
      proposedScopeRefs: [],
      proposedPropertyRefs: [],
      proposedRelationRefs: [],
      completionPropertyRefs: []
    })), request).accepted,
    false,
    "an understood factual need requires executable semantic selectors"
  );
}

function payload(informationNeed: AiInformationNeedV2): AiSemanticIntentPayloadV8 {
  return {
    rawInputEcho: "Formulation libre A",
    semanticFrame: {
      schemaVersion: 1,
      understandingStatus: "UNDERSTOOD",
      overallMeaning: "Le personnage demande une identité publique.",
      overallCommitment: "committed",
      globalConditions: [],
      components: [{
        componentId: informationNeed.sourceComponentId,
        order: 1,
        meaning: "Le personnage demande une identité publique.",
        commitment: "committed",
        conditions: [],
        negated: false,
        quoted: false,
        relationToPrevious: "NONE",
        alternativeGroupId: null,
        dependsOnComponentIds: [],
        simultaneousWithComponentIds: [],
        supersedesComponentIds: [],
        mentionedTargets: [{ surface: "l'interlocuteur", proposedRef: targetRef }],
        suggestedDomain: "social",
        suggestedAction: "poser une question factuelle",
        suggestedCapabilityId: "scene.visible-dialogue",
        dialogueAct: { act: "ASK_QUESTION", contentGoal: "Obtenir l'identité publique demandée." },
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
  semanticPayload: AiSemanticIntentPayloadV8
): AiRoleOutputEnvelopeV1<AiSemanticIntentPayloadV8> {
  return {
    schemaVersion: 1,
    contractVersion: request.contractVersion,
    outputId: "output:j10j0",
    callId: request.callId,
    attemptId: request.attemptId,
    packId: request.packId,
    snapshotId: request.snapshotId,
    role: request.role,
    status: "OK",
    payload: semanticPayload,
    diagnostics: [],
    supersedesOutputId: null
  };
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
