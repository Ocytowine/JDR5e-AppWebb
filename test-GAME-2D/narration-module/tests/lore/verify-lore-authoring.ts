import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  validateLoreAuthorEntityV1,
  type LoreAuthorEntityV1,
  type LoreEntityTypeV1
} from "../../src/bootstrap/lore";
import { assert } from "../contracts/assertions";

const fixtureRoot = fileURLToPath(new URL("../fixtures/lore/", import.meta.url));
const expectedTypes = new Set<LoreEntityTypeV1>([
  "espece",
  "culture",
  "pnj",
  "periode_historique",
  "evenement_historique"
]);

async function loadFixtures(kind: "valid" | "invalid"): Promise<Array<{ name: string; value: unknown }>> {
  const directory = `${fixtureRoot}${kind}`;
  const names = (await readdir(directory)).filter(name => name.endsWith(".json")).sort();
  return Promise.all(names.map(async name => ({
    name,
    value: JSON.parse(await readFile(`${directory}/${name}`, "utf8")) as unknown
  })));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function run(): Promise<void> {
  const validFixtures = await loadFixtures("valid");
  const invalidFixtures = await loadFixtures("invalid");
  assert.equal(validFixtures.length, 5, "Five valid lore fixtures are required.");
  assert.equal(invalidFixtures.length, 5, "Five invalid lore fixtures are required.");

  const observedTypes = new Set<LoreEntityTypeV1>();
  const validEntities = new Map<LoreEntityTypeV1, LoreAuthorEntityV1>();
  for (const fixture of validFixtures) {
    const result = validateLoreAuthorEntityV1(fixture.value);
    assert.equal(result.valid, true, `${fixture.name} should be valid${result.valid ? "" : `: ${result.issues.join("; ")}`}`);
    if (!result.valid) continue;
    observedTypes.add(result.value.type);
    validEntities.set(result.value.type, result.value);
    console.log(`PASS [lore-authoring] valid/${fixture.name}`);
  }
  assert.deepEqual([...observedTypes].sort(), [...expectedTypes].sort(), "Every lore type needs a valid fixture.");

  for (const fixture of invalidFixtures) {
    const result = validateLoreAuthorEntityV1(fixture.value);
    assert.equal(result.valid, false, `${fixture.name} should be rejected.`);
    console.log(`PASS [lore-authoring] invalid/${fixture.name}`);
  }

  const species = clone(validEntities.get("espece"));
  assert.ok(species && species.type === "espece");
  species.biologie = { ...species.biologie, unexpected: true } as typeof species.biologie;
  assert.equal(validateLoreAuthorEntityV1(species).valid, false, "Unknown nested fields must be rejected.");

  const event = clone(validEntities.get("evenement_historique"));
  assert.ok(event && event.type === "evenement_historique");
  event.informations.push(clone(event.informations[0]));
  assert.equal(validateLoreAuthorEntityV1(event).valid, false, "Information ids must be unique per entity.");

  console.log("PASS [lore-authoring] 5 valid fixtures, 5 targeted rejections and strict semantic checks.");
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
