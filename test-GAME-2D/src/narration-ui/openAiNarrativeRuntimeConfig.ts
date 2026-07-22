import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V2,
  NPC_PERFORMER_CONTRACT_VERSION_V1,
  type AiIntentInterpreterConfigV1,
  type NpcPerformerConfigV1
} from "../../narration-module/src/application";
import type { LoreGuidedPlaceCandidateGeneratorConfigV1 } from "../../narration-module/src/application";
import { ServerOpenAiEnhancementProviderV1 } from "./serverOpenAiEnhancementClient";

export function buildOpenAiIntentInterpreterConfigV1(endpoint?: string): AiIntentInterpreterConfigV1 {
  return {
    provider: new ServerOpenAiEnhancementProviderV1(endpoint),
    contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V2,
    route: {
      schemaVersion: 1,
      routeId: "prototype-ui-openai-player-intent-interpreter",
      role: "player_intent_interpreter",
      providerKind: "FAKE_CONTRACT",
      providerId: "server-openai-route",
      modelId: "server-selected-openai-intent-model",
      modelConfigVersion: "i06z",
      certified: true,
      allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1, AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V2],
      inputTokenLimit: 2_000,
      outputTokenLimit: 900,
      timeoutMs: 30_000,
      fallbackRouteIds: []
    },
    retryPolicy: {
      schemaVersion: 1,
      role: "player_intent_interpreter",
      maxTechnicalRetries: 1,
      maxTargetedCorrections: 0,
      maxFullRegenerations: 0,
      allowFallback: true
    }
  };
}

export function buildOpenAiNpcPerformerConfigV1(endpoint?: string): NpcPerformerConfigV1 {
  return {
    provider: new ServerOpenAiEnhancementProviderV1(endpoint),
    route: {
      schemaVersion: 1,
      routeId: "prototype-ui-openai-npc-performer",
      role: "npc_performer",
      providerKind: "FAKE_CONTRACT",
      providerId: "server-openai-route",
      modelId: "server-selected-openai-npc-performer-model",
      modelConfigVersion: "i06zk",
      certified: true,
      allowedContractVersions: [NPC_PERFORMER_CONTRACT_VERSION_V1],
      inputTokenLimit: 2_000,
      outputTokenLimit: 2_000,
      timeoutMs: 30_000,
      fallbackRouteIds: []
    },
    coherenceCriticRoute: {
      schemaVersion: 1,
      routeId: "prototype-ui-openai-npc-dialogue-critic",
      role: "coherence_critic",
      providerKind: "FAKE_CONTRACT",
      providerId: "server-openai-route",
      modelId: "server-selected-openai-coherence-critic-model",
      modelConfigVersion: "nar-130-dialogue-act-fidelity",
      certified: true,
      allowedContractVersions: ["narrative-ai-resolution/1"],
      inputTokenLimit: 1_000,
      outputTokenLimit: 1_600,
      timeoutMs: 30_000,
      fallbackRouteIds: []
    },
    retryPolicy: {
      schemaVersion: 1,
      role: "npc_performer",
      maxTechnicalRetries: 0,
      maxTargetedCorrections: 0,
      maxFullRegenerations: 0,
      allowFallback: false
    }
  };
}

export function buildOpenAiSceneCreatorConfigV1(endpoint?: string): LoreGuidedPlaceCandidateGeneratorConfigV1 {
  return {
    provider: new ServerOpenAiEnhancementProviderV1(endpoint),
    route: {
      schemaVersion: 1, routeId: "prototype-ui-openai-scene-creator", role: "scene_creator",
      providerKind: "FAKE_CONTRACT", providerId: "server-openai-route", modelId: "server-selected-openai-model",
      modelConfigVersion: "lore-guided-place-v1", certified: true,
      allowedContractVersions: ["lore-guided-place-candidate/1"], inputTokenLimit: 2_000, outputTokenLimit: 1_500,
      timeoutMs: 30_000, fallbackRouteIds: []
    },
    retryPolicy: { schemaVersion: 1, role: "scene_creator", maxTechnicalRetries: 0, maxTargetedCorrections: 0, maxFullRegenerations: 0, allowFallback: false }
  };
}
