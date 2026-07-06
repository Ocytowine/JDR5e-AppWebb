import { parseDocument } from "yaml";
import {
  canonicalizeJson,
  cloneJson,
  computeJsonFingerprint
} from "../../core/canonical-json/canonicalJson";
import { validateLoreAuthorEntityV1 } from "./validateLoreAuthoring";
import type {
  CompileLoreCorpusOptionsV1,
  CompileLoreCorpusResultV1,
  CompileLoreSourceOptionsV1,
  CompileLoreSourceResultV1,
  CompiledLoreSourceV1,
  ContentEntryDescriptorV1,
  HistoricalEventLoreAuthorV1,
  HistoricalPeriodLoreAuthorV1,
  BuildingLoreAuthorV1,
  CityLoreAuthorV1,
  DistrictLoreAuthorV1,
  FactionLoreAuthorV1,
  RegionLoreAuthorV1,
  LoreAuthorEntityV1,
  LoreCompilationDiagnosticCodeV1,
  LoreCompilationDiagnosticV1,
  LoreEntityV1,
  LoreFragmentV1,
  LoreKnowledgeLevelV1,
  LoreRelationV1,
  LoreSourceInputV1,
  NpcLoreAuthorV1,
  Sha256Fingerprint,
  SpeciesLoreAuthorV1,
  CultureLoreAuthorV1
} from "./types";

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/;
const CLASSIFIED_HEADING = /^#{2,6}\s+\[(COMMUN|LOCAL|SPECIALISE|RESTREINT|MJ_SECRET)\]\s+(.+?)\s*$/;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map(normalizeText).filter(Boolean))].sort(compareText);
}

function diagnostic(
  code: LoreCompilationDiagnosticCodeV1,
  severity: "ERROR" | "WARNING",
  sourcePath: string,
  jsonPath: string,
  messageKey: string,
  details: Record<string, unknown> = {}
): LoreCompilationDiagnosticV1 {
  return { code, severity, sourcePath, jsonPath, messageKey, details };
}

function sortDiagnostics(values: LoreCompilationDiagnosticV1[]): LoreCompilationDiagnosticV1[] {
  return values.sort((left, right) =>
    compareText(left.sourcePath, right.sourcePath) ||
    compareText(left.jsonPath, right.jsonPath) ||
    compareText(left.code, right.code)
  );
}

function normalizeSourcePath(value: string): string | null {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//, "");
  const segments = normalized.split("/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:/.test(normalized) ||
    segments.some(segment => !segment || segment === "." || segment === "..")
  ) return null;
  return normalized;
}

async function computeSourceFingerprint(sourceText: string): Promise<Sha256Fingerprint> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(sourceText));
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  return `sha256:${hex}`;
}

function parseAuthorSource(
  sourceText: string,
  sourcePath: string
): { author: LoreAuthorEntityV1; body: string } | { diagnostics: LoreCompilationDiagnosticV1[] } {
  const match = sourceText.match(FRONT_MATTER);
  if (!match) {
    return { diagnostics: [diagnostic(
      "WIKI_FRONT_MATTER_MISSING",
      "ERROR",
      sourcePath,
      "/",
      "lore.front-matter.missing"
    )] };
  }

  const document = parseDocument(match[1], {
    schema: "core",
    strict: true,
    uniqueKeys: true
  });
  if (document.errors.length > 0) {
    return { diagnostics: document.errors.map(error => diagnostic(
      "WIKI_YAML_INVALID",
      "ERROR",
      sourcePath,
      "/",
      "lore.yaml.invalid",
      { message: error.message }
    )) };
  }

  let value: unknown;
  try {
    value = document.toJS({ maxAliasCount: 0 });
  } catch (error) {
    return { diagnostics: [diagnostic(
      "WIKI_YAML_INVALID",
      "ERROR",
      sourcePath,
      "/",
      "lore.yaml.unsafe-alias",
      { message: error instanceof Error ? error.message : String(error) }
    )] };
  }

  if (
    value &&
    typeof value === "object" &&
    "schema_version" in value &&
    (value as { schema_version?: unknown }).schema_version !== 1
  ) {
    return { diagnostics: [diagnostic(
      "WIKI_SCHEMA_VERSION_UNSUPPORTED",
      "ERROR",
      sourcePath,
      "/schema_version",
      "lore.schema-version.unsupported",
      { received: (value as { schema_version?: unknown }).schema_version }
    )] };
  }

  const validation = validateLoreAuthorEntityV1(value);
  if (!validation.valid) {
    return { diagnostics: validation.issues.map(issue => diagnostic(
      "WIKI_INVALID_VALUE",
      "ERROR",
      sourcePath,
      issue.startsWith("/") ? issue.split(" ")[0] : "/",
      "lore.authoring.invalid",
      { issue }
    )) };
  }
  return { author: validation.value, body: match[2].trim() };
}

function relation(
  relationName: string,
  targetId: string,
  targetType: string | null
): LoreRelationV1 {
  return {
    relation: relationName,
    targetId,
    targetType,
    strength: targetId.startsWith("external:") ? "OPTIONAL" : "REQUIRED"
  };
}

function speciesRelations(author: SpeciesLoreAuthorV1): LoreRelationV1[] {
  const values: LoreRelationV1[] = [];
  if (author.catalogue_mecanique) {
    values.push(relation(
      "catalogue_mecanique",
      author.catalogue_mecanique.entry_id,
      `GAME_CATALOG_ENTRY:${author.catalogue_mecanique.entry_kind}`
    ));
  }
  author.langues.forEach(target => values.push(relation("langue", target, "GAME_CATALOG_ENTRY:language")));
  author.cultures_associees.forEach(target => values.push(relation("culture_associee", target, "culture")));
  author.regions_presence.forEach(entry => values.push(relation("presence_regionale", entry.region, "region")));
  return values;
}

function cultureRelations(author: CultureLoreAuthorV1): LoreRelationV1[] {
  const values: LoreRelationV1[] = [];
  author.especes_associees.forEach(target => values.push(relation("espece_associee", target, "espece")));
  author.zones_associees.forEach(target => values.push(relation("zone_associee", target, null)));
  author.langues.forEach(target => values.push(relation("langue", target, "GAME_CATALOG_ENTRY:language")));
  author.relations_factions.forEach(target => values.push(relation("faction_liee", target, "faction")));
  return values;
}

function npcRelations(author: NpcLoreAuthorV1): LoreRelationV1[] {
  const values = [
    relation("espece", author.espece, "espece"),
    relation("lieu_initial", author.lieu_initial, null)
  ];
  if (author.culture) values.push(relation("culture", author.culture, "culture"));
  author.factions.forEach(target => values.push(relation("faction", target, "faction")));
  author.relations_initiales.forEach(entry => values.push(relation("relation_pnj", entry.pnj, "pnj")));
  author.connaissances_initiales.forEach(entry => values.push(relation("connaissance_initiale", entry.entity, null)));
  return values;
}

function periodRelations(author: HistoricalPeriodLoreAuthorV1): LoreRelationV1[] {
  const values: LoreRelationV1[] = [];
  if (author.periode_parente) values.push(relation("periode_parente", author.periode_parente, "periode_historique"));
  author.territoires.forEach(target => values.push(relation("territoire", target, null)));
  author.cultures.forEach(target => values.push(relation("culture", target, "culture")));
  author.evenements_majeurs.forEach(target => values.push(relation("evenement_majeur", target, "evenement_historique")));
  return values;
}

function eventRelations(author: HistoricalEventLoreAuthorV1): LoreRelationV1[] {
  const values: LoreRelationV1[] = [];
  if (author.periode) values.push(relation("periode", author.periode, "periode_historique"));
  author.lieux.forEach(target => values.push(relation("lieu", target, null)));
  author.participants.forEach(target => values.push(relation("participant", target, null)));
  author.causes.forEach(entry => values.push(relation("cause", entry.evenement, "evenement_historique")));
  return values;
}

function regionRelations(author: RegionLoreAuthorV1): LoreRelationV1[] {
  const values = [relation("territoire", author.territoire, null)];
  if (author.autorite_locale) values.push(relation("autorite_locale", author.autorite_locale, null));
  author.villes_principales.forEach(target => values.push(relation("ville_principale", target, "ville")));
  author.lieux_remarquables.forEach(target => values.push(relation("lieu_remarquable", target, null)));
  author.factions_actives.forEach(target => values.push(relation("faction_active", target, "faction")));
  return values;
}

function cityRelations(author: CityLoreAuthorV1): LoreRelationV1[] {
  const values = [
    relation("territoire", author.territoire, null),
    relation("region", author.region, "region"),
    relation("siege_pouvoir", author.siege_pouvoir, "batiment")
  ];
  author.quartiers.forEach(target => values.push(relation("quartier", target, "quartier")));
  author.batiments_importants.forEach(target => values.push(relation("batiment_important", target, "batiment")));
  author.factions_presentes.forEach(target => values.push(relation("faction_presente", target, "faction")));
  author.religions_principales.forEach(target => values.push(relation("religion_principale", target, null)));
  author.liaisons.forEach(target => values.push(relation("liaison", target, null)));
  return values;
}

function districtRelations(author: DistrictLoreAuthorV1): LoreRelationV1[] {
  return [
    relation("territoire", author.territoire, null),
    relation("region", author.region, "region"),
    relation("ville", author.ville, "ville")
  ];
}

function buildingRelations(author: BuildingLoreAuthorV1): LoreRelationV1[] {
  const values = [
    relation("territoire", author.territoire, null),
    relation("region", author.region, "region"),
    relation("ville", author.ville, "ville"),
    relation("quartier", author.quartier, "quartier"),
    relation("proprietaire_faction", author.proprietaire_faction, "faction")
  ];
  author.lieux_connectes.forEach(target => values.push(relation("lieu_connecte", target, null)));
  author.factions_residentes?.forEach(target => values.push(relation("faction_residente", target, "faction")));
  return values;
}

function factionRelations(author: FactionLoreAuthorV1): LoreRelationV1[] {
  return [
    relation("territoire", author.territoire, null),
    relation("region", author.region, "region"),
    relation("ville", author.ville, "ville"),
    relation("autorite_tutelle", author.autorite_tutelle, null),
    relation("siege_pouvoir", author.siege_pouvoir, "batiment")
  ];
}

function buildRelations(author: LoreAuthorEntityV1): LoreRelationV1[] {
  let values: LoreRelationV1[];
  switch (author.type) {
    case "royaume": values = []; break;
    case "territoire": values = []; break;
    case "region": values = regionRelations(author); break;
    case "ville": values = cityRelations(author); break;
    case "quartier": values = districtRelations(author); break;
    case "batiment": values = buildingRelations(author); break;
    case "faction": values = factionRelations(author); break;
    case "meta": values = []; break;
    case "espece": values = speciesRelations(author); break;
    case "culture": values = cultureRelations(author); break;
    case "pnj": values = npcRelations(author); break;
    case "periode_historique": values = periodRelations(author); break;
    case "evenement_historique": values = eventRelations(author); break;
  }
  author.informations.forEach(information => {
    information.entites_liees.forEach(target => values.push(relation("information_liee", target, null)));
  });
  const deduplicated = new Map<string, LoreRelationV1>();
  values.forEach(value => deduplicated.set(
    `${value.relation}\u0000${value.targetType ?? ""}\u0000${value.targetId}`,
    value
  ));
  return [...deduplicated.values()].sort((left, right) =>
    compareText(left.relation, right.relation) ||
    compareText(left.targetType ?? "", right.targetType ?? "") ||
    compareText(left.targetId, right.targetId)
  );
}

function buildEntity(
  author: LoreAuthorEntityV1,
  body: string,
  provenance: LoreEntityV1["provenance"]
): LoreEntityV1 {
  const {
    schema_version: _schemaVersion,
    type: _type,
    id: _id,
    nom: _name,
    ...attributes
  } = author;
  return {
    schemaVersion: 1,
    entityId: author.id,
    entityType: author.type,
    displayName: author.nom,
    attributes: cloneJson(attributes) as unknown as LoreEntityV1["attributes"],
    relations: buildRelations(author),
    searchTerms: uniqueSorted([author.nom, ...author.aliases, ...author.mots_cles]),
    body,
    provenance
  };
}

interface FragmentDraft {
  fieldPath: string;
  text: string;
  knowledgeLevel: LoreKnowledgeLevelV1;
  relatedEntityIds: string[];
  topics: string[];
  tags: string[];
}

function renderList(values: readonly string[]): string {
  return values.map(normalizeText).filter(Boolean).join("; ");
}

function structuredFragmentDrafts(author: LoreAuthorEntityV1): FragmentDraft[] {
  const drafts: FragmentDraft[] = [];
  const add = (fieldPath: string, text: string, knowledgeLevel: LoreKnowledgeLevelV1) => {
    const normalized = normalizeText(text);
    if (normalized) drafts.push({ fieldPath, text: normalized, knowledgeLevel, relatedEntityIds: [], topics: [], tags: [] });
  };
  if (author.type === "espece") {
    add("/apparence_observable", renderList(author.apparence_observable), "COMMUN");
    add("/biologie/particularites", renderList(author.biologie.particularites), "COMMUN");
  } else if (author.type === "culture") {
    add("/valeurs", renderList(author.valeurs), "LOCAL");
    add("/coutumes", renderList(author.coutumes), "LOCAL");
    add("/organisation_sociale", renderList(author.organisation_sociale), "LOCAL");
    add("/esthetique", renderList(author.esthetique), "LOCAL");
  } else if (author.type === "pnj") {
    add("/apparence", renderList(author.apparence), "LOCAL");
    add("/expression", canonicalizeJson(author.expression), "RESTREINT");
    add("/motivations_initiales", renderList(author.motivations_initiales), "MJ_SECRET");
    add("/objectifs_initiaux", renderList(author.objectifs_initiaux), "MJ_SECRET");
  } else if (author.type === "periode_historique") {
    add("/caracteristiques", renderList(author.caracteristiques), "SPECIALISE");
  } else if (author.type === "evenement_historique") {
    add("/consequences", renderList(author.consequences), "COMMUN");
  } else if (author.type === "region") {
    add("/climat", author.climat, "COMMUN");
    add("/relief", renderList(author.relief), "COMMUN");
    add("/peuples_present", renderList(author.peuples_present), "LOCAL");
    add("/ressources", renderList(author.ressources), "LOCAL");
    add("/activites", renderList(author.activites), "LOCAL");
  } else if (author.type === "ville") {
    add("/climat", author.climat, "COMMUN");
    add("/particularites_env", renderList(author.particularites_env), "LOCAL");
    add("/composition_population", renderList(author.composition_population), "LOCAL");
  } else if (author.type === "batiment") {
    add("/fonction_principale", renderList(author.fonction_principale), "LOCAL");
    add("/rumeurs", renderList(author.rumeurs), "LOCAL");
  } else if (author.type === "faction") {
    add("/role_dans_la_ville", renderList(author.role_dans_la_ville), "LOCAL");
    add("/ideologie", renderList(author.ideologie), "SPECIALISE");
    add("/traits_identifiants", renderList(author.traits_identifiants), "LOCAL");
    add("/signe_distinctif", renderList(author.signe_distinctif), "LOCAL");
  }
  return drafts;
}

function slugHeading(value: string): string {
  return value.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "section";
}

function classifiedBodyDrafts(
  body: string,
  sourcePath: string
): { drafts: FragmentDraft[]; diagnostics: LoreCompilationDiagnosticV1[] } {
  if (!body.trim()) return { drafts: [], diagnostics: [] };
  const drafts: FragmentDraft[] = [];
  const diagnostics: LoreCompilationDiagnosticV1[] = [];
  const lines = body.split(/\r?\n/);
  let current: { level: LoreKnowledgeLevelV1; title: string; lines: string[] } | null = null;
  let unclassified = false;

  const flush = () => {
    if (!current) return;
    const text = normalizeText(current.lines.join(" "));
    if (text) drafts.push({
      fieldPath: `/body/${slugHeading(current.title)}`,
      text,
      knowledgeLevel: current.level,
      relatedEntityIds: [],
      topics: [normalizeText(current.title)],
      tags: []
    });
  };

  for (const line of lines) {
    const heading = line.match(CLASSIFIED_HEADING);
    if (heading) {
      flush();
      current = { level: heading[1] as LoreKnowledgeLevelV1, title: heading[2], lines: [] };
      continue;
    }
    if (/^#{2,6}\s+/.test(line)) {
      flush();
      current = null;
      unclassified = true;
      continue;
    }
    if (current) current.lines.push(line);
    else if (line.trim()) unclassified = true;
  }
  flush();

  if (unclassified) diagnostics.push(diagnostic(
    "WIKI_BODY_UNCLASSIFIED",
    "WARNING",
    sourcePath,
    "/body",
    "lore.body.unclassified"
  ));
  return { drafts, diagnostics };
}

async function buildFragments(
  author: LoreAuthorEntityV1,
  entity: LoreEntityV1,
  sourcePath: string
): Promise<{ fragments: LoreFragmentV1[]; diagnostics: LoreCompilationDiagnosticV1[] }> {
  const relationIds = uniqueSorted(entity.relations
    .filter(value => value.relation !== "information_liee")
    .map(value => value.targetId));
  const commonTags = uniqueSorted(author.mots_cles);
  const body = classifiedBodyDrafts(entity.body, sourcePath);
  const drafts: FragmentDraft[] = [{
    fieldPath: "/resume",
    text: normalizeText(author.resume),
    knowledgeLevel: "COMMUN",
    relatedEntityIds: relationIds,
    topics: uniqueSorted([author.nom, ...author.aliases]),
    tags: commonTags
  }, ...structuredFragmentDrafts(author)];

  author.informations.forEach(information => drafts.push({
    fieldPath: `/informations/${information.id}`,
    text: normalizeText(information.texte),
    knowledgeLevel: information.niveau,
    relatedEntityIds: uniqueSorted(information.entites_liees),
    topics: uniqueSorted(information.sujets),
    tags: commonTags
  }));
  drafts.push(...body.drafts);

  const seenPaths = new Set<string>();
  for (const draft of drafts) {
    if (seenPaths.has(draft.fieldPath)) body.diagnostics.push(diagnostic(
      "WIKI_INVALID_VALUE",
      "ERROR",
      sourcePath,
      draft.fieldPath,
      "lore.fragment-path.duplicate"
    ));
    seenPaths.add(draft.fieldPath);
  }

  const fragments = await Promise.all(drafts.map(async draft => {
    const fingerprint = await computeJsonFingerprint({ entityId: author.id, fieldPath: draft.fieldPath });
    return {
      schemaVersion: 1 as const,
      fragmentId: `fragment.${fingerprint.slice("sha256:".length, "sha256:".length + 32)}`,
      entityId: author.id,
      fieldPath: draft.fieldPath,
      text: draft.text,
      tags: uniqueSorted([...commonTags, ...draft.tags]),
      knowledgeLevel: draft.knowledgeLevel,
      relatedEntityIds: uniqueSorted(draft.relatedEntityIds),
      topics: uniqueSorted(draft.topics),
      provenance: entity.provenance
    } satisfies LoreFragmentV1;
  }));
  fragments.sort((left, right) => compareText(left.fieldPath, right.fieldPath));
  return { fragments, diagnostics: body.diagnostics };
}

function descriptorReferences(relations: LoreRelationV1[]): ContentEntryDescriptorV1["references"] {
  return relations.map(value => ({
    targetId: value.targetId,
    relation: value.relation,
    strength: value.strength
  })).sort((left, right) =>
    compareText(left.relation, right.relation) || compareText(left.targetId, right.targetId)
  );
}

export async function compileLoreSourceV1(
  input: LoreSourceInputV1,
  options: CompileLoreSourceOptionsV1
): Promise<CompileLoreSourceResultV1> {
  const sourcePath = normalizeSourcePath(input.sourcePath);
  if (!sourcePath) return { ok: false, diagnostics: [diagnostic(
    "WIKI_SOURCE_PATH_INVALID",
    "ERROR",
    input.sourcePath,
    "/",
    "lore.source-path.invalid"
  )] };

  const parsed = parseAuthorSource(input.sourceText, sourcePath);
  if ("diagnostics" in parsed) return { ok: false, diagnostics: sortDiagnostics(parsed.diagnostics) };

  const sourceFingerprint = await computeSourceFingerprint(input.sourceText);
  const provenance = {
    packageId: options.packageId,
    packageVersion: options.packageVersion,
    sourcePath,
    sourceFingerprint
  } as const;
  const entity = buildEntity(parsed.author, parsed.body, provenance);
  const fragmentResult = await buildFragments(parsed.author, entity, sourcePath);
  if (fragmentResult.diagnostics.some(value => value.severity === "ERROR")) {
    return { ok: false, diagnostics: sortDiagnostics(fragmentResult.diagnostics) };
  }
  const descriptor: ContentEntryDescriptorV1 = {
    entryId: entity.entityId,
    entryKind: "LORE_ENTITY",
    entityType: entity.entityType,
    payloadSchemaVersion: 1,
    sourcePath,
    sourceFingerprint,
    payloadFingerprint: await computeJsonFingerprint(entity) as Sha256Fingerprint,
    references: descriptorReferences(entity.relations)
  };
  return {
    ok: true,
    value: {
      author: parsed.author,
      entity,
      fragments: fragmentResult.fragments,
      descriptor,
      diagnostics: sortDiagnostics(fragmentResult.diagnostics)
    }
  };
}

function resolveRelations(
  sources: CompiledLoreSourceV1[],
  options: CompileLoreCorpusOptionsV1
): LoreCompilationDiagnosticV1[] {
  const byId = new Map(sources.map(source => [source.entity.entityId, source]));
  const diagnostics: LoreCompilationDiagnosticV1[] = [];
  for (const source of sources) {
    for (const value of source.entity.relations) {
      if (value.targetId.startsWith("external:")) continue;
      if (value.targetType?.startsWith("GAME_CATALOG_ENTRY:")) {
        const kind = value.targetType.slice("GAME_CATALOG_ENTRY:".length);
        if (!options.catalogEntries?.has(`${kind}:${value.targetId}`)) diagnostics.push(diagnostic(
          "WIKI_REFERENCE_MISSING",
          "ERROR",
          source.entity.provenance.sourcePath,
          "/relations",
          "lore.catalog-reference.missing",
          { relation: value.relation, targetId: value.targetId, targetType: value.targetType }
        ));
        continue;
      }
      const target = byId.get(value.targetId);
      if (!target) {
        diagnostics.push(diagnostic(
          "WIKI_REFERENCE_MISSING",
          "ERROR",
          source.entity.provenance.sourcePath,
          "/relations",
          "lore.reference.missing",
          { relation: value.relation, targetId: value.targetId, targetType: value.targetType }
        ));
      } else if (value.targetType && target.entity.entityType !== value.targetType) {
        diagnostics.push(diagnostic(
          "WIKI_REFERENCE_TYPE_MISMATCH",
          "ERROR",
          source.entity.provenance.sourcePath,
          "/relations",
          "lore.reference.type-mismatch",
          { expected: value.targetType, received: target.entity.entityType, targetId: value.targetId }
        ));
      }
    }
    if (source.author.type === "pnj") {
      source.author.connaissances_initiales.forEach((knowledge, index) => {
        const targetSource = byId.get(knowledge.entity);
        if (
          targetSource &&
          !targetSource.author.informations.some(information => information.id === knowledge.information_id)
        ) diagnostics.push(diagnostic(
          "WIKI_KNOWLEDGE_TARGET_MISSING",
          "ERROR",
          source.entity.provenance.sourcePath,
          `/connaissances_initiales/${index}/information_id`,
          "lore.knowledge-target.missing",
          { entityId: knowledge.entity, informationId: knowledge.information_id }
        ));
      });
    }
  }
  return diagnostics;
}

export async function compileLoreCorpusV1(
  inputs: LoreSourceInputV1[],
  options: CompileLoreCorpusOptionsV1
): Promise<CompileLoreCorpusResultV1> {
  const compiledResults = await Promise.all(inputs.map(input => compileLoreSourceV1(input, options)));
  const diagnostics = compiledResults.flatMap(result => result.ok ? result.value.diagnostics : result.diagnostics);
  if (compiledResults.some(result => !result.ok)) {
    return { ok: false, diagnostics: sortDiagnostics(diagnostics) };
  }
  const sources = compiledResults.flatMap(result => result.ok ? [result.value] : []);
  const byId = new Map<string, CompiledLoreSourceV1>();
  for (const source of sources) {
    const existing = byId.get(source.entity.entityId);
    if (existing) diagnostics.push(diagnostic(
      "WIKI_DUPLICATE_ID",
      "ERROR",
      source.entity.provenance.sourcePath,
      "/id",
      "lore.entity-id.duplicate",
      { entityId: source.entity.entityId, firstSourcePath: existing.entity.provenance.sourcePath }
    ));
    else byId.set(source.entity.entityId, source);
  }
  diagnostics.push(...resolveRelations(sources, options));
  if (diagnostics.some(value => value.severity === "ERROR")) {
    return { ok: false, diagnostics: sortDiagnostics(diagnostics) };
  }

  const descriptors = sources.map(source => source.descriptor).sort((left, right) =>
    compareText(left.entryKind, right.entryKind) ||
    compareText(left.entityType, right.entityType) ||
    compareText(left.entryId, right.entryId)
  );
  const manifestWithoutFingerprint = {
    schemaVersion: 1 as const,
    packageId: options.packageId,
    packageVersion: options.packageVersion,
    minimumRuntimeContract: "campaign-bootstrap/2" as const,
    entries: descriptors
  };
  const manifest = {
    ...manifestWithoutFingerprint,
    rootFingerprint: await computeJsonFingerprint(manifestWithoutFingerprint) as Sha256Fingerprint
  };
  const entities = sources.map(source => source.entity)
    .sort((left, right) => compareText(left.entityType, right.entityType) || compareText(left.entityId, right.entityId));
  const fragments = sources.flatMap(source => source.fragments)
    .sort((left, right) => compareText(left.entityId, right.entityId) || compareText(left.fieldPath, right.fieldPath));
  return {
    ok: true,
    value: {
      manifest,
      entities,
      fragments,
      diagnostics: sortDiagnostics(diagnostics)
    }
  };
}

export function partitionLoreFragmentsBySecrecy(fragments: LoreFragmentV1[]): {
  indexable: LoreFragmentV1[];
  secret: LoreFragmentV1[];
} {
  return {
    indexable: fragments.filter(fragment => fragment.knowledgeLevel !== "MJ_SECRET"),
    secret: fragments.filter(fragment => fragment.knowledgeLevel === "MJ_SECRET")
  };
}
