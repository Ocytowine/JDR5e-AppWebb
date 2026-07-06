import { canonicalizeJson, cloneJson, computeJsonFingerprint, computeRequestFingerprint } from "../../core/canonical-json/canonicalJson";
import type {
  AggregateRecord,
  CampaignClockPayload,
  CampaignRecord,
  EventRecord,
  JsonObject,
  OperationRecord
} from "../../core/contracts/types";
import { importLegacyCharacterV1 } from "../character/importLegacyCharacter";
import type { CharacterImportResultV1 } from "../character/types";
import type { LoreEntityV1, Sha256Fingerprint } from "../lore/types";
import type { CampaignBootstrapRepository } from "../persistence/CampaignBootstrapRepository";
import type { CampaignBootstrapPersistenceRequestV1 } from "../persistence/types";
import { loadRuleRegistryV1, type RuleRegistryV1 } from "../rules/RuleRegistry";
import type {
  CampaignBootstrapDiagnosticCodeV1,
  CampaignBootstrapDiagnosticV1,
  CampaignBootstrapInputV1,
  CampaignBootstrapOutcomeV1,
  ContentPackageResolverV1,
  ResolvedContentPackageV1,
  RulesetResolverV1
} from "./types";

const LOCATION_TYPES = new Set(["royaume", "territoire", "region", "ville", "quartier", "batiment"]);
const INPUT_KEYS = [
  "schemaVersion", "ids", "contentPackageId", "contentPackageVersion", "rulesetId", "rulesetVersion",
  "calendarId", "calendarVersion", "initialLocationId", "character", "requestedAt"
].sort();

function add(
  diagnostics: CampaignBootstrapDiagnosticV1[],
  code: CampaignBootstrapDiagnosticCodeV1,
  path: string,
  details: Record<string, unknown> = {}
): void {
  diagnostics.push({ code, path, details });
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function contentKey(kind: string, id: string): string {
  return `${kind}\u0000${id}`;
}

async function sourceFingerprint(sourceText: string): Promise<Sha256Fingerprint> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(sourceText));
  return `sha256:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

function asPayload(value: unknown): JsonObject {
  return cloneJson(value) as JsonObject;
}

function validateInput(input: CampaignBootstrapInputV1): CampaignBootstrapDiagnosticV1[] {
  const diagnostics: CampaignBootstrapDiagnosticV1[] = [];
  try {
    canonicalizeJson(input);
  } catch (error) {
    add(diagnostics, "BOOTSTRAP_INPUT_INVALID", "/", { issue: error instanceof Error ? error.message : "invalid JSON" });
    return diagnostics;
  }
  if (!input || typeof input !== "object" || Object.keys(input).sort().join("|") !== INPUT_KEYS.join("|") || input.schemaVersion !== 1) {
    add(diagnostics, "BOOTSTRAP_INPUT_INVALID", "/", { issue: "invalid envelope" });
    return diagnostics;
  }
  if (!Number.isInteger(input.contentPackageVersion) || input.contentPackageVersion < 1 ||
      !Number.isInteger(input.rulesetVersion) || input.rulesetVersion < 1 ||
      !Number.isInteger(input.calendarVersion) || input.calendarVersion < 1) {
    add(diagnostics, "BOOTSTRAP_INPUT_INVALID", "/", { issue: "versions must be positive integers" });
  }
  if (!Number.isFinite(Date.parse(input.requestedAt)) || new Date(input.requestedAt).toISOString() !== input.requestedAt) {
    add(diagnostics, "BOOTSTRAP_INPUT_INVALID", "/requestedAt", { issue: "canonical UTC instant required" });
  }
  const ids = Object.values(input.ids);
  if (ids.some(value => typeof value !== "string" || value.length < 3) || new Set(ids).size !== ids.length) {
    add(diagnostics, "BOOTSTRAP_INPUT_INVALID", "/ids", { issue: "identities must be non-empty and unique" });
  }
  return diagnostics;
}

async function validateContentPackage(
  resolved: ResolvedContentPackageV1,
  expectedId: string,
  expectedVersion: number
): Promise<CampaignBootstrapDiagnosticV1[]> {
  const diagnostics: CampaignBootstrapDiagnosticV1[] = [];
  const manifest = resolved.manifest;
  if (
    manifest.schemaVersion !== 1 || manifest.packageId !== expectedId || manifest.packageVersion !== expectedVersion ||
    manifest.minimumRuntimeContract !== "campaign-bootstrap/2"
  ) add(diagnostics, "BOOTSTRAP_CONTENT_MANIFEST_INVALID", "/content/manifest", { packageId: manifest.packageId, packageVersion: manifest.packageVersion });
  const sortedDescriptors = [...manifest.entries].sort((left, right) =>
    compare(left.entryKind, right.entryKind) || compare(left.entityType, right.entityType) || compare(left.entryId, right.entryId));
  const actualRoot = await computeJsonFingerprint({
    schemaVersion: manifest.schemaVersion,
    packageId: manifest.packageId,
    packageVersion: manifest.packageVersion,
    minimumRuntimeContract: manifest.minimumRuntimeContract,
    entries: sortedDescriptors
  });
  if (actualRoot !== manifest.rootFingerprint) add(diagnostics, "BOOTSTRAP_CONTENT_MANIFEST_INVALID", "/content/manifest/rootFingerprint", {
    expected: manifest.rootFingerprint, actual: actualRoot
  });
  const descriptorByKey = new Map<string, typeof manifest.entries[number]>();
  manifest.entries.forEach((descriptor, index) => {
    const key = contentKey(descriptor.entryKind, descriptor.entryId);
    if (descriptorByKey.has(key)) add(diagnostics, "BOOTSTRAP_CONTENT_MANIFEST_INVALID", `/content/manifest/entries/${index}`, { issue: "duplicate descriptor", entryId: descriptor.entryId });
    descriptorByKey.set(key, descriptor);
  });
  const resolvedByKey = new Map(resolved.entries.map(entry => [contentKey(entry.entryKind, entry.entryId), entry]));
  for (const [key, descriptor] of descriptorByKey) {
    const entry = resolvedByKey.get(key);
    if (!entry) {
      add(diagnostics, "BOOTSTRAP_CONTENT_ENTRY_MISSING", "/content/entries", { entryId: descriptor.entryId, entryKind: descriptor.entryKind });
      continue;
    }
    const [actualSource, actualPayload] = await Promise.all([
      sourceFingerprint(entry.sourceText),
      computeJsonFingerprint(entry.payload)
    ]);
    if (actualSource !== descriptor.sourceFingerprint || actualPayload !== descriptor.payloadFingerprint) {
      add(diagnostics, "BOOTSTRAP_CONTENT_FINGERPRINT_MISMATCH", "/content/entries", {
        entryId: descriptor.entryId,
        expectedSource: descriptor.sourceFingerprint,
        actualSource,
        expectedPayload: descriptor.payloadFingerprint,
        actualPayload
      });
    }
  }
  for (const key of resolvedByKey.keys()) {
    if (!descriptorByKey.has(key)) add(diagnostics, "BOOTSTRAP_CONTENT_MANIFEST_INVALID", "/content/entries", { issue: "undeclared resolved entry", key });
  }
  const loreById = new Map<string, LoreEntityV1>();
  resolved.loreEntities.forEach((entity, index) => {
    if (loreById.has(entity.entityId)) {
      add(diagnostics, "BOOTSTRAP_CONTENT_MANIFEST_INVALID", `/content/loreEntities/${index}`, {
        issue: "duplicate lore entity", entityId: entity.entityId
      });
    }
    loreById.set(entity.entityId, entity);
    const entry = resolvedByKey.get(contentKey("LORE_ENTITY", entity.entityId));
    if (!entry || canonicalizeJson(entry.payload) !== canonicalizeJson(entity)) {
      add(diagnostics, "BOOTSTRAP_CONTENT_FINGERPRINT_MISMATCH", `/content/loreEntities/${index}`, {
        issue: "lore projection differs from its declared payload", entityId: entity.entityId
      });
    }
    const descriptor = descriptorByKey.get(contentKey("LORE_ENTITY", entity.entityId));
    if (descriptor && (
      entity.provenance.packageId !== manifest.packageId ||
      entity.provenance.packageVersion !== manifest.packageVersion ||
      entity.provenance.sourcePath !== descriptor.sourcePath ||
      entity.provenance.sourceFingerprint !== descriptor.sourceFingerprint
    )) {
      add(diagnostics, "BOOTSTRAP_CONTENT_FINGERPRINT_MISMATCH", `/content/loreEntities/${index}/provenance`, {
        issue: "lore provenance differs from its descriptor", entityId: entity.entityId
      });
    }
  });
  manifest.entries.filter(entry => entry.entryKind === "LORE_ENTITY").forEach(descriptor => {
    if (!loreById.has(descriptor.entryId)) {
      add(diagnostics, "BOOTSTRAP_CONTENT_ENTRY_MISSING", "/content/loreEntities", {
        entryId: descriptor.entryId, entryKind: descriptor.entryKind
      });
    }
  });
  const catalogIds = new Set(manifest.entries.filter(entry => entry.entryKind === "GAME_CATALOG_ENTRY").map(entry => entry.entryId));
  const catalog = resolved.characterCatalog;
  const referencedCatalogIds = [
    ...catalog.races, ...catalog.backgrounds, ...catalog.languages, ...catalog.classes.keys(),
    ...catalog.subclasses.keys(), ...catalog.items.keys(), ...catalog.actions, ...catalog.reactions,
    ...catalog.spells, ...catalog.features
  ];
  referencedCatalogIds.forEach(id => {
    if (!catalogIds.has(id)) add(diagnostics, "BOOTSTRAP_CONTENT_ENTRY_MISSING", "/content/characterCatalog", { entryId: id, entryKind: "GAME_CATALOG_ENTRY" });
  });
  return diagnostics;
}

function geographicChain(entities: LoreEntityV1[], initialId: string): {
  chain: string[];
  diagnostics: CampaignBootstrapDiagnosticV1[];
} {
  const diagnostics: CampaignBootstrapDiagnosticV1[] = [];
  const byId = new Map(entities.map(entity => [entity.entityId, entity]));
  const initial = byId.get(initialId);
  if (!initial) {
    add(diagnostics, "BOOTSTRAP_LOCATION_MISSING", "/initialLocationId", { initialLocationId: initialId });
    return { chain: [], diagnostics };
  }
  if (!LOCATION_TYPES.has(initial.entityType)) {
    add(diagnostics, "BOOTSTRAP_LOCATION_TYPE_INVALID", "/initialLocationId", { entityType: initial.entityType });
    return { chain: [], diagnostics };
  }
  const parentRelations: Record<string, string[]> = {
    batiment: ["quartier", "ville"], quartier: ["ville"], ville: ["region"],
    region: ["territoire"], territoire: ["royaume"], royaume: []
  };
  const chain: string[] = [];
  const seen = new Set<string>();
  let current: LoreEntityV1 | undefined = initial;
  while (current) {
    if (seen.has(current.entityId)) {
      add(diagnostics, "BOOTSTRAP_LOCATION_CHAIN_INVALID", "/initialLocationId", { issue: "cycle", entityId: current.entityId });
      break;
    }
    seen.add(current.entityId);
    chain.push(current.entityId);
    const allowed = parentRelations[current.entityType] ?? [];
    if (allowed.length === 0) break;
    const relation = allowed.flatMap(name => current!.relations.filter(value => value.relation === name)).at(0);
    if (!relation) {
      add(diagnostics, "BOOTSTRAP_LOCATION_CHAIN_INVALID", "/initialLocationId", { issue: "parent missing", entityId: current.entityId, expectedRelations: allowed });
      break;
    }
    const parent = byId.get(relation.targetId);
    if (!parent) {
      add(diagnostics, "BOOTSTRAP_LOCATION_CHAIN_INVALID", "/initialLocationId", { issue: "parent unresolved", entityId: current.entityId, targetId: relation.targetId });
      break;
    }
    current = parent;
  }
  return { chain, diagnostics };
}

async function verifyCharacterRules(
  imported: CharacterImportResultV1,
  registry: RuleRegistryV1,
  content: ResolvedContentPackageV1
): Promise<CampaignBootstrapDiagnosticV1[]> {
  const diagnostics: CampaignBootstrapDiagnosticV1[] = [];
  const checks: Array<Promise<{ label: string; outputKey: string; expected: number; result: Awaited<ReturnType<RuleRegistryV1["execute"]>> }>> = [];
  Object.entries(imported.character.abilityScores).forEach(([ability, score]) => {
    checks.push(registry.execute({ ruleId: "core.character.ability-modifier", ruleVersion: 1 }, { score })
      .then(result => ({ label: `abilityModifiers.${ability}`, outputKey: "modifier", expected: imported.tacticalProjection.abilityModifiers[ability as keyof typeof imported.tacticalProjection.abilityModifiers], result })));
  });
  checks.push(registry.execute({ ruleId: "core.character.global-level", ruleVersion: 1 }, {
    classes: imported.character.classes.map(value => ({ level: value.level }))
  }).then(result => ({ label: "level", outputKey: "level", expected: imported.tacticalProjection.level, result })));
  checks.push(registry.execute({ ruleId: "core.character.proficiency-bonus", ruleVersion: 1 }, {
    level: imported.character.globalLevel
  }).then(result => ({ label: "proficiencyBonus", outputKey: "proficiencyBonus", expected: imported.tacticalProjection.proficiencyBonus, result })));
  checks.push(registry.execute({ ruleId: "core.character.maximum-hit-points", ruleVersion: 1 }, {
    constitutionModifier: imported.tacticalProjection.abilityModifiers.CON,
    classes: imported.character.classes.map(value => ({
      level: value.level,
      hitDie: content.characterCatalog.classes.get(value.classId)?.hitDie ?? 0
    }))
  }).then(result => ({ label: "maximumHitPoints", outputKey: "maximumHitPoints", expected: imported.tacticalProjection.maximumHitPoints, result })));
  checks.push(registry.execute({ ruleId: "core.character.armor-class", ruleVersion: 1 }, {
    dexterityModifier: imported.tacticalProjection.abilityModifiers.DEX,
    armors: imported.character.inventory.flatMap(item => {
      const catalogEntry = content.characterCatalog.items.get(item.itemId);
      if (!catalogEntry || catalogEntry.kind !== "armor" || catalogEntry.baseArmorClass === null) return [];
      return [{
        equipped: item.equippedSlot !== null,
        baseArmorClass: catalogEntry.baseArmorClass,
        dexterityCap: catalogEntry.dexterityCap,
        category: catalogEntry.armorCategory
      }];
    }),
    bonuses: []
  }).then(result => ({ label: "armorClass", outputKey: "armorClass", expected: imported.tacticalProjection.armorClass, result })));
  checks.push(registry.execute({ ruleId: "core.character.passive-perception", ruleVersion: 1 }, {
    wisdomModifier: imported.tacticalProjection.abilityModifiers.SAG,
    proficiencyBonus: imported.tacticalProjection.proficiencyBonus,
    proficiencyRank: imported.character.expertise.includes("perception") ? 2 : imported.character.skills.includes("perception") ? 1 : 0
  }).then(result => ({ label: "passivePerception", outputKey: "passivePerception", expected: imported.tacticalProjection.passivePerception, result })));
  for (const check of await Promise.all(checks)) {
    const actual = check.result.ok ? Number(check.result.value.output[check.outputKey]) : Number.NaN;
    if (!check.result.ok || actual !== check.expected) add(diagnostics, "BOOTSTRAP_PROJECTION_RULE_MISMATCH", "/character", {
      field: check.label, expected: check.expected, actual: Number.isNaN(actual) ? null : actual,
      executionCode: check.result.ok ? null : check.result.code
    });
  }
  return diagnostics;
}

export class CampaignBootstrapServiceV1 {
  constructor(
    private readonly contentResolver: ContentPackageResolverV1,
    private readonly rulesetResolver: RulesetResolverV1,
    private readonly repository: CampaignBootstrapRepository
  ) {}

  async bootstrap(input: CampaignBootstrapInputV1): Promise<CampaignBootstrapOutcomeV1> {
    const diagnostics = validateInput(input);
    if (diagnostics.length > 0) return { ok: false, diagnostics };
    const content = await this.contentResolver.resolve(input.contentPackageId, input.contentPackageVersion);
    if (!content) {
      add(diagnostics, "BOOTSTRAP_CONTENT_NOT_FOUND", "/contentPackageId", { packageId: input.contentPackageId, packageVersion: input.contentPackageVersion });
      return { ok: false, diagnostics };
    }
    diagnostics.push(...await validateContentPackage(content, input.contentPackageId, input.contentPackageVersion));
    const resolvedRuleset = await this.rulesetResolver.resolve(input.rulesetId, input.rulesetVersion);
    if (!resolvedRuleset) add(diagnostics, "BOOTSTRAP_RULESET_NOT_FOUND", "/rulesetId", { rulesetId: input.rulesetId, rulesetVersion: input.rulesetVersion });
    if (diagnostics.length > 0 || !resolvedRuleset) return { ok: false, diagnostics };
    if (resolvedRuleset.manifest.rulesetId !== input.rulesetId || resolvedRuleset.manifest.rulesetVersion !== input.rulesetVersion) {
      add(diagnostics, "BOOTSTRAP_RULESET_INVALID", "/ruleset", { issue: "resolved identity mismatch" });
      return { ok: false, diagnostics };
    }
    const registryResult = await loadRuleRegistryV1({
      contentPackageId: input.contentPackageId,
      contentPackageVersion: input.contentPackageVersion,
      manifest: resolvedRuleset.manifest,
      definitions: resolvedRuleset.definitions,
      executors: resolvedRuleset.executors
    });
    if (!registryResult.ok) {
      add(diagnostics, "BOOTSTRAP_RULESET_INVALID", "/ruleset", { diagnostics: registryResult.diagnostics });
      return { ok: false, diagnostics };
    }
    const location = geographicChain(content.loreEntities, input.initialLocationId);
    diagnostics.push(...location.diagnostics);
    if (diagnostics.length > 0) return { ok: false, diagnostics };
    const imported = await importLegacyCharacterV1(input.character, {
      rulesetId: input.rulesetId,
      rulesetVersion: input.rulesetVersion,
      catalog: content.characterCatalog
    });
    if (!imported.ok) {
      add(diagnostics, "BOOTSTRAP_CHARACTER_INVALID", "/character", { diagnostics: imported.diagnostics });
      return { ok: false, diagnostics };
    }
    diagnostics.push(...await verifyCharacterRules(imported.value, registryResult.value, content));
    if (diagnostics.length > 0) return { ok: false, diagnostics };

    const requestPayload: JsonObject = {
      contentPackageId: input.contentPackageId,
      contentPackageVersion: input.contentPackageVersion,
      contentRootFingerprint: content.manifest.rootFingerprint,
      rulesetId: input.rulesetId,
      rulesetVersion: input.rulesetVersion,
      rulesetRootFingerprint: resolvedRuleset.manifest.rootFingerprint,
      characterSourceFingerprint: input.character.sourceFingerprint,
      initialLocationId: input.initialLocationId
    };
    const requestFingerprint = await computeRequestFingerprint("campaign.bootstrap", 1, requestPayload);
    const dependencies = {
      contentPackageId: input.contentPackageId,
      contentPackageVersion: input.contentPackageVersion,
      rulesetId: input.rulesetId,
      rulesetVersion: input.rulesetVersion,
      calendarId: input.calendarId,
      calendarVersion: input.calendarVersion
    };
    const campaign: CampaignRecord = {
      schemaVersion: 1, campaignId: input.ids.campaignId, campaignRevision: 1, status: "ACTIVE",
      clockAggregateId: input.ids.clockAggregateId, dependencies, writeBlock: null,
      lastCommitId: input.ids.commitId, createdAt: input.requestedAt, updatedAt: input.requestedAt
    };
    const operation: OperationRecord = {
      schemaVersion: 1, operationId: input.ids.operationId, campaignId: input.ids.campaignId,
      clientRequestId: input.ids.clientRequestId, idempotencyKey: input.ids.idempotencyKey,
      requestFingerprint, operationKind: "campaign.bootstrap", requestPayloadSchemaVersion: 1,
      requestPayload, phase: "COMMITTED_PENDING_RENDER", observedCampaignRevision: 0,
      commitId: input.ids.commitId, completionMode: null, resultPayloadSchemaVersion: null,
      resultPayload: null, failure: null, receivedAt: input.requestedAt, updatedAt: input.requestedAt
    };
    const aggregates: AggregateRecord[] = [
      { aggregateType: "world.clock", aggregateId: input.ids.clockAggregateId, payload: { elapsedGameSeconds: 0, calendarId: input.calendarId, calendarVersion: input.calendarVersion } satisfies CampaignClockPayload },
      { aggregateType: "character.state", aggregateId: input.ids.characterAggregateId, payload: asPayload(imported.value.character) },
      { aggregateType: "character.tactical-projection", aggregateId: input.ids.tacticalProjectionAggregateId, payload: asPayload(imported.value.tacticalProjection) },
      { aggregateType: "character.narrative-projection", aggregateId: input.ids.narrativeProjectionAggregateId, payload: asPayload(imported.value.narrativeProjection) },
      { aggregateType: "world.position", aggregateId: input.ids.positionAggregateId, payload: { characterId: imported.value.character.characterId, locationId: input.initialLocationId, geographicChain: location.chain } },
      { aggregateType: "campaign.bootstrap-context", aggregateId: input.ids.bootstrapContextAggregateId, payload: asPayload({
        contentRootFingerprint: content.manifest.rootFingerprint,
        rulesetRootFingerprint: resolvedRuleset.manifest.rootFingerprint,
        characterSourceFingerprint: input.character.sourceFingerprint,
        characterWarnings: imported.value.diagnostics
      }) }
    ].map(value => ({
      schemaVersion: 1,
      campaignId: input.ids.campaignId,
      aggregateType: value.aggregateType,
      aggregateId: value.aggregateId,
      aggregateRevision: 0,
      payloadSchemaVersion: 1,
      payload: value.payload,
      updatedByCommitId: input.ids.commitId
    }));
    const event: EventRecord = {
      schemaVersion: 1, eventId: input.ids.eventId, campaignId: input.ids.campaignId,
      operationId: input.ids.operationId, eventType: "campaign.bootstrapped", origin: "SYSTEM",
      causation: { kind: "OPERATION", id: input.ids.operationId },
      aggregateRefs: aggregates.map(value => ({ aggregateType: value.aggregateType, aggregateId: value.aggregateId, aggregateRevision: 0 })),
      visibility: { scope: "SYSTEM", actorIds: [] }, occurredAtGameSecond: 0,
      payloadSchemaVersion: 1, payload: requestPayload, commitId: input.ids.commitId,
      recordedAt: input.requestedAt, commitSequence: 1, eventSequence: 0
    };
    const persistenceRequest: CampaignBootstrapPersistenceRequestV1 = {
      schemaVersion: 1,
      campaign,
      operation,
      initialAggregates: aggregates,
      acceptedCommands: [],
      events: [event],
      outboxTasks: [],
      commit: {
        schemaVersion: 1, commitId: input.ids.commitId, campaignId: input.ids.campaignId,
        operationId: input.ids.operationId, idempotencyKey: input.ids.idempotencyKey,
        requestFingerprint, previousCampaignRevision: 0, campaignRevision: 1, commitSequence: 1,
        commandIds: [], eventIds: [input.ids.eventId],
        aggregateWrites: aggregates.map(value => ({
          aggregateType: value.aggregateType, aggregateId: value.aggregateId,
          previousRevision: null, aggregateRevision: 0
        })),
        outboxTaskIds: [], committedAt: input.requestedAt
      }
    };
    const persisted = await this.repository.bootstrapCampaign(persistenceRequest);
    if (!persisted.ok) {
      add(diagnostics, "BOOTSTRAP_PERSISTENCE_FAILED", "/persistence", { error: persisted.error });
      return { ok: false, diagnostics };
    }
    return {
      ok: true,
      value: {
        persistence: persisted.value,
        character: imported.value,
        geographicChain: location.chain,
        diagnostics
      }
    };
  }
}
