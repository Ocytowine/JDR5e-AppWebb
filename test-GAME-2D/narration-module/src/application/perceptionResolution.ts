import type { JsonObject } from "../core";
import type { AiStructuredSemanticIntentV1 } from "../ai/types";
import type { PlayableScenePerceptionClueV1, PlayableSceneStateV1 } from "./playableScene";
import { buildUnresolvedSkillCheckProposalV1, type SkillCheckProposalV1 } from "./skillCheckProposal";
import { attachMechanicalCharacterContextV1, type RelevantMechanicalCharacterContextV1 } from "./skillCheckProposal";
import { assessPerceptionSearchDifficultyV1 } from "./difficultyAssessment";
import { selectSkillCheckDifficultyBandV1 } from "./skillCheckProposal";
import {
  narrativeDesignationOfV1,
  narrativeFirstMentionV1,
  narrativeSubsequentMentionV1
} from "./narrativeDesignation";
import { buildSceneReferentRegistryV1, findSceneReferentByRefV1 } from "./sceneReferentRegistry";

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
  const effectiveDepth = request.informationKind === "PRESENCE" ? "GLANCE" : request.depth;
  const visiblePresence = request.informationKind === "PRESENCE" && input.targetRef !== null
    ? buildVisiblePresenceClue(input.scene, input.targetRef)
    : null;
  const candidates = [
    ...(visiblePresence === null ? [] : [visiblePresence]),
    ...(input.scene.perceptionClues ?? []).filter(clue => clue.targetRef === input.targetRef),
    ...(input.targetRef === null ? buildSceneWideVisibleClues(input.scene) : [])
  ];
  const automaticVisibility = effectiveDepth === "GLANCE" ? "IMMEDIATE" : "FOCUSED";
  const revealed = candidates.filter(clue => clue.visibility === automaticVisibility && clue.factKind === "VISIBLE_SIGN");
  const withheld = candidates.filter(clue => !revealed.includes(clue));
  if (
    request.depth === "SEARCH" &&
    request.informationKind !== "PRESENCE" &&
    request.informationKind !== "VISIBLE_TRAIT"
  ) {
    const proposal = selectSkillCheckDifficultyBandV1(buildUnresolvedSkillCheckProposalV1({
      checkId: buildPerceptionCheckIdV1(
        input.scene.sceneId,
        input.targetRef ?? "scene"
      ),
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
      effectiveDepth,
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
    return result("NOT_PERCEPTIBLE", effectiveDepth, input.targetRef, request.focus, [], withheld, null);
  }
  return result("AUTOMATIC_RESULT", effectiveDepth, input.targetRef, request.focus, revealed, withheld, null);
}

export function buildPerceptionCheckIdV1(
  sceneId: string,
  targetRef: string
): string {
  const identity = `${sceneId}\u0000${targetRef}`;
  return [
    "perception-check",
    idPart(sceneId).slice(0, 24),
    idPart(targetRef).slice(-24),
    fnv1a32(identity)
  ].join(":");
}

function idPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/gu, "-").replace(/^-+|-+$/gu, "") || "scene";
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function buildVisiblePresenceClue(scene: PlayableSceneStateV1, targetRef: string): PlayableScenePerceptionClueV1 | null {
  const referent = findSceneReferentByRefV1(buildSceneReferentRegistryV1(scene), targetRef);
  if (referent === null) return null;
  const actor = [...scene.presentNpc, ...scene.ambientPopulation]
    .find(candidate => `npc:${candidate.actorId}` === referent.canonicalRef);
  const mention = actor === undefined
    ? referent.displayName
    : narrativeSubsequentMentionV1(narrativeDesignationOfV1(actor), actor.displayName);
  return {
    schemaVersion: 1,
    clueId: `visible-presence:${referent.canonicalRef}`,
    targetRef: referent.canonicalRef,
    visibility: "IMMEDIATE",
    factKind: "VISIBLE_SIGN",
    playerText: `Tu repères aussitôt ${mention}, déjà visible ici.`,
    sourceRefs: [`scene:${scene.sceneId}`, referent.sourceRef],
    version: 1
  };
}

function buildSceneWideVisibleClues(scene: PlayableSceneStateV1): PlayableScenePerceptionClueV1[] {
  const visibleActors: Array<{ text: string; sourceRef: string }> = [
    ...scene.presentNpc.map(actor => ({
      text: `${narrativeFirstMentionV1(narrativeDesignationOfV1(actor), actor.narrativeLabel || actor.displayName)}, ${stripFinalPunctuation(actor.visibleState)}`,
      sourceRef: `npc:${actor.actorId}`
    })),
    ...scene.ambientPopulation.map(actor => ({
      text: `${narrativeFirstMentionV1(narrativeDesignationOfV1(actor), actor.displayName)} ${stripFinalPunctuation(actor.visibleActivity)}; ${stripFinalPunctuation(actor.visibleAppearance)}`,
      sourceRef: `ambient-presence:${actor.actorId}`
    }))
  ];
  if (visibleActors.length === 0) {
    return [{
      schemaVersion: 1,
      clueId: "scene-visible:scene-situation",
      targetRef: `scene:${scene.sceneId}`,
      visibility: "IMMEDIATE",
      factKind: "VISIBLE_SIGN",
      playerText: scene.perceptibleSituation.join(" "),
      sourceRefs: [`scene:${scene.sceneId}`],
      version: 1
    }];
  }
  const transitions = ["À proximité, tu distingues", "Non loin,", "Plus en retrait,", "Dans le même espace,"];
  const playerText = visibleActors
    .map((actor, index) => `${transitions[Math.min(index, transitions.length - 1)]} ${actor.text}.`)
    .join(" ");
  return [{
    schemaVersion: 1,
    clueId: "scene-visible:population",
    targetRef: `scene:${scene.sceneId}`,
    visibility: "IMMEDIATE",
    factKind: "VISIBLE_SIGN",
    playerText,
    sourceRefs: [`scene:${scene.sceneId}`, ...visibleActors.map(actor => actor.sourceRef)],
    version: 1
  }];
}

function stripFinalPunctuation(value: string): string {
  return value.trim().replace(/[.!?;:,]+$/u, "");
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
