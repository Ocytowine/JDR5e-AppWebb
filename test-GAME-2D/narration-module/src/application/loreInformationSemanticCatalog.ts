import type { LoreEntityV1, LoreKnowledgeLevelV1 } from "../bootstrap/lore";
import type { NarrativeLoreBuildCatalogV1 } from "../context";
import type { JsonObject } from "../core";

export const LORE_INFORMATION_SEMANTIC_CATALOG_CONTRACT_V1 =
  "lore-information-semantic-catalog/1" as const;
export const LORE_INFORMATION_INTERPRETER_PROJECTION_CONTRACT_V1 =
  "lore-information-interpreter-projection/1" as const;

export interface LoreInformationSemanticCatalogV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof LORE_INFORMATION_SEMANTIC_CATALOG_CONTRACT_V1;
  anchorSubjectRef: string;
  subjects: Array<JsonObject & {
    ref: string;
    label: string;
    entityType: string;
  }>;
  properties: Array<JsonObject & {
    ref: string;
    subjectRef: string;
    fieldPath: string;
    label: string;
    availability: "PRESENT" | "DECLARED_MISSING";
    knowledgeLevel: "COMMUN" | "LOCAL";
    creationMode: "FORBIDDEN" | "TEXT" | "IDENTITY";
    identityRolePropertyRef: string | null;
  }>;
  relations: Array<JsonObject & {
    ref: string;
    sourceSubjectRef: string;
    targetSubjectRef: string;
    label: string;
  }>;
  authority: "REFERENCE_ONLY_NO_FACT_VALUES";
  noCommit: true;
  version: 1;
}

export interface LoreInformationInterpreterProjectionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof LORE_INFORMATION_INTERPRETER_PROJECTION_CONTRACT_V1;
  anchorSubjectRef: string;
  subjectColumns: ["ref", "label", "entityType"];
  subjects: Array<[string, string, string]>;
  propertyColumns: [
    "ref",
    "subjectRef",
    "fieldPath",
    "label",
    "availability",
    "knowledgeLevel",
    "creationMode",
    "identityRolePropertyRef"
  ];
  properties: Array<[
    string,
    string,
    string,
    string,
    "PRESENT" | "DECLARED_MISSING",
    "COMMUN" | "LOCAL",
    "FORBIDDEN" | "TEXT" | "IDENTITY",
    string | null
  ]>;
  relationColumns: ["ref", "sourceSubjectRef", "targetSubjectRef", "label"];
  relations: Array<[string, string, string, string]>;
  authority: "REFERENCE_ONLY_NO_FACT_VALUES";
  noCommit: true;
  version: 1;
}

/**
 * Projection de transport sans perte du catalogue canonique. Les colonnes
 * explicites rendent chaque ligne reconstructible tout en évitant de répéter
 * les mêmes clés JSON pour chaque sujet, propriété et relation.
 */
export function projectLoreInformationCatalogForInterpreterV1(
  catalog: LoreInformationSemanticCatalogV1
): LoreInformationInterpreterProjectionV1 {
  return {
    schemaVersion: 1,
    contractVersion: LORE_INFORMATION_INTERPRETER_PROJECTION_CONTRACT_V1,
    anchorSubjectRef: catalog.anchorSubjectRef,
    subjectColumns: ["ref", "label", "entityType"],
    subjects: catalog.subjects.map(subject => [subject.ref, subject.label, subject.entityType]),
    propertyColumns: [
      "ref",
      "subjectRef",
      "fieldPath",
      "label",
      "availability",
      "knowledgeLevel",
      "creationMode",
      "identityRolePropertyRef"
    ],
    properties: catalog.properties.map(property => [
      property.ref,
      property.subjectRef,
      property.fieldPath,
      property.label,
      property.availability,
      property.knowledgeLevel,
      property.creationMode,
      property.identityRolePropertyRef
    ]),
    relationColumns: ["ref", "sourceSubjectRef", "targetSubjectRef", "label"],
    relations: catalog.relations.map(relation => [
      relation.ref,
      relation.sourceSubjectRef,
      relation.targetSubjectRef,
      relation.label
    ]),
    authority: catalog.authority,
    noCommit: true,
    version: 1
  };
}

const PUBLIC_LEVELS = new Set<LoreKnowledgeLevelV1>(["COMMUN", "LOCAL"]);
const MAX_DEPTH = 2;
const MAX_SUBJECTS = 7;
const MAX_PROPERTIES = 18;
const MAX_RELATIONS = 12;

export function buildLoreInformationSemanticCatalogV1(input: {
  catalog: NarrativeLoreBuildCatalogV1;
  anchorEntityId: string;
}): LoreInformationSemanticCatalogV1 | null {
  const entityById = new Map(input.catalog.entities.map(entity => [entity.entityId, entity] as const));
  const anchor = entityById.get(input.anchorEntityId);
  if (anchor === undefined) return null;
  const publicEntityIds = new Set(
    [...input.catalog.facts, ...input.catalog.fragments]
      .filter(fragment => PUBLIC_LEVELS.has(fragment.knowledgeLevel))
      .map(fragment => fragment.entityId)
  );
  publicEntityIds.add(anchor.entityId);

  const depths = new Map<string, number>([[anchor.entityId, 0]]);
  const queue = [anchor.entityId];
  while (queue.length > 0 && depths.size < MAX_SUBJECTS) {
    const sourceId = queue.shift()!;
    const depth = depths.get(sourceId)!;
    if (depth >= MAX_DEPTH) continue;
    const source = entityById.get(sourceId);
    if (source === undefined) continue;
    const declaredRelationKeys = new Set(declaredRelations(source).map(relationKey));
    const orderedRelations = [...source.relations].sort((left, right) =>
      Number(!declaredRelationKeys.has(relationKey(left))) - Number(!declaredRelationKeys.has(relationKey(right)))
      || entityInformationPriority(entityById.get(left.targetId), input.catalog)
      - entityInformationPriority(entityById.get(right.targetId), input.catalog)
      || left.relation.localeCompare(right.relation)
      || left.targetId.localeCompare(right.targetId)
    );
    for (const relation of orderedRelations) {
      if (!entityById.has(relation.targetId) || !publicEntityIds.has(relation.targetId) || depths.has(relation.targetId)) continue;
      depths.set(relation.targetId, depth + 1);
      queue.push(relation.targetId);
      if (depths.size >= MAX_SUBJECTS) break;
    }
  }
  const entities = [...depths.keys()]
    .map(entityId => entityById.get(entityId)!)
    .sort((left, right) => (depths.get(left.entityId)! - depths.get(right.entityId)!) || left.entityId.localeCompare(right.entityId));
  const retained = new Set(entities.map(entity => entity.entityId));
  const subjects = entities.map(entity => ({
    ref: subjectRef(entity.entityId),
    label: entity.displayName,
    entityType: entity.entityType
  }));
  const propertyByKey = new Map<string, LoreInformationSemanticCatalogV1["properties"][number]>();
  const propertyPriority = new Map<string, number>();
  for (const fragment of [
    ...input.catalog.facts,
    ...input.catalog.fragments.filter(fragment => fragment.entityId === anchor.entityId)
  ]) {
    if (!retained.has(fragment.entityId) || !PUBLIC_LEVELS.has(fragment.knowledgeLevel)) continue;
    const key = propertyKey(fragment.entityId, fragment.fieldPath);
    if (!propertyByKey.has(key)) {
      propertyByKey.set(key, {
      ref: propertyRef(fragment.entityId, fragment.fieldPath),
      subjectRef: subjectRef(fragment.entityId),
      fieldPath: fragment.fieldPath,
      label: dataLabel(fragment.fieldPath),
      availability: "PRESENT",
      knowledgeLevel: fragment.knowledgeLevel === "LOCAL" ? "LOCAL" : "COMMUN",
      creationMode: "FORBIDDEN",
      identityRolePropertyRef: null
      });
      propertyPriority.set(key, fragment.fragmentId.startsWith("fact.") ? 1 : 2);
    }
  }
  for (const entity of entities) {
    for (const property of declaredProperties(entity)) {
      if (!PUBLIC_LEVELS.has(property.level)) continue;
      const fieldPath = `/${property.id}`;
      const key = propertyKey(entity.entityId, fieldPath);
      propertyByKey.set(key, {
        ref: propertyRef(entity.entityId, fieldPath),
        subjectRef: subjectRef(entity.entityId),
        fieldPath,
        label: property.label,
        availability: property.value === null ? "DECLARED_MISSING" : "PRESENT",
        knowledgeLevel: property.level === "LOCAL" ? "LOCAL" : "COMMUN",
        creationMode: property.creationMode,
        identityRolePropertyRef: property.identityRolePropertyId === null
          ? null
          : propertyRef(entity.entityId, `/${property.identityRolePropertyId}`)
      });
      propertyPriority.set(key, 0);
    }
  }
  const declaredEdgeRefs = new Set(entities.flatMap(source => declaredRelations(source)
    .map(relation => edgeRef(source.entityId, relation.relation, relation.targetId))));
  const relations = entities.flatMap(source => source.relations
    .filter(relation => retained.has(relation.targetId))
    .map(relation => ({
      ref: edgeRef(source.entityId, relation.relation, relation.targetId),
      sourceSubjectRef: subjectRef(source.entityId),
      targetSubjectRef: subjectRef(relation.targetId),
      label: dataLabel(relation.relation)
    })))
    .sort((left, right) =>
      Number(!declaredEdgeRefs.has(left.ref)) - Number(!declaredEdgeRefs.has(right.ref))
      || (depths.get(entityIdFromSubjectRef(left.sourceSubjectRef)) ?? MAX_DEPTH + 1)
      - (depths.get(entityIdFromSubjectRef(right.sourceSubjectRef)) ?? MAX_DEPTH + 1)
      || left.ref.localeCompare(right.ref)
    )
    .slice(0, MAX_RELATIONS);
  return {
    schemaVersion: 1,
    contractVersion: LORE_INFORMATION_SEMANTIC_CATALOG_CONTRACT_V1,
    anchorSubjectRef: subjectRef(anchor.entityId),
    subjects,
    properties: [...propertyByKey.values()].sort((left, right) =>
      (propertyPriority.get(propertyKey(entityIdFromSubjectRef(left.subjectRef), left.fieldPath)) ?? 2)
      - (propertyPriority.get(propertyKey(entityIdFromSubjectRef(right.subjectRef), right.fieldPath)) ?? 2)
      || (depths.get(entityIdFromSubjectRef(left.subjectRef)) ?? MAX_DEPTH + 1)
      - (depths.get(entityIdFromSubjectRef(right.subjectRef)) ?? MAX_DEPTH + 1)
      || left.ref.localeCompare(right.ref)
    ).slice(0, MAX_PROPERTIES),
    relations,
    authority: "REFERENCE_ONLY_NO_FACT_VALUES",
    noCommit: true,
    version: 1
  };
}

export function propertyRef(entityId: string, fieldPath: string): string {
  return `lore-property:${entityId}:${fieldPath.replace(/^\//u, "")}`;
}

export function edgeRef(sourceId: string, relation: string, targetId: string): string {
  return `lore-edge:${sourceId}:${relation}:${targetId}`;
}

function subjectRef(entityId: string): string {
  return `lore-entity:${entityId}`;
}

function entityIdFromSubjectRef(ref: string): string {
  return ref.replace(/^lore-entity:/u, "");
}

function propertyKey(entityId: string, fieldPath: string): string {
  return `${entityId}\u0000${fieldPath}`;
}

function dataLabel(value: string): string {
  return value.replace(/^\//u, "").replaceAll("_", " ");
}

function declaredProperties(entity: LoreEntityV1): Array<{
  id: string;
  label: string;
  value: string | null;
  level: LoreKnowledgeLevelV1;
  creationMode: "FORBIDDEN" | "TEXT" | "IDENTITY";
  identityRolePropertyId: string | null;
}> {
  const raw = entity.attributes.proprietes_factuelles;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(value => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return [];
    const candidate = value as Record<string, unknown>;
    if (
      typeof candidate.propriete !== "string"
      || typeof candidate.libelle !== "string"
      || !(candidate.valeur === null || typeof candidate.valeur === "string")
      || !["COMMUN", "LOCAL", "SPECIALISE", "RESTREINT", "MJ_SECRET"].includes(String(candidate.niveau))
    ) return [];
    return [{
      id: candidate.propriete,
      label: candidate.libelle,
      value: candidate.valeur,
      level: candidate.niveau as LoreKnowledgeLevelV1,
      creationMode: candidate.creation === "TEXTE"
        ? "TEXT"
        : candidate.creation === "IDENTITE"
          ? "IDENTITY"
          : "FORBIDDEN",
      identityRolePropertyId: typeof candidate.propriete_role_identite === "string"
        ? candidate.propriete_role_identite
        : null
    }];
  });
}

function entityInformationPriority(
  entity: LoreEntityV1 | undefined,
  catalog: NarrativeLoreBuildCatalogV1
): number {
  if (entity === undefined) return 3;
  if (declaredProperties(entity).length > 0 || Array.isArray(entity.attributes.relations_declarees)) return 0;
  if (catalog.facts.some(fragment => fragment.entityId === entity.entityId)) return 1;
  return 2;
}

function declaredRelations(entity: LoreEntityV1): Array<{ relation: string; targetId: string }> {
  const raw = entity.attributes.relations_declarees;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(value => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return [];
    const candidate = value as Record<string, unknown>;
    return typeof candidate.relation === "string" && typeof candidate.cible === "string"
      ? [{ relation: candidate.relation, targetId: candidate.cible }]
      : [];
  });
}

function relationKey(relation: { relation: string; targetId: string }): string {
  return `${relation.relation}\u0000${relation.targetId}`;
}
