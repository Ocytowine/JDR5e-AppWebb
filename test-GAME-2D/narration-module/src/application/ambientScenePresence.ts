import type { PlayableSceneStateV1 } from "./playableScene";
import {
  buildNarrativeDesignationV1,
  narrativeDesignationOfV1,
  narrativeFirstMentionV1
} from "./narrativeDesignation";

export function buildAmbientScenePresenceV1(input: {
  sceneId: string;
  role: string;
  index: number;
  currentPressure: string;
  contextLabel: string;
  localNorms?: string[];
  knowledgeRefs: string[];
}): PlayableSceneStateV1["ambientPopulation"][number] {
  const normalizedRole = input.role.trim();
  const roleLabel = ambientRoleLabel(normalizedRole);
  const singularLabel = singularizeFirstWord(roleLabel);
  const profiles = [
    { distinctiveTrait: "aux gestes soigneux", visibleActivity: "classe méthodiquement ce qui passe entre ses mains", demeanor: "méthodique et réservé", speechStyle: "phrases précises, peu d'emphase", visibleAppearance: "tenue de travail sobre, gestes soigneux et doigts marqués par son activité" },
    { distinctiveTrait: "au pas pressé", visibleActivity: "circule d'un poste à l'autre sans s'attarder", demeanor: "attentif mais pressé", speechStyle: "réponses brèves, regard souvent ramené à son travail", visibleAppearance: "vêtement pratique ajusté pour le mouvement, pli net et accessoire de travail visible" },
    { distinctiveTrait: "au regard attentif", visibleActivity: "reste légèrement en retrait et surveille les mouvements alentour", demeanor: "calme et observateur", speechStyle: "ton mesuré, silences avant les réponses", visibleAppearance: "silhouette posée, tenue entretenue et regard qui s'attarde sur les détails" },
    { distinctiveTrait: "à la posture prudente", visibleActivity: "poursuit sa tâche tout en gardant un œil sur ce qui l'entoure", demeanor: "sociable avec prudence", speechStyle: "formules courtoises, détails donnés seulement si utiles", visibleAppearance: "tenue locale soignée, posture ouverte mais effets personnels gardés près du corps" }
  ] as const;
  const profile = profiles[input.index % profiles.length]!;
  const subjectRef = `npc:${input.sceneId}:ambient:${input.index + 1}`;
  const roleWithArticle = `${startsWithVowel(singularLabel) ? "l'" : "le "}${singularLabel}`;
  const displayName = `${sentenceCase(singularLabel)} ${profile.distinctiveTrait}`;
  const designation = buildNarrativeDesignationV1({
    subjectRef,
    subjectKind: "ACTOR",
    knowledgeStatus: "DESIGNATION",
    publicRole: roleLabel,
    playerFacingLabel: displayName,
    firstMention: `une silhouette ${startsWithVowel(singularLabel) ? "d'" : "de "}${singularLabel} ${profile.distinctiveTrait}`,
    subsequentMention: `${roleWithArticle} ${profile.distinctiveTrait}`,
    sourceRefs: [`scene:${input.sceneId}:visible-presence`, ...input.knowledgeRefs]
  });
  return {
    schemaVersion: 1,
    actorId: `${input.sceneId}:ambient:${input.index + 1}`,
    displayName,
    designation,
    publicRole: roleLabel,
    visibleActivity: normalizedRole === roleLabel ? profile.visibleActivity : normalizedRole,
    visibleAppearance: profile.visibleAppearance,
    demeanor: profile.demeanor,
    immediateGoal: `mener à bien son activité de ${singularLabel} sans perdre le fil`,
    currentPressure: input.currentPressure,
    speechStyle: [profile.speechStyle],
    conversationalHooks: unique([input.contextLabel, roleLabel, ...(input.localNorms ?? []).slice(0, 1)]),
    boundaries: ["reste dans les limites de son rôle public", "ne transforme pas une conversation en engagement durable"],
    knowledgeRefs: [...input.knowledgeRefs],
    keywords: unique([normalizedRole, roleLabel, singularLabel, displayName, designation.subsequentMention]),
    version: 1
  };
}

export function buildVisiblePopulationNarrationV1(scene: PlayableSceneStateV1): string {
  const foreground = scene.presentNpc.map(npc =>
    `${narrativeFirstMentionV1(narrativeDesignationOfV1(npc), npc.narrativeLabel || npc.displayName)}, ${npc.visibleState}`
  );
  const ambient = scene.ambientPopulation ?? [];
  const parts: string[] = [];
  if (foreground.length > 0) parts.push(`Quelques figures se détachent : ${foreground.join(" ; ")}.`);
  if (ambient.length > 0) {
    const activities = ambient.slice(0, 3).map(presence =>
      `${narrativeFirstMentionV1(narrativeDesignationOfV1(presence), presence.displayName)} ${presence.visibleActivity}`
    );
    const continuation = " D'autres silhouettes entretiennent le mouvement du lieu.";
    parts.push(`Le lieu est habité : ${joinFrenchList(activities)}.${continuation}`);
  }
  return parts.join(" ") || "Aucune présence particulière ne se détache pour le moment.";
}

function ambientRoleLabel(value: string): string {
  return value
    .replace(/[.,;:!?]+$/gu, "")
    .split(/\s+(?:en déplacement|attendant|transportant|venus?|venues?|cherchant|traversant|chargés?|chargées?|occupés?|occupées?|porteurs?|porteuses?|soumis|soumises)\b/iu, 1)[0]!
    .trim();
}

function singularizeFirstWord(value: string): string {
  return value.replace(/^([\p{L}-]+)s\b/iu, "$1");
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))].sort();
}

function joinFrenchList(values: string[]): string {
  if (values.length < 2) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} et ${values.at(-1)}`;
}

function startsWithVowel(value: string): boolean {
  return /^[aeiouyàâäéèêëîïôöùûü]/iu.test(value);
}

function sentenceCase(value: string): string {
  return value.charAt(0).toLocaleUpperCase("fr-FR") + value.slice(1);
}
