import { readFile, readdir } from "node:fs/promises";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { stringify } from "yaml";
import {
  compileLoreCorpusV1,
  compileLoreSourceV1,
  partitionLoreFragmentsBySecrecy,
  validateLoreAuthorEntityV1,
  type CultureLoreAuthorV1,
  type HistoricalEventLoreAuthorV1,
  type HistoricalPeriodLoreAuthorV1,
  type LoreAuthorEntityV1,
  type LoreSourceInputV1,
  type NpcLoreAuthorV1,
  type SpeciesLoreAuthorV1
} from "../../src/bootstrap/lore";
import { assert } from "../contracts/assertions";

const fixtureRoot = fileURLToPath(new URL("../fixtures/lore/valid/", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const productionLoreRoot = fileURLToPath(new URL("../../../../wiki/lore/", import.meta.url));
const exclusionManifestPath = fileURLToPath(new URL("../../../../wiki/lore-exclusions.json", import.meta.url));
const templateRoot = fileURLToPath(new URL("../../../../wiki/Template/lore-v1/", import.meta.url));
const options = {
  packageId: "jdr5e.test-lore",
  packageVersion: 1,
  catalogEntries: new Set(["race:elf", "language:elfique"])
} as const;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function source(author: LoreAuthorEntityV1, body = ""): string {
  return `---\n${stringify(author)}---\n${body}`;
}

async function loadAuthors(): Promise<Map<LoreAuthorEntityV1["type"], LoreAuthorEntityV1>> {
  const result = new Map<LoreAuthorEntityV1["type"], LoreAuthorEntityV1>();
  for (const name of (await readdir(fixtureRoot)).filter(name => name.endsWith(".json")).sort()) {
    const value = JSON.parse(await readFile(`${fixtureRoot}${name}`, "utf8")) as unknown;
    const validation = validateLoreAuthorEntityV1(value);
    assert.equal(validation.valid, true, `${name} must remain a valid author fixture.`);
    if (validation.valid) result.set(validation.value.type, validation.value);
  }
  return result;
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const path = `${root}/${entry.name}`;
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return nested.flat().sort();
}

async function verifyProductionCorpus(): Promise<void> {
  const manifest = JSON.parse(await readFile(exclusionManifestPath, "utf8")) as {
    schemaVersion: number;
    exclusions: Array<{ sourcePath: string; reason: string }>;
  };
  assert.equal(manifest.schemaVersion, 1);
  const exclusions = new Map(manifest.exclusions.map(value => [value.sourcePath, value.reason]));
  assert.equal(exclusions.size, manifest.exclusions.length, "Exclusion paths must be unique.");

  const inputs: LoreSourceInputV1[] = [];
  const encounteredExclusions = new Set<string>();
  for (const absolutePath of await listFiles(productionLoreRoot)) {
    const sourcePath = relative(repositoryRoot, absolutePath).replaceAll("\\", "/");
    const sourceText = await readFile(absolutePath, "utf8");
    if (sourceText.startsWith("---\n") || sourceText.startsWith("---\r\n")) {
      assert.equal(exclusions.has(sourcePath), false, `${sourcePath} is both compilable and excluded.`);
      inputs.push({ sourcePath, sourceText });
      continue;
    }
    assert.ok(exclusions.has(sourcePath), `${sourcePath} must be migrated or explicitly excluded.`);
    assert.ok(exclusions.get(sourcePath)?.trim(), `${sourcePath} exclusion must have a reason.`);
    encounteredExclusions.add(sourcePath);
  }
  assert.deepEqual(
    [...exclusions.keys()].sort(),
    [...encounteredExclusions].sort(),
    "The exclusion manifest must not contain stale paths."
  );

  const result = await compileLoreCorpusV1(inputs, {
    packageId: "jdr5e.production-lore",
    packageVersion: 1,
    catalogEntries: new Set<string>()
  });
  assert.equal(
    result.ok,
    true,
    result.ok ? undefined : result.diagnostics.map(value => `${value.sourcePath}: ${value.details.issue ?? value.code}`).join("\n")
  );
  if (!result.ok) return;
  assert.equal(result.value.entities.length, 25);
  assert.deepEqual(
    Object.fromEntries(
      [...new Set(result.value.entities.map(entity => entity.entityType))]
        .sort()
        .map(type => [type, result.value.entities.filter(entity => entity.entityType === type).length])
    ),
    { batiment: 7, faction: 3, meta: 3, quartier: 7, region: 3, royaume: 1, ville: 1 }
  );
  const archives = result.value.entities.find(entity => entity.entityId === "archives_de_lysenthe");
  assert.ok(archives, "The production package must include the Archives de Lysenthe.");
  const archivesDescriptor = result.value.manifest.entries.find(entry => entry.entryId === "archives_de_lysenthe");
  assert.ok(archivesDescriptor);
  assert.equal(archives.provenance.sourcePath, archivesDescriptor.sourcePath);
  assert.equal(archives.provenance.sourceFingerprint, archivesDescriptor.sourceFingerprint);
  const archivesFragments = result.value.fragments.filter(fragment => fragment.entityId === "archives_de_lysenthe");
  assert.ok(archivesFragments.length > 0, "The Archives must expose field-addressable lore fragments.");
  assert.ok(archivesFragments.every(fragment => fragment.fieldPath && fragment.provenance.sourcePath === archives.provenance.sourcePath));
  console.log("PASS [lore-compiler] Archives de Lysenthe retain file and field provenance.");
  console.log("PASS [lore-compiler] production corpus: 25 sources compiled, 1 explicit exclusion.");
}

async function verifyAuthorTemplates(): Promise<void> {
  const names = (await readdir(templateRoot))
    .filter(name => name.endsWith(".md") && name !== "README.md")
    .sort();
  assert.equal(names.length, 13);
  for (const name of names) {
    const result = await compileLoreSourceV1({
      sourcePath: `wiki/Template/lore-v1/${name}`,
      sourceText: await readFile(`${templateRoot}/${name}`, "utf8")
    }, options);
    assert.equal(
      result.ok,
      true,
      result.ok ? undefined : `${name}: ${result.diagnostics.map(value => value.details.issue ?? value.code).join(", ")}`
    );
  }
  console.log("PASS [lore-compiler] 13 author templates conform to lore-authoring/1.");
}

function selfContainedSources(authors: Map<LoreAuthorEntityV1["type"], LoreAuthorEntityV1>): LoreSourceInputV1[] {
  const species = clone(authors.get("espece")) as SpeciesLoreAuthorV1;
  species.regions_presence = [{ region: "external:ylssea", importance: "MAJEURE" }];

  const culture = clone(authors.get("culture")) as CultureLoreAuthorV1;
  culture.zones_associees = ["external:ylssea"];
  culture.relations_factions = ["external:archivistes_de_lysenthe"];
  culture.informations[0].entites_liees = ["external:archivistes_de_lysenthe"];

  const npc = clone(authors.get("pnj")) as NpcLoreAuthorV1;
  npc.lieu_initial = "external:archives_de_lysenthe";
  npc.factions = ["external:archivistes_de_lysenthe"];
  npc.informations[0].entites_liees = ["external:archives_de_lysenthe"];
  npc.informations.push({
    id: "preparation_privee",
    niveau: "MJ_SECRET",
    texte: "Maelis dissimule un registre soustrait aux collections.",
    sujets: ["registre caché"],
    entites_liees: ["external:registre_cache"]
  });

  const period = clone(authors.get("periode_historique")) as HistoricalPeriodLoreAuthorV1;
  period.territoires = ["external:astryade"];

  const event = clone(authors.get("evenement_historique")) as HistoricalEventLoreAuthorV1;
  event.lieux = ["external:archives_de_lysenthe"];
  event.participants = ["external:archivistes_de_lysenthe"];
  event.causes = [];
  event.informations[0].entites_liees = ["external:archives_de_lysenthe"];

  return [species, culture, npc, period, event].map(author => ({
    sourcePath: `wiki/lore/test/${author.type}/${author.id}.md`,
    sourceText: source(
      author,
      author.type === "pnj"
        ? "## [COMMUN] Présence publique\nMaelis est connue comme conservatrice.\n\n## [MJ_SECRET] Préparation\nElle protège un registre caché."
        : ""
    )
  }));
}

async function run(): Promise<void> {
  const authors = await loadAuthors();
  const inputs = selfContainedSources(authors);

  for (const input of inputs) {
    const first = await compileLoreSourceV1(input, options);
    const second = await compileLoreSourceV1(input, options);
    assert.equal(first.ok, true, `${input.sourcePath} should compile.`);
    assert.deepEqual(first, second, `${input.sourcePath} compilation must be deterministic.`);
    if (!first.ok) continue;
    assert.ok(/^sha256:[0-9a-f]{64}$/.test(first.value.descriptor.sourceFingerprint));
    assert.ok(/^sha256:[0-9a-f]{64}$/.test(first.value.descriptor.payloadFingerprint));
    assert.equal(first.value.entity.provenance.sourcePath.includes("\\"), false);
    assert.equal(
      new Set(first.value.fragments.map(fragment => fragment.fragmentId)).size,
      first.value.fragments.length,
      "Fragment ids must be unique."
    );
    console.log(`PASS [lore-compiler] source/${first.value.entity.entityType}`);
  }

  const normal = await compileLoreCorpusV1(inputs, options);
  const reversed = await compileLoreCorpusV1([...inputs].reverse(), options);
  assert.equal(normal.ok, true, normal.ok ? undefined : normal.diagnostics.map(value => value.code).join(", "));
  assert.deepEqual(normal, reversed, "Corpus output must not depend on source enumeration order.");
  if (!normal.ok) return;
  assert.equal(normal.value.entities.length, 5);
  assert.equal(normal.value.manifest.entries.length, 5);
  assert.ok(/^sha256:[0-9a-f]{64}$/.test(normal.value.manifest.rootFingerprint));

  const partition = partitionLoreFragmentsBySecrecy(normal.value.fragments);
  assert.ok(partition.secret.length >= 3, "Explicit and structured MJ secrets should be separated.");
  assert.equal(partition.indexable.some(fragment => fragment.knowledgeLevel === "MJ_SECRET"), false);
  assert.equal(partition.secret.every(fragment => fragment.knowledgeLevel === "MJ_SECRET"), true);
  assert.equal(
    partition.indexable.some(fragment => fragment.relatedEntityIds.includes("external:registre_cache")),
    false,
    "A secret relation must not leak through a public summary fragment."
  );
  assert.ok(partition.secret.some(fragment => fragment.relatedEntityIds.includes("external:registre_cache")));

  const missingReference = await compileLoreCorpusV1(
    inputs.filter(input => !input.sourcePath.includes("/culture/")),
    options
  );
  assert.equal(missingReference.ok, false);
  if (!missingReference.ok) {
    assert.ok(missingReference.diagnostics.some(value => value.code === "WIKI_REFERENCE_MISSING"));
  }

  const invalidKnowledgeInputs = selfContainedSources(authors);
  const npcInput = invalidKnowledgeInputs.find(input => input.sourcePath.includes("/pnj/"));
  assert.ok(npcInput);
  const invalidNpc = clone(authors.get("pnj")) as NpcLoreAuthorV1;
  invalidNpc.lieu_initial = "external:archives_de_lysenthe";
  invalidNpc.factions = ["external:archivistes_de_lysenthe"];
  invalidNpc.informations[0].entites_liees = ["external:archives_de_lysenthe"];
  invalidNpc.connaissances_initiales[0].information_id = "information_absente";
  npcInput.sourceText = source(invalidNpc);
  const invalidKnowledge = await compileLoreCorpusV1(invalidKnowledgeInputs, options);
  assert.equal(invalidKnowledge.ok, false);
  if (!invalidKnowledge.ok) {
    assert.ok(invalidKnowledge.diagnostics.some(value => value.code === "WIKI_KNOWLEDGE_TARGET_MISSING"));
  }

  const duplicate = await compileLoreCorpusV1([
    ...inputs,
    { ...inputs[0], sourcePath: "wiki/lore/test/duplicate.md" }
  ], options);
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.ok(duplicate.diagnostics.some(value => value.code === "WIKI_DUPLICATE_ID"));

  const invalidYaml = await compileLoreSourceV1({
    sourcePath: "wiki/lore/test/invalid-yaml.md",
    sourceText: "---\nschema_version: 1\nid: premier\nid: second\n---\n"
  }, options);
  assert.equal(invalidYaml.ok, false);
  if (!invalidYaml.ok) assert.ok(invalidYaml.diagnostics.some(value => value.code === "WIKI_YAML_INVALID"));

  const noFrontMatter = await compileLoreSourceV1({
    sourcePath: "wiki/lore/test/no-front-matter.md",
    sourceText: "Texte sans front matter."
  }, options);
  assert.equal(noFrontMatter.ok, false);
  if (!noFrontMatter.ok) {
    assert.ok(noFrontMatter.diagnostics.some(value => value.code === "WIKI_FRONT_MATTER_MISSING"));
  }

  const unclassified = await compileLoreSourceV1({
    sourcePath: "wiki\\lore\\test\\unclassified.md",
    sourceText: source(authors.get("espece") as SpeciesLoreAuthorV1, "Texte libre non classifié.")
  }, options);
  assert.equal(unclassified.ok, true);
  if (unclassified.ok) {
    assert.equal(unclassified.value.entity.provenance.sourcePath, "wiki/lore/test/unclassified.md");
    assert.ok(unclassified.value.diagnostics.some(value => value.code === "WIKI_BODY_UNCLASSIFIED"));
  }

  const duplicateBodySection = await compileLoreSourceV1({
    sourcePath: "wiki/lore/test/duplicate-body-section.md",
    sourceText: source(
      authors.get("espece") as SpeciesLoreAuthorV1,
      "## [COMMUN] Même titre\nPremier texte.\n\n## [LOCAL] Même titre\nSecond texte."
    )
  }, options);
  assert.equal(duplicateBodySection.ok, false);
  if (!duplicateBodySection.ok) {
    assert.ok(duplicateBodySection.diagnostics.some(value => value.messageKey === "lore.fragment-path.duplicate"));
  }

  console.log("PASS [lore-compiler] deterministic corpus, references, fragments, secrets and diagnostics.");
  await verifyAuthorTemplates();
  await verifyProductionCorpus();
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
