import type { LoreEntityV1, LoreFragmentV1, LoreKnowledgeLevelV1 } from "../bootstrap/lore";
import type { NarrativeLoreBuildCatalogV1 } from "../context";
import type { JsonObject } from "../core";
import type { InformationNeedV1, ResolvedInformationCandidateV1 } from "./npcInformationResolution";
import type {
  CampaignLoreProjectionReaderV1,
  CampaignLoreProjectionV1
} from "./loreGuidedSceneCreation";

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

export interface TargetedLoreInformationLookupResultV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof TARGETED_LORE_INFORMATION_LOOKUP_CONTRACT_V1;
  lookupId: string;
  need: InformationNeedV1;
  resolvedSubjectRefs: string[];
  candidates: ResolvedInformationCandidateV1[];
  missingDimensions: string[];
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
  if (value.candidates.some(candidate => !["LORE_INITIAL", "CAMPAIGN_LORE_PROJECTION"].includes(candidate.authority))) issues.push("candidate authority escaped read-only lore lookup");
  if (value.candidates.some(candidate => candidate.sourceRefs.length === 0)) issues.push("candidate provenance is missing");
  if (value.sourceRefs.some(ref => /^(?:secret|private|hidden):/iu.test(ref))) issues.push("private source leaked from lookup");
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

export function createTargetedLoreInformationReaderV1(input: {
  catalog: NarrativeLoreBuildCatalogV1;
  projectionReader?: CampaignLoreProjectionReaderV1 | null;
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

      const subjects = resolveSubjects(request.need, anchor, input.catalog.entities, entityById);
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
      const candidates = targets.flatMap((target, index) => {
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
          sourceRefs
        } satisfies ResolvedInformationCandidateV1];
      });
      const diagnostics = [
        `anchor:${anchor.entityId}`,
        ...subjects.map(subject => `subject:${subject.entityId}`),
        ...(projections.length > 0 ? [`campaign-projections:${projections.length}`] : [])
      ];
      if (targets.length === 0) diagnostics.push("no-relevant-lore-target");
      if (targets.length > 0 && candidates.length === 0) diagnostics.push("all-relevant-targets-withheld-or-empty");
      return {
        schemaVersion: 1,
        contractVersion: TARGETED_LORE_INFORMATION_LOOKUP_CONTRACT_V1,
        lookupId: request.lookupId,
        need: structuredClone(request.need),
        resolvedSubjectRefs: subjects.map(subject => `lore-entity:${subject.entityId}`),
        candidates,
        missingDimensions: candidates.length === 0 ? [request.need.requestedDimension] : [],
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

type SelectedTarget = {
  fragment: LoreFragmentV1;
  relevance: number;
  selectedBy: TargetedLoreInspectedTargetV1["selectedBy"];
};

function resolveSubjects(
  need: InformationNeedV1,
  anchor: LoreEntityV1,
  entities: LoreEntityV1[],
  entityById: Map<string, LoreEntityV1>
): LoreEntityV1[] {
  if (need.proposedSubjectRef) {
    const explicit = entityById.get(need.proposedSubjectRef.replace(/^[^:]+:/u, ""));
    if (explicit) return contextualizeGenericPlaceSubject(explicit, need, entityById);
  }
  const mention = normalize(need.subjectMention);
  const exact = entities.filter(entity => [entity.entityId, entity.displayName, ...entity.searchTerms].some(term => normalize(term) === mention));
  if (exact.length > 0) return exact;
  if (isGenericCityMention(mention)) {
    const city = relatedEntity(anchor, "ville", entityById) ?? (anchor.entityType === "ville" ? anchor : null);
    if (city) return [city];
  }
  return contextualizeGenericPlaceSubject(anchor, need, entityById);
}

function contextualizeGenericPlaceSubject(
  entity: LoreEntityV1,
  need: InformationNeedV1,
  entityById: Map<string, LoreEntityV1>
): LoreEntityV1[] {
  if (isGovernanceNeed(need) && entity.entityType !== "ville") {
    const city = relatedEntity(entity, "ville", entityById);
    if (city) return [city];
  }
  return [entity];
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
    if (isGovernanceNeed(input.need) && subject.entityType === "ville") {
      addPath(subject.entityId, "/type_gouvernance", 100, "SUBJECT");
      addPath(subject.entityId, "/siege_pouvoir", 99, "RELATION");
      const seat = relatedEntity(subject, "siege_pouvoir", input.entityById);
      if (seat) {
        addPath(seat.entityId, "/proprietaire_principal", 98, "RELATION");
        addPath(seat.entityId, "/resume", 80, "RELATION");
        addPath(seat.entityId, "/fonction_principale", 79, "RELATION");
      }
    }
    if (input.need.requestedAnswerShape === "LOCATION") {
      addPath(subject.entityId, "/quartier", 100, "SUBJECT");
      addPath(subject.entityId, "/ville", 99, "SUBJECT");
      addPath(subject.entityId, "/region", 98, "SUBJECT");
      addPath(subject.entityId, "/resume", 80, "SUBJECT");
    }
    const queryTokens = tokens(input.need.requestedDimension);
    for (const fragment of input.fragmentsByEntity.get(subject.entityId) ?? []) {
      const score = tokenScore(queryTokens, tokens(`${fragment.fieldPath} ${fragment.text} ${fragment.topics.join(" ")}`));
      if (score > 0) add(fragment, 40 + score, "SUBJECT");
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
  if (["/siege_pouvoir", "/quartier", "/ville", "/region"].includes(fragment.fieldPath)) return entityById.get(raw)?.displayName ?? raw;
  return raw;
}

function relatedEntity(entity: LoreEntityV1, relation: string, entityById: Map<string, LoreEntityV1>): LoreEntityV1 | null {
  const target = entity.relations.find(entry => entry.relation === relation)?.targetId;
  return target ? entityById.get(target) ?? null : null;
}

function isGovernanceNeed(need: InformationNeedV1): boolean {
  if (!["CURRENT", "UNSPECIFIED"].includes(need.temporalScope)) return false;
  if (!["IDENTITY", "TITLE", "LOCATION", "OPEN"].includes(need.requestedAnswerShape)) return false;
  const terms = tokens(need.requestedDimension);
  return [...terms].some(term => /^(?:dirig|gouvern|autor|pouvoir|regent|souver|command|responsab|titulaire|tete|siege)/u.test(term));
}

function isGenericCityMention(value: string): boolean {
  return ["ville", "la ville", "cette ville", "cite", "la cite", "cette cite"].includes(value);
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

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("fr").replace(/[_-]+/gu, " ").replace(/[^a-z0-9 ]+/gu, " ").replace(/\s+/gu, " ").trim();
}

function tokens(value: string): Set<string> {
  const stopWords = new Set(["actuel", "actuelle", "ancien", "ancienne", "local", "locale", "personnel", "personnelle"]);
  return new Set(normalize(value).split(" ").filter(token => token.length > 2 && !stopWords.has(token)));
}

function tokenScore(left: Set<string>, right: Set<string>): number {
  let score = 0;
  for (const token of left) if (right.has(token)) score += 1;
  return score;
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
