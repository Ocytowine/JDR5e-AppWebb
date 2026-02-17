import fs from "node:fs";
import path from "node:path";
import {
  canConsumeActionCost,
  consumeActionCost,
  refundActionCost,
  getMaxMainActionsPerTurn
} from "../src/game/engine/rules/actionEconomy.ts";
import { getDualWieldConstraintIssues } from "../src/game/engine/rules/weaponPairingRules.ts";

type Usage = { usedActionCount: number; usedBonusCount: number };

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const surgePath = path.resolve("src/data/characters/features/fighter/action-surge.json");
const surge = JSON.parse(fs.readFileSync(surgePath, "utf8"));
const surgeEffect =
  surge?.rules?.runtimeEffects?.[0]?.effects?.find((e: any) => String(e?.kind ?? "") === "grantMainAction") ?? null;

assert(Boolean(surgeEffect), "action-surge: runtimeEffect grantMainAction introuvable");
assert(Number(surgeEffect.amount ?? 0) === 1, "action-surge: amount attendu = 1");

console.log("[OK] action-surge.json -> grantMainAction amount=1");

let usage: Usage = { usedActionCount: 0, usedBonusCount: 0 };
let budget = { actionsPerTurn: 1, bonusActionsPerTurn: 1, bonusMainActionsThisTurn: 0 };

assert(canConsumeActionCost({ costType: "action", usage, budget }).ok, "Action #1 devrait etre autorisee");
usage = consumeActionCost(usage, "action");
assert(usage.usedActionCount === 1, "usedActionCount devrait valoir 1");
assert(!canConsumeActionCost({ costType: "action", usage, budget }).ok, "Action #2 devrait etre bloquee sans bonus");
console.log("[OK] cycle action de base: 1 action autorisee puis blocage");

budget = { ...budget, bonusMainActionsThisTurn: Number(surgeEffect.amount ?? 0) };
assert(getMaxMainActionsPerTurn(budget) === 2, "Max main actions attendu = 2 apres Action Surge");
assert(canConsumeActionCost({ costType: "action", usage, budget }).ok, "Action #2 devrait etre autorisee apres Action Surge");
usage = consumeActionCost(usage, "action");
assert(usage.usedActionCount === 2, "usedActionCount devrait valoir 2 apres action supplementaire");
assert(!canConsumeActionCost({ costType: "action", usage, budget }).ok, "Action #3 devrait etre bloquee");
console.log("[OK] action-surge: action supplementaire accordee puis blocage");

let bonusUsage: Usage = { usedActionCount: 0, usedBonusCount: 0 };
const bonusBudget = { actionsPerTurn: 1, bonusActionsPerTurn: 1, bonusMainActionsThisTurn: 0 };

assert(canConsumeActionCost({ costType: "bonus", usage: bonusUsage, budget: bonusBudget }).ok, "Bonus #1 devrait etre autorisee");
bonusUsage = consumeActionCost(bonusUsage, "bonus");
assert(bonusUsage.usedBonusCount === 1, "usedBonusCount devrait valoir 1");
assert(!canConsumeActionCost({ costType: "bonus", usage: bonusUsage, budget: bonusBudget }).ok, "Bonus #2 devrait etre bloquee");
console.log("[OK] cycle bonus de base: 1 bonus autorisee puis blocage");

bonusUsage = refundActionCost(bonusUsage, "bonus");
assert(bonusUsage.usedBonusCount === 0, "Rollback bonus attendu a 0");
assert(canConsumeActionCost({ costType: "bonus", usage: bonusUsage, budget: bonusBudget }).ok, "Bonus devrait redevenir autorisee apres rollback");
console.log("[OK] rollback bonus: compteur restaure correctement");

const dualWieldAction: any = {
  id: "offhand-test",
  name: "Attaque secondaire test",
  category: "attack",
  actionCost: { actionType: "bonus", movementCost: 0 },
  tags: ["offhand-attack"]
};
const weaponById = new Map<string, any>([
  ["dague-a", { id: "dague-a", category: "simple", properties: { light: true } }],
  ["dague-b", { id: "dague-b", category: "simple", properties: { light: true } }]
]);
const armorById = new Map<string, any>();

const oneWeaponIssues = getDualWieldConstraintIssues({
  action: dualWieldAction,
  inventoryItems: [
    {
      type: "weapon",
      id: "dague-a",
      equippedSlot: "ceinture_gauche",
      storedIn: null,
      isPrimaryWeapon: true,
      isSecondaryHand: false
    }
  ],
  weaponById,
  armorById
});
assert(
  oneWeaponIssues.some(issue => issue.includes("deux armes pretes")),
  "Avec une seule arme, l'attaque secondaire devrait etre ineligible"
);

const twoWeaponIssues = getDualWieldConstraintIssues({
  action: dualWieldAction,
  inventoryItems: [
    {
      type: "weapon",
      id: "dague-a",
      equippedSlot: "ceinture_gauche",
      storedIn: null,
      isPrimaryWeapon: true,
      isSecondaryHand: false
    },
    {
      type: "weapon",
      id: "dague-b",
      equippedSlot: "ceinture_droite",
      storedIn: null,
      isPrimaryWeapon: false,
      isSecondaryHand: true
    }
  ],
  weaponById,
  armorById
});
assert(twoWeaponIssues.length === 0, "Avec deux armes light, l'attaque secondaire devrait etre eligible");
console.log("[OK] dual-wield: 1 arme=ineligible, 2 armes=eligible (si bonus dispo)");

console.log("\nVerification de bout en bout reussie.");
