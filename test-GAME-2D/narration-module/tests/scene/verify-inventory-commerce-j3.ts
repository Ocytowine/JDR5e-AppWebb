import assert from "node:assert/strict";
import type { CharacterAggregatePayloadV1 } from "../../src/bootstrap";
import {
  applyInventoryTransactionStateV1,
  INVENTORY_TRANSACTION_CONTRACT_V1,
  type ExternalInventoryOwnershipV1,
  type InventoryItemFactsPortV1,
  type InventoryTransactionCommandV1
} from "../../src/application";

const character = {
  inventory: [{ instanceId: "item:bourse", itemId: "obj_bourse", itemKind: "object", quantity: 1, equippedSlot: null, storedInInstanceId: null, primaryWeapon: false },
    { instanceId: "item:or", itemId: "obj_piece_or", itemKind: "object", quantity: 10, equippedSlot: null, storedInInstanceId: "item:bourse", primaryWeapon: false }],
  equipmentSlots: {}
} as unknown as CharacterAggregatePayloadV1;
const external: ExternalInventoryOwnershipV1 = {
  schemaVersion: 1, contractVersion: "external-inventory-ownership/1", version: 1,
  owners: [{ schemaVersion: 1, ownerRef: "npc:merchant", ownerKind: "NPC", sceneId: "scene:halles", displayName: "Marchand",
    acceptsDirectTransfers: true,
    inventory: [{ instanceId: "merchant:plume:1", itemId: "obj_plume_encre", itemKind: "object", quantity: 1, equippedSlot: null, storedInInstanceId: null, primaryWeapon: false, accessible: true }],
    offers: [
      { schemaVersion: 1, offerRef: "offer:sell-plume", direction: "SELL_TO_PLAYER", itemId: "obj_plume_encre", itemInstanceId: "merchant:plume:1", currencyItemId: "obj_piece_or", priceQuantity: 1, status: "ACTIVE" },
      { schemaVersion: 1, offerRef: "offer:buy-plume", direction: "BUY_FROM_PLAYER", itemId: "obj_plume_encre", itemInstanceId: null, currencyItemId: "obj_piece_or", priceQuantity: 1, status: "ACTIVE" }
    ] }]
};
const facts: InventoryItemFactsPortV1 = { resolve(itemId) {
  const values: Record<string, number> = { obj_bourse: 100, obj_piece_or: 100, obj_plume_encre: 100 };
  return itemId in values ? { schemaVersion: 1, itemId, label: itemId, weight: 0, containerCapacityWeight: itemId === "obj_bourse" ? 10 : null, allowedEquipmentSlots: [], sourceRefs: [`src/data/items:${itemId}`], valueInCopper: values[itemId]! } : null;
} };
const base = { schemaVersion: 1, contractVersion: INVENTORY_TRANSACTION_CONTRACT_V1, characterAggregateId: "character", tacticalProjectionAggregateId: "tactical", narrativeProjectionAggregateId: "narrative", actorRef: "actor:hero", containerInstanceId: null, equipmentSlot: null, externalInventoryAggregateId: "external", externalOwnerRef: "npc:merchant", activeSceneId: "scene:halles", occurredAtGameSecond: 0 } as const;

const bought = applyInventoryTransactionStateV1(character, external, {
  ...base, action: "BUY", itemInstanceId: "merchant:plume:1", offerRef: "offer:sell-plume"
} satisfies InventoryTransactionCommandV1, facts);
assert.equal(bought.ok, true);
if (!bought.ok) throw new Error("buy failed");
assert.equal(bought.character.inventory.find(item => item.itemId === "obj_piece_or")?.quantity, 9);
assert.equal(bought.character.inventory.some(item => item.instanceId === "merchant:plume:1"), true);
assert.equal(bought.external?.owners[0]?.inventory.some(item => item.itemId === "obj_piece_or"), true);

const sold = applyInventoryTransactionStateV1(bought.character, bought.external, {
  ...base, action: "SELL", itemInstanceId: "merchant:plume:1", offerRef: "offer:buy-plume"
} satisfies InventoryTransactionCommandV1, facts);
assert.equal(sold.ok, true);
if (!sold.ok) throw new Error("sale failed");
assert.equal(sold.character.inventory.find(item => item.itemId === "obj_piece_or")?.quantity, 10);
assert.equal(sold.character.inventory.some(item => item.itemId === "obj_plume_encre"), false);
assert.equal(sold.external?.owners[0]?.inventory.some(item => item.itemId === "obj_plume_encre"), true);
assert.equal(sold.external?.owners[0]?.inventory.some(item => item.itemId === "obj_piece_or"), false);

const forgedPrice = applyInventoryTransactionStateV1(character, external, {
  ...base, action: "BUY", itemInstanceId: "merchant:plume:1", offerRef: "offer:sell-plume"
} satisfies InventoryTransactionCommandV1, { resolve(itemId) {
  const resolved = facts.resolve(itemId);
  return resolved === null || itemId !== "obj_plume_encre" ? resolved : { ...resolved, valueInCopper: 200 };
} });
assert.equal(forgedPrice.ok, false);

console.log("inventory-commerce-j3: physical gold, catalog price, buy, sell and conservation verified");
