import React from "react";
import ReactDOM from "react-dom/client";
import { NarrativeAppSurface } from "../../../src/narration-ui/NarrativeAppSurface";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6,
  createBrowserPersistentNarrativeTurnControllerV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  type CompanionAutonomyPolicyV1,
  type NarrativeTurnControllerV1
} from "../../src/application";
import type { ContractAiProviderV1 } from "../../src/ai/FakeContractAiProvider";
import type { AiCallRequestV1, AiRoleOutputEnvelopeV1, AiSemanticIntentPayloadV6 } from "../../src/ai/types";

declare global {
  interface Window {
    __companionJ7Controller?: NarrativeTurnControllerV1;
  }
}

const actorId = "reference-inn-rain-001:ambient:marel";
const companionScene = {
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
    boundaries: ["évite les risques inconsidérés", "reste proche de ses alliés"],
    knowledgeRefs: ["reference-scene:reference-inn-rain-001"],
    keywords: ["Marel", "clerc", "compagnon"],
    version: 1 as const
  }]
};

const policy: CompanionAutonomyPolicyV1 = {
  schemaVersion: 1,
  policyId: "companion-policy:marel-browser-j7",
  policyRevision: 1,
  sourceRefs: ["social-actor:marel:autonomy"],
  rules: [{
    schemaVersion: 1,
    category: "ASSIST",
    disposition: "ACCEPTED",
    adaptation: null,
    conditions: [],
    sourceRefs: ["social-concern:shared-research"]
  }, {
    schemaVersion: 1,
    category: "PERSONAL_RISK",
    disposition: "REFUSED",
    adaptation: null,
    conditions: [],
    sourceRefs: ["social-boundary:no-reckless-danger"]
  }]
};

const intentProvider: ContractAiProviderV1 = {
  async generate(call: AiCallRequestV1): Promise<unknown> {
    const task = call.input.task as { rawInput: string; activeCompanionRefs: string[] };
    const activeCompanion = task.activeCompanionRefs.includes(`npc:${actorId}`);
    const personalRisk = task.rawInput.includes("seul face au danger");
    const category = personalRisk ? "PERSONAL_RISK" as const : "ASSIST" as const;
    const requestSummary = personalRisk
      ? "Faire diversion seul face au danger."
      : "Comparer les deux registres avec le joueur.";
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
          playerGoal: activeCompanion ? requestSummary : "Saluer Marel.",
          actionHint: requestSummary,
          domainHint: "social",
          scope: "SOCIAL_EXCHANGE",
          targetMention: { surface: "Marel", candidateKind: "npc", proposedRef: `npc:${actorId}`, contextLink: "EXPLICIT" },
          perception: null,
          dialogueAct: { act: activeCompanion ? "REQUEST_ACTION" : "INITIATE_CONVERSATION", contentGoal: activeCompanion ? requestSummary : "Saluer Marel." },
          uncertainties: [],
          clarificationPrompt: null,
          confidence: "high",
          composition: {
            orientation: null,
            spatialLeadIn: null,
            communication: { mode: "SPEECH", act: activeCompanion ? "REQUEST_ACTION" : "INITIATE_CONVERSATION", contentGoal: activeCompanion ? requestSummary : "Saluer Marel.", order: 1 },
            spatialFollowUp: null
          },
          companionDirective: activeCompanion ? { schemaVersion: 1, category, requestSummary } : null
        }
      },
      diagnostics: [],
      supersedesOutputId: null
    } satisfies AiRoleOutputEnvelopeV1<AiSemanticIntentPayloadV6>;
  }
};

async function bootstrap() {
  const controller = await createBrowserPersistentNarrativeTurnControllerV1({
    databaseName: "jdr5e-companion-j7-free-input-v1",
    initialScene: { scene: companionScene, locationRef: "location:inn-common-room" },
    intentInterpreterConfig: {
      provider: intentProvider,
      contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6,
      route: {
        schemaVersion: 1,
        routeId: "browser-j7-companion-directive",
        role: "player_intent_interpreter",
        providerKind: "FAKE_CONTRACT",
        providerId: "browser-j7",
        modelId: "fixture-j7",
        modelConfigVersion: "companion-directive-v6",
        certified: true,
        allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6],
        inputTokenLimit: 2_000,
        outputTokenLimit: 1_000,
        timeoutMs: 1_000,
        fallbackRouteIds: []
      },
      retryPolicy: { schemaVersion: 1, role: "player_intent_interpreter", maxTechnicalRetries: 0, maxTargetedCorrections: 0, maxFullRegenerations: 0, allowFallback: false }
    },
    mjPlannerConfig: null,
    npcPerformerConfig: null,
    interpreterCharacterContextResolver: null,
    activeSceneResolver: {
      async resolve() { return { ok: true as const, value: companionScene }; }
    }
  });
  const firstContact = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "j7-browser:first-contact",
    rawInput: "Je salue Marel."
  });
  if (!firstContact.ok) throw new Error(firstContact.error.messageKey);
  const proposed = await controller.proposeMissionRelationEngagement({
    schemaVersion: 1,
    contractVersion: "mission-relation-proposal-command/1",
    clientRequestId: "j7-browser:propose-relation",
    engagementId: "engagement:j7-browser:shared-road",
    engagementKind: "RELATION",
    sceneId: companionScene.sceneId,
    sceneActorId: actorId,
    durableRef: "relation:j7-browser:shared-road",
    summary: "Marel et le joueur choisissent de poursuivre la route ensemble.",
    proposedBy: "PLAYER",
    publicSourceRefs: ["dialogue:j7-browser:shared-road"]
  });
  if (!proposed.ok) throw new Error(proposed.error.messageKey);
  const resolved = await controller.resolveMissionRelationEngagement({
    schemaVersion: 1,
    contractVersion: "mission-relation-resolution-command/1",
    clientRequestId: "j7-browser:accept-relation",
    engagementId: "engagement:j7-browser:shared-road",
    resolution: {
      schemaVersion: 1,
      disposition: "ACCEPTED",
      authority: "SOCIAL",
      evidenceKind: "SOCIAL_RESOLUTION",
      authorityOperationId: "social:j7-browser:shared-road",
      publicSourceRefs: ["social:j7-browser:mutual-choice"],
      conditions: [],
      version: 1
    }
  });
  if (!resolved.ok || resolved.value.ownerConfirmation === null) throw new Error("Relation compagnon non confirmée.");
  const promoted = await controller.promoteSceneActor({
    schemaVersion: 1,
    clientRequestId: "j7-browser:promote-marel",
    sceneId: companionScene.sceneId,
    sceneActorId: actorId,
    ownerConfirmation: resolved.value.ownerConfirmation
  });
  if (!promoted.ok) throw new Error(promoted.error.messageKey);
  const recruited = await controller.recruitCompanion({
    schemaVersion: 1,
    clientRequestId: "j7-browser:recruit-marel",
    campaignNpcId: promoted.value.campaignNpc.campaignNpcId,
    actorId,
    engagementId: "engagement:j7-browser:shared-road",
    activeSceneId: companionScene.sceneId,
    leaderActorId: "actor:player",
    occurredAtGameSecond: 0,
    autonomyPolicy: policy
  });
  if (!recruited.ok && recruited.error.code !== "IDEMPOTENCY_CONFLICT") throw new Error(recruited.error.messageKey);
  window.__companionJ7Controller = controller;
  return { controller, openingScene: companionScene };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <NarrativeAppSurface bootstrapController={bootstrap} />
);
