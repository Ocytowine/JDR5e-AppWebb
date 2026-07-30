import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  CampaignBootstrapServiceV1,
  ACTIVE_CAMPAIGN_CHARACTER_PROFILE_AGGREGATE_TYPE_V1,
  activeCampaignCharacterProfileAggregateIdV1,
  createMvpRulesetManifestV1,
  MemoryCampaignBootstrapRepository,
  MVP_RULE_DEFINITIONS_V1,
  MVP_RULE_EXECUTORS_V1,
  validateActiveCampaignCharacterProfileV1,
  type CampaignBootstrapInputV1,
  type ContentPackageResolverV1,
  type LoreEntityV1,
  type ResolvedContentEntryV1,
  type ResolvedContentPackageV1,
  type ResolvedRulesetV1,
  type RulesetResolverV1,
  type Sha256Fingerprint
} from "../../src/bootstrap/index";
import { computeJsonFingerprint } from "../../src/core/index";
import { assert } from "../contracts/assertions";
import { currentCharacterCatalog } from "../fixtures/character/currentCharacterCatalog";

const fixturePath = fileURLToPath(new URL("../fixtures/character/valid/creator-ready.json", import.meta.url));
const packageId = "content.jdr5e.bootstrap-test";

async function sourceFingerprint(sourceText: string): Promise<Sha256Fingerprint> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sourceText));
  return `sha256:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

function lore(entityId: string, entityType: LoreEntityV1["entityType"], parent?: [string, string]): LoreEntityV1 {
  const sourcePath = `wiki/${entityType}/${entityId}.md`;
  return {
    schemaVersion: 1,
    entityId,
    entityType,
    displayName: entityId.replaceAll("_", " "),
    attributes: {},
    relations: parent ? [{ relation: parent[0], targetId: parent[1], targetType: null, strength: "REQUIRED" }] : [],
    searchTerms: [entityId],
    body: `Lore de ${entityId}.`,
    provenance: {
      packageId,
      packageVersion: 1,
      sourcePath,
      sourceFingerprint: "sha256:pending"
    }
  };
}

function catalogIds(content: ReturnType<typeof currentCharacterCatalog>): string[] {
  return [...new Set([
    ...content.races, ...content.backgrounds, ...content.languages,
    ...content.classes.keys(), ...content.subclasses.keys(), ...content.items.keys(),
    ...content.actions, ...content.reactions, ...content.spells, ...content.features
  ])].sort();
}

async function contentPackage(options: { brokenChain?: boolean } = {}): Promise<ResolvedContentPackageV1> {
  const characterCatalog = currentCharacterCatalog();
  const loreEntities = [
    lore("archives_de_lysenthe", "batiment", ["quartier", "quartier_des_archives"]),
    lore("quartier_des_archives", "quartier", ["ville", "lysenthe"]),
    lore("lysenthe", "ville", ["region", "ylssea"]),
    lore("ylssea", "region", options.brokenChain ? undefined : ["territoire", "astryade"]),
    lore("astryade", "royaume")
  ];
  const loreSources = new Map(loreEntities.map(entity => [
    entity.entityId,
    `---\nid: ${entity.entityId}\n---\n${entity.body}`
  ]));
  await Promise.all(loreEntities.map(async entity => {
    entity.provenance.sourceFingerprint = await sourceFingerprint(loreSources.get(entity.entityId)!);
  }));
  const entries: ResolvedContentEntryV1[] = [
    ...loreEntities.map(entity => ({
      entryKind: "LORE_ENTITY" as const,
      entryId: entity.entityId,
      sourceText: loreSources.get(entity.entityId)!,
      payload: entity
    })),
    ...catalogIds(characterCatalog).map(entryId => ({
      entryKind: "GAME_CATALOG_ENTRY" as const,
      entryId,
      sourceText: `catalog:${entryId}`,
      payload: { schemaVersion: 1, entryId }
    }))
  ];
  const descriptors = await Promise.all(entries.map(async entry => ({
    entryId: entry.entryId,
    entryKind: entry.entryKind,
    entityType: entry.entryKind === "LORE_ENTITY"
      ? loreEntities.find(entity => entity.entityId === entry.entryId)!.entityType
      : "game-catalog-entry",
    payloadSchemaVersion: 1,
    sourcePath: entry.entryKind === "LORE_ENTITY"
      ? loreEntities.find(entity => entity.entityId === entry.entryId)!.provenance.sourcePath
      : `catalog/${entry.entryId}.json`,
    sourceFingerprint: await sourceFingerprint(entry.sourceText!),
    payloadFingerprint: await computeJsonFingerprint(entry.payload) as Sha256Fingerprint,
    references: []
  })));
  descriptors.sort((left, right) => left.entryKind.localeCompare(right.entryKind) || left.entityType.localeCompare(right.entityType) || left.entryId.localeCompare(right.entryId));
  const base = {
    schemaVersion: 1 as const,
    packageId,
    packageVersion: 1,
    minimumRuntimeContract: "campaign-bootstrap/2" as const,
    entries: descriptors
  };
  return {
    manifest: { ...base, rootFingerprint: await computeJsonFingerprint(base) as Sha256Fingerprint },
    entries,
    loreEntities,
    characterCatalog
  };
}

async function ruleset(): Promise<ResolvedRulesetV1> {
  return {
    manifest: await createMvpRulesetManifestV1(packageId, 1, 1),
    definitions: MVP_RULE_DEFINITIONS_V1,
    executors: MVP_RULE_EXECUTORS_V1
  };
}

async function input(): Promise<CampaignBootstrapInputV1> {
  const character = JSON.parse(await readFile(fixturePath, "utf8"));
  return {
    schemaVersion: 1,
    ids: {
      campaignId: "campaign-lysenthe",
      operationId: "operation-bootstrap-lysenthe",
      clientRequestId: "request-bootstrap-lysenthe",
      idempotencyKey: "idempotency-bootstrap-lysenthe",
      commitId: "commit-bootstrap-lysenthe",
      eventId: "event-bootstrap-lysenthe",
      clockAggregateId: "aggregate-clock-lysenthe",
      characterAggregateId: "aggregate-character-aryn",
      tacticalProjectionAggregateId: "aggregate-tactical-aryn",
      narrativeProjectionAggregateId: "aggregate-narrative-aryn",
      positionAggregateId: "aggregate-position-aryn",
      bootstrapContextAggregateId: "aggregate-bootstrap-context"
    },
    contentPackageId: packageId,
    contentPackageVersion: 1,
    rulesetId: "rules.jdr5e",
    rulesetVersion: 2,
    calendarId: "calendar.astryade",
    calendarVersion: 1,
    initialLocationId: "archives_de_lysenthe",
    character: {
      schemaVersion: 1,
      sourceKind: "CHARACTER_CREATOR_LEGACY",
      sourceSchemaVersion: 1,
      sourceFingerprint: await computeJsonFingerprint(character) as Sha256Fingerprint,
      character
    },
    requestedAt: "2026-07-06T10:00:00.000Z"
  } as CampaignBootstrapInputV1;
}

function resolver<T>(value: T | null): { resolve(): Promise<T | null> } {
  return { resolve: async () => value };
}

async function rejected(
  name: string,
  expectedCode: string,
  content: ResolvedContentPackageV1 | null,
  rules: ResolvedRulesetV1 | null,
  mutateInput?: (value: CampaignBootstrapInputV1) => void,
  repository = new MemoryCampaignBootstrapRepository()
): Promise<void> {
  const request = await input();
  mutateInput?.(request);
  const service = new CampaignBootstrapServiceV1(
    resolver(content) as ContentPackageResolverV1,
    resolver(rules) as RulesetResolverV1,
    repository
  );
  const result = await service.bootstrap(request);
  assert.equal(result.ok, false, `${name} must be rejected.`);
  if (!result.ok) assert.ok(result.diagnostics.some(value => value.code === expectedCode), `${name}: expected ${expectedCode}`);
  const campaign = await repository.getCampaign(request.ids.campaignId);
  assert.equal(campaign.ok, false, `${name}: rejection must not publish a campaign.`);
  console.log(`PASS [campaign-bootstrap-service] rejects ${name} without partial state`);
}

async function run(): Promise<void> {
  const content = await contentPackage();
  const rules = await ruleset();
  const request = await input();
  const repository = new MemoryCampaignBootstrapRepository();
  const service = new CampaignBootstrapServiceV1(
    resolver(content) as ContentPackageResolverV1,
    resolver(rules) as RulesetResolverV1,
    repository
  );
  const result = await service.bootstrap(request);
  assert.equal(result.ok, true, result.ok ? undefined : result.diagnostics.map(value => value.code).join(", "));
  if (!result.ok) return;
  assert.equal(result.value.persistence.campaign.campaignRevision, 1);
  assert.deepEqual(result.value.geographicChain, ["archives_de_lysenthe", "quartier_des_archives", "lysenthe", "ylssea", "astryade"]);
  for (const [aggregateType, aggregateId] of [
    ["world.clock", request.ids.clockAggregateId],
    ["character.state", request.ids.characterAggregateId],
    ["character.tactical-projection", request.ids.tacticalProjectionAggregateId],
    ["character.narrative-projection", request.ids.narrativeProjectionAggregateId],
    [
      ACTIVE_CAMPAIGN_CHARACTER_PROFILE_AGGREGATE_TYPE_V1,
      activeCampaignCharacterProfileAggregateIdV1(request.ids.campaignId)
    ],
    ["world.position", request.ids.positionAggregateId],
    ["campaign.bootstrap-context", request.ids.bootstrapContextAggregateId]
  ]) {
    assert.equal((await repository.getAggregate(request.ids.campaignId, aggregateType, aggregateId)).ok, true);
  }
  const activeProfile = await repository.getAggregate(
    request.ids.campaignId,
    ACTIVE_CAMPAIGN_CHARACTER_PROFILE_AGGREGATE_TYPE_V1,
    activeCampaignCharacterProfileAggregateIdV1(request.ids.campaignId)
  );
  assert.equal(activeProfile.ok, true);
  if (activeProfile.ok) {
    assert.deepEqual(
      validateActiveCampaignCharacterProfileV1(activeProfile.value.payload),
      []
    );
    assert.equal(
      activeProfile.value.payload.characterStateAggregateId,
      request.ids.characterAggregateId
    );
    assert.equal(
      activeProfile.value.payload.tacticalProjectionAggregateId,
      request.ids.tacticalProjectionAggregateId
    );
  }
  const events = await repository.listEvents(request.ids.campaignId, null, 10);
  assert.equal(events.ok, true);
  if (events.ok) assert.deepEqual(events.value.map(value => value.eventType), ["campaign.bootstrapped"]);
  const replay = await service.bootstrap(request);
  assert.equal(replay.ok, true);
  if (replay.ok) assert.equal(replay.value.persistence.commit.commitId, result.value.persistence.commit.commitId);
  const replayEvents = await repository.listEvents(request.ids.campaignId, null, 10);
  if (replayEvents.ok) assert.equal(replayEvents.value.length, 1);
  console.log("PASS [campaign-bootstrap-service] Archives de Lysenthe bootstrap is atomic and idempotent");

  await rejected("missing content package", "BOOTSTRAP_CONTENT_NOT_FOUND", null, rules);
  const tampered = await contentPackage();
  tampered.entries[0].sourceText += "tampered";
  await rejected("tampered content", "BOOTSTRAP_CONTENT_FINGERPRINT_MISMATCH", tampered, rules);
  await rejected("missing ruleset", "BOOTSTRAP_RULESET_NOT_FOUND", content, null);
  await rejected("missing location", "BOOTSTRAP_LOCATION_MISSING", content, rules, value => { value.initialLocationId = "unknown"; });
  await rejected("broken geographic chain", "BOOTSTRAP_LOCATION_CHAIN_INVALID", await contentPackage({ brokenChain: true }), rules);
  await rejected("invalid character", "BOOTSTRAP_CHARACTER_INVALID", content, rules, value => {
    (value.character.character as Record<string, unknown>).raceId = "unknown";
    value.character.sourceFingerprint = "sha256:invalid";
  });
  const mismatchedRules = await ruleset();
  mismatchedRules.executors = mismatchedRules.executors.map(value => value.executorId === "character.compute-ability-modifier"
    ? { ...value, execute: () => ({ modifier: 99 }) }
    : value);
  await rejected("projection/rule mismatch", "BOOTSTRAP_PROJECTION_RULE_MISMATCH", content, mismatchedRules);
  const failingRepository = new MemoryCampaignBootstrapRepository({
    failureInjector: point => { if (point === "BOOTSTRAP_AFTER_EVENTS") throw new Error("injected"); }
  });
  await rejected("persistence failure", "BOOTSTRAP_PERSISTENCE_FAILED", content, rules, undefined, failingRepository);
  console.log("PASS [campaign-bootstrap-service] 1 end-to-end scenario and 8 rejection boundaries");
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
