import type { LoreEntityV1, LoreFragmentV1, LoreKnowledgeLevelV1 } from "../bootstrap/lore";
import {
  PLAYABLE_SCENE_CONTRACT_VERSION_V1,
  validatePlayableSceneV1,
  type PlayableSceneNpcV1,
  type PlayableScenePointOfInterestV1,
  type PlayableSceneStateV1,
  type PlayableSceneVisibleElementV1
} from "./playableScene";

export const LORE_PLAYABLE_SCENE_ADAPTER_VERSION_V1 = "lore-playable-scene-adapter/1" as const;

export interface LorePlayableSceneBuildResultV1 {
  schemaVersion: 1;
  adapterVersion: typeof LORE_PLAYABLE_SCENE_ADAPTER_VERSION_V1;
  scene: PlayableSceneStateV1;
  includedFragmentIds: string[];
  withheldFragmentIds: string[];
  withheldKnowledgeLevels: LoreKnowledgeLevelV1[];
  sourceEntityId: string;
  version: 1;
}

const PLAYER_VISIBLE_LEVELS = new Set<LoreKnowledgeLevelV1>(["COMMUN", "LOCAL"]);

export function buildPlayableSceneFromLoreLocationV1(input: {
  entity: LoreEntityV1;
  fragments: LoreFragmentV1[];
  sceneId?: string;
}): LorePlayableSceneBuildResultV1 {
  if (!["batiment", "quartier", "ville"].includes(input.entity.entityType)) {
    throw new Error(`Unsupported lore location type for playable scene: ${input.entity.entityType}`);
  }

  const relevantFragments = input.fragments.filter(fragment => fragment.entityId === input.entity.entityId);
  const visibleFragments = relevantFragments.filter(fragment => PLAYER_VISIBLE_LEVELS.has(fragment.knowledgeLevel));
  const withheldFragments = relevantFragments.filter(fragment => !PLAYER_VISIBLE_LEVELS.has(fragment.knowledgeLevel));
  const sceneId = input.sceneId ?? `wiki-location:${input.entity.entityId}`;
  const attributes = input.entity.attributes as Record<string, unknown>;
  const summary = input.entity.body.trim().length > 0 ? input.entity.body.trim() : input.entity.displayName;
  const visibleTexts = visibleFragments.map(fragment => fragment.text.trim()).filter(Boolean);
  const perceptibleSituation = uniqueNonEmpty([
    input.entity.displayName,
    input.entity.body.trim(),
    ...visibleTexts
  ]).slice(0, 4);
  const scene: PlayableSceneStateV1 = {
    schemaVersion: 1,
    contractVersion: PLAYABLE_SCENE_CONTRACT_VERSION_V1,
    sceneId,
    locationName: input.entity.displayName,
    perceptibleSituation: perceptibleSituation.length > 0 ? perceptibleSituation : [summary],
    visibleElements: buildVisibleElements(input.entity, visibleFragments),
    presentNpc: buildNpcFromPresence(input.entity),
    pointsOfInterest: buildPointsOfInterest(input.entity),
    perceptionClues: [],
    currentTension: buildTension(input.entity),
    playerKnownFacts: uniqueNonEmpty([
      `Le personnage peut identifier le lieu: ${input.entity.displayName}.`,
      typeof attributes.acces === "string" ? `Accès visible ou annoncé: ${attributes.acces}.` : "",
      "Seuls les faits publics ou locaux du wiki sont exposés à la scène."
    ]),
    localMemoryPolicy: {
      schemaVersion: 1,
      maxShortTermNpcMemory: 5,
      version: 1
    },
    aiSceneWriterPolicy: {
      schemaVersion: 1,
      mayCreate: [],
      mayReference: visibleFragments.map(fragment => `lore-fragment:${fragment.fragmentId}`),
      mustNotCreate: ["PNJ durable", "lieu durable", "objet utile", "indice secret", "issue de combat"],
      noveltyConstraints: ["faits wiki visibles uniquement", "aucune révélation de fragment restreint ou secret"],
      version: 1
    },
    version: 1
  };
  const validation = validatePlayableSceneV1(scene);
  if (!validation.ok) throw new Error(`Invalid playable scene derived from lore: ${validation.issues.join("; ")}`);
  return {
    schemaVersion: 1,
    adapterVersion: LORE_PLAYABLE_SCENE_ADAPTER_VERSION_V1,
    scene,
    includedFragmentIds: visibleFragments.map(fragment => fragment.fragmentId).sort(),
    withheldFragmentIds: withheldFragments.map(fragment => fragment.fragmentId).sort(),
    withheldKnowledgeLevels: uniqueKnowledgeLevels(withheldFragments.map(fragment => fragment.knowledgeLevel)),
    sourceEntityId: input.entity.entityId,
    version: 1
  };
}

function buildVisibleElements(entity: LoreEntityV1, fragments: LoreFragmentV1[]): PlayableSceneVisibleElementV1[] {
  const values = fragments.slice(0, 3).map((fragment, index) => ({
    schemaVersion: 1 as const,
    elementId: `${entity.entityId}:visible:${index + 1}`,
    label: fragment.topics[0] ?? fragment.fieldPath.replace(/^\//u, ""),
    description: fragment.text,
    keywords: uniqueNonEmpty([...fragment.tags, ...fragment.topics, entity.displayName]),
    playerVisible: true as const,
    version: 1 as const
  }));
  if (values.length > 0) return values;
  return [{
    schemaVersion: 1,
    elementId: `${entity.entityId}:visible:summary`,
    label: entity.displayName,
    description: entity.body || entity.displayName,
    keywords: [...entity.searchTerms],
    playerVisible: true,
    version: 1
  }];
}

function buildNpcFromPresence(entity: LoreEntityV1): PlayableSceneNpcV1[] {
  const profile = entity.attributes.profil_presence as { roles_probables?: Array<{ role?: unknown }> } | undefined;
  const role = profile?.roles_probables?.map(entry => entry.role).find((value): value is string =>
    typeof value === "string" && value !== "pnj_lambda"
  ) ?? "responsable local";
  const displayRole = titleCase(role.replaceAll("_", " "));
  return [{
    schemaVersion: 1,
    actorId: `npc-${entity.entityId}-${slug(role)}`,
    displayName: `${displayRole} de ${entity.displayName}`,
    narrativeLabel: `le ${displayRole.toLowerCase()} de ${entity.displayName}`,
    publicRole: displayRole,
    visibleState: `présent à ${entity.displayName}, occupé par la fonction publique du lieu`,
    keywords: uniqueNonEmpty([role, displayRole, entity.displayName]),
    defaultReply: `« ${entity.displayName} suit ses procédures. Si vous avez une demande, formulez-la clairement. »`,
    repeatedReply: `« Je vous ai entendu. Pour ${entity.displayName}, seules les demandes claires et autorisées avancent. »`,
    version: 1
  }];
}

function buildPointsOfInterest(entity: LoreEntityV1): PlayableScenePointOfInterestV1[] {
  const attributes = entity.attributes as { lieux_connectes?: unknown; fonction_principale?: unknown };
  const connected = Array.isArray(attributes.lieux_connectes)
    ? attributes.lieux_connectes.filter((value): value is string => typeof value === "string")
    : [];
  const functions = Array.isArray(attributes.fonction_principale)
    ? attributes.fonction_principale.filter((value): value is string => typeof value === "string")
    : [];
  const values = [...connected.slice(0, 2), ...functions.slice(0, 1)];
  if (values.length === 0) return [{
    schemaVersion: 1,
    pointId: `${entity.entityId}:main`,
    label: entity.displayName,
    visibleDescription: entity.body || `Point principal de ${entity.displayName}.`,
    keywords: [...entity.searchTerms],
    destinationAliases: [],
    version: 1
  }];
  return values.map((value, index) => ({
    schemaVersion: 1,
    pointId: `${entity.entityId}:poi:${index + 1}`,
    label: titleCase(value.replace(/^external:/u, "").replaceAll("_", " ")),
    visibleDescription: value.startsWith("external:")
      ? `Connexion externe visible ou connue: ${value.slice("external:".length).replaceAll("_", " ")}.`
      : `Élément associé au lieu: ${value.replaceAll("_", " ")}.`,
    keywords: uniqueNonEmpty([value, ...value.split(/[_\s-]+/u)]),
    destinationAliases: value.startsWith("external:")
      ? [value.slice("external:".length).replaceAll("_", " ")]
      : [],
    version: 1
  }));
}

function buildTension(entity: LoreEntityV1): string {
  const attributes = entity.attributes as { acces?: unknown; niveau_securite?: unknown; type_batiment?: unknown };
  const access = typeof attributes.acces === "string" ? attributes.acces : "inconnu";
  const security = typeof attributes.niveau_securite === "number" ? attributes.niveau_securite : null;
  if (security !== null && security >= 75) {
    return `${entity.displayName} est un lieu ${access} où la sécurité visible impose de mesurer ses demandes.`;
  }
  return `${entity.displayName} est accessible selon ses usages locaux, sans conflit engagé.`;
}

function uniqueKnowledgeLevels(values: LoreKnowledgeLevelV1[]): LoreKnowledgeLevelV1[] {
  return [...new Set(values)].sort();
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function titleCase(value: string): string {
  return value.replace(/\b\p{L}/gu, match => match.toLocaleUpperCase("fr-FR"));
}

function slug(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
}
