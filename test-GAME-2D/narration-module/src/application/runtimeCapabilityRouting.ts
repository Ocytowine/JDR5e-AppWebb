import type { AiIntentRuntimeHandlingV1, AiStructuredSemanticIntentV1 } from "../ai/types";

export const NARRATIVE_RUNTIME_CAPABILITY_REGISTRY_VERSION_V1 = "narrative-runtime-capability-registry/1" as const;
export type NarrativeRuntimeDomainV1 = NonNullable<AiIntentRuntimeHandlingV1["requiredDomain"]>;
export type NarrativeRuntimeRouteDispositionV1 = "HANDLE" | "HANDOFF" | "CLARIFY";
export type NarrativeRuntimeCommandFamilyV1 = "SPEECH" | "PERCEPTION" | "SCENE_INTERACTION" | "HANDOFF" | "NONE";

export interface NarrativeRuntimeCapabilityV1 {
  capabilityId: string;
  domain: NarrativeRuntimeDomainV1;
  semanticKinds: AiStructuredSemanticIntentV1["kind"][];
  disposition: "HANDLE";
  commandFamily: Exclude<NarrativeRuntimeCommandFamilyV1, "HANDOFF" | "NONE">;
  commitPolicy: "FORBIDDEN" | "DOMAIN_VALIDATED";
  noGameTime: true;
}

export interface NarrativeRuntimeRouteV1 {
  schemaVersion: 1;
  registryVersion: typeof NARRATIVE_RUNTIME_CAPABILITY_REGISTRY_VERSION_V1;
  routeId: string;
  capabilityId: string | null;
  disposition: NarrativeRuntimeRouteDispositionV1;
  requiredDomain: NarrativeRuntimeDomainV1 | null;
  commandFamily: NarrativeRuntimeCommandFamilyV1;
  commitPolicy: "FORBIDDEN" | "DOMAIN_VALIDATED";
  noGameTime: true;
  reason: string;
}

export const NARRATIVE_RUNTIME_CAPABILITIES_V1: readonly NarrativeRuntimeCapabilityV1[] = [
  { capabilityId: "scene.visible-interaction", domain: "scene_resolution", semanticKinds: ["move_near_visible_actor", "manipulate_visible_object", "nonverbal_signal"], disposition: "HANDLE", commandFamily: "SCENE_INTERACTION", commitPolicy: "DOMAIN_VALIDATED", noGameTime: true },
  { capabilityId: "scene.visible-dialogue", domain: "social", semanticKinds: ["address_visible_actor"], disposition: "HANDLE", commandFamily: "SPEECH", commitPolicy: "DOMAIN_VALIDATED", noGameTime: true },
  { capabilityId: "scene.visible-perception", domain: "perception", semanticKinds: ["observe_environment"], disposition: "HANDLE", commandFamily: "PERCEPTION", commitPolicy: "FORBIDDEN", noGameTime: true },
  { capabilityId: "scene.context-response", domain: "scene_resolution", semanticKinds: ["context_question", "meta_request", "hypothetical_action"], disposition: "HANDLE", commandFamily: "PERCEPTION", commitPolicy: "FORBIDDEN", noGameTime: true }
] as const;

const CLOSED_DOMAINS = new Set<NarrativeRuntimeDomainV1>(["inventory", "tactical", "rest", "world"]);

export function routeNarrativeSemanticIntentV1(input: {
  semanticIntent: AiStructuredSemanticIntentV1;
  runtimeSuggestion: AiIntentRuntimeHandlingV1 | null;
}): NarrativeRuntimeRouteV1 {
  const semantic = input.semanticIntent;
  if (semantic.kind === "unclear_intent" || semantic.confidence === "low" || semantic.commitment === "unclear") {
    return clarifyRoute("L'intention sémantique reste insuffisamment déterminée pour sélectionner une capacité runtime.");
  }
  const suggestedDomain = input.runtimeSuggestion?.requiredDomain ?? null;
  if (
    suggestedDomain !== null &&
    CLOSED_DOMAINS.has(suggestedDomain) &&
    shouldHonorClosedDomain(semantic, suggestedDomain)
  ) {
    return handoffRoute(suggestedDomain);
  }
  const capability = capabilityForSemanticKind(semantic.kind);
  if (semantic.commitment === "none" || semantic.commitment === "hypothetical") {
    return capability === null
      ? noCommitRoute("Intention non engagée conservée sans commande ni commit.")
      : handledRoute(capability, "Intention non engagée traitée sans commit par la capacité déclarée.", "FORBIDDEN");
  }
  if (capability !== null) {
    return handledRoute(capability, `Capacité ouverte ${capability.capabilityId} sélectionnée depuis semanticIntent.kind.`);
  }
  if (suggestedDomain !== null && CLOSED_DOMAINS.has(suggestedDomain)) {
    return handoffRoute(suggestedDomain);
  }
  return clarifyRoute("Aucune capacité ouverte ne correspond à l'intention sémantique; le sens n'est pas forcé dans scene_resolution.");
}

function shouldHonorClosedDomain(semantic: AiStructuredSemanticIntentV1, domain: NarrativeRuntimeDomainV1): boolean {
  if (semantic.kind !== "manipulate_visible_object") return capabilityForSemanticKind(semantic.kind) === null;
  if (domain === "inventory") return true;
  const targetKind = semantic.target?.kind ?? "unknown";
  if (domain === "tactical" && targetKind === "npc") return true;
  if (domain === "world") return !semantic.forbiddenInterpretations.includes("scene_transition");
  return targetKind !== "object" && targetKind !== "place";
}

function handoffRoute(domain: NarrativeRuntimeDomainV1): NarrativeRuntimeRouteV1 {
  const label = domain === "tactical" ? "tactique" : domain === "inventory" ? "inventaire" : domain === "rest" ? "repos" : domain === "world" ? "monde" : domain;
  return { schemaVersion: 1, registryVersion: NARRATIVE_RUNTIME_CAPABILITY_REGISTRY_VERSION_V1, routeId: `handoff:${domain}`, capabilityId: null, disposition: "HANDOFF", requiredDomain: domain, commandFamily: "HANDOFF", commitPolicy: "FORBIDDEN", noGameTime: true, reason: `Handoff ${label} requis: le sens est conservé, mais le domaine ${domain} n'est pas ouvert dans le registre runtime.` };
}

function capabilityForSemanticKind(kind: AiStructuredSemanticIntentV1["kind"]): NarrativeRuntimeCapabilityV1 | null {
  return NARRATIVE_RUNTIME_CAPABILITIES_V1.find(entry => entry.semanticKinds.includes(kind)) ?? null;
}

function handledRoute(capability: NarrativeRuntimeCapabilityV1, reason: string, commitPolicy = capability.commitPolicy): NarrativeRuntimeRouteV1 {
  return { schemaVersion: 1, registryVersion: NARRATIVE_RUNTIME_CAPABILITY_REGISTRY_VERSION_V1, routeId: `capability:${capability.capabilityId}`, capabilityId: capability.capabilityId, disposition: "HANDLE", requiredDomain: capability.domain, commandFamily: capability.commandFamily, commitPolicy, noGameTime: true, reason };
}

function noCommitRoute(reason: string): NarrativeRuntimeRouteV1 {
  return { schemaVersion: 1, registryVersion: NARRATIVE_RUNTIME_CAPABILITY_REGISTRY_VERSION_V1, routeId: "capability:scene.context-response", capabilityId: "scene.context-response", disposition: "HANDLE", requiredDomain: "scene_resolution", commandFamily: "NONE", commitPolicy: "FORBIDDEN", noGameTime: true, reason };
}

function clarifyRoute(reason: string): NarrativeRuntimeRouteV1 {
  return { schemaVersion: 1, registryVersion: NARRATIVE_RUNTIME_CAPABILITY_REGISTRY_VERSION_V1, routeId: "clarify:unroutable-semantic-intent", capabilityId: null, disposition: "CLARIFY", requiredDomain: null, commandFamily: "NONE", commitPolicy: "FORBIDDEN", noGameTime: true, reason };
}
