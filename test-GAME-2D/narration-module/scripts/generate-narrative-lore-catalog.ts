import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compileLoreCorpusV1 } from "../src/bootstrap/lore";
import { buildNarrativeLoreBuildCatalogV1 } from "../src/context";
import {
  loadIndexedLoreCatalogEntries,
  loadProductionLoreSources
} from "./lib/productionLore";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url)).replaceAll("\\", "/").replace(/\/$/u, "");
const loreRoot = `${repositoryRoot}/wiki/lore`;
const exclusionManifestPath = `${repositoryRoot}/wiki/lore-exclusions.json`;
const outputPath = fileURLToPath(new URL("../../src/narration-ui/generated/narrativeLoreCatalog.generated.json", import.meta.url));

export async function generateNarrativeLoreCatalogText(): Promise<string> {
  const compiled = await compileLoreCorpusV1(
    await loadProductionLoreSources({ repositoryRoot, loreRoot, exclusionManifestPath }),
    {
      packageId: "jdr5e.production-lore",
      packageVersion: 1,
      catalogEntries: await loadIndexedLoreCatalogEntries(repositoryRoot)
    }
  );
  if (!compiled.ok) {
    throw new Error(compiled.diagnostics.map(value => `${value.sourcePath}: ${value.details.issue ?? value.code}`).join("\n"));
  }
  return `${JSON.stringify(buildNarrativeLoreBuildCatalogV1(compiled.value), null, 2)}\n`;
}

async function run(): Promise<void> {
  const next = await generateNarrativeLoreCatalogText();
  const current = await readFile(outputPath, "utf8").catch(() => null);
  if (current === next) {
    console.log("Narrative lore catalog is up to date.");
    return;
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, next, "utf8");
  console.log(`Generated narrative lore catalog: ${outputPath}`);
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
