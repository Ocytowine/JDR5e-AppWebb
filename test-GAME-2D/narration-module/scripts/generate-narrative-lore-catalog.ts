import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compileLoreCorpusV1 } from "../src/bootstrap/lore";
import type {
  ContentEntryDescriptorV1,
  Sha256Fingerprint
} from "../src/bootstrap/lore";
import { computeJsonFingerprint } from "../src/core";
import { buildNarrativeLoreBuildCatalogV1 } from "../src/context";
import {
  loadIndexedLoreCatalogEntries,
  loadProductionLoreSources
} from "./lib/productionLore";
import { loadRaceTypesFromIndex } from "../../src/PlayerCharacterCreator/catalogs/raceCatalog";
import { loadBackgroundTypesFromIndex } from "../../src/PlayerCharacterCreator/catalogs/backgroundCatalog";
import {
  loadClassTypesFromIndex,
  loadSubclassTypesFromIndex
} from "../../src/PlayerCharacterCreator/catalogs/classCatalog";
import { loadLanguageTypesFromIndex } from "../../src/PlayerCharacterCreator/catalogs/languageCatalog";
import { loadWeaponTypesFromIndex } from "../../src/PlayerCharacterCreator/catalogs/weaponCatalog";
import { loadArmorItemsFromIndex } from "../../src/PlayerCharacterCreator/catalogs/armorCatalog";
import { loadObjectItemsFromIndex } from "../../src/PlayerCharacterCreator/catalogs/objectCatalog";
import { loadToolItemsFromIndex } from "../../src/PlayerCharacterCreator/catalogs/toolCatalog";
import { loadActionTypesFromIndex } from "../../src/game/actionCatalog";
import { spellCatalog } from "../../src/game/spellCatalog";
import reactionsIndex from "../../src/data/reactions/index.json";
import featuresIndex from "../../src/data/characters/features/index.json";
import bastionDefenseCatalog from
  "../../src/data/narration/bastion-defense-catalog.json";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url)).replaceAll("\\", "/").replace(/\/$/u, "");
const loreRoot = `${repositoryRoot}/wiki/lore`;
const exclusionManifestPath = `${repositoryRoot}/wiki/lore-exclusions.json`;
const outputPath = fileURLToPath(new URL("../../src/narration-ui/generated/narrativeLoreCatalog.generated.json", import.meta.url));
const bootstrapOutputPath = fileURLToPath(new URL("../../src/narration-ui/generated/campaignBootstrapPackage.generated.json", import.meta.url));

async function textFingerprint(value: string): Promise<Sha256Fingerprint> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return `sha256:${Array.from(
    new Uint8Array(digest),
    byte => byte.toString(16).padStart(2, "0")
  ).join("")}`;
}

function basenameIds(paths: unknown): string[] {
  if (!Array.isArray(paths)) return [];
  return paths
    .filter(value => typeof value === "string")
    .map(value => value.split("/").at(-1)?.replace(/\.json$/u, "") ?? "")
    .filter(Boolean);
}

function installedCharacterCatalogIds(): string[] {
  return [
    ...loadRaceTypesFromIndex().map(value => value.id),
    ...loadBackgroundTypesFromIndex().map(value => value.id),
    ...loadLanguageTypesFromIndex().map(value => value.id),
    ...loadClassTypesFromIndex().map(value => value.id),
    ...loadSubclassTypesFromIndex().map(value => value.id),
    ...loadWeaponTypesFromIndex().map(value => value.id),
    ...loadArmorItemsFromIndex().map(value => value.id),
    ...loadObjectItemsFromIndex().map(value => value.id),
    ...loadToolItemsFromIndex().map(value => value.id),
    ...loadActionTypesFromIndex().map(value => value.id),
    ...spellCatalog.list.map(value => value.id),
    ...basenameIds((reactionsIndex as { reactions?: unknown }).reactions),
    ...basenameIds((featuresIndex as { features?: unknown }).features)
  ];
}

export async function generateNarrativeLoreCatalogText(): Promise<{
  narrativeText: string;
  bootstrapText: string;
}> {
  const catalogEntryIds = new Set([
    ...await loadIndexedLoreCatalogEntries(repositoryRoot),
    ...installedCharacterCatalogIds(),
    bastionDefenseCatalog.catalogId
  ]);
  const compiled = await compileLoreCorpusV1(
    await loadProductionLoreSources({ repositoryRoot, loreRoot, exclusionManifestPath }),
    {
      packageId: "jdr5e.production-lore",
      packageVersion: 1,
      catalogEntries: catalogEntryIds
    }
  );
  if (!compiled.ok) {
    throw new Error(compiled.diagnostics.map(value => `${value.sourcePath}: ${value.details.issue ?? value.code}`).join("\n"));
  }
  const narrativeCatalog = buildNarrativeLoreBuildCatalogV1(compiled.value);
  const loreEntries = await Promise.all(narrativeCatalog.entities.map(
    async entity => ({
      descriptor: {
        entryId: entity.entityId,
        entryKind: "LORE_ENTITY" as const,
        entityType: entity.entityType,
        payloadSchemaVersion: 1,
        sourcePath: entity.provenance.sourcePath,
        sourceFingerprint: entity.provenance.sourceFingerprint,
        payloadFingerprint:
          await computeJsonFingerprint(entity) as Sha256Fingerprint,
        references: entity.relations.map(relation => ({
          targetId: relation.targetId,
          relation: relation.relation,
          strength: relation.strength
        }))
      } satisfies ContentEntryDescriptorV1,
      entry: {
        entryKind: "LORE_ENTITY" as const,
        entryId: entity.entityId,
        sourceText: null,
        installedSourceFingerprint: entity.provenance.sourceFingerprint,
        payload: entity
      }
    })
  ));
  const gameEntries = await Promise.all([...catalogEntryIds].sort().map(
    async entryId => {
      const isBastionDefenseCatalog =
        entryId === bastionDefenseCatalog.catalogId;
      const sourceText = isBastionDefenseCatalog
        ? JSON.stringify(bastionDefenseCatalog)
        : `catalog:${entryId}`;
      const payload = isBastionDefenseCatalog
        ? bastionDefenseCatalog
        : { schemaVersion: 1, entryId };
      return {
        descriptor: {
          entryId,
          entryKind: "GAME_CATALOG_ENTRY" as const,
          entityType: "game-catalog-entry",
          payloadSchemaVersion: 1,
          sourcePath: `catalog/${entryId}.json`,
          sourceFingerprint: await textFingerprint(sourceText),
          payloadFingerprint:
            await computeJsonFingerprint(payload) as Sha256Fingerprint,
          references: []
        } satisfies ContentEntryDescriptorV1,
        entry: {
          entryKind: "GAME_CATALOG_ENTRY" as const,
          entryId,
          sourceText,
          payload
        }
      };
    }
  ));
  const compiledEntries = [...loreEntries, ...gameEntries].sort((left, right) =>
    left.descriptor.entryKind.localeCompare(right.descriptor.entryKind)
    || left.descriptor.entityType.localeCompare(right.descriptor.entityType)
    || left.descriptor.entryId.localeCompare(right.descriptor.entryId)
  );
  const manifestBase = {
    schemaVersion: 1 as const,
    packageId: narrativeCatalog.packageId,
    packageVersion: narrativeCatalog.packageVersion,
    minimumRuntimeContract: "campaign-bootstrap/2" as const,
    entries: compiledEntries.map(value => value.descriptor)
  };
  const bootstrapPackage = {
    schemaVersion: 1,
    contractVersion: "installed-campaign-content/1",
    manifest: {
      ...manifestBase,
      rootFingerprint:
        await computeJsonFingerprint(manifestBase) as Sha256Fingerprint
    },
    entries: compiledEntries.map(value => value.entry),
    loreEntities: narrativeCatalog.entities,
    version: 1
  };
  return {
    narrativeText: `${JSON.stringify(narrativeCatalog, null, 2)}\n`,
    bootstrapText: `${JSON.stringify(bootstrapPackage, null, 2)}\n`
  };
}

async function run(): Promise<void> {
  const next = await generateNarrativeLoreCatalogText();
  const [currentNarrative, currentBootstrap] = await Promise.all([
    readFile(outputPath, "utf8").catch(() => null),
    readFile(bootstrapOutputPath, "utf8").catch(() => null)
  ]);
  if (
    currentNarrative === next.narrativeText
    && currentBootstrap === next.bootstrapText
  ) {
    console.log("Narrative lore catalog is up to date.");
    return;
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await Promise.all([
    writeFile(outputPath, next.narrativeText, "utf8"),
    writeFile(bootstrapOutputPath, next.bootstrapText, "utf8")
  ]);
  console.log(`Generated narrative lore catalogs: ${outputPath}; ${bootstrapOutputPath}`);
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
