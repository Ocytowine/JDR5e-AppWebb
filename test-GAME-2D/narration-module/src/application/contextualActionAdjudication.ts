import type { JsonObject } from "../core";
import type { AiStructuredSemanticIntentV1 } from "../ai/types";
import type { NarrativeIntentInterpretationV1 } from "./intentClarification";
import type { PlayableSceneStateV1 } from "./playableScene";
import { buildSceneReferentRegistryV1, findSceneReferentByRefV1 } from "./sceneReferentRegistry";
import { buildUnresolvedSkillCheckProposalV1, type SkillCheckProposalV1 } from "./skillCheckProposal";
import { attachMechanicalCharacterContextV1, type RelevantMechanicalCharacterContextV1 } from "./skillCheckProposal";
import { assessPerceptionSearchDifficultyV1 } from "./difficultyAssessment";
import { selectSkillCheckDifficultyBandV1 } from "./skillCheckProposal";

export const CONTEXTUAL_ACTION_ADJUDICATION_CONTRACT_VERSION_V1 = "contextual-action-adjudication/1" as const;

export type ContextualActionDispositionV1 =
  | "AUTOMATIC_SUCCESS"
  | "CHECK_REQUIRED"
  | "IMPOSSIBLE"
  | "NEEDS_CLARIFICATION"
  | "DOMAIN_HANDOFF";

export interface ContextualActionAdjudicationV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof CONTEXTUAL_ACTION_ADJUDICATION_CONTRACT_VERSION_V1;
  disposition: ContextualActionDispositionV1;
  resolutionScope: "ACTION_ALLOWED" | "OBSERVATION_RESULT" | "NONE";
  reason: string;
  targetRef: string | null;
  sourceRefs: string[];
  ruleRefs: string[];
  checkProposal: SkillCheckProposalV1 | null;
  commitAuthority: false;
}

export function adjudicateContextualActionV1(input: {
  interpretation: NarrativeIntentInterpretationV1;
  scene: PlayableSceneStateV1;
  mechanicalCharacterContext?: RelevantMechanicalCharacterContextV1 | null;
}): ContextualActionAdjudicationV1 {
  const semantic = input.interpretation.semanticIntent;
  const target = input.interpretation.referentResolution?.resolvedTarget ?? semantic.target ?? null;
  const targetRef = target?.ref ?? null;
  const sceneSource = `scene:${input.scene.sceneId}`;

  if (
    semantic.kind === "unclear_intent" ||
    semantic.commitment === "unclear" ||
    input.interpretation.referentResolution?.ambiguity === "multiple_candidates" ||
    input.interpretation.referentResolution?.ambiguity === "insufficient_context"
  ) {
    return result("NEEDS_CLARIFICATION", "NONE", "L'intention, la cible ou la méthode reste réellement ambiguë.", targetRef, [sceneSource]);
  }

  if (semantic.commitment === "none" || semantic.commitment === "hypothetical") {
    return result("AUTOMATIC_SUCCESS", "NONE", "La demande n'engage aucune action mécanique.", targetRef, [sceneSource]);
  }

  if (
    semantic.kind === "observe_environment" &&
    semantic.perception?.depth === "SEARCH" &&
    semantic.perception.informationKind !== "PRESENCE" &&
    semantic.perception.informationKind !== "VISIBLE_TRAIT"
  ) {
    const proposal = selectSkillCheckDifficultyBandV1(buildUnresolvedSkillCheckProposalV1({
      checkId: `${input.interpretation.intentId}:skill-check:1`,
      domain: "perception",
      goal: semantic.perception.soughtInformation ?? semantic.perception.focus,
      targetRef,
      ability: "SAG",
      skillId: "perception",
      passiveEligible: false,
      passiveReason: "Une recherche active approfondie investit du temps et ne se résout pas par la perception passive dans ce contrat.",
      successStake: "Révéler uniquement les indices vérifiés que la scène autorise pour cette recherche.",
      failureStake: "Ne révéler aucun indice vérifié; le domaine doit encore fixer le coût temporel et la politique de nouvelle tentative.",
      sourceRefs: [sceneSource]
    }), assessPerceptionSearchDifficultyV1({ scene: input.scene, targetRef }));
    return result(
      "CHECK_REQUIRED",
      "OBSERVATION_RESULT",
      "La recherche approfondie introduit une incertitude significative; une proposition de test doit être validée par le domaine.",
      targetRef,
      [sceneSource],
      [],
      input.mechanicalCharacterContext === null || input.mechanicalCharacterContext === undefined
        ? proposal
        : attachMechanicalCharacterContextV1(proposal, input.mechanicalCharacterContext)
    );
  }

  if (requiresVisibleSceneTarget(semantic) && targetRef !== null) {
    const visible = findSceneReferentByRefV1(buildSceneReferentRegistryV1(input.scene), targetRef);
    if (visible === null) {
      return result(
        "IMPOSSIBLE",
        "NONE",
        "Le référent demandé n'est pas présent dans la projection visible de la scène.",
        targetRef,
        [sceneSource],
        ["house.action.impossible-before-roll@1"]
      );
    }
  }

  if (requiresVisibleSceneTarget(semantic) && targetRef === null) {
    return result("NEEDS_CLARIFICATION", "NONE", "L'action exige une cible visible qui n'a pas été résolue.", null, [sceneSource]);
  }

  if (semantic.kind === "traverse_visible_boundary" && target?.kind === "place" && (target.label?.trim() ?? "") !== "") {
    return result(
      "AUTOMATIC_SUCCESS",
      "ACTION_ALLOWED",
      "La destination locale est suffisamment décrite; sa faisabilité et sa création éventuelle appartiennent au domaine monde.",
      targetRef,
      [sceneSource]
    );
  }

  if (semantic.kind === "observe_environment") {
    return result(
      "AUTOMATIC_SUCCESS",
      "OBSERVATION_RESULT",
      "L'observation immédiate ou focalisée peut être résolue depuis les signes perceptibles autorisés.",
      targetRef,
      [sceneSource]
    );
  }

  if (["address_visible_actor", "move_near_visible_actor", "manipulate_visible_object", "nonverbal_signal"].includes(semantic.kind)) {
    return result(
      "AUTOMATIC_SUCCESS",
      "ACTION_ALLOWED",
      "La tentative locale est faisable sur un référent visible; cette décision n'affirme pas la réussite d'une conséquence ultérieure.",
      targetRef,
      [sceneSource]
    );
  }

  return result(
    "DOMAIN_HANDOFF",
    "NONE",
    "L'intention est comprise mais aucune résolution contextuelle locale ne possède encore son domaine.",
    targetRef,
    [sceneSource]
  );
}

function requiresVisibleSceneTarget(semantic: AiStructuredSemanticIntentV1): boolean {
  return ["address_visible_actor", "move_near_visible_actor", "manipulate_visible_object", "nonverbal_signal"].includes(semantic.kind);
}

function result(
  disposition: ContextualActionDispositionV1,
  resolutionScope: ContextualActionAdjudicationV1["resolutionScope"],
  reason: string,
  targetRef: string | null,
  sourceRefs: string[],
  ruleRefs: string[] = [],
  checkProposal: ContextualActionAdjudicationV1["checkProposal"] = null
): ContextualActionAdjudicationV1 {
  return {
    schemaVersion: 1,
    contractVersion: CONTEXTUAL_ACTION_ADJUDICATION_CONTRACT_VERSION_V1,
    disposition,
    resolutionScope,
    reason,
    targetRef,
    sourceRefs,
    ruleRefs,
    checkProposal,
    commitAuthority: false
  };
}
