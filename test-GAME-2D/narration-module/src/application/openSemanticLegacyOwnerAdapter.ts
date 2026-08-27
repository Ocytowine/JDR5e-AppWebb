import type { AiStructuredSemanticIntentV1 } from "../ai/types";
import type { JsonObject } from "../core";
import type { NarrativeDomainCommandV1 } from "./domainCommands";
import type { NarrativeIntentInterpretationV1, NarrativeIntentTargetV1 } from "./intentClarification";
import {
  selectOpenSemanticLegacyOwnerStepsV1,
  type OpenSemanticExecutionStepV1,
  type OpenSemanticLegacyOwnerSelectionV1
} from "./openSemanticExecution";

export const OPEN_SEMANTIC_LEGACY_OWNER_ADAPTER_V1 =
  "open-semantic-legacy-owner-adapter/1" as const;

export interface OpenSemanticLegacyOwnerAdapterProjectionV1 {
  schemaVersion: 1;
  contractVersion: typeof OPEN_SEMANTIC_LEGACY_OWNER_ADAPTER_V1;
  componentId: string;
  capabilityId: string;
  semanticInputText: string;
  interpretation: NarrativeIntentInterpretationV1 & JsonObject;
  domainCommand: NarrativeDomainCommandV1;
  rawInputAccess: "FORBIDDEN";
}

/**
 * Pont de migration vers les propriétaires V1 : il ne sélectionne jamais une
 * capacité et ne lit jamais la saisie joueur. Il projette une étape routée par
 * G5, ou la micro-séquence atomique « approche puis communication » vers un
 * même acteur visible, ou plusieurs actes de dialogue vers un acteur unique,
 * dans les champs structurés attendus par les ports V1. Les compositions
 * multi-cibles ou multi-domaines restent suspendues.
 */
export function buildOpenSemanticLegacyOwnerAdapterProjectionV1(
  interpretation: NarrativeIntentInterpretationV1
): OpenSemanticLegacyOwnerAdapterProjectionV1 | null {
  if (interpretation.semanticSource !== "OPEN_SEMANTIC_FRAME_V8") return null;
  const frame = interpretation.openSemanticFrame;
  const plan = interpretation.openSemanticRuntime?.executionPlan;
  if (frame === null || frame === undefined || plan === undefined) return null;
  if (frame.understandingStatus !== "UNDERSTOOD" || frame.confidence === "low") return null;
  const selection = selectOpenSemanticLegacyOwnerStepsV1({ frame, plan });
  if (selection === null) return null;
  const step = selection.steps.at(-1)!;
  if (step.capabilityId === null || step.requiredDomain === null) return null;
  const component = frame.components.find(entry => entry.componentId === step.componentId);
  if (component === undefined) return null;
  const target = targetFromSelection(frame, selection.targetRefs);
  const semanticKind = semanticKindFor(step);
  const isSequence = selection.mode !== "SINGLE_COMPONENT";
  const semanticGoal = isSequence ? frame.overallMeaning : component.meaning;
  const commitmentSource = isSequence ? frame.overallCommitment : component.commitment;
  const commitment = commitmentSource === "mixed" ? "unclear" : commitmentSource;
  const noCommit = step.capabilityId === "scene.visible-perception"
    || step.capabilityId === "scene.context-response";
  const companionDirective = companionDirectiveFor(step.capabilityId, component.meaning);
  const restPlan = restPlanFor(step.capabilityId);
  const dialogueAct = dialogueActForSelection({ frame, selection, targetRef: target?.ref ?? null });
  const semanticIntent: AiStructuredSemanticIntentV1 = {
    schemaVersion: 1,
    kind: semanticKind,
    playerGoal: semanticGoal,
    target,
    commitment,
    preconditions: [
      ...frame.globalConditions,
      ...selection.steps.flatMap(selected => selected.conditions)
    ],
    evidenceFromInput: [],
    uncertainties: frame.ambiguities.map(entry => entry.summary),
    forbiddenInterpretations: [
      "reinterpret_open_semantic_component",
      "read_raw_player_input_in_owner",
      "commit_without_owner_validation"
    ],
    confidence: frame.confidence,
    perception: semanticKind === "observe_environment"
      ? {
          schemaVersion: 1,
          depth: "FOCUSED",
          focus: component.meaning,
          soughtInformation: component.meaning,
          informationKind: "UNCERTAIN_CLUE"
        }
      : null,
    dialogueAct: semanticKind === "address_visible_actor"
      ? companionDirective === null
        ? dialogueAct
        : {
            schemaVersion: 1,
            act: "REQUEST_ACTION",
            contentGoal: component.dialogueAct?.contentGoal ?? component.meaning,
            addresseeRef: target?.ref ?? null
          }
      : null,
    companionDirective,
    restPlan,
    ...(isSequence ? {
      composition: {
        schemaVersion: 1 as const,
        orderedComponents: selection.steps.map(selected => ({
          order: selected.order,
          kind: selected.capabilityId === "scene.visible-actor-approach"
            ? "APPROACH_TARGET" as const
            : selected.capabilityId === "scene.visible-actor-orientation"
              ? "NONVERBAL_SIGNAL" as const
            : selected.capabilityId === "scene.visible-dialogue"
              ? "SPEECH" as const
              : "NONVERBAL_SIGNAL" as const,
          playerGoal: selected.meaning
        }))
      }
    } : {})
  };
  const runtimeHandling = {
    schemaVersion: 1 as const,
    status: "SUPPORTED_BY_CURRENT_RUNTIME" as const,
    reason: "Projection d'adaptation issue d'une capacité G5 exacte; le propriétaire conserve la validation et le commit.",
    requiredDomain: step.requiredDomain,
    canonicalActionHint: step.capabilityId,
    noCommit,
    noGameTime: true
  };
  const projected = {
    ...interpretation,
    semanticSource: "OPEN_SEMANTIC_OWNER_ADAPTER_V1" as const,
    intentType: semanticKind === "address_visible_actor"
      ? "speech"
      : semanticKind === "context_question"
        ? "meta_question"
        : "action",
    commitment,
    target,
    action: semanticKind === "address_visible_actor" ? "ask" : "act",
    semanticIntent,
    runtimeHandling,
    runtimeDecision: {
      schemaVersion: 1,
      source: "LOCAL_CAPABILITY_REGISTRY" as const,
      status: "SUPPORTED_BY_CURRENT_RUNTIME" as const,
      requiredDomain: step.requiredDomain,
      reason: runtimeHandling.reason,
      noCommit,
      noGameTime: true,
      aiSuggestionMatched: true
    },
    referentResolution: {
      schemaVersion: 1,
      usedPreviousContext: false,
      source: target === null ? "none" : "visible_scene",
      resolvedTarget: target,
      evidence: component.mentionedTargets.map(entry => entry.surface),
      ambiguity: "none",
      confidence: frame.confidence
    },
    coreMeaning: semanticGoal,
    expectedTimeEffect: noCommit ? "NO_GAME_TIME" : "DOMAIN_TO_DECIDE",
    safetyNotes: [
      ...interpretation.safetyNotes,
      "Adaptation propriétaire G7 dérivée du couple exact capacité/domaine; aucune lecture de la saisie brute."
    ]
  } as NarrativeIntentInterpretationV1 & JsonObject;
  const domainCommand: NarrativeDomainCommandV1 = {
    schemaVersion: 1,
    contractVersion: "narrative-domain-command/1",
    commandId: `${interpretation.intentId}:open-semantic:${component.componentId}`,
    intentId: interpretation.intentId,
    domain: step.requiredDomain,
    commandType: commandTypeFor(step),
    semanticKind,
    semanticGoal,
    targetRefs: [...selection.targetRefs],
    payload: {
      componentId: component.componentId,
      componentIds: selection.steps.map(selected => selected.componentId),
      capabilityId: step.capabilityId,
      capabilityIds: selection.steps.map(selected => selected.capabilityId),
      executionPolicy: selection.executionPolicy,
      orderedDialogueActs: selection.steps.flatMap(selected => {
        const selectedComponent = frame.components.find(entry => entry.componentId === selected.componentId);
        return selectedComponent?.dialogueAct === null || selectedComponent?.dialogueAct === undefined
          ? []
          : [{
              componentId: selected.componentId,
              order: selected.order,
              act: selectedComponent.dialogueAct.act,
              contentGoal: selectedComponent.dialogueAct.contentGoal,
              informationNeed: selectedComponent.informationNeed === undefined || selectedComponent.informationNeed === null
                ? null
                : structuredClone(selectedComponent.informationNeed),
              conditions: [...selectedComponent.conditions]
            }];
      }),
      commitment,
      conditions: selection.steps.flatMap(selected => {
        const selectedComponent = frame.components.find(entry => entry.componentId === selected.componentId);
        return selectedComponent?.conditions ?? [];
      }),
      ownerPreflightRequired: true
    },
    commitPolicy: noCommit ? "FORBIDDEN" : "DOMAIN_VALIDATED",
    commitAuthority: false,
    noGameTime: true,
    source: "LOCAL_COMMAND_BUILDER"
  };
  return {
    schemaVersion: 1,
    contractVersion: OPEN_SEMANTIC_LEGACY_OWNER_ADAPTER_V1,
    componentId: component.componentId,
    capabilityId: step.capabilityId,
    semanticInputText: semanticGoal,
    interpretation: projected,
    domainCommand,
    rawInputAccess: "FORBIDDEN"
  };
}

function semanticKindFor(step: OpenSemanticExecutionStepV1): AiStructuredSemanticIntentV1["kind"] {
  switch (step.capabilityId) {
    case "scene.visible-actor-approach": return "move_near_visible_actor";
    case "scene.visible-actor-orientation": return "nonverbal_signal";
    case "scene.visible-object-interaction": return "manipulate_visible_object";
    case "scene.visible-nonverbal-signal": return "nonverbal_signal";
    case "scene.visible-dialogue":
    case "companion.autonomous-request":
    case "companion.follow-request":
    case "companion.separate-request":
    case "companion.rejoin-request":
    case "companion.leave-request":
      return "address_visible_actor";
    case "scene.visible-perception": return "observe_environment";
    case "scene.context-response": return "context_question";
    case "world.narrative-travel":
    case "world.scene-transition":
    case "world.dynamic-place":
      return "traverse_visible_boundary";
    default: return "manipulate_visible_object";
  }
}

function targetFrom(mention: { surface: string; proposedRef: string | null } | null): NarrativeIntentTargetV1 | null {
  if (mention === null) return null;
  const ref = mention.proposedRef;
  const kind: NarrativeIntentTargetV1["kind"] = ref === null
    ? "unknown"
    : /^(?:npc|actor):/u.test(ref)
      ? "npc"
      : /^(?:location|place):/u.test(ref)
        ? "place"
        : "object";
  return { kind, ref, label: mention.surface };
}

function targetFromSelection(
  frame: NarrativeIntentInterpretationV1["openSemanticFrame"],
  targetRefs: readonly string[]
): NarrativeIntentTargetV1 | null {
  if (frame === null || frame === undefined || targetRefs.length === 0) return null;
  const targetRef = targetRefs[0]!;
  const mention = frame.components
    .flatMap(component => component.mentionedTargets)
    .find(candidate => candidate.proposedRef === targetRef) ?? null;
  return targetFrom(mention);
}

function dialogueActForSelection(input: {
  frame: NonNullable<NarrativeIntentInterpretationV1["openSemanticFrame"]>;
  selection: OpenSemanticLegacyOwnerSelectionV1;
  targetRef: string | null;
}): NonNullable<AiStructuredSemanticIntentV1["dialogueAct"]> {
  const acts = input.selection.steps.flatMap(step => {
    const dialogueAct = input.frame.components.find(
      component => component.componentId === step.componentId
    )?.dialogueAct;
    return dialogueAct === null || dialogueAct === undefined ? [] : [dialogueAct];
  });
  const distinctActs = [...new Set(acts.map(act => act.act))];
  return {
    schemaVersion: 1,
    act: distinctActs.length === 1 ? distinctActs[0]! : "OTHER",
    contentGoal: input.selection.mode === "SINGLE_COMPONENT"
      ? acts[0]?.contentGoal ?? input.frame.overallMeaning
      : input.frame.overallMeaning,
    addresseeRef: input.targetRef
  };
}

function commandTypeFor(step: OpenSemanticExecutionStepV1): NarrativeDomainCommandV1["commandType"] {
  if (step.capabilityId === "scene.visible-dialogue" || step.capabilityId?.startsWith("companion.")) return "SCENE_SPEECH_REQUEST";
  if (step.capabilityId === "scene.visible-perception" || step.capabilityId === "scene.context-response") return "PERCEPTION_REQUEST";
  return step.requiredDomain === "scene_resolution" ? "SCENE_INTERACTION_REQUEST" : "DOMAIN_HANDOFF_REQUEST";
}

function companionDirectiveFor(
  capabilityId: string,
  meaning: string
): AiStructuredSemanticIntentV1["companionDirective"] {
  if (!capabilityId.startsWith("companion.")) return null;
  const presenceIntent = capabilityId === "companion.separate-request"
    ? "SEPARATE" as const
    : capabilityId === "companion.rejoin-request"
      ? "REJOIN" as const
      : capabilityId === "companion.leave-request"
        ? "LEAVE" as const
        : "UNCHANGED" as const;
  return {
    schemaVersion: 1,
    category: capabilityId === "companion.follow-request" ? "FOLLOW" : "ASSIST",
    requestSummary: meaning,
    presenceIntent
  };
}

function restPlanFor(capabilityId: string): AiStructuredSemanticIntentV1["restPlan"] {
  if (capabilityId === "rest.short") return { schemaVersion: 1, restKind: "SHORT_REST" };
  if (capabilityId === "rest.long") return { schemaVersion: 1, restKind: "LONG_REST" };
  if (capabilityId === "rest.process") return { schemaVersion: 1, restKind: null };
  return null;
}
