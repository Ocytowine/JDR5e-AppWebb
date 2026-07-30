import React from "react";
import ReactDOM from "react-dom/client";
import { NarrativeAppSurface } from "../../../src/narration-ui/NarrativeAppSurface";
import {
  createBrowserPersistentNarrativeTurnControllerV1,
  mutateSocialActorStateV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  SOCIAL_ACTOR_MUTATION_COMMAND_V1,
  type SocialActorMutationSetV1
} from "../../src/application";

async function bootstrap() {
  const controller = await createBrowserPersistentNarrativeTurnControllerV1({
    databaseName: "jdr5e-social-initiative-ui-6c",
    intentInterpreterConfig: null,
    mjPlannerConfig: null,
    npcPerformerConfig: null,
    initializeRepository: async (repository, campaignId) => {
      const changes: SocialActorMutationSetV1 = {
        knownFactRefsAdded: [],
        beliefsUpserted: [],
        relationshipDeltas: [],
        reputationMarkersUpserted: [],
        debtsAndPromisesUpserted: [],
        concernsUpserted: [{
          concernId: "concern-browser-warn-waitress",
          status: "ACTIVE",
          privateObjective: "Prévenir la serveuse sans attirer l'attention de toute la salle.",
          publicActionHint: "adresse un signe d'avertissement à la serveuse",
          actKind: "SIGNAL",
          urgency: 80,
          availableFromGameSecond: 0,
          expiresAtGameSecond: null,
          targetRefs: ["actor:npc-serveuse-nerveuse"],
          sourceRefs: ["private:browser-fixture:warning"],
          minimumIntervalSeconds: 60,
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
          clientRequestId: "seed-browser-social-initiative-6c",
          actorId: "npc-garde-blesse",
          reason: "Fixture navigateur 6C.",
          sourceEventRefs: ["event:browser-fixture:social-initiative"],
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
