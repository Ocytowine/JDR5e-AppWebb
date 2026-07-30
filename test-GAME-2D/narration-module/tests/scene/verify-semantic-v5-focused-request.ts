import assert from "node:assert/strict";
import type {
  AiCallRequestV1,
  AiRoleOutputEnvelopeV1,
  AiSemanticIntentPayloadV5,
  ContractAiProviderV1
} from "../../src/ai";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V5,
  createDefaultAiIntentInterpreterConfigV1,
  interpretNarrativeInputWithAiV1
} from "../../src/application";
import { buildArchiveLorePilotV1 } from "../../../src/narration-ui/archiveLorePilot";

const contactInput = "je voudrais parler à un clerc";
const requestInput =
  "je souhaiterai acceder à des documents relatif aux naissance, je voudrais retrouver mes parents";

async function main(): Promise<void> {
  const pilot = await buildArchiveLorePilotV1();
  const clerc = pilot.scene.ambientPopulation.find(
    presence => presence.publicRole === "clerc"
  );
  assert.ok(clerc, "la scène des Archives doit exposer un clerc");
  const clercRef = `npc:${clerc.actorId}`;

  const fixtures = new Map<string, AiSemanticIntentPayloadV5>([
    [contactInput, payload(contactInput, {
      kind: "address_visible_actor",
      playerGoal: "Entrer en conversation avec le clerc visible.",
      targetMention: target("un clerc", clercRef, "EXPLICIT"),
      dialogueAct: dialogue("INITIATE_CONVERSATION", "Parler au clerc."),
      communication: speech(
        "INITIATE_CONVERSATION",
        "Parler au clerc."
      )
    })],
    [requestInput, payload(requestInput, {
      // Reproduit la divergence observée en live : la composante structurée
      // porte bien une parole, mais le classement principal est erroné.
      kind: "context_question",
      playerGoal:
        "Demander l'accès aux documents de naissance afin de retrouver ses parents.",
      targetMention: target("au clerc", clercRef, "RECENT_FOCUS"),
      dialogueAct: dialogue(
        "REQUEST_ACTION",
        "Demander l'accès aux documents de naissance pour rechercher ses parents."
      ),
      communication: speech(
        "REQUEST_ACTION",
        "Demander l'accès aux documents de naissance pour rechercher ses parents."
      )
    })]
  ]);
  let capturedActiveDialogueTarget: unknown = null;
  const provider: ContractAiProviderV1 = {
    async generate(request: AiCallRequestV1): Promise<unknown> {
      const task = request.input.task as {
        rawInput: string;
        activeDialogueTarget?: unknown;
      };
      const rawInput = task.rawInput;
      if (rawInput === requestInput) {
        capturedActiveDialogueTarget = task.activeDialogueTarget;
      }
      const fixture = fixtures.get(rawInput);
      if (!fixture) throw new Error(`Fixture absente pour ${rawInput}`);
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
        payload: fixture,
        diagnostics: [],
        supersedesOutputId: null
      } satisfies AiRoleOutputEnvelopeV1<AiSemanticIntentPayloadV5>;
    }
  };
  const base = createDefaultAiIntentInterpreterConfigV1();
  const config = {
    ...base,
    provider,
    contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V5,
    route: {
      ...base.route,
      allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V5],
      outputTokenLimit: 900
    }
  };

  const contact = await interpretNarrativeInputWithAiV1({
    campaignId: "cmp-focused-clerc",
    operationId: "op-focused-clerc-contact",
    intentId: "intent-focused-clerc-contact",
    rawInput: contactInput,
    playableScene: pilot.scene,
    config
  });
  assert.equal(contact.usedAiInterpretation, true);
  assert.equal(contact.interpretation.semanticIntent.kind, "address_visible_actor");
  assert.equal(contact.interpretation.semanticIntent.dialogueAct?.act, "INITIATE_CONVERSATION");
  assert.equal(contact.interpretation.semanticIntent.target?.ref, clercRef);

  const request = await interpretNarrativeInputWithAiV1({
    campaignId: "cmp-focused-clerc",
    operationId: "op-focused-clerc-request",
    intentId: "intent-focused-clerc-request",
    rawInput: requestInput,
    playableScene: pilot.scene,
    localReferentHints: [{
      schemaVersion: 1,
      sceneId: pilot.scene.sceneId,
      sceneVersion: pilot.scene.version,
      target: contact.interpretation.semanticIntent.target!,
      sourceOperationId: "op-focused-clerc-contact",
      sourceText: contactInput,
      confidence: "high"
    }],
    recentSemanticTurns: [{
      schemaVersion: 1,
      operationId: "op-focused-clerc-contact",
      semanticKind: contact.interpretation.semanticIntent.kind,
      playerGoal: contact.interpretation.semanticIntent.playerGoal,
      primaryTarget: contact.interpretation.semanticIntent.target,
      topic: null,
      commitment: contact.interpretation.semanticIntent.commitment,
      focusDisposition: "RETAIN"
    }],
    config
  });
  assert.deepEqual(capturedActiveDialogueTarget, {
    schemaVersion: 1,
    target: contact.interpretation.semanticIntent.target,
    sourceOperationId: "op-focused-clerc-contact",
    sourcePlayerGoal: contact.interpretation.semanticIntent.playerGoal
  });
  assert.equal(
    request.usedAiInterpretation,
    true,
    JSON.stringify(request.interpretationFailure?.issues ?? [])
  );
  assert.equal(request.interpretation.semanticIntent.kind, "address_visible_actor");
  assert.equal(request.interpretation.semanticIntent.dialogueAct?.act, "REQUEST_ACTION");
  assert.equal(request.interpretation.semanticIntent.target?.ref, clercRef);
  assert.equal(request.interpretation.referentResolution?.usedPreviousContext, true);
  assert.equal(request.interpretation.requiresClarification, false);
  console.log(
    "semantic-v5/focused-request: OK (demande composée canonicalisée et clerc focalisé conservé)"
  );
}

function payload(
  rawInput: string,
  input: {
    kind: AiSemanticIntentPayloadV5["intent"]["kind"];
    playerGoal: string;
    targetMention: NonNullable<AiSemanticIntentPayloadV5["intent"]["targetMention"]>;
    dialogueAct: NonNullable<AiSemanticIntentPayloadV5["intent"]["dialogueAct"]>;
    communication: NonNullable<AiSemanticIntentPayloadV5["intent"]["composition"]["communication"]>;
  }
): AiSemanticIntentPayloadV5 {
  return {
    rawInputEcho: rawInput,
    intent: {
      kind: input.kind,
      commitment: "committed",
      preconditions: [],
      playerGoal: input.playerGoal,
      actionHint: null,
      domainHint: input.kind === "address_visible_actor" ? "social" : null,
      scope:
        input.kind === "address_visible_actor" ? "SOCIAL_EXCHANGE" : "META",
      targetMention: input.targetMention,
      perception: null,
      dialogueAct: input.dialogueAct,
      composition: {
        orientation: null,
        spatialLeadIn: null,
        communication: input.communication,
        spatialFollowUp: null
      },
      uncertainties: [],
      clarificationPrompt: null,
      confidence: "high"
    }
  };
}

function target(
  surface: string,
  proposedRef: string,
  contextLink: "EXPLICIT" | "RECENT_FOCUS"
): NonNullable<AiSemanticIntentPayloadV5["intent"]["targetMention"]> {
  return { surface, candidateKind: "npc", proposedRef, contextLink };
}

function dialogue(
  act: "INITIATE_CONVERSATION" | "REQUEST_ACTION",
  contentGoal: string
): NonNullable<AiSemanticIntentPayloadV5["intent"]["dialogueAct"]> {
  return { act, contentGoal };
}

function speech(
  act: "INITIATE_CONVERSATION" | "REQUEST_ACTION",
  contentGoal: string
): NonNullable<AiSemanticIntentPayloadV5["intent"]["composition"]["communication"]> {
  return { mode: "SPEECH", act, contentGoal, order: 1 };
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
