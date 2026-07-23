import type { JsonObject } from "../core";
import type { AiStructuredSemanticIntentV1 } from "../ai/types";
import type { PlayableScenePerceptionClueV1, PlayableSceneStateV1 } from "./playableScene";
import { buildUnresolvedSkillCheckProposalV1, type SkillCheckProposalV1 } from "./skillCheckProposal";
import { attachMechanicalCharacterContextV1, type RelevantMechanicalCharacterContextV1 } from "./skillCheckProposal";
import { assessPerceptionSearchDifficultyV1 } from "./difficultyAssessment";
import { selectSkillCheckDifficultyBandV1 } from "./skillCheckProposal";

export const PERCEPTION_RESOLUTION_CONTRACT_VERSION_V1 = "perception-resolution/1" as const;

export interface PerceptionResolutionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof PERCEPTION_RESOLUTION_CONTRACT_VERSION_V1;
  status: "AUTOMATIC_RESULT" | "CHECK_REQUIRED" | "NOT_PERCEPTIBLE" | "NEEDS_CLARIFICATION";
  depth: "GLANCE" | "FOCUSED" | "SEARCH";
  targetRef: string | null;
  focus: string;
  revealedClueRefs: string[];
  revealedTexts: string[];
  withheldClueRefs: string[];
  checkProposal: SkillCheckProposalV1 | null;
  sourceRefs: string[];
}

export function resolvePerceptionV1(input: {
  semanticIntent: AiStructuredSemanticIntentV1;
  targetRef: string | null;
  scene: PlayableSceneStateV1;
  mechanicalCharacterContext?: RelevantMechanicalCharacterContextV1 | null;
}): PerceptionResolutionV1 | null {
  if (input.semanticIntent.kind !== "observe_environment") return null;
  const request = input.semanticIntent.perception;
  if (request === null) {
    return result("NEEDS_CLARIFICATION", "GLANCE", input.targetRef, input.semanticIntent.playerGoal, [], [], null);
  }
  const candidates = (input.scene.perceptionClues ?? []).filter(clue => clue.targetRef === input.targetRef);
  const automaticVisibility = request.depth === "GLANCE" ? "IMMEDIATE" : "FOCUSED";
  const revealed = candidates.filter(clue => clue.visibility === automaticVisibility && clue.factKind === "VISIBLE_SIGN");
  const withheld = candidates.filter(clue => !revealed.includes(clue));
  if (request.depth === "SEARCH") {
    const proposal = selectSkillCheckDifficultyBandV1(buildUnresolvedSkillCheckProposalV1({
      checkId: `perception:${input.scene.sceneId}:${input.targetRef ?? "scene"}:skill-check:1`,
      domain: "perception",
      goal: request.soughtInformation ?? request.focus,
      targetRef: input.targetRef,
      ability: "SAG",
      skillId: "perception",
      passiveEligible: false,
      passiveReason: "Une recherche active approfondie ne se résout pas par le score passif dans ce contrat.",
      successStake: "Révéler uniquement les indices vérifiés autorisés par la scène.",
      failureStake: "Ne révéler aucun indice vérifié et laisser le domaine fixer le coût ou une nouvelle tentative.",
      sourceRefs: [`scene:${input.scene.sceneId}`]
    }), assessPerceptionSearchDifficultyV1({ scene: input.scene, targetRef: input.targetRef }));
    return result(
      "CHECK_REQUIRED",
      request.depth,
      input.targetRef,
      request.focus,
      [],
      candidates,
      input.mechanicalCharacterContext === null || input.mechanicalCharacterContext === undefined
        ? proposal
        : attachMechanicalCharacterContextV1(proposal, input.mechanicalCharacterContext)
    );
  }
  if (revealed.length === 0) {
    return result("NOT_PERCEPTIBLE", request.depth, input.targetRef, request.focus, [], withheld, null);
  }
  return result("AUTOMATIC_RESULT", request.depth, input.targetRef, request.focus, revealed, withheld, null);
}

function result(
  status: PerceptionResolutionV1["status"],
  depth: PerceptionResolutionV1["depth"],
  targetRef: string | null,
  focus: string,
  revealed: PlayableScenePerceptionClueV1[],
  withheld: PlayableScenePerceptionClueV1[],
  checkProposal: PerceptionResolutionV1["checkProposal"]
): PerceptionResolutionV1 {
  return {
    schemaVersion: 1,
    contractVersion: PERCEPTION_RESOLUTION_CONTRACT_VERSION_V1,
    status,
    depth,
    targetRef,
    focus,
    revealedClueRefs: revealed.map(clue => clue.clueId),
    revealedTexts: revealed.map(clue => clue.playerText),
    withheldClueRefs: withheld.map(clue => clue.clueId),
    checkProposal,
    sourceRefs: [...new Set(revealed.flatMap(clue => clue.sourceRefs))]
  };
}
