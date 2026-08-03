import type { JsonObject } from "../core";
import type { SceneTransitionTopologyV1 } from "./sceneTransition";

export const DESTINATION_PLAUSIBILITY_CONTRACT_V1 = "destination-plausibility/1" as const;

export type DestinationMentionKindV1 =
  | "VISIBLE_DECLARED_EXIT"
  | "KNOWN_PLACE"
  | "PROPER_NAME"
  | "DESCRIPTIVE_REQUEST";

export type DestinationDeclaredScaleV1 = "LOCAL" | "TRAVEL" | "UNKNOWN";

export interface DestinationMentionV1 extends JsonObject {
  schemaVersion: 1;
  mentionKind: DestinationMentionKindV1;
  rawMention: string;
  requestedDisplayName: string | null;
  destinationDescription: string | null;
  proposedPlaceRef: string | null;
  visibleBoundaryRef: string | null;
  declaredScale: DestinationDeclaredScaleV1;
}

export interface DestinationKnownPlaceV1 extends JsonObject {
  schemaVersion: 1;
  placeRef: string;
  displayName: string;
  aliases: string[];
  parentLocationRef: string;
  arrivalSceneId: string | null;
  sourceRefs: string[];
}

export type DestinationLoreConstraintEffectV1 = "FORBID" | "REQUIRE_CONDITION";

/**
 * A constraint must already have been matched to the requested destination by
 * its owning lore projection. This pure resolver never infers a contradiction
 * from prose on its own.
 */
export interface MatchedDestinationLoreConstraintV1 extends JsonObject {
  schemaVersion: 1;
  constraintId: string;
  effect: DestinationLoreConstraintEffectV1;
  reason: string;
  condition: string | null;
  ownerDomain: string | null;
  sourceRefs: string[];
}

export interface DestinationResolutionContextV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof DESTINATION_PLAUSIBILITY_CONTRACT_V1;
  sourceSceneId: string;
  sourceLocationRef: string;
  currentParentLocationRef: string;
  geographicChain: string[];
  mention: DestinationMentionV1;
  knownPlaces: DestinationKnownPlaceV1[];
  topology: SceneTransitionTopologyV1;
  matchedLoreConstraints: MatchedDestinationLoreConstraintV1[];
}

export type DestinationPlausibilityOutcomeV1 =
  | "USE_KNOWN_DESTINATION"
  | "CREATE_LOCAL"
  | "CLARIFY"
  | "TRAVEL_REQUIRED"
  | "REJECT_CONTRADICTION"
  | "ARBITRATION_REQUIRED";

export type DestinationPlausibilityCodeV1 =
  | "KNOWN_LOCAL_DESTINATION"
  | "KNOWN_DESTINATION_ROUTE_REQUIRED"
  | "VISIBLE_EXIT_CAN_BE_MATERIALIZED"
  | "EXPLICIT_LOCAL_DESCRIPTION_REQUIRES_ARBITRATION"
  | "UNKNOWN_NAMED_DESTINATION_REQUIRES_ARBITRATION"
  | "DESTINATION_MENTION_AMBIGUOUS"
  | "DESTINATION_SCOPE_UNCLEAR"
  | "KNOWN_TRAVEL_DESTINATION"
  | "EXPLICIT_TRAVEL_DESTINATION"
  | "LORE_CONTRADICTION"
  | "INVALID_CONTEXT";

export interface DestinationAccessHintV1 extends JsonObject {
  schemaVersion: 1;
  state: "CONTROLLED" | "BLOCKED" | "UNKNOWN";
  ownerDomain: string;
  reason: string;
  requirements: string[];
  sourceRefs: string[];
  authority: "NON_COMMITTABLE_ACCESS_HINT";
}

export interface DestinationPlausibilityDecisionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof DESTINATION_PLAUSIBILITY_CONTRACT_V1;
  outcome: DestinationPlausibilityOutcomeV1;
  code: DestinationPlausibilityCodeV1;
  destinationRef: string | null;
  allowedParentLocationRef: string | null;
  candidatePlaceRefs: string[];
  reason: string;
  accessHint: DestinationAccessHintV1 | null;
  sourceRefs: string[];
  commitAuthority: false;
}

export function buildDestinationMentionV1(input: {
  rawMention: string;
  proposedPlaceRef: string | null;
  visibleBoundaryRef: string | null;
  visibleDestinationName: string | null;
}): DestinationMentionV1 {
  const rawMention = input.rawMention.trim();
  if (input.visibleBoundaryRef !== null) {
    return {
      schemaVersion: 1,
      mentionKind: "VISIBLE_DECLARED_EXIT",
      rawMention,
      requestedDisplayName: input.visibleDestinationName?.trim() || rawMention,
      destinationDescription: null,
      proposedPlaceRef: input.proposedPlaceRef,
      visibleBoundaryRef: input.visibleBoundaryRef,
      declaredScale: "LOCAL"
    };
  }
  const descriptive = isDescriptiveDestination(rawMention);
  return {
    schemaVersion: 1,
    mentionKind: input.proposedPlaceRef !== null ? "KNOWN_PLACE" : descriptive ? "DESCRIPTIVE_REQUEST" : "PROPER_NAME",
    rawMention,
    requestedDisplayName: descriptive ? null : rawMention,
    destinationDescription: descriptive ? rawMention : null,
    proposedPlaceRef: input.proposedPlaceRef,
    visibleBoundaryRef: null,
    declaredScale: inferDeclaredScale(rawMention)
  };
}

export function validateDestinationResolutionContextV1(
  context: DestinationResolutionContextV1
): { ok: true } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  if (context.schemaVersion !== 1) issues.push("schemaVersion must be 1.");
  if (context.contractVersion !== DESTINATION_PLAUSIBILITY_CONTRACT_V1) issues.push("contractVersion mismatch.");
  if (!context.sourceSceneId.trim()) issues.push("sourceSceneId is required.");
  if (!isCanonicalRef(context.sourceLocationRef)) issues.push("sourceLocationRef must be canonical.");
  if (!isCanonicalRef(context.currentParentLocationRef)) issues.push("currentParentLocationRef must be canonical.");
  if (!context.mention.rawMention.trim()) issues.push("mention.rawMention is required.");
  if (context.mention.requestedDisplayName !== null && !context.mention.requestedDisplayName.trim()) issues.push("requestedDisplayName must be null or non-empty.");
  if (context.mention.destinationDescription !== null && !context.mention.destinationDescription.trim()) issues.push("destinationDescription must be null or non-empty.");
  if (context.mention.proposedPlaceRef !== null && !isCanonicalRef(context.mention.proposedPlaceRef)) issues.push("proposedPlaceRef must be null or canonical.");
  if (context.mention.visibleBoundaryRef !== null && !isCanonicalRef(context.mention.visibleBoundaryRef)) issues.push("visibleBoundaryRef must be null or canonical.");
  if (context.mention.mentionKind === "VISIBLE_DECLARED_EXIT" && context.mention.visibleBoundaryRef === null) issues.push("A visible declared exit requires visibleBoundaryRef.");
  for (const place of context.knownPlaces) {
    if (!isCanonicalRef(place.placeRef)) issues.push(`Known place ref is not canonical: ${place.placeRef}.`);
    if (!place.displayName.trim()) issues.push(`Known place ${place.placeRef || "unknown"} requires displayName.`);
    if (!isCanonicalRef(place.parentLocationRef)) issues.push(`Known place ${place.placeRef || "unknown"} requires a canonical parentLocationRef.`);
    if (place.sourceRefs.length === 0 || place.sourceRefs.some(ref => !ref.trim())) issues.push(`Known place ${place.placeRef || "unknown"} requires sourceRefs.`);
  }
  for (const constraint of context.matchedLoreConstraints) {
    if (!constraint.constraintId.trim() || !constraint.reason.trim()) issues.push("Matched lore constraints require an id and a reason.");
    if (constraint.sourceRefs.length === 0 || constraint.sourceRefs.some(ref => !ref.trim())) issues.push(`Constraint ${constraint.constraintId || "unknown"} requires sourceRefs.`);
    if (constraint.effect === "REQUIRE_CONDITION" && !constraint.condition?.trim()) issues.push(`Constraint ${constraint.constraintId || "unknown"} requires a condition.`);
  }
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

export function decideDestinationPlausibilityV1(
  context: DestinationResolutionContextV1
): DestinationPlausibilityDecisionV1 {
  const validation = validateDestinationResolutionContextV1(context);
  if (!validation.ok) {
    return decision("CLARIFY", "INVALID_CONTEXT", {
      reason: validation.issues.join(" | ")
    });
  }

  const forbidden = context.matchedLoreConstraints.filter(constraint => constraint.effect === "FORBID");
  if (forbidden.length > 0) {
    return decision("REJECT_CONTRADICTION", "LORE_CONTRADICTION", {
      reason: forbidden.map(constraint => constraint.reason).join(" "),
      sourceRefs: unique(forbidden.flatMap(constraint => constraint.sourceRefs))
    });
  }

  const conditional = context.matchedLoreConstraints.filter(constraint => constraint.effect === "REQUIRE_CONDITION");
  const accessHint: DestinationAccessHintV1 | null = conditional.length === 0 ? null : {
    schemaVersion: 1,
    state: "CONTROLLED",
    ownerDomain: conditional[0]?.ownerDomain?.trim() || "WorldDomain",
    reason: conditional.map(constraint => constraint.reason).join(" "),
    requirements: conditional.map(constraint => constraint.condition).filter((value): value is string => value !== null),
    sourceRefs: unique(conditional.flatMap(constraint => constraint.sourceRefs)),
    authority: "NON_COMMITTABLE_ACCESS_HINT"
  };

  return { ...decideDestinationExistenceV1(context), accessHint };
}

function decideDestinationExistenceV1(context: DestinationResolutionContextV1): DestinationPlausibilityDecisionV1 {

  const matches = resolveKnownPlaces(context.mention, context.knownPlaces);
  if (matches.length > 1) {
    return decision("CLARIFY", "DESTINATION_MENTION_AMBIGUOUS", {
      candidatePlaceRefs: matches.map(place => place.placeRef),
      reason: "Plusieurs lieux connus correspondent à la destination demandée.",
      sourceRefs: unique(matches.flatMap(place => place.sourceRefs))
    });
  }
  if (matches.length === 1) {
    const place = matches[0]!;
    const connection = context.topology.connections.find(candidate =>
      candidate.sourceSceneId === context.sourceSceneId &&
      candidate.destinationRef === place.placeRef &&
      (context.mention.visibleBoundaryRef === null || candidate.boundaryRef === context.mention.visibleBoundaryRef)
    );
    const requiresTravel = context.mention.declaredScale === "TRAVEL"
      || connection?.scale === "TRAVEL"
      || (connection === undefined && place.parentLocationRef !== context.currentParentLocationRef);
    if (requiresTravel) {
      return decision("TRAVEL_REQUIRED", "KNOWN_TRAVEL_DESTINATION", {
          destinationRef: place.placeRef,
          reason: "La destination existe, mais elle ne relève pas d'une transition locale depuis la scène courante.",
          sourceRefs: place.sourceRefs
        });
    }
    if (connection === undefined || context.mention.visibleBoundaryRef === null) {
      return decision("CLARIFY", "KNOWN_DESTINATION_ROUTE_REQUIRED", {
        destinationRef: place.placeRef,
        candidatePlaceRefs: [place.placeRef],
        reason: "Le lieu existe, mais aucun passage local visible ne permet de confirmer ce déplacement depuis la scène courante.",
        sourceRefs: place.sourceRefs
      });
    }
    return decision("USE_KNOWN_DESTINATION", "KNOWN_LOCAL_DESTINATION", {
      destinationRef: place.placeRef,
      reason: "La destination correspond à un lieu connu accessible par le passage local visible.",
      sourceRefs: unique([...place.sourceRefs, ...connection.sourceRefs])
    });
  }

  const likelyMatches = resolveLikelyKnownPlaces(context.mention, context.knownPlaces);
  if (likelyMatches.length > 0) {
    return decision("CLARIFY", "DESTINATION_MENTION_AMBIGUOUS", {
      candidatePlaceRefs: likelyMatches.map(place => place.placeRef),
      reason: "La destination ressemble à un lieu déjà connu; il faut confirmer son identité avant toute création distincte.",
      sourceRefs: unique(likelyMatches.flatMap(place => place.sourceRefs))
    });
  }

  if (context.mention.declaredScale === "TRAVEL") {
    return decision("TRAVEL_REQUIRED", "EXPLICIT_TRAVEL_DESTINATION", {
      reason: "Le joueur demande explicitement une destination de voyage; aucun lieu local ne doit être créé."
    });
  }

  if (context.mention.mentionKind === "VISIBLE_DECLARED_EXIT") {
    return decision("CREATE_LOCAL", "VISIBLE_EXIT_CAN_BE_MATERIALIZED", {
      allowedParentLocationRef: context.currentParentLocationRef,
      reason: "La scène déclare publiquement cette sortie et aucune destination connue ne la matérialise encore.",
      sourceRefs: visibleExitSourceRefs(context)
    });
  }

  if (context.mention.declaredScale === "UNKNOWN") {
    return context.mention.mentionKind === "DESCRIPTIVE_REQUEST"
      ? decision("CLARIFY", "DESTINATION_SCOPE_UNCLEAR", {
          reason: "La proximité ou l'échelle de la destination n'est pas suffisamment établie."
        })
      : decision("ARBITRATION_REQUIRED", "UNKNOWN_NAMED_DESTINATION_REQUIRES_ARBITRATION", {
          allowedParentLocationRef: context.currentParentLocationRef,
          reason: "Le lieu nommé est inconnu; l'arbitre doit déterminer s'il est local, distant ou contradictoire."
        });
  }

  return context.mention.mentionKind === "DESCRIPTIVE_REQUEST"
    ? decision("ARBITRATION_REQUIRED", "EXPLICIT_LOCAL_DESCRIPTION_REQUIRES_ARBITRATION", {
        allowedParentLocationRef: context.currentParentLocationRef,
        reason: "La demande est locale mais sa plausibilité sémantique doit être évaluée avant création."
      })
    : decision("ARBITRATION_REQUIRED", "UNKNOWN_NAMED_DESTINATION_REQUIRES_ARBITRATION", {
        allowedParentLocationRef: context.currentParentLocationRef,
        reason: "Le nom ne correspond à aucun lieu connu; son existence locale doit être arbitrée avant création."
      });
}

function resolveKnownPlaces(mention: DestinationMentionV1, places: DestinationKnownPlaceV1[]): DestinationKnownPlaceV1[] {
  if (mention.proposedPlaceRef !== null) {
    const exactRef = places.filter(place => place.placeRef === mention.proposedPlaceRef);
    if (exactRef.length > 0) return exactRef;
  }
  const identity = mention.requestedDisplayName ?? mention.rawMention;
  const normalizedIdentity = normalizeIdentity(identity);
  return places.filter(place =>
    [place.displayName, ...place.aliases].some(value => normalizeIdentity(value) === normalizedIdentity)
  );
}

function resolveLikelyKnownPlaces(mention: DestinationMentionV1, places: DestinationKnownPlaceV1[]): DestinationKnownPlaceV1[] {
  const identityTokens = significantTokens(mention.requestedDisplayName ?? mention.rawMention);
  if (identityTokens.size < 2) return [];
  return places.filter(place =>
    [place.displayName, ...place.aliases].some(value => tokenSimilarity(identityTokens, significantTokens(value)) >= 0.67)
  );
}

function significantTokens(value: string): Set<string> {
  const ignored = new Set(["a", "au", "aux", "de", "des", "du", "la", "le", "les", "l", "un", "une", "d"]);
  return new Set(normalize(value).replace(/[^a-z0-9]+/gu, " ").split(" ").filter(token => token.length > 1 && !ignored.has(token)));
}

function tokenSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  const intersection = [...left].filter(token => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return intersection / union;
}

function visibleExitSourceRefs(context: DestinationResolutionContextV1): string[] {
  const boundaryRef = context.mention.visibleBoundaryRef;
  if (boundaryRef === null) return [];
  return unique(context.topology.connections
    .filter(connection => connection.sourceSceneId === context.sourceSceneId && connection.boundaryRef === boundaryRef)
    .flatMap(connection => connection.sourceRefs));
}

function decision(
  outcome: DestinationPlausibilityOutcomeV1,
  code: DestinationPlausibilityCodeV1,
  detail: Partial<Pick<DestinationPlausibilityDecisionV1, "destinationRef" | "allowedParentLocationRef" | "candidatePlaceRefs" | "reason" | "accessHint" | "sourceRefs">>
): DestinationPlausibilityDecisionV1 {
  return {
    schemaVersion: 1,
    contractVersion: DESTINATION_PLAUSIBILITY_CONTRACT_V1,
    outcome,
    code,
    destinationRef: detail.destinationRef ?? null,
    allowedParentLocationRef: detail.allowedParentLocationRef ?? null,
    candidatePlaceRefs: detail.candidatePlaceRefs ?? [],
    reason: detail.reason ?? "",
    accessHint: detail.accessHint ?? null,
    sourceRefs: unique(detail.sourceRefs ?? []),
    commitAuthority: false
  };
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").trim().toLocaleLowerCase("fr-FR").replace(/\s+/gu, " ");
}

function isDescriptiveDestination(value: string): boolean {
  const normalized = normalize(value);
  return /^(?:un|une|des|quelques?|n'importe quel|un endroit|un lieu)\b/u.test(normalized)
    || /\b(?:non loin|a proximite|dans les environs|pres d'ici|calme|discret|anime|abandonne)\b/u.test(normalized);
}

function inferDeclaredScale(value: string): DestinationDeclaredScaleV1 {
  const normalized = normalize(value);
  if (/\b(?:non loin|a proximite|dans les environs|pres d'ici|a cote|voisin|proche|dans ce quartier)\b/u.test(normalized)) return "LOCAL";
  if (/\b(?:autre ville|autre region|lointain|au loin|voyage|pars pour|partir pour)\b/u.test(normalized)) return "TRAVEL";
  return "UNKNOWN";
}

function normalizeIdentity(value: string): string {
  return normalize(value).replace(/^(?:a la |a l'|aux |au |a |les |le |la |l')/u, "").trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isCanonicalRef(value: string): boolean {
  return /^[a-z][a-z0-9_-]*:.+/u.test(value);
}
