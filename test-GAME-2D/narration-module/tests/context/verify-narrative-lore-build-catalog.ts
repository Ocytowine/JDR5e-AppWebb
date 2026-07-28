import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { compileLoreCorpusV1 } from "../../src/bootstrap/lore";
import {
  assertNarrativeLoreBuildCatalogV1,
  buildNarrativeLoreBuildCatalogV1,
  NARRATIVE_LORE_INFLUENCE_BUDGET_V1
} from "../../src/context";
import {
  loadIndexedLoreCatalogEntries,
  loadProductionLoreSources
} from "../../scripts/lib/productionLore";
import { assert } from "../contracts/assertions";

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url)).replaceAll("\\", "/").replace(/\/$/u, "");
const generatedPath = fileURLToPath(new URL("../../../src/narration-ui/generated/narrativeLoreCatalog.generated.json", import.meta.url));

async function run(): Promise<void> {
  const compiled = await compileLoreCorpusV1(
    await loadProductionLoreSources({
      repositoryRoot,
      loreRoot: `${repositoryRoot}/wiki/lore`,
      exclusionManifestPath: `${repositoryRoot}/wiki/lore-exclusions.json`
    }),
    {
      packageId: "jdr5e.production-lore",
      packageVersion: 1,
      catalogEntries: await loadIndexedLoreCatalogEntries(repositoryRoot)
    }
  );
  assert.equal(compiled.ok, true, compiled.ok ? undefined : compiled.diagnostics.map(value => value.code).join(", "));
  if (!compiled.ok) return;

  const catalog = buildNarrativeLoreBuildCatalogV1(compiled.value);
  assertNarrativeLoreBuildCatalogV1(catalog);
  const rebuiltFromReversedInput = buildNarrativeLoreBuildCatalogV1({
    ...compiled.value,
    entities: [...compiled.value.entities].reverse(),
    fragments: [...compiled.value.fragments].reverse()
  });
  assert.deepEqual(catalog, rebuiltFromReversedInput, "Build catalog output must not depend on enumeration order.");

  const generated = JSON.parse(await readFile(generatedPath, "utf8")) as unknown;
  assertNarrativeLoreBuildCatalogV1(generated);
  assert.deepEqual(generated, catalog, "The tracked generated catalog must match the production lore sources.");
  assert.ok(catalog.entities.length < compiled.value.entities.length, "The runtime catalog must omit unrelated authoring entities.");
  assert.equal(catalog.scenes.length, 15, "Every authored building, district and city must expose a scene packet.");
  assert.equal(catalog.fragments.every(fragment => fragment.provenance.sourcePath.startsWith("wiki/lore/")), true);

  const archive = catalog.scenes.find(scene => scene.entityId === "archives_de_lysenthe");
  assert.ok(archive, "The Archives scene packet must be generated.");
  assert.ok(archive.influencePacket.influences.length <= NARRATIVE_LORE_INFLUENCE_BUDGET_V1);
  assert.equal(
    archive.influencePacket.influences.every(influence => ["COMMUN", "LOCAL"].includes(influence.knowledgeLevel)),
    true,
    "A player-facing influence packet must not contain specialised, restricted or secret lore."
  );
  assert.ok(
    archive.influencePacket.unresolvedDimensions.length > 0,
    "Missing lore dimensions must remain explicitly open for compatible ambient creation."
  );
  assert.equal(
    archive.influencePacket.unresolvedDimensions.includes("LANGUAGE"),
    true,
    "An absent language detail is an open dimension, not an invented strict constraint."
  );

  const serialized = JSON.stringify(catalog);
  assert.equal(serialized.includes("\"sourceText\""), false, "Raw wiki source text must not enter the browser catalog.");
  assert.equal(serialized.includes("\"topology\""), false, "The lore catalog must not own runtime topology.");
  assert.equal(serialized.includes("\"connectionIntents\""), false, "The lore catalog must not propose runtime connections.");

  console.log(`PASS [narrative-lore-build-catalog] ${catalog.scenes.length} bounded scene packets generated from ${catalog.sourcePaths.length} retained sources.`);
  console.log("PASS [narrative-lore-build-catalog] player knowledge, provenance and influence budget remain explicit.");
  console.log("PASS [narrative-lore-build-catalog] unresolved lore stays open while topology remains locally owned.");
}

void run();
