import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  CampaignBootstrapServiceV1,
  MemoryCampaignBootstrapRepository,
  type CampaignBootstrapInputV1
} from "../../src/bootstrap";
import {
  computeJsonFingerprint,
  type JsonObject
} from "../../src/core";
import {
  LEGACY_ACTIVE_SHEET_KEY_V1,
  LEGACY_SAVED_SHEETS_KEY_V1,
  readActiveCharacterSheetV1
} from "../../../src/narration-ui/activeCharacterSheetAdapter";
import {
  createInstalledContentPackageResolverV1,
  createInstalledRulesetResolverV1,
  INSTALLED_CONTENT_PACKAGE_ID_V1,
  INSTALLED_CONTENT_PACKAGE_VERSION_V1,
  INSTALLED_RULESET_ID_V1,
  INSTALLED_RULESET_VERSION_V1
} from "../../../src/narration-ui/installedCampaignContent";

async function run(): Promise<void> {
const fixturePath = fileURLToPath(new URL(
  "../fixtures/character/valid/creator-ready.json",
  import.meta.url
));
const character = JSON.parse(await readFile(fixturePath, "utf8")) as JsonObject;
const storageValues = new Map<string, string>([
  [LEGACY_ACTIVE_SHEET_KEY_V1, "sheet-aryn"],
  [LEGACY_SAVED_SHEETS_KEY_V1, JSON.stringify([{
    id: "sheet-aryn",
    name: "Aryn prête à jouer",
    updatedAt: "2026-07-30T10:00:00.000Z",
    character
  }])]
]);
const active = await readActiveCharacterSheetV1({
  getItem: key => storageValues.get(key) ?? null
});
assert.equal(active.ok, true, "la fiche active valide doit être adaptée");
if (!active.ok) process.exit(1);
assert.equal(
  active.value.envelope.sourceFingerprint,
  await computeJsonFingerprint(character),
  "l’adaptateur doit empreinter l’instantané exact"
);

const noSelection = await readActiveCharacterSheetV1({
  getItem: key => key === LEGACY_SAVED_SHEETS_KEY_V1 ? "[]" : null
});
assert.equal(noSelection.ok, false);
if (!noSelection.ok) {
  assert.equal(
    noSelection.diagnostics[0]?.code,
    "ACTIVE_SHEET_NOT_SELECTED",
    "l’absence de sélection doit être expliquée avant tout bootstrap"
  );
}

const contentResolver = createInstalledContentPackageResolverV1();
const content = await contentResolver.resolve(
  INSTALLED_CONTENT_PACKAGE_ID_V1,
  INSTALLED_CONTENT_PACKAGE_VERSION_V1
);
assert.ok(content, "le paquet installé doit résoudre sa version exacte");
assert.equal(
  content.entries
    .filter(value => value.entryKind === "LORE_ENTITY")
    .every(value =>
      value.sourceText === null
      && typeof value.installedSourceFingerprint === "string"),
  true,
  "le paquet navigateur ne doit pas embarquer les sources wiki brutes"
);
assert.equal(
  await contentResolver.resolve(INSTALLED_CONTENT_PACKAGE_ID_V1, 999),
  null,
  "une autre version ne doit pas produire de fallback"
);

const repository = new MemoryCampaignBootstrapRepository();
const service = new CampaignBootstrapServiceV1(
  contentResolver,
  createInstalledRulesetResolverV1(),
  repository
);
const result = await service.bootstrap({
  schemaVersion: 1,
  ids: {
    campaignId: "campaign-installed-entry",
    operationId: "operation-installed-entry",
    clientRequestId: "request-installed-entry",
    idempotencyKey: "idempotency-installed-entry",
    commitId: "commit-installed-entry",
    eventId: "event-installed-entry",
    clockAggregateId: "aggregate-installed-clock",
    characterAggregateId: "aggregate-installed-character",
    tacticalProjectionAggregateId: "aggregate-installed-tactical",
    narrativeProjectionAggregateId: "aggregate-installed-narrative",
    positionAggregateId: "aggregate-installed-position",
    bootstrapContextAggregateId: "aggregate-installed-context"
  },
  contentPackageId: INSTALLED_CONTENT_PACKAGE_ID_V1,
  contentPackageVersion: INSTALLED_CONTENT_PACKAGE_VERSION_V1,
  rulesetId: INSTALLED_RULESET_ID_V1,
  rulesetVersion: INSTALLED_RULESET_VERSION_V1,
  calendarId: "calendar.astryade",
  calendarVersion: 1,
  initialLocationId: "archives_de_lysenthe",
  character: active.value.envelope,
  requestedAt: "2026-07-30T10:00:00.000Z"
} as CampaignBootstrapInputV1);
assert.equal(
  result.ok,
  true,
  result.ok
    ? undefined
    : result.diagnostics.map(value =>
        `${value.code}:${JSON.stringify(value.details)}`).join("\n")
);
if (result.ok) {
  assert.deepEqual(
    result.value.geographicChain,
    [
      "archives_de_lysenthe",
      "quartier_des_archives",
      "lysenthe",
      "ylssea",
      "astryade"
    ],
    "le paquet installé doit fournir la chaîne géographique de départ"
  );
}

console.log("installed-campaign-entry/1: OK");
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
