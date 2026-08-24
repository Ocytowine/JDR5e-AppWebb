import {
  createCatalogMissionRelationRuntimeV1,
  type MissionRelationDialogueDecisionPolicyV1
} from "../../narration-module/src/application";

const policy: MissionRelationDialogueDecisionPolicyV1 = {
  decide({ rawInput, interpretation, actor, scene }) {
    const normalized = normalize(rawInput);
    const sourceRefs = [`playable-scene:${scene.sceneId}`, `actor:${actor.actorId}`];
    const directive = interpretation.semanticIntent.companionDirective ?? null;
    if (directive?.category === "FOLLOW") {
      const eligible = scene.sceneId === "wiki-location:archives_de_lysenthe"
        && actor.actorId === "wiki-location:archives_de_lysenthe:ambient:1";
      return {
        disposition: eligible ? "ACCEPTED" : "REFUSED",
        conditions: [],
        publicSourceRefs: eligible
          ? [...sourceRefs, "playable-content:companion:archives-careful-archivist"]
          : [...sourceRefs, "playable-content:companion:not-recruitable"]
      };
    }
    if (/\b(voler|derober|trahir|mentir|falsifier|contourner|forcer)\b/u.test(normalized)) {
      return { disposition: "REFUSED", conditions: [], publicSourceRefs: sourceRefs };
    }
    if (
      scene.sceneId === "wiki-location:archives_de_lysenthe"
      && /archiviste/u.test(normalize(`${actor.displayName} ${actor.publicRole}`))
      && /\b(fonds|salle|archive|document|registre).{0,40}\b(prive|restreint|interdit|reserve)\b/u.test(normalized)
    ) {
      return {
        disposition: "CONDITIONAL",
        conditions: ["Présenter un mandat de haut rang autorisant cette consultation."],
        publicSourceRefs: [...sourceRefs, "condition:archives-high-rank-mandate"]
      };
    }
    const authoredHooks: string[] = "conversationalHooks" in actor && Array.isArray(actor.conversationalHooks)
      ? (actor.conversationalHooks as unknown[]).filter((value): value is string => typeof value === "string")
      : [];
    const authoredGoal: string[] = "immediateGoal" in actor && typeof actor.immediateGoal === "string"
      ? [String(actor.immediateGoal)]
      : [];
    const matchesAuthoredPurpose = [...authoredHooks, ...authoredGoal]
      .flatMap(text => normalize(text).split(/\s+/u))
      .filter(token => token.length >= 6)
      .some(token => normalized.includes(token));
    return {
      disposition: matchesAuthoredPurpose ? "ACCEPTED" : "UNCERTAIN",
      conditions: [],
      publicSourceRefs: sourceRefs
    };
  }
};

export function createInstalledMissionRelationRuntimeV1() {
  return createCatalogMissionRelationRuntimeV1({ decisionPolicy: policy });
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[’']/gu, " ");
}
