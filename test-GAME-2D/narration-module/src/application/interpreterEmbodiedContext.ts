import type { JsonObject } from "../core";
import type { InterpreterCharacterContextV1 } from "./interpreterCharacterContext";
import type { PlayerPublicContextV1 } from "./playerPublicContext";
import type { InterpreterRuntimeContextV1 } from "./runtimeCapabilityRouting";
import type { LocalInteractionFocusV1 } from "./localInteractionFocus";

export const INTERPRETER_EMBODIED_PUBLIC_CONTEXT_CONTRACT_V1 =
  "interpreter-embodied-public-context/1" as const;

export interface InterpreterEmbodiedPublicContextV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof INTERPRETER_EMBODIED_PUBLIC_CONTEXT_CONTRACT_V1;
  character: JsonObject & {
    ref: string;
    label: string;
    raceRef: string | null;
    backgroundRef: string | null;
    biography: string | null;
    personality: string | null;
    objectives: string | null;
    flaws: string | null;
    physicalDescription: string | null;
  };
  namedReferences: Array<JsonObject & {
    ref: string;
    kind: string;
    label: string;
    aliases: string[];
    referenceOnly: true;
  }>;
  referenceAmbiguities: Array<JsonObject & {
    alias: string;
    candidateRefs: string[];
    candidateLabels: string[];
  }>;
  currentScene: JsonObject & {
    sceneId: string;
    label: string;
    presentActors: Array<JsonObject & {
      actorRef: string;
      label: string;
      publicRole: string;
      visibleState: string;
    }>;
  };
  acquiredKnowledge: Array<JsonObject & {
    factRef: string;
    statement: string;
    status: string;
    attributedSpeakerRefs: string[];
  }>;
  activeInterlocutor: (JsonObject & {
    actorRef: string;
    label: string | null;
    sourceOperationId: string;
  }) | null;
  activeInteraction: LocalInteractionFocusV1 | null;
  recentFocus: Array<JsonObject & {
    targetRef: string;
    targetKind: string;
    label: string | null;
    sourceOperationId: string;
  }>;
  recentIntentions: Array<JsonObject & {
    operationId: string;
    meaning: string;
    commitment: string;
    targetRef: string | null;
  }>;
  presentCompanions: Array<JsonObject & {
    actorRef: string;
    label: string | null;
  }>;
  activeProcess: (JsonObject & {
    kind: "TRAVEL";
    status: string;
    destinationRef: string;
    awaitingPlayerDecision: boolean;
  }) | null;
  runtimeCapabilities: Array<JsonObject & {
    capabilityId: string;
    domain: string;
    availability: string;
    playerFacingScope: string;
  }>;
  authority: "INTERPRETATION_ONLY_PUBLIC_CONTEXT";
  ownerValidationRequired: true;
  noCommit: true;
  noGameTime: true;
  deliberatelyExcluded: string[];
}

export interface InterpreterEmbodiedRecentTurnV1 {
  operationId: string;
  playerGoal: string;
  commitment: string;
  primaryTarget: { ref: string | null } | null;
}

export interface InterpreterEmbodiedFocusV1 {
  target: { kind: string; ref: string | null; label: string | null };
  sourceOperationId: string;
}

const LIMITS = {
  namedReferences: 48,
  referenceAmbiguities: 16,
  presentActors: 16,
  acquiredKnowledge: 16,
  recentFocus: 3,
  recentIntentions: 4,
  presentCompanions: 8,
  runtimeCapabilities: 16
} as const;

const DELIBERATELY_EXCLUDED = [
  "ability_scores_modifiers_hit_points_armor_class_and_difficulty",
  "resource_amounts_charges_cooldowns_prices_and_private_inventories",
  "gm_secrets_hidden_plot_truth_and_other_actor_private_knowledge",
  "npc_private_goals_pressures_deception_and_relationship_values",
  "player_private_notebook",
  "full_conversation_transcripts_and_unbounded_history",
  "success_failure_commit_time_and_domain_routing_authority"
];
const REFERENCE_KIND_ORDER = [
  "LANGUAGE", "ACTION", "SPELL", "FEATURE", "EQUIPPED_ITEM", "INVENTORY_ITEM"
] as const;

export function buildInterpreterEmbodiedPublicContextV1(input: {
  characterContext: InterpreterCharacterContextV1 | null;
  playerPublicContext: PlayerPublicContextV1 | null;
  recentSemanticTurns: readonly InterpreterEmbodiedRecentTurnV1[];
  recentFocus: readonly InterpreterEmbodiedFocusV1[];
  activeInterlocutor: {
    target: { ref: string; label: string | null };
    sourceOperationId: string;
  } | null;
  activeInteraction?: LocalInteractionFocusV1 | null;
  activeCompanionRefs: readonly string[];
  runtimeContext: InterpreterRuntimeContextV1;
}): InterpreterEmbodiedPublicContextV1 | null {
  const characterContext = input.characterContext;
  const publicContext = input.playerPublicContext;
  if (characterContext === null || publicContext === null) return null;
  const profile = characterContext.embodiedProfile;
  const actorByCanonicalRef = new Map(publicContext.presentActors.map(actor => [canonicalActorRef(actor.actorRef), actor]));
  return {
    schemaVersion: 1,
    contractVersion: INTERPRETER_EMBODIED_PUBLIC_CONTEXT_CONTRACT_V1,
    character: {
      ref: characterContext.character.ref,
      label: characterContext.character.label,
      raceRef: profile?.identity.raceRef ?? null,
      backgroundRef: profile?.identity.backgroundRef ?? null,
      biography: bounded(profile?.selfNarrative.biography ?? null, 800),
      personality: bounded(profile?.selfNarrative.personality ?? null, 800),
      objectives: bounded(profile?.selfNarrative.objectives ?? null, 800),
      flaws: bounded(profile?.selfNarrative.flaws ?? null, 800),
      physicalDescription: bounded(profile?.selfNarrative.physicalDescription ?? null, 800)
    },
    namedReferences: REFERENCE_KIND_ORDER
      .flatMap(kind => characterContext.references.filter(reference => reference.kind === kind).slice(0, 8))
      .slice(0, LIMITS.namedReferences)
      .map(reference => ({
        ref: reference.ref,
        kind: reference.kind,
        label: bounded(reference.label, 120) ?? reference.ref,
        aliases: reference.aliases.slice(0, 8).map(alias => bounded(alias, 80) ?? "").filter(Boolean),
        referenceOnly: true as const
      })),
    referenceAmbiguities: characterContext.ambiguities
      .slice(0, LIMITS.referenceAmbiguities)
      .map(ambiguity => ({
        alias: bounded(ambiguity.alias, 80) ?? "",
        candidateRefs: ambiguity.candidateRefs.slice(0, 8),
        candidateLabels: ambiguity.candidateLabels.slice(0, 8).map(label => bounded(label, 120) ?? "").filter(Boolean)
      })),
    currentScene: {
      sceneId: publicContext.location.sceneId,
      label: bounded(publicContext.location.label, 160) ?? publicContext.location.sceneId,
      presentActors: publicContext.presentActors.slice(0, LIMITS.presentActors).map(actor => ({
        actorRef: actor.actorRef,
        label: bounded(actor.label, 120) ?? actor.actorRef,
        publicRole: bounded(actor.publicRole, 160) ?? "",
        visibleState: bounded(actor.visibleState, 300) ?? ""
      }))
    },
    acquiredKnowledge: publicContext.knownFacts.slice(0, LIMITS.acquiredKnowledge).map(fact => ({
      factRef: fact.factRef,
      statement: bounded(fact.statement, 400) ?? "",
      status: fact.status,
      attributedSpeakerRefs: fact.attributedSpeakerRefs.slice(0, 8)
    })),
    activeInterlocutor: input.activeInterlocutor === null ? null : {
      actorRef: input.activeInterlocutor.target.ref,
      label: bounded(input.activeInterlocutor.target.label, 120),
      sourceOperationId: input.activeInterlocutor.sourceOperationId
    },
    activeInteraction: input.activeInteraction?.status === "ACTIVE"
      ? { ...input.activeInteraction }
      : null,
    recentFocus: input.recentFocus
      .filter(focus => focus.target.ref !== null)
      .slice(0, LIMITS.recentFocus)
      .map(focus => ({
        targetRef: focus.target.ref as string,
        targetKind: focus.target.kind,
        label: bounded(focus.target.label, 120),
        sourceOperationId: focus.sourceOperationId
      })),
    recentIntentions: input.recentSemanticTurns.slice(0, LIMITS.recentIntentions).map(turn => ({
      operationId: turn.operationId,
      meaning: bounded(turn.playerGoal, 300) ?? "",
      commitment: turn.commitment,
      targetRef: turn.primaryTarget?.ref ?? null
    })),
    presentCompanions: [...new Set(input.activeCompanionRefs)]
      .slice(0, LIMITS.presentCompanions)
      .map(ref => {
        const actor = actorByCanonicalRef.get(canonicalActorRef(ref));
        return { actorRef: ref, label: bounded(actor?.label ?? null, 120) };
      }),
    activeProcess: input.runtimeContext.activeTravel === null ? null : {
      kind: "TRAVEL",
      status: input.runtimeContext.activeTravel.status,
      destinationRef: input.runtimeContext.activeTravel.destinationLocationId,
      awaitingPlayerDecision: input.runtimeContext.activeTravel.awaitingPlayerDecision
    },
    runtimeCapabilities: input.runtimeContext.capabilities.slice(0, LIMITS.runtimeCapabilities).map(capability => ({
      capabilityId: capability.capabilityId,
      domain: capability.domain,
      availability: capability.availability,
      playerFacingScope: bounded(capability.playerFacingScope, 300) ?? ""
    })),
    authority: "INTERPRETATION_ONLY_PUBLIC_CONTEXT",
    ownerValidationRequired: true,
    noCommit: true,
    noGameTime: true,
    deliberatelyExcluded: [...DELIBERATELY_EXCLUDED]
  };
}

function canonicalActorRef(value: string): string {
  return `actor:${value.replace(/^(actor:|npc:)/u, "")}`;
}

function bounded(value: string | null | undefined, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/gu, " ");
  return normalized.length === 0 ? null : normalized.slice(0, max);
}
