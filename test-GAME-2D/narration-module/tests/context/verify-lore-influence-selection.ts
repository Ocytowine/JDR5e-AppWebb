import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { compileLoreSourceV1, type LoreEntityV1, type LoreFragmentV1 } from "../../src/bootstrap/lore";
import { selectLoreInfluencesV1 } from "../../src/context";
import { assert } from "../contracts/assertions";

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const sourcePaths = [
  "wiki/lore/territoire/astryade",
  "wiki/lore/territoire/region/Ylsséa/index",
  "wiki/lore/territoire/region/Ylsséa/Lysenthe/index",
  "wiki/lore/territoire/region/Ylsséa/Lysenthe/quartiers/quartier_des_archives",
  "wiki/lore/territoire/region/Ylsséa/Lysenthe/batiments/archives_de_lysenthe",
  "wiki/lore/factions/archivistes_de_lysenthe",
  "wiki/lore/populations/especes/humains.md",
  "wiki/lore/populations/especes/elfes.md",
  "wiki/lore/populations/cultures/culture_cotiere_ylssea.md"
] as const;

async function compilePilot(): Promise<{ entities: LoreEntityV1[]; fragments: LoreFragmentV1[] }> {
  const entities: LoreEntityV1[] = [];
  const fragments: LoreFragmentV1[] = [];
  for (const sourcePath of sourcePaths) {
    const result = await compileLoreSourceV1({
      sourcePath,
      sourceText: await readFile(`${repositoryRoot}${sourcePath}`, "utf8")
    }, {
      packageId: "jdr5e.lore-influence-test",
      packageVersion: 1
    });
    assert.equal(result.ok, true, result.ok ? undefined : result.diagnostics.map(value => value.code).join(", "));
    if (!result.ok) continue;
    entities.push(result.value.entity);
    fragments.push(...result.value.fragments);
  }
  return { entities, fragments };
}

async function run(): Promise<void> {
  const pilot = await compilePilot();
  const input = {
    creationType: "SCENE" as const,
    anchorEntityId: "archives_de_lysenthe",
    ...pilot,
    allowedKnowledgeLevels: ["COMMUN", "LOCAL"] as const,
    maximumInfluences: 100
  };
  const first = selectLoreInfluencesV1(input);
  const second = selectLoreInfluencesV1(input);
  assert.deepEqual(first, second, "Lore influence selection must be deterministic.");
  assert.equal(first.ok, true);
  if (!first.ok) return;

  assert.deepEqual(first.packet.geographicChain, [
    "archives_de_lysenthe",
    "quartier_des_archives",
    "lysenthe",
    "ylssea",
    "astryade"
  ]);
  for (const relatedId of ["archivistes_de_lysenthe", "humains", "elfes", "culture_cotiere_ylssea"]) {
    assert.ok(first.packet.relatedEntityIds.includes(relatedId), `${relatedId} must influence the Archives scene.`);
    assert.ok(first.packet.influences.some(influence => influence.entityId === relatedId));
  }
  assert.ok(first.packet.influences.some(influence =>
    influence.entityId === "archives_de_lysenthe" && influence.degree === "STRICT_CANON"
  ));
  assert.ok(first.packet.influences.some(influence =>
    influence.entityId === "quartier_des_archives" && influence.degree === "LOCAL_GUIDANCE"
  ));
  assert.ok(first.packet.influences.some(influence =>
    influence.entityId === "ylssea" && influence.degree === "REGIONAL_GUIDANCE"
  ));
  assert.equal(first.packet.influences.some(influence => influence.knowledgeLevel === "MJ_SECRET"), false);
  assert.equal(new Set(first.packet.sourceRefs).size, first.packet.sourceRefs.length);

  const bounded = selectLoreInfluencesV1({ ...input, maximumInfluences: 5 });
  assert.equal(bounded.ok, true);
  if (bounded.ok) {
    assert.equal(bounded.packet.influences.length, 5);
    assert.ok(bounded.packet.diagnostics.includes("influence budget reached"));
  }

  const missing = selectLoreInfluencesV1({ ...input, anchorEntityId: "missing" });
  assert.deepEqual(missing, {
    ok: false,
    code: "LORE_ANCHOR_NOT_FOUND",
    issues: ["Unknown lore anchor: missing."]
  });
  console.log("lore-influence-packet/1: deterministic geography, related culture/faction/species, visibility and budget OK");
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
