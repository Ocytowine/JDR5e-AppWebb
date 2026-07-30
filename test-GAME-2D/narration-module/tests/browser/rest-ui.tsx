import React from "react";
import ReactDOM from "react-dom/client";
import { NarrativeAppSurface } from "../../../src/narration-ui/NarrativeAppSurface";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
  createBrowserPersistentNarrativeTurnControllerV1,
  createDefaultAiIntentInterpreterConfigV1,
  createNarrativeRestRuntimeV1,
  mutateSocialActorStateV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  SOCIAL_ACTOR_MUTATION_COMMAND_V1,
  type SocialActorMutationSetV1
} from "../../src/application";
import type { ContractAiProviderV1 } from "../../src/ai/FakeContractAiProvider";

const provider: ContractAiProviderV1 = {
  async generate(request) {
    const rawInput = (request.input.task as { rawInput: string }).rawInput;
    return {
      schemaVersion: 1,
      contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
      outputId: `output:${request.attemptId}`,
      callId: request.callId,
      attemptId: request.attemptId,
      packId: request.packId,
      snapshotId: request.snapshotId,
      role: request.role,
      status: "OK",
      payload: {
        rawInputEcho: rawInput,
        intents: [{
          intentId: "intent:rest-ui",
          order: 1,
          intentType: "action",
          commitment: "committed",
          target: { kind: "self", ref: "player-character:browser", label: "personnage" },
          action: "act",
          referentResolution: null,
          topic: "repos long",
          coreMeaning: "Le personnage commence un repos long.",
          playerImposedDetails: ["repos long"],
          openDetails: [],
          forbiddenInterpretations: ["accorder immédiatement les bénéfices"],
          requiresClarification: false,
          clarificationQuestion: null,
          riskFlags: [],
          expectedTimeEffect: "DOMAIN_TO_DECIDE",
          confidence: "high",
          semanticIntent: {
            schemaVersion: 1,
            kind: "manipulate_visible_object",
            playerGoal: "commencer un repos long",
            target: { kind: "self", ref: "player-character:browser", label: "personnage" },
            commitment: "committed",
            evidenceFromInput: [rawInput],
            uncertainties: [],
            forbiddenInterpretations: ["accorder immédiatement les bénéfices"],
            confidence: "high",
            perception: null,
            dialogueAct: null,
            restPlan: { schemaVersion: 1, restKind: "LONG_REST" }
          },
          runtimeHandling: {
            schemaVersion: 1,
            status: "UNSUPPORTED_DOMAIN",
            reason: "Le domaine repos requiert son propriétaire.",
            requiredDomain: "rest",
            canonicalActionHint: "act",
            noCommit: true,
            noGameTime: true
          }
        }]
      },
      diagnostics: [],
      supersedesOutputId: null
    };
  }
};

async function bootstrap() {
  const interruptionPercent = new URLSearchParams(window.location.search).get("danger") === "100" ? 100 : 0;
  const base = createDefaultAiIntentInterpreterConfigV1();
  const restRuntime = createNarrativeRestRuntimeV1({
    rules: {
      shortRestDurationSeconds: 3_600,
      longRestDurationSeconds: 28_800,
      segmentSeconds: 3_600
    },
    authorize: ({ scene }) => ({
      allowed: true,
      reason: "La chambre permet de se reposer.",
      locationRef: { kind: "scene", id: scene.sceneId },
      safetyProfile: { interruptionPercent }
    })
  });
  const controller = await createBrowserPersistentNarrativeTurnControllerV1({
    databaseName: interruptionPercent === 100 ? "jdr5e-rest-ui-6v-interruption" : "jdr5e-rest-ui-6v",
    intentInterpreterConfig: {
      ...base,
      provider,
      contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
      route: {
        ...base.route,
        allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1]
      }
    },
    mjPlannerConfig: null,
    npcPerformerConfig: null,
    restRuntime,
    initializeRepository: async (repository, campaignId) => {
      const changes: SocialActorMutationSetV1 = {
        knownFactRefsAdded: [],
        beliefsUpserted: [],
        relationshipDeltas: [],
        reputationMarkersUpserted: [],
        debtsAndPromisesUpserted: [],
        concernsUpserted: [{
          concernId: "concern-rest-time-warn-waitress",
          status: "ACTIVE",
          privateObjective: "Prévenir la serveuse lorsque la relève tarde.",
          publicActionHint: "adresse un signe d'avertissement à la serveuse",
          actKind: "SIGNAL",
          urgency: 80,
          availableFromGameSecond: 3_600,
          expiresAtGameSecond: null,
          targetRefs: ["actor:npc-serveuse-nerveuse"],
          sourceRefs: ["private:browser-fixture:rest-time-warning"],
          minimumIntervalSeconds: 86_400,
          lastExecutedAtGameSecond: null,
          executionCount: 0
        }],
        visibilityConstraintsAdded: ["private-to:npc-garde-blesse"]
      };
      const seeded = await mutateSocialActorStateV1({
        repository,
        campaignId,
        command: {
          schemaVersion: 1,
          contractVersion: SOCIAL_ACTOR_MUTATION_COMMAND_V1,
          clientRequestId: "seed-browser-rest-time-social-6v",
          actorId: "npc-garde-blesse",
          reason: "Fixture transverse 6V après avance diégétique.",
          sourceEventRefs: ["event:browser-fixture:rest-time-social"],
          occurredAtGameSecond: 0,
          changes
        }
      });
      if (!seeded.ok) {
        throw new Error(`${seeded.error.code}: ${seeded.error.messageKey}`);
      }
    }
  });
  return { controller, openingScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1 };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <NarrativeAppSurface bootstrapController={bootstrap} />
);
