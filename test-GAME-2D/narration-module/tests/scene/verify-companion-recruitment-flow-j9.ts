import assert from "node:assert/strict";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6,
  createCatalogMissionRelationRuntimeV1,
  createNarrativeCompanionRecruitmentRuntimeV1,
  createPrototypeNarrativeTurnControllerV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  type CompanionAutonomyPolicyV1
} from "../../src/application";
import type { ContractAiProviderV1 } from "../../src/ai/FakeContractAiProvider";
import type {
  AiCallRequestV1,
  AiRoleOutputEnvelopeV1,
  AiSemanticIntentPayloadV6
} from "../../src/ai/types";

const actorId = "reference-inn-rain-001:ambient:marel";
const scene = {
  ...REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  ambientPopulation: [{
    schemaVersion: 1 as const,
    actorId,
    displayName: "Marel",
    publicRole: "Clerc voyageur",
    visibleActivity: "compare deux registres annotés",
    visibleAppearance: "une sacoche de cuir remplie de feuillets",
    demeanor: "attentif et prudent",
    immediateGoal: "mettre de l'ordre dans les témoignages recueillis",
    currentPressure: "il refuse de mettre inutilement sa vie en jeu",
    speechStyle: ["phrases posées", "réponses franches"],
    conversationalHooks: ["archives", "registres", "voyage"],
    boundaries: ["évite les risques inconsidérés"],
    knowledgeRefs: ["reference-scene:reference-inn-rain-001"],
    keywords: ["Marel", "clerc", "compagnon"],
    version: 1 as const
  }]
};

const autonomyPolicy: CompanionAutonomyPolicyV1 = {
  schemaVersion: 1,
  policyId: "companion-policy:marel:j9",
  policyRevision: 1,
  sourceRefs: ["authored-companion:marel:j9"],
  rules: [{
    schemaVersion: 1,
    category: "FOLLOW",
    disposition: "ACCEPTED",
    adaptation: null,
    conditions: [],
    sourceRefs: ["authored-companion:marel:shared-road"]
  }, {
    schemaVersion: 1,
    category: "PERSONAL_RISK",
    disposition: "REFUSED",
    adaptation: null,
    conditions: [],
    sourceRefs: ["authored-companion:marel:no-reckless-danger"]
  }]
};

const provider: ContractAiProviderV1 = {
  async generate(call: AiCallRequestV1): Promise<unknown> {
    const task = call.input.task as { rawInput: string };
    const recruit = task.rawInput.includes("rejoindre");
    const contentGoal = recruit
      ? "Demander à Marel de rejoindre durablement le groupe."
      : "Saluer Marel.";
    return {
      schemaVersion: 1,
      contractVersion: call.contractVersion,
      outputId: `output:${call.attemptId}`,
      callId: call.callId,
      attemptId: call.attemptId,
      packId: call.packId,
      snapshotId: call.snapshotId,
      role: call.role,
      status: "OK",
      payload: {
        rawInputEcho: task.rawInput,
        intent: {
          kind: "address_visible_actor",
          commitment: "committed",
          preconditions: [],
          playerGoal: contentGoal,
          actionHint: contentGoal,
          domainHint: "social",
          scope: "SOCIAL_EXCHANGE",
          targetMention: {
            surface: "Marel",
            candidateKind: "npc",
            proposedRef: `npc:${actorId}`,
            contextLink: "EXPLICIT"
          },
          perception: null,
          dialogueAct: {
            act: recruit ? "REQUEST_ACTION" : "INITIATE_CONVERSATION",
            contentGoal
          },
          uncertainties: [],
          clarificationPrompt: null,
          confidence: "high",
          composition: {
            orientation: null,
            spatialLeadIn: null,
            communication: {
              mode: "SPEECH",
              act: recruit ? "REQUEST_ACTION" : "INITIATE_CONVERSATION",
              contentGoal,
              order: 1
            },
            spatialFollowUp: null
          },
          companionDirective: recruit ? {
            schemaVersion: 1,
            category: "FOLLOW",
            requestSummary: contentGoal
          } : null
        }
      },
      diagnostics: [],
      supersedesOutputId: null
    } satisfies AiRoleOutputEnvelopeV1<AiSemanticIntentPayloadV6>;
  }
};

async function main(): Promise<void> {
  const controller = await createPrototypeNarrativeTurnControllerV1({
    initialScene: { scene, locationRef: "location:inn-common-room" },
    activeSceneResolver: { async resolve() { return { ok: true as const, value: scene }; } },
    intentInterpreterConfig: {
      provider,
      contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6,
      route: {
        schemaVersion: 1,
        routeId: "j9-natural-companion-recruitment",
        role: "player_intent_interpreter",
        providerKind: "FAKE_CONTRACT",
        providerId: "j9-local-gate",
        modelId: "deterministic-j9",
        modelConfigVersion: "companion-recruitment-v1",
        certified: true,
        allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6],
        inputTokenLimit: 2_000,
        outputTokenLimit: 1_000,
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
    },
    mjPlannerConfig: null,
    npcPerformerConfig: null,
    interpreterCharacterContextResolver: null,
    missionRelationRuntime: createCatalogMissionRelationRuntimeV1({
      decisionPolicy: {
        decide: () => ({
          disposition: "ACCEPTED",
          conditions: [],
          publicSourceRefs: ["social-policy:marel-mutual-choice"]
        })
      }
    }),
    companionRecruitmentRuntime: createNarrativeCompanionRecruitmentRuntimeV1({
      policy: {
        resolve: ({ actor }) => actor.actorId === actorId
          ? autonomyPolicy
          : null
      }
    })
  });

  const greeting = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "j9:companion:greeting",
    rawInput: "Je salue Marel."
  });
  assert.equal(greeting.ok, true);

  const recruitment = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "j9:companion:recruitment",
    rawInput: "Je demande à Marel de rejoindre durablement mon groupe."
  });
  if (!recruitment.ok) throw new Error(
    `${recruitment.error.messageKey} ${JSON.stringify(recruitment.error.details)}`
  );
  const party = await controller.restoreCompanionParty();
  if (!party.ok) throw new Error(party.error.messageKey);
  assert.equal(party.value.state?.members.length, 1);
  assert.equal(party.value.state?.members[0]?.actorId, actorId);
  assert.equal(
    party.value.state?.members[0]?.autonomyPolicy.policyId,
    autonomyPolicy.policyId
  );
  console.log("companion-recruitment/J9: player dialogue -> accepted J4 cause -> durable NPC -> autonomous J7 companion verified");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
