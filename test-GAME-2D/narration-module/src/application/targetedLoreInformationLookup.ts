import type { LoreEntityV1, LoreFragmentV1, LoreKnowledgeLevelV1 } from "../bootstrap/lore";
import type { NarrativeLoreBuildCatalogV1 } from "../context";
import type { JsonObject } from "../core";
import type { InformationNeedV1, ResolvedInformationCandidateV1 } from "./npcInformationResolution";
import type { CampaignFactInformationReaderV1, CampaignFactRecordV1 } from "./campaignFactAuthority";
import type {
  CampaignLoreProjectionReaderV1,
  CampaignLoreProjectionV1
} from "./loreGuidedSceneCreation";
import {
  buildLoreInformationSemanticCatalogV1,
  type LoreInformationSemanticCatalogV1
} from "./loreInformationSemanticCatalog";

export const TARGETED_LORE_INFORMATION_LOOKUP_CONTRACT_V1 = "targeted-lore-information-lookup/1" as const;
export const TARGETED_LORE_INFORMATION_MAX_CANDIDATES_V1 = 8;

export interface TargetedLoreInformationLookupRequestV1 extends JsonObject {
  schemaVersion: 1;
  lookupId: string;
  campaignId: string;
  campaignRevision: number;
  anchorEntityId: string;
  need: InformationNeedV1;
  knowledgeRefs: string[];
  allowedKnowledgeLevels: LoreKnowledgeLevelV1[];
}

export interface TargetedLoreInspectedTargetV1 extends JsonObject {
  entityId: string;
  fieldPath: string;
  relevance: number;
  selectedBy: "SUBJECT" | "RELATION" | "KNOWLEDGE_REF";
}

export interface TargetedLoreMissingPropertyV1 extends JsonObject {
  propertyRef: string;
  publicLabel: string;
  subjectRef: string;
  fieldPath: string;
  knowledgeLevel: "COMMUN" | "LOCAL";
  creationMode: "FORBIDDEN" | "TEXT" | "IDENTITY";
  identityRolePropertyRef: string | null;
}

export interface TargetedLoreInformationLookupResultV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof TARGETED_LORE_INFORMATION_LOOKUP_CONTRACT_V1;
  lookupId: string;
  need: InformationNeedV1;
  resolvedSubjectRefs: string[];
  candidates: ResolvedInformationCandidateV1[];
  missingDimensions: string[];
  missingProperties: TargetedLoreMissingPropertyV1[];
  inspectedTargets: TargetedLoreInspectedTargetV1[];
  sourceRefs: string[];
  diagnostics: string[];
  authority: "READ_ONLY_FACT_LOOKUP";
  noCommit: true;
  version: 1;
}

export interface TargetedLoreInformationReaderV1 {
  lookup(request: TargetedLoreInformationLookupRequestV1): Promise<TargetedLoreInformationLookupResultV1>;
}

export type TargetedLoreInformationLookupValidationV1 =
  | { ok: true }
  | { ok: false; issues: string[] };

export function validateTargetedLoreInformationLookupResultV1(
  value: TargetedLoreInformationLookupResultV1
): TargetedLoreInformationLookupValidationV1 {
  const issues: string[] = [];
  if (value.schemaVersion !== 1 || value.contractVersion !== TARGETED_LORE_INFORMATION_LOOKUP_CONTRACT_V1 || value.version !== 1) issues.push("lookup result contract is invalid");
  if (value.authority !== "READ_ONLY_FACT_LOOKUP" || value.noCommit !== true) issues.push("lookup authority boundary is invalid");
  if (value.candidates.length > TARGETED_LORE_INFORMATION_MAX_CANDIDATES_V1) issues.push("candidate budget exceeded");
  if (new Set(value.candidates.map(candidate => candidate.candidateId)).size !== value.candidates.length) issues.push("candidate ids are not unique");
  if (value.candidates.some(candidate => !["LORE_INITIAL", "CAMPAIGN_LORE_PROJECTION", "CAMPAIGN_FACT"].includes(candidate.authority))) issues.push("candidate authority escaped read-only fact lookup");
  if (value.candidates.some(candidate => !["COMMUN", "LOCAL"].includes(candidate.sourceKnowledgeLevel ?? ""))) issues.push("candidate crossed public/local knowledge boundary");
  if (value.candidates.some(candidate => candidate.scopeRefs.length === 0)) issues.push("candidate scope is missing");
  if (value.candidates.some(candidate => candidate.sourceRefs.length === 0)) issues.push("candidate provenance is missing");
  if (value.sourceRefs.some(ref => /^(?:secret|private|hidden):/iu.test(ref))) issues.push("private source leaked from lookup");
  if (value.missingProperties.some(property => !value.missingDimensions.includes(property.propertyRef))) issues.push("missing property is not part of missing dimensions");
  if (value.missingProperties.some(property => !property.publicLabel.trim() || !/^[a-z][a-z0-9_-]*:.+/u.test(property.propertyRef))) issues.push("missing property presentation is invalid");
  if (value.missingProperties.some(property => !/^lore-entity:.+/u.test(property.subjectRef) || !/^\/.+/u.test(property.fieldPath) || !["COMMUN", "LOCAL"].includes(property.knowledgeLevel))) issues.push("missing property owner metadata is invalid");
  if (new Set(value.missingProperties.map(property => property.propertyRef)).size !== value.missingProperties.length) issues.push("missing property presentations are not unique");
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

export function createTargetedLoreInformationReaderV1(input: {
  catalog: NarrativeLoreBuildCatalogV1;
  projectionReader?: CampaignLoreProjectionReaderV1 | null;
  campaignFactReader?: CampaignFactInformationReaderV1 | null;
}): TargetedLoreInformationReaderV1 {
  const entityById = new Map(input.catalog.entities.map(entity => [entity.entityId, entity] as const));
  const searchableLore = [...input.catalog.facts, ...input.catalog.fragments];
  const fragmentById = new Map(searchableLore.map(fragment => [fragment.fragmentId, fragment] as const));
  const fragmentsByEntity = groupFragments(searchableLore);

  return {
    async lookup(request) {
      validateRequest(request);
      const allowedLevels = new Set(request.allowedKnowledgeLevels);
      const anchor = entityById.get(request.anchorEntityId);
      if (!anchor) throw new Error(`Unknown lore anchor ${request.anchorEntityId}.`);
      if (request.need.contractVersion === "information-need/2") {
        return lookupByOpenSelectors({
          request,
          catalog: input.catalog,
          anchor,
          entityById,
          fragmentById,
          projectionReader: input.projectionReader ?? null,
          campaignFactReader: input.campaignFactReader ?? null
        });
      }

      const subjects = resolveSubjects(request.need, anchor, input.catalog.entities, entityById);
      const subjectRefs = subjects.map(subject => `lore-entity:${subject.entityId}`);
      const campaignFacts = input.campaignFactReader
        ? await input.campaignFactReader.listEffectiveFacts({
            schemaVersion: 1,
            campaignId: request.campaignId,
            campaignRevision: request.campaignRevision,
            subjectRefs,
            temporalScope: request.need.temporalScope
          })
        : [];
      const campaignCandidates = campaignFacts
        .filter(fact => allowedLevels.has(fact.knowledgeLevel))
        .map((fact, index) => ({
          schemaVersion: 1 as const,
          candidateId: `information-candidate:${request.lookupId}:campaign:${index + 1}`,
          subjectRef: fact.subjectRef,
          property: fact.predicate,
          value: fact.objectText,
          authority: "CAMPAIGN_FACT" as const,
          visibility: "PLAYER_VISIBLE" as const,
          sourceKnowledgeLevel: fact.knowledgeLevel,
          scopeRefs: [fact.subjectRef],
          sourceRefs: unique([`campaign-fact:${fact.factId}`, ...fact.sourceRefs])
        } satisfies ResolvedInformationCandidateV1));
      const campaignTargets = new Set(campaignCandidates.map(candidate => targetKey(candidate.subjectRef!.replace(/^lore-entity:/u, ""), candidate.property)));
      const selected = selectTargets({
        need: request.need,
        subjects,
        anchor,
        entityById,
        fragmentById,
        fragmentsByEntity,
        knowledgeRefs: request.knowledgeRefs,
        allowedLevels
      });
      const targets = uniqueTargets(selected).slice(0, TARGETED_LORE_INFORMATION_MAX_CANDIDATES_V1);
      const projections = input.projectionReader
        ? (await input.projectionReader.listEffectiveProjections({
            schemaVersion: 1,
            campaignId: request.campaignId,
            campaignRevision: request.campaignRevision,
            targets: targets.map(target => ({ entityId: target.fragment.entityId, fieldPath: target.fragment.fieldPath }))
          })).projections
        : [];
      const projectionByTarget = new Map(projections.map(projection => [targetKey(projection.entityId, projection.fieldPath), projection] as const));
      const loreCandidates = targets.flatMap((target, index) => {
        if (campaignTargets.has(targetKey(target.fragment.entityId, target.fragment.fieldPath))) return [];
        const projection = projectionByTarget.get(targetKey(target.fragment.entityId, target.fragment.fieldPath));
        if (projection?.disposition === "WITHHOLD") return [];
        const value = effectiveValue(target.fragment, projection, entityById);
        if (!value) return [];
        const sourceRefs = projection
          ? unique([`campaign-lore-projection:${projection.projectionId}`, ...projection.sourceRefs, sourceRef(target.fragment)])
          : [sourceRef(target.fragment)];
        return [{
          schemaVersion: 1 as const,
          candidateId: `information-candidate:${request.lookupId}:${index + 1}`,
          subjectRef: `lore-entity:${target.fragment.entityId}`,
          property: target.fragment.fieldPath,
          value,
          authority: projection ? "CAMPAIGN_LORE_PROJECTION" as const : "LORE_INITIAL" as const,
          visibility: "PLAYER_VISIBLE" as const,
          sourceKnowledgeLevel: target.fragment.knowledgeLevel,
          scopeRefs: entityScopeRefs(entityById.get(target.fragment.entityId), entityById),
          sourceRefs
        } satisfies ResolvedInformationCandidateV1];
      });
      const candidates = [...campaignCandidates, ...loreCandidates].slice(0, TARGETED_LORE_INFORMATION_MAX_CANDIDATES_V1);
      const diagnostics = [
        `anchor:${anchor.entityId}`,
        ...subjects.map(subject => `subject:${subject.entityId}`),
        ...(projections.length > 0 ? [`campaign-projections:${projections.length}`] : []),
        ...(campaignCandidates.length > 0 ? [`campaign-facts:${campaignCandidates.length}`] : [])
      ];
      if (targets.length === 0 && campaignCandidates.length === 0) diagnostics.push("no-relevant-fact-target");
      if (targets.length > 0 && candidates.length === 0) diagnostics.push("all-relevant-targets-withheld-or-empty");
      return {
        schemaVersion: 1,
        contractVersion: TARGETED_LORE_INFORMATION_LOOKUP_CONTRACT_V1,
        lookupId: request.lookupId,
        need: structuredClone(request.need),
        resolvedSubjectRefs: subjects.map(subject => `lore-entity:${subject.entityId}`),
        candidates,
        missingDimensions: legacyMissingDimensions(request.need, candidates.length),
        missingProperties: [],
        inspectedTargets: targets.map(target => ({
          entityId: target.fragment.entityId,
          fieldPath: target.fragment.fieldPath,
          relevance: target.relevance,
          selectedBy: target.selectedBy
        })),
        sourceRefs: unique(candidates.flatMap(candidate => candidate.sourceRefs)),
        diagnostics,
        authority: "READ_ONLY_FACT_LOOKUP",
        noCommit: true,
        version: 1
      };
    }
  };
}

async function lookupByOpenSelectors(input: {
  request: TargetedLoreInformationLookupRequestV1;
  catalog: NarrativeLoreBuildCatalogV1;
  anchor: LoreEntityV1;
  entityById: Map<string, LoreEntityV1>;
  fragmentById: Map<string, LoreFragmentV1>;
  projectionReader: CampaignLoreProjectionReaderV1 | null;
  campaignFactReader: CampaignFactInformationReaderV1 | null;
}): Promise<TargetedLoreInformationLookupResultV1> {
  const need = input.request.need;
  if (need.contractVersion !== "information-need/2") throw new Error("Open selector lookup requires information-need/2.");
  const semanticCatalog = buildLoreInformationSemanticCatalogV1({
    catalog: input.catalog,
    anchorEntityId: input.anchor.entityId
  });
  if (semanticCatalog === null) throw new Error("Lore information semantic catalogue is unavailable.");
  const subjectByRef = new Map(semanticCatalog.subjects.map(subject => [subject.ref, subject] as const));
  const propertyByRef = new Map(semanticCatalog.properties.map(property => [property.ref, property] as const));
  const relationByRef = new Map(semanticCatalog.relations.map(relation => [relation.ref, relation] as const));
  const diagnostics = validateOpenSelectors(need, subjectByRef, propertyByRef, relationByRef);
  const reachedSubjectRefs = new Set<string>();
  if (need.proposedSubjectRef !== null && subjectByRef.has(need.proposedSubjectRef)) reachedSubjectRefs.add(need.proposedSubjectRef);
  need.proposedScopeRefs.filter(ref => subjectByRef.has(ref)).forEach(ref => reachedSubjectRefs.add(ref));
  if (reachedSubjectRefs.size === 0) reachedSubjectRefs.add(semanticCatalog.anchorSubjectRef);
  const inspectedRelations: LoreInformationSemanticCatalogV1["relations"] = [];
  for (const relationRef of need.proposedRelationRefs) {
    const relation = relationByRef.get(relationRef);
    if (relation === undefined) continue;
    if (!reachedSubjectRefs.has(relation.sourceSubjectRef)) {
      diagnostics.push(`disconnected-relation:${relation.ref}`);
      continue;
    }
    reachedSubjectRefs.add(relation.targetSubjectRef);
    inspectedRelations.push(relation);
  }
  const selectedProperties = unique([...need.proposedPropertyRefs, ...need.completionPropertyRefs])
    .flatMap(ref => {
      const property = propertyByRef.get(ref);
      return property !== undefined && reachedSubjectRefs.has(property.subjectRef) ? [property] : [];
    });
  const subjectRefs = [...reachedSubjectRefs].sort();
  const selectedKeys = new Set(selectedProperties.map(property => targetKey(
    entityIdFromSubjectRef(property.subjectRef),
    property.fieldPath
  )));
  const campaignFacts = input.campaignFactReader === null
    ? []
    : await input.campaignFactReader.listEffectiveFacts({
        schemaVersion: 1,
        campaignId: input.request.campaignId,
        campaignRevision: input.request.campaignRevision,
        subjectRefs,
        temporalScope: need.temporalScope
      });
  const allowedLevels = new Set(input.request.allowedKnowledgeLevels);
  const campaignCandidates = campaignFacts
    .filter(fact => allowedLevels.has(fact.knowledgeLevel))
    .filter(fact => selectedKeys.has(targetKey(entityIdFromSubjectRef(fact.subjectRef), fact.predicate)))
    .map((fact, index): ResolvedInformationCandidateV1 => ({
      schemaVersion: 1,
      candidateId: `information-candidate:${input.request.lookupId}:campaign:${index + 1}`,
      subjectRef: fact.subjectRef,
      property: fact.predicate,
      value: fact.objectText,
      authority: "CAMPAIGN_FACT",
      visibility: "PLAYER_VISIBLE",
      sourceKnowledgeLevel: fact.knowledgeLevel,
      scopeRefs: subjectRefs,
      sourceRefs: unique([`campaign-fact:${fact.factId}`, ...fact.sourceRefs])
    }));
  const campaignKeys = new Set(campaignCandidates.map(candidate => targetKey(
    entityIdFromSubjectRef(candidate.subjectRef!),
    candidate.property
  )));
  const targets = (need.temporalScope === "CURRENT" || need.temporalScope === "UNSPECIFIED") ? selectedProperties.flatMap(property => {
    const entityId = entityIdFromSubjectRef(property.subjectRef);
    const fragment = [...input.catalog.facts, ...input.catalog.fragments].find(candidate =>
      candidate.entityId === entityId
      && candidate.fieldPath === property.fieldPath
      && allowedLevels.has(candidate.knowledgeLevel)
    );
    return fragment === undefined ? [] : [{ fragment, property }];
  }).slice(0, TARGETED_LORE_INFORMATION_MAX_CANDIDATES_V1) : [];
  const projections = input.projectionReader === null
    ? []
    : (await input.projectionReader.listEffectiveProjections({
        schemaVersion: 1,
        campaignId: input.request.campaignId,
        campaignRevision: input.request.campaignRevision,
        targets: targets.map(target => ({ entityId: target.fragment.entityId, fieldPath: target.fragment.fieldPath }))
      })).projections;
  const projectionByTarget = new Map(projections.map(projection => [targetKey(projection.entityId, projection.fieldPath), projection] as const));
  const loreCandidates = targets.flatMap((target, index): ResolvedInformationCandidateV1[] => {
    const key = targetKey(target.fragment.entityId, target.fragment.fieldPath);
    if (campaignKeys.has(key)) return [];
    const projection = projectionByTarget.get(key);
    if (projection?.disposition === "WITHHOLD") return [];
    const value = effectiveValue(target.fragment, projection, input.entityById);
    if (value === null) return [];
    return [{
      schemaVersion: 1,
      candidateId: `information-candidate:${input.request.lookupId}:selector:${index + 1}`,
      subjectRef: target.property.subjectRef,
      property: target.property.fieldPath,
      value,
      authority: projection === undefined ? "LORE_INITIAL" : "CAMPAIGN_LORE_PROJECTION",
      visibility: "PLAYER_VISIBLE",
      sourceKnowledgeLevel: target.fragment.knowledgeLevel,
      scopeRefs: subjectRefs,
      sourceRefs: projection === undefined
        ? [sourceRef(target.fragment)]
        : unique([`campaign-lore-projection:${projection.projectionId}`, ...projection.sourceRefs, sourceRef(target.fragment)])
    }];
  });
  const candidates = [...campaignCandidates, ...loreCandidates].slice(0, TARGETED_LORE_INFORMATION_MAX_CANDIDATES_V1);
  const resolvedKeys = new Set(candidates.map(candidate => targetKey(
    entityIdFromSubjectRef(candidate.subjectRef!),
    candidate.property
  )));
  const completionRefs = need.completionPropertyRefs.length > 0
    ? need.completionPropertyRefs
    : need.proposedPropertyRefs;
  const missingDimensions = completionRefs.filter(ref => {
    const property = propertyByRef.get(ref);
    return property === undefined || !resolvedKeys.has(targetKey(entityIdFromSubjectRef(property.subjectRef), property.fieldPath));
  });
  const missingProperties = missingDimensions.flatMap(propertyRef => {
    const property = propertyByRef.get(propertyRef);
    if (property === undefined) return [];
    return [{
      propertyRef,
      publicLabel: property.label,
      subjectRef: property.subjectRef,
      fieldPath: property.fieldPath,
      knowledgeLevel: property.knowledgeLevel,
      creationMode: property.creationMode,
      identityRolePropertyRef: property.identityRolePropertyRef
    }];
  });
  if (candidates.length === 0) diagnostics.push("no-candidate-for-validated-selectors");
  return {
    schemaVersion: 1,
    contractVersion: TARGETED_LORE_INFORMATION_LOOKUP_CONTRACT_V1,
    lookupId: input.request.lookupId,
    need: structuredClone(need),
    resolvedSubjectRefs: subjectRefs,
    candidates,
    missingDimensions,
    missingProperties,
    inspectedTargets: [
      ...targets.map((target, index) => ({
        entityId: target.fragment.entityId,
        fieldPath: target.fragment.fieldPath,
        relevance: 100 - index,
        selectedBy: "SUBJECT" as const
      })),
      ...inspectedRelations.map((relation, index) => ({
        entityId: entityIdFromSubjectRef(relation.targetSubjectRef),
        fieldPath: relation.ref,
        relevance: 80 - index,
        selectedBy: "RELATION" as const
      }))
    ].slice(0, TARGETED_LORE_INFORMATION_MAX_CANDIDATES_V1),
    sourceRefs: unique(candidates.flatMap(candidate => candidate.sourceRefs)),
    diagnostics,
    authority: "READ_ONLY_FACT_LOOKUP",
    noCommit: true,
    version: 1
  };
}

function validateOpenSelectors(
  need: Extract<InformationNeedV1, { contractVersion: "information-need/2" }>,
  subjectByRef: ReadonlyMap<string, unknown>,
  propertyByRef: ReadonlyMap<string, unknown>,
  relationByRef: ReadonlyMap<string, unknown>
): string[] {
  const diagnostics: string[] = [];
  if (need.proposedSubjectRef !== null && !subjectByRef.has(need.proposedSubjectRef)) diagnostics.push(`unknown-subject-selector:${need.proposedSubjectRef}`);
  need.proposedScopeRefs.filter(ref => !subjectByRef.has(ref)).forEach(ref => diagnostics.push(`unknown-scope-selector:${ref}`));
  [...need.proposedPropertyRefs, ...need.completionPropertyRefs]
    .filter(ref => !propertyByRef.has(ref))
    .forEach(ref => diagnostics.push(`unknown-property-selector:${ref}`));
  need.proposedRelationRefs.filter(ref => !relationByRef.has(ref)).forEach(ref => diagnostics.push(`unknown-relation-selector:${ref}`));
  return unique(diagnostics);
}

function entityIdFromSubjectRef(ref: string): string {
  return ref.replace(/^lore-entity:/u, "");
}

function legacyMissingDimensions(need: InformationNeedV1, candidateCount: number): string[] {
  return candidateCount === 0 ? [need.requestedDimension] : [];
}

type SelectedTarget = {
  fragment: LoreFragmentV1;
  relevance: number;
  selectedBy: TargetedLoreInspectedTargetV1["selectedBy"];
};

function resolveSubjects(
  need: InformationNeedV1,
  anchor: LoreEntityV1,
  _entities: LoreEntityV1[],
  entityById: Map<string, LoreEntityV1>
): LoreEntityV1[] {
  if (need.proposedSubjectRef) {
    const explicit = entityById.get(need.proposedSubjectRef.replace(/^[^:]+:/u, ""));
    if (explicit) return [explicit];
  }
  return [anchor];
}

function selectTargets(input: {
  need: InformationNeedV1;
  subjects: LoreEntityV1[];
  anchor: LoreEntityV1;
  entityById: Map<string, LoreEntityV1>;
  fragmentById: Map<string, LoreFragmentV1>;
  fragmentsByEntity: Map<string, LoreFragmentV1[]>;
  knowledgeRefs: string[];
  allowedLevels: Set<LoreKnowledgeLevelV1>;
}): SelectedTarget[] {
  const selected: SelectedTarget[] = [];
  const add = (fragment: LoreFragmentV1 | undefined, relevance: number, selectedBy: SelectedTarget["selectedBy"]) => {
    if (fragment && input.allowedLevels.has(fragment.knowledgeLevel)) selected.push({ fragment, relevance, selectedBy });
  };
  const addPath = (entityId: string, fieldPath: string, relevance: number, selectedBy: SelectedTarget["selectedBy"]) =>
    add(input.fragmentsByEntity.get(entityId)?.find(fragment => fragment.fieldPath === fieldPath), relevance, selectedBy);

  for (const subject of input.subjects) {
    for (const fragment of input.fragmentsByEntity.get(subject.entityId) ?? []) {
      add(fragment, fragment.fragmentId.startsWith("fact.") ? 100 : 40, "SUBJECT");
    }
    const firstHop = subject.relations.flatMap(relation => {
      const target = input.entityById.get(relation.targetId);
      return target === undefined ? [] : [target];
    });
    for (const related of firstHop) {
      for (const fragment of input.fragmentsByEntity.get(related.entityId) ?? []) {
        if (fragment.fragmentId.startsWith("fact.")) add(fragment, 80, "RELATION");
      }
      for (const relation of related.relations) {
        const secondHop = input.entityById.get(relation.targetId);
        if (secondHop === undefined) continue;
        for (const fragment of input.fragmentsByEntity.get(secondHop.entityId) ?? []) {
          if (fragment.fragmentId.startsWith("fact.")) add(fragment, 60, "RELATION");
        }
      }
    }
  }
  for (const ref of input.knowledgeRefs) {
    const match = /^lore-fragment:(.+)$/u.exec(ref);
    if (match) add(input.fragmentById.get(match[1]!), 60, "KNOWLEDGE_REF");
  }
  return selected.sort((left, right) => right.relevance - left.relevance || targetKey(left.fragment.entityId, left.fragment.fieldPath).localeCompare(targetKey(right.fragment.entityId, right.fragment.fieldPath)));
}

function effectiveValue(
  fragment: LoreFragmentV1,
  projection: CampaignLoreProjectionV1 | undefined,
  entityById: Map<string, LoreEntityV1>
): string | null {
  const raw = projection?.replacementText ?? fragment.text;
  if (!raw.trim()) return null;
  return entityById.get(raw)?.displayName ?? raw;
}

function entityScopeRefs(entity: LoreEntityV1 | undefined, entityById: Map<string, LoreEntityV1>): string[] {
  if (!entity) return [];
  void entityById;
  return [`lore-entity:${entity.entityId}`];
}

function groupFragments(fragments: LoreFragmentV1[]): Map<string, LoreFragmentV1[]> {
  const grouped = new Map<string, LoreFragmentV1[]>();
  for (const fragment of fragments) grouped.set(fragment.entityId, [...(grouped.get(fragment.entityId) ?? []), fragment]);
  return grouped;
}

function uniqueTargets(targets: SelectedTarget[]): SelectedTarget[] {
  const uniqueTargets = new Map<string, SelectedTarget>();
  for (const target of targets) if (!uniqueTargets.has(targetKey(target.fragment.entityId, target.fragment.fieldPath))) uniqueTargets.set(targetKey(target.fragment.entityId, target.fragment.fieldPath), target);
  return [...uniqueTargets.values()];
}

function targetKey(entityId: string, fieldPath: string): string {
  return `${entityId}\u0000${fieldPath}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "fr"));
}

function sourceRef(fragment: LoreFragmentV1): string {
  return fragment.fragmentId.startsWith("fact.") ? `lore-fact:${fragment.fragmentId}` : `lore-fragment:${fragment.fragmentId}`;
}

function validateRequest(request: TargetedLoreInformationLookupRequestV1): void {
  if (request.schemaVersion !== 1 || !request.lookupId.trim() || !request.campaignId.trim() || request.campaignRevision < 0 || !request.anchorEntityId.trim()) {
    throw new Error("Targeted lore information lookup request is invalid.");
  }
  if (!Array.isArray(request.knowledgeRefs) || !Array.isArray(request.allowedKnowledgeLevels) || request.allowedKnowledgeLevels.length === 0) {
    throw new Error("Targeted lore information lookup boundaries are invalid.");
  }
  if (request.allowedKnowledgeLevels.some(level => !["COMMUN", "LOCAL"].includes(level))) {
    throw new Error("Targeted lore information lookup cannot cross the public/local knowledge boundary.");
  }
}
