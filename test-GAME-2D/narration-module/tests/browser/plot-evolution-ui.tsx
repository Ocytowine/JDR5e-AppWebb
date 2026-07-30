import React from "react";
import ReactDOM from "react-dom/client";
import { NarrativeAppSurface } from "../../../src/narration-ui/NarrativeAppSurface";
import {
  PLOT_CREATE_COMMAND_V1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  createBrowserPersistentNarrativeTurnControllerV1,
  createPlotV1,
  type PlotStateV1
} from "../../src/application";

const plot: PlotStateV1 = {
  schemaVersion: 1,
  plotId: "plot-browser-missing-ledger",
  status: "ACTIVE",
  hiddenTruth: {
    truthId: "truth-browser-cellar",
    statement: "Le garde blessé a caché le registre sous l'escalier de la cave.",
    sourceRefs: ["private:browser:plot-truth"]
  },
  commitments: ["Le registre a quitté sa place avant l'arrivée du personnage."],
  requiredRevelations: [{
    revelationId: "revelation-browser-ledger-moved",
    label: "Comprendre que le registre a été déplacé.",
    requiredForResolution: true
  }],
  cluePaths: [{
    cluePathId: "clue-browser-dust",
    revelationId: "revelation-browser-ledger-moved",
    independenceKey: "location:inn:shelf",
    status: "AVAILABLE",
    sourceRefs: ["private:browser:dust"]
  }, {
    cluePathId: "clue-browser-witness",
    revelationId: "revelation-browser-ledger-moved",
    independenceKey: "actor:innkeeper",
    status: "AVAILABLE",
    sourceRefs: ["private:browser:witness"]
  }],
  falseLeads: [],
  scheduledEvents: [{
    plotEventId: "event-browser-ledger-moved",
    status: "SCHEDULED",
    dueAtGameSecond: 0,
    resolvedAtGameSecond: null,
    causedByRefs: ["event:browser:inn-closing"],
    locationRef: "location:reference-inn-rain-001",
    privateOutcome: "Le registre est dissimulé dans la cave.",
    effects: [{
      effectId: "effect-browser-empty-shelf",
      visibility: "INFERABLE",
      sceneId: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1.sceneId,
      publicSign: "Près du comptoir, une étagère porte la marque claire d'un volume récemment retiré.",
      knowledgeChannelRef: null,
      sourceRefs: ["private:browser:dust"],
      presentedAtGameSecond: null
    }, {
      effectId: "effect-browser-hidden-cellar",
      visibility: "HIDDEN",
      sceneId: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1.sceneId,
      publicSign: null,
      knowledgeChannelRef: null,
      sourceRefs: ["private:browser:cellar"],
      presentedAtGameSecond: null
    }]
  }],
  sourceRefs: ["fixture:browser:plot-6d"],
  createdAtGameSecond: 0,
  version: 1
};

async function bootstrap() {
  const controller = await createBrowserPersistentNarrativeTurnControllerV1({
    databaseName: "jdr5e-plot-evolution-ui-6d",
    intentInterpreterConfig: null,
    mjPlannerConfig: null,
    npcPerformerConfig: null,
    initializeRepository: async (repository, campaignId) => {
      const created = await createPlotV1({
        repository,
        campaignId,
        command: {
          schemaVersion: 1,
          contractVersion: PLOT_CREATE_COMMAND_V1,
          clientRequestId: "seed-browser-plot-6d",
          plot
        }
      });
      if (!created.ok) throw new Error(`${created.error.code}: ${created.error.messageKey}`);
    }
  });
  return { controller, openingScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1 };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <NarrativeAppSurface bootstrapController={bootstrap} />
);
