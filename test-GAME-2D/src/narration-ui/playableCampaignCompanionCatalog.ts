import {
  createNarrativeCompanionRecruitmentRuntimeV1,
  type CompanionAutonomyPolicyV1,
  type CompanionRecruitmentPolicyV1
} from "../../narration-module/src/application";

const ARCHIVES_SCENE_ID = "wiki-location:archives_de_lysenthe";
const CAREFUL_ARCHIVIST_ACTOR_ID = `${ARCHIVES_SCENE_ID}:ambient:1`;
const CONTENT_REF = "playable-content:companion:archives-careful-archivist";

const autonomyPolicy: CompanionAutonomyPolicyV1 = {
  schemaVersion: 1,
  policyId: "archives-careful-archivist-autonomy",
  policyRevision: 1,
  sourceRefs: [CONTENT_REF, `actor:${CAREFUL_ARCHIVIST_ACTOR_ID}`],
  rules: [
    rule("FOLLOW", "ACCEPTED"),
    rule("SCOUT", "CONDITIONAL", null, ["Il lui faut un objectif précis et une voie de retour sûre."]),
    rule("ASSIST", "ACCEPTED"),
    rule("GUARD", "ADAPTED", "il privilégie une veille discrète et une issue dégagée"),
    rule("SOCIAL", "ACCEPTED"),
    rule("PERSONAL_RISK", "REFUSED")
  ]
};

const recruitmentPolicy: CompanionRecruitmentPolicyV1 = {
  resolve({ actor, scene }) {
    return scene.sceneId === ARCHIVES_SCENE_ID && actor.actorId === CAREFUL_ARCHIVIST_ACTOR_ID
      ? autonomyPolicy
      : null;
  }
};

export function createInstalledCompanionRecruitmentRuntimeV1() {
  return createNarrativeCompanionRecruitmentRuntimeV1({ policy: recruitmentPolicy });
}

function rule(
  category: CompanionAutonomyPolicyV1["rules"][number]["category"],
  disposition: CompanionAutonomyPolicyV1["rules"][number]["disposition"],
  adaptation: string | null = null,
  conditions: string[] = []
): CompanionAutonomyPolicyV1["rules"][number] {
  return {
    schemaVersion: 1,
    category,
    disposition,
    adaptation,
    conditions,
    sourceRefs: [CONTENT_REF, `companion-policy:archives-careful-archivist:${category.toLowerCase()}`]
  };
}
