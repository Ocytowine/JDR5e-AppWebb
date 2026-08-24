import type { AiIntentRuntimeHandlingV1, AiStructuredSemanticIntentV1 } from "../ai/types";
import type { JsonObject } from "../core";

export const NARRATIVE_RUNTIME_CAPABILITY_REGISTRY_VERSION_V1 = "narrative-runtime-capability-registry/1" as const;
export const NARRATIVE_RUNTIME_CAPABILITY_REGISTRY_VERSION_V2 = "narrative-runtime-capability-registry/2" as const;
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

export interface NarrativeRuntimeAvailabilityV2 {
  rest: boolean;
  inventoryMutation?: boolean;
}

export interface InterpreterRuntimeCapabilityV1 extends JsonObject {
  capabilityId: string;
  domain: NarrativeRuntimeDomainV1;
  availability: "AVAILABLE" | "HANDOFF_ONLY" | "EXTERNAL_TRIGGER_ONLY";
  playerFacingScope: string;
}

export interface InterpreterRuntimeContextV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: "interpreter-runtime-context/1";
  capabilities: InterpreterRuntimeCapabilityV1[];
  activeTravel: {
    status: "PLANNED" | "ACTIVE" | "INTERRUPTED";
    destinationLocationId: string;
    awaitingPlayerDecision: boolean;
  } | null;
}

export interface NarrativeRuntimeRouteV2 extends Omit<NarrativeRuntimeRouteV1, "registryVersion" | "noGameTime"> {
  registryVersion: typeof NARRATIVE_RUNTIME_CAPABILITY_REGISTRY_VERSION_V2;
  noGameTime: boolean;
}

export const NARRATIVE_RUNTIME_CAPABILITIES_V1: readonly NarrativeRuntimeCapabilityV1[] = [
  { capabilityId: "scene.visible-interaction", domain: "scene_resolution", semanticKinds: ["move_near_visible_actor", "manipulate_visible_object", "nonverbal_signal"], disposition: "HANDLE", commandFamily: "SCENE_INTERACTION", commitPolicy: "DOMAIN_VALIDATED", noGameTime: true },
  { capabilityId: "scene.visible-dialogue", domain: "social", semanticKinds: ["address_visible_actor"], disposition: "HANDLE", commandFamily: "SPEECH", commitPolicy: "DOMAIN_VALIDATED", noGameTime: true },
  { capabilityId: "scene.visible-perception", domain: "perception", semanticKinds: ["observe_environment"], disposition: "HANDLE", commandFamily: "PERCEPTION", commitPolicy: "FORBIDDEN", noGameTime: true },
  { capabilityId: "scene.context-response", domain: "scene_resolution", semanticKinds: ["context_question", "meta_request", "hypothetical_action"], disposition: "HANDLE", commandFamily: "PERCEPTION", commitPolicy: "FORBIDDEN", noGameTime: true }
] as const;

export function buildInterpreterRuntimeContextV1(input: {
  sceneTransition: boolean;
  dynamicPlace: boolean;
  rest: boolean;
  inventoryAccess: boolean;
  inventoryMutation?: boolean;
  tacticalAccess: boolean;
  travel?: boolean;
  activeTravel?: InterpreterRuntimeContextV1["activeTravel"];
}): InterpreterRuntimeContextV1 {
  return {
    schemaVersion: 1,
    contractVersion: "interpreter-runtime-context/1",
    activeTravel: input.activeTravel ?? null,
    capabilities: [
      ...NARRATIVE_RUNTIME_CAPABILITIES_V1.map(capability => ({
        capabilityId: capability.capabilityId,
        domain: capability.domain,
        availability: "AVAILABLE" as const,
        playerFacingScope: playerFacingScope(capability.capabilityId)
      })),
      {
        capabilityId: "world.narrative-travel",
        domain: "world",
        availability: input.travel ? "AVAILABLE" : "HANDOFF_ONLY",
        playerFacingScope: "DÃ©part ou reprise d'un trajet par intention libre; une interruption active attend une rÃ©ponse dans la fiction."
      },
      {
        capabilityId: "world.scene-transition",
        domain: "world",
        availability: input.sceneTransition ? "AVAILABLE" : "HANDOFF_ONLY",
        playerFacingScope: "Franchissement d'une limite visible vers une destination connue."
      },
      {
        capabilityId: "world.dynamic-place",
        domain: "world",
        availability: input.dynamicPlace ? "AVAILABLE" : "HANDOFF_ONLY",
        playerFacingScope: "Déplacement engagé vers un lieu compatible qui n'existe pas encore dans la scène."
      },
      {
        capabilityId: "rest.process",
        domain: "rest",
        availability: input.rest ? "AVAILABLE" : "HANDOFF_ONLY",
        playerFacingScope: "Demande engagée de repos court ou long; le propriétaire vérifie ensuite le lieu et les règles."
      },
      {
        capabilityId: "inventory.access-credential",
        domain: "inventory",
        availability: input.inventoryAccess ? "AVAILABLE" : "HANDOFF_ONLY",
        playerFacingScope: "Présenter un objet réellement possédé à un contrôle d'accès actif qui accepte l'approche inventaire."
      },
      {
        capabilityId: "inventory.mutation",
        domain: "inventory",
        availability: input.inventoryMutation ? "AVAILABLE" : "HANDOFF_ONLY",
        playerFacingScope: "Gérer, transférer, donner, recevoir, acheter ou vendre un exemplaire réel; le propriétaire vérifie possession, lieu, PNJ, offre, prix, monnaie, contenant, capacité et emplacement."
      },
      {
        capabilityId: "tactical.access-conflict",
        domain: "tactical",
        availability: input.tacticalAccess ? "AVAILABLE" : "HANDOFF_ONLY",
        playerFacingScope: "Engager l'approche tactique d'un contrôle d'accès actif lorsqu'une fabrique de rencontre propriétaire est installée."
      },
      {
        capabilityId: "tactical.generic-handoff",
        domain: "tactical",
        availability: "HANDOFF_ONLY",
        playerFacingScope: "Intention violente ou combat libre; aucun résultat tactique n'est autorisé par l'interpréteur."
      },
      {
        capabilityId: "campaign.autonomous-boundaries",
        domain: "world",
        availability: "EXTERNAL_TRIGGER_ONLY",
        playerFacingScope: "Monde, intrigue, progression, bastion et défense évoluent depuis leurs causes ou commandes propriétaires."
      }
    ]
  };
}

const CLOSED_DOMAINS = new Set<NarrativeRuntimeDomainV1>(["inventory", "rules", "tactical", "rest", "world"]);

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

/**
 * V2 conserve le registre fermé par défaut, mais permet au contrôleur d'ouvrir
 * un domaine uniquement lorsqu'un propriétaire effectif lui a été injecté.
 * La disponibilité ne change jamais le sens proposé par l'interpréteur.
 */
export function routeNarrativeSemanticIntentV2(input: {
  semanticIntent: AiStructuredSemanticIntentV1;
  runtimeSuggestion: AiIntentRuntimeHandlingV1 | null;
  availability: NarrativeRuntimeAvailabilityV2;
}): NarrativeRuntimeRouteV2 {
  const legacy = routeNarrativeSemanticIntentV1(input);
  const committedRest =
    input.runtimeSuggestion?.requiredDomain === "rest" &&
    input.semanticIntent.commitment === "committed" &&
    input.semanticIntent.confidence !== "low" &&
    input.semanticIntent.kind !== "unclear_intent";
  const committedInventoryMutation =
    input.runtimeSuggestion?.requiredDomain === "inventory" &&
    input.semanticIntent.commitment === "committed" &&
    input.semanticIntent.confidence !== "low" &&
    input.semanticIntent.kind !== "unclear_intent";
  if (committedInventoryMutation && input.availability.inventoryMutation) {
    return {
      ...legacy,
      registryVersion: NARRATIVE_RUNTIME_CAPABILITY_REGISTRY_VERSION_V2,
      routeId: "capability:inventory.mutation",
      capabilityId: "inventory.mutation",
      disposition: "HANDLE",
      requiredDomain: "inventory",
      commandFamily: "SCENE_INTERACTION",
      commitPolicy: "DOMAIN_VALIDATED",
      noGameTime: true,
      reason: "Le propriétaire de transaction d'inventaire est disponible et valide l'exemplaire, le contenant et l'emplacement."
    };
  }
  if (committedRest && input.availability.rest) {
    return {
      ...legacy,
      registryVersion: NARRATIVE_RUNTIME_CAPABILITY_REGISTRY_VERSION_V2,
      routeId: "capability:rest.process",
      capabilityId: "rest.process",
      disposition: "HANDLE",
      requiredDomain: "rest",
      commandFamily: "HANDOFF",
      commitPolicy: "DOMAIN_VALIDATED",
      noGameTime: false,
      reason: "Le propriétaire du repos est disponible; il valide les choix, le temps et le commit du processus."
    };
  }
  if (committedRest) {
    return {
      ...handoffRoute("rest"),
      registryVersion: NARRATIVE_RUNTIME_CAPABILITY_REGISTRY_VERSION_V2
    };
  }
  return {
    ...legacy,
    registryVersion: NARRATIVE_RUNTIME_CAPABILITY_REGISTRY_VERSION_V2
  };
}

function shouldHonorClosedDomain(semantic: AiStructuredSemanticIntentV1, domain: NarrativeRuntimeDomainV1): boolean {
  if (semantic.kind !== "manipulate_visible_object") return capabilityForSemanticKind(semantic.kind) === null;
  if (domain === "inventory") return true;
  const targetKind = semantic.target?.kind ?? "unknown";
  if (domain === "tactical" && targetKind === "npc") return true;
  if (domain === "world") return !semantic.forbiddenInterpretations.includes("scene_transition");
  return targetKind !== "object" && targetKind !== "place";
}

function playerFacingScope(capabilityId: string): string {
  switch (capabilityId) {
    case "scene.visible-interaction":
      return "Interactions locales avec les acteurs, objets et signes visibles de la scène.";
    case "scene.visible-dialogue":
      return "Paroles, questions, déclarations et demandes adressées à un acteur visible.";
    case "scene.visible-perception":
      return "Observation générale, examen visible et recherche d'un indice incertain.";
    default:
      return "Questions de contexte, demandes méta et possibilités sans action engagée.";
  }
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
