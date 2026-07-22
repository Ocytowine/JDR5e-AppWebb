import type {
  LoreEntityTypeV1,
  LoreEntityV1,
  LoreFragmentV1,
  LoreKnowledgeLevelV1
} from "../bootstrap/lore";

export const LORE_INFLUENCE_PACKET_CONTRACT_V1 = "lore-influence-packet/1" as const;

export type LoreInfluenceDegreeV1 = "STRICT_CANON" | "LOCAL_GUIDANCE" | "REGIONAL_GUIDANCE";

export type LoreInfluenceDimensionV1 =
  | "IDENTITY"
  | "DESCRIPTION"
  | "ENVIRONMENT"
  | "POPULATION"
  | "LANGUAGE"
  | "CULTURE"
  | "SOCIAL"
  | "AUTHORITY";

export interface LoreInfluenceRefV1 {
  schemaVersion: 1;
  sourceRef: string;
  entityId: string;
  entityType: LoreEntityTypeV1;
  fragmentId: string;
  fieldPath: string;
  knowledgeLevel: LoreKnowledgeLevelV1;
  degree: LoreInfluenceDegreeV1;
  dimension: LoreInfluenceDimensionV1;
  reason: string;
  text: string;
  version: 1;
}

export interface LoreInfluencePacketV1 {
  schemaVersion: 1;
  contractVersion: typeof LORE_INFLUENCE_PACKET_CONTRACT_V1;
  creationType: "SCENE" | "NPC" | "PLACE" | "LOCAL_EVENT";
  anchorEntityId: string;
  geographicChain: string[];
  relatedEntityIds: string[];
  influences: LoreInfluenceRefV1[];
  unresolvedDimensions: LoreInfluenceDimensionV1[];
  sourceRefs: string[];
  diagnostics: string[];
  version: 1;
}

export interface SelectLoreInfluencesInputV1 {
  creationType: LoreInfluencePacketV1["creationType"];
  anchorEntityId: string;
  entities: LoreEntityV1[];
  fragments: LoreFragmentV1[];
  allowedKnowledgeLevels: readonly LoreKnowledgeLevelV1[];
  maximumInfluences: number;
}

export type LoreInfluenceSelectionResultV1 =
  | { ok: true; packet: LoreInfluencePacketV1 }
  | { ok: false; code: "LORE_ANCHOR_NOT_FOUND" | "LORE_SELECTION_INVALID"; issues: string[] };

const ALL_DIMENSIONS: LoreInfluenceDimensionV1[] = [
  "IDENTITY",
  "DESCRIPTION",
  "ENVIRONMENT",
  "POPULATION",
  "LANGUAGE",
  "CULTURE",
  "SOCIAL",
  "AUTHORITY"
];

const PARENT_RELATION_BY_TYPE: Partial<Record<LoreEntityTypeV1, string>> = {
  batiment: "quartier",
  quartier: "ville",
  ville: "region",
  region: "territoire"
};

const DIRECT_FACTION_RELATIONS = new Set([
  "proprietaire_faction",
  "faction_residente",
  "faction_presente",
  "faction_active"
]);

export function selectLoreInfluencesV1(input: SelectLoreInfluencesInputV1): LoreInfluenceSelectionResultV1 {
  if (!Number.isInteger(input.maximumInfluences) || input.maximumInfluences < 1) {
    return { ok: false, code: "LORE_SELECTION_INVALID", issues: ["maximumInfluences must be a positive integer."] };
  }
  const entityById = new Map(input.entities.map(entity => [entity.entityId, entity]));
  if (entityById.size !== input.entities.length) {
    return { ok: false, code: "LORE_SELECTION_INVALID", issues: ["entities must have unique ids."] };
  }
  const anchor = entityById.get(input.anchorEntityId);
  if (!anchor) return { ok: false, code: "LORE_ANCHOR_NOT_FOUND", issues: [`Unknown lore anchor: ${input.anchorEntityId}.`] };

  const geographicChain = buildGeographicChain(anchor, entityById);
  const candidates = new Map<string, { degree: LoreInfluenceDegreeV1; reason: string; priority: number }>();
  geographicChain.forEach((entityId, distance) => candidates.set(entityId, {
    degree: distance === 0 ? "STRICT_CANON" : distance <= 2 ? "LOCAL_GUIDANCE" : "REGIONAL_GUIDANCE",
    reason: distance === 0 ? "ancre canonique demandée" : `héritage géographique de niveau ${distance}`,
    priority: distance
  }));

  for (const entityId of geographicChain) {
    const entity = entityById.get(entityId);
    if (!entity) continue;
    for (const relation of entity.relations) {
      if (!DIRECT_FACTION_RELATIONS.has(relation.relation)) continue;
      addCandidate(candidates, relation.targetId, "LOCAL_GUIDANCE", `faction liée par ${relation.relation}`, 10);
    }
    for (const speciesId of presenceSpecies(entity)) {
      addCandidate(candidates, speciesId, "LOCAL_GUIDANCE", `espèce pondérée par ${entity.entityId}`, 20);
    }
  }

  const selectedSpecies = new Set([...candidates.keys()].filter(id => entityById.get(id)?.entityType === "espece"));
  for (const culture of input.entities.filter(entity => entity.entityType === "culture")) {
    const associatedSpecies = culture.relations.some(relation =>
      relation.relation === "espece_associee" && selectedSpecies.has(relation.targetId)
    );
    const associatedZone = culture.relations.some(relation =>
      relation.relation === "zone_associee" && geographicChain.includes(relation.targetId)
    );
    if (associatedSpecies && associatedZone) {
      addCandidate(candidates, culture.entityId, "REGIONAL_GUIDANCE", "culture reliée aux espèces et à la chaîne géographique", 30);
    }
  }

  const allowedLevels = new Set(input.allowedKnowledgeLevels);
  const orderedCandidates = [...candidates.entries()]
    .filter(([entityId]) => entityById.has(entityId))
    .sort((left, right) => left[1].priority - right[1].priority || left[0].localeCompare(right[0], "fr"));
  const influences: LoreInfluenceRefV1[] = [];
  for (const [entityId, candidate] of orderedCandidates) {
    const entity = entityById.get(entityId)!;
    const entityFragments = input.fragments
      .filter(fragment => fragment.entityId === entityId && allowedLevels.has(fragment.knowledgeLevel))
      .sort((left, right) => left.fieldPath.localeCompare(right.fieldPath, "fr"));
    for (const fragment of entityFragments) {
      if (influences.length >= input.maximumInfluences) break;
      influences.push({
        schemaVersion: 1,
        sourceRef: `lore-fragment:${fragment.fragmentId}`,
        entityId,
        entityType: entity.entityType,
        fragmentId: fragment.fragmentId,
        fieldPath: fragment.fieldPath,
        knowledgeLevel: fragment.knowledgeLevel,
        degree: candidate.degree,
        dimension: influenceDimension(entity.entityType, fragment.fieldPath),
        reason: candidate.reason,
        text: fragment.text,
        version: 1
      });
    }
    if (influences.length >= input.maximumInfluences) break;
  }

  const represented = new Set(influences.map(influence => influence.dimension));
  const diagnostics: string[] = [];
  if (influences.length >= input.maximumInfluences) diagnostics.push("influence budget reached");
  for (const entityId of candidates.keys()) {
    if (!entityById.has(entityId) && !entityId.startsWith("external:")) diagnostics.push(`unresolved related entity: ${entityId}`);
  }
  return {
    ok: true,
    packet: {
      schemaVersion: 1,
      contractVersion: LORE_INFLUENCE_PACKET_CONTRACT_V1,
      creationType: input.creationType,
      anchorEntityId: input.anchorEntityId,
      geographicChain,
      relatedEntityIds: orderedCandidates.map(([entityId]) => entityId).filter(entityId => !geographicChain.includes(entityId)),
      influences,
      unresolvedDimensions: ALL_DIMENSIONS.filter(dimension => !represented.has(dimension)),
      sourceRefs: influences.map(influence => influence.sourceRef),
      diagnostics: [...new Set(diagnostics)].sort(),
      version: 1
    }
  };
}

function buildGeographicChain(anchor: LoreEntityV1, entityById: Map<string, LoreEntityV1>): string[] {
  const chain: string[] = [];
  const visited = new Set<string>();
  let current: LoreEntityV1 | undefined = anchor;
  while (current && !visited.has(current.entityId)) {
    chain.push(current.entityId);
    visited.add(current.entityId);
    const relationName: string | undefined = PARENT_RELATION_BY_TYPE[current.entityType];
    if (!relationName) break;
    const parentId: string | undefined = current.relations.find(relation => relation.relation === relationName)?.targetId;
    current = parentId ? entityById.get(parentId) : undefined;
  }
  return chain;
}

function addCandidate(
  candidates: Map<string, { degree: LoreInfluenceDegreeV1; reason: string; priority: number }>,
  entityId: string,
  degree: LoreInfluenceDegreeV1,
  reason: string,
  priority: number
): void {
  const existing = candidates.get(entityId);
  if (!existing || priority < existing.priority) candidates.set(entityId, { degree, reason, priority });
}

function presenceSpecies(entity: LoreEntityV1): string[] {
  const attributes = entity.attributes as {
    profil_presence?: { ponderation_especes?: Array<{ espece?: unknown }> };
    profil_population?: { especes_dominantes?: unknown[]; especes_minoritaires?: unknown[]; especes_rares?: unknown[] };
  };
  const weighted = attributes.profil_presence?.ponderation_especes?.map(entry => entry.espece) ?? [];
  const population = attributes.profil_population;
  return [...new Set([
    ...weighted,
    ...(population?.especes_dominantes ?? []),
    ...(population?.especes_minoritaires ?? []),
    ...(population?.especes_rares ?? [])
  ].filter((value): value is string => typeof value === "string"))];
}

function influenceDimension(entityType: LoreEntityTypeV1, fieldPath: string): LoreInfluenceDimensionV1 {
  if (fieldPath === "/resume") return "IDENTITY";
  if (entityType === "culture") return "CULTURE";
  if (entityType === "espece") return "POPULATION";
  if (entityType === "faction") return fieldPath.includes("ideologie") ? "CULTURE" : "SOCIAL";
  if (fieldPath.includes("climat") || fieldPath.includes("relief") || fieldPath.includes("env")) return "ENVIRONMENT";
  if (fieldPath.includes("population") || fieldPath.includes("peuples") || fieldPath.includes("presence")) return "POPULATION";
  if (fieldPath.includes("langue")) return "LANGUAGE";
  if (fieldPath.includes("autorite") || fieldPath.includes("securite") || fieldPath.includes("acces")) return "AUTHORITY";
  return "DESCRIPTION";
}
