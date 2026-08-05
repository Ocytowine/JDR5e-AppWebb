import { readFile, readdir } from "node:fs/promises";
import { relative } from "node:path";
import type { LoreSourceInputV1 } from "../../src/bootstrap/lore";

export async function listFilesRecursively(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const path = `${root}/${entry.name}`;
    return entry.isDirectory() ? listFilesRecursively(path) : [path];
  }));
  return nested.flat().sort();
}

export async function loadProductionLoreSources(input: {
  repositoryRoot: string;
  loreRoot: string;
  exclusionManifestPath: string;
}): Promise<LoreSourceInputV1[]> {
  const manifest = JSON.parse(await readFile(input.exclusionManifestPath, "utf8")) as {
    schemaVersion?: unknown;
    exclusions?: Array<{ sourcePath?: unknown; reason?: unknown }>;
  };
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.exclusions)) {
    throw new Error("wiki/lore-exclusions.json must follow schema version 1.");
  }
  const exclusions = new Map(manifest.exclusions.map(entry => {
    if (typeof entry.sourcePath !== "string" || typeof entry.reason !== "string" || !entry.reason.trim()) {
      throw new Error("Every lore exclusion requires a sourcePath and a reason.");
    }
    return [entry.sourcePath, entry.reason] as const;
  }));
  if (exclusions.size !== manifest.exclusions.length) throw new Error("Lore exclusion paths must be unique.");

  const encounteredExclusions = new Set<string>();
  const sources: LoreSourceInputV1[] = [];
  for (const absolutePath of await listFilesRecursively(input.loreRoot)) {
    const sourcePath = relative(input.repositoryRoot, absolutePath).replaceAll("\\", "/");
    // Lore fingerprints and embedded bodies must not depend on the checkout's
    // platform line endings. CRLF is the historical canonical representation
    // used by the installed package.
    const sourceText = (await readFile(absolutePath, "utf8"))
      .replace(/\r?\n/gu, "\r\n");
    if (sourceText.startsWith("---\n") || sourceText.startsWith("---\r\n")) {
      if (exclusions.has(sourcePath)) throw new Error(`${sourcePath} is both compilable and excluded.`);
      sources.push({ sourcePath, sourceText });
    } else {
      if (!exclusions.has(sourcePath)) throw new Error(`${sourcePath} must be migrated or explicitly excluded.`);
      encounteredExclusions.add(sourcePath);
    }
  }
  if ([...exclusions.keys()].some(sourcePath => !encounteredExclusions.has(sourcePath))) {
    throw new Error("The lore exclusion manifest contains a stale path.");
  }
  return sources.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
}

export async function loadIndexedLoreCatalogEntries(repositoryRoot: string): Promise<Set<string>> {
  const catalogs = [
    { kind: "race", folder: "test-GAME-2D/src/data/characters/races" },
    { kind: "language", folder: "test-GAME-2D/src/data/characters/languages" }
  ] as const;
  const entries = new Set<string>();
  for (const catalog of catalogs) {
    const folder = `${repositoryRoot}/${catalog.folder}`;
    const index = JSON.parse(await readFile(`${folder}/index.json`, "utf8")) as { types?: unknown };
    if (!Array.isArray(index.types)) throw new Error(`${catalog.folder}/index.json must expose a types array.`);
    for (const relativePath of index.types) {
      if (typeof relativePath !== "string") throw new Error(`${catalog.folder}/index.json contains a non-string path.`);
      const definition = JSON.parse(await readFile(`${folder}/${relativePath.replace(/^\.\//u, "")}`, "utf8")) as { id?: unknown };
      if (typeof definition.id !== "string") throw new Error(`${relativePath} must expose a catalog id.`);
      entries.add(`${catalog.kind}:${definition.id}`);
    }
  }
  return entries;
}
