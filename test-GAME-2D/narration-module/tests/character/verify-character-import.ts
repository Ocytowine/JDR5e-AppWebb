import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { computeJsonFingerprint } from "../../src/core/index";
import {
  importLegacyCharacterV1,
  type CharacterImportEnvelopeV1
} from "../../src/bootstrap/index";
import { assert } from "../contracts/assertions";
import { currentCharacterCatalog } from "../fixtures/character/currentCharacterCatalog";

const fixturePath = fileURLToPath(new URL("../fixtures/character/valid/creator-ready.json", import.meta.url));

function clone<T>(value: T): T {
  return structuredClone(value);
}

async function envelope(character: unknown, sourceSchemaVersion = 1): Promise<CharacterImportEnvelopeV1> {
  return {
    schemaVersion: 1,
    sourceKind: "CHARACTER_CREATOR_LEGACY",
    sourceSchemaVersion,
    sourceFingerprint: await computeJsonFingerprint(character) as `sha256:${string}`,
    character
  };
}

async function run(): Promise<void> {
  const base = JSON.parse(await readFile(fixturePath, "utf8")) as Record<string, any>;
  const catalog = currentCharacterCatalog();
  const options = { rulesetId: "rules.jdr5e", rulesetVersion: 1, catalog };
  const valid = await importLegacyCharacterV1(await envelope(base), options);
  assert.equal(valid.ok, true, valid.ok ? undefined : valid.diagnostics.map(value => value.code).join(", "));
  if (valid.ok) {
    assert.equal(valid.value.character.globalLevel, 1);
    assert.equal(valid.value.tacticalProjection.maximumHitPoints, 12);
    assert.equal(valid.value.tacticalProjection.armorClass, 16);
    assert.equal(valid.value.tacticalProjection.proficiencyBonus, 2);
    assert.equal(valid.value.narrativeProjection.observable.clothingState, "UNKNOWN");
    assert.deepEqual(valid.value.tacticalProjection.equippedItemInstanceIds, ["item-armure", "item-bourse", "item-epee"]);
  }
  const repeated = await importLegacyCharacterV1(await envelope(base), options);
  assert.deepEqual(repeated, valid, "Import and projections must be deterministic.");
  console.log("PASS [character-import] valid creator fixture and deterministic projections");

  const cases: Array<{ name: string; mutate: (value: Record<string, any>) => unknown; code: string; version?: number }> = [
    { name: "future version", mutate: value => value, code: "CHARACTER_VERSION_UNSUPPORTED", version: 2 },
    { name: "non-object", mutate: () => [], code: "CHARACTER_JSON_NOT_OBJECT" },
    { name: "missing id", mutate: value => { delete value.id; return value; }, code: "CHARACTER_ID_MISSING" },
    { name: "ability range", mutate: value => { value.caracs.force.FOR = 31; return value; }, code: "CHARACTER_ABILITY_OUT_OF_RANGE" },
    { name: "unknown class", mutate: value => { value.classe[1].classeId = "unknown"; return value; }, code: "CHARACTER_CLASS_UNKNOWN" },
    { name: "level mismatch", mutate: value => { value.niveauGlobal = 2; return value; }, code: "CHARACTER_GLOBAL_LEVEL_MISMATCH" },
    { name: "unknown item", mutate: value => { value.inventoryItems[0].id = "unknown"; return value; }, code: "CHARACTER_ITEM_UNKNOWN" },
    { name: "duplicate instance", mutate: value => { value.inventoryItems[1].instanceId = "item-armure"; return value; }, code: "CHARACTER_ITEM_INSTANCE_ID_DUPLICATE" },
    { name: "missing container", mutate: value => { value.inventoryItems[3].storedIn = "absent"; return value; }, code: "CHARACTER_CONTAINER_MISSING" },
    { name: "container cycle", mutate: value => { value.inventoryItems[2].storedIn = "item-bourse"; return value; }, code: "CHARACTER_CONTAINER_CYCLE" },
    { name: "slot mismatch", mutate: value => { value.materielSlots.corps = "item-epee"; return value; }, code: "CHARACTER_EQUIPMENT_SLOT_MISMATCH" },
    { name: "currency mismatch", mutate: value => { value.argent.or = 11; return value; }, code: "CHARACTER_CURRENCY_MISMATCH" },
    { name: "unknown action", mutate: value => { value.actionIds.push("unknown-action"); return value; }, code: "CHARACTER_ACTION_UNKNOWN" },
    { name: "unknown spell", mutate: value => { value.derived.grants.spells.push("unknown-spell"); return value; }, code: "CHARACTER_SPELL_UNKNOWN" },
    { name: "unknown capability", mutate: value => { value.derived.grants.features.push("unknown-feature"); return value; }, code: "CHARACTER_FEATURE_UNKNOWN" },
    { name: "resource overflow", mutate: value => { value.combatStats.resources.focus = { current: 2, max: 1 }; return value; }, code: "CHARACTER_RESOURCE_EXCEEDS_MAXIMUM" }
  ];
  for (const entry of cases) {
    const character = entry.mutate(clone(base));
    const result = await importLegacyCharacterV1(await envelope(character, entry.version), options);
    assert.equal(result.ok, false, `${entry.name} must be rejected.`);
    if (!result.ok) assert.ok(result.diagnostics.some(value => value.code === entry.code), `${entry.name}: expected ${entry.code}`);
    console.log(`PASS [character-import] rejects ${entry.name}`);
  }

  const withUnknown = clone(base);
  withUnknown.prototypeOnlyField = true;
  const warning = await importLegacyCharacterV1(await envelope(withUnknown), options);
  assert.equal(warning.ok, true);
  if (warning.ok) assert.ok(warning.value.diagnostics.some(value => value.code === "CHARACTER_UNKNOWN_PROPERTY"));
  console.log("PASS [character-import] unknown properties are diagnosed and discarded");
  console.log(`PASS [character-import] 1 valid fixture, ${cases.length} targeted rejections, projections and warnings.`);
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
