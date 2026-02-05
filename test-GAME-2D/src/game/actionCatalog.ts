// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
// Source of truth: action-game/actions/catalog (generated index)

import type { ActionDefinition } from "./actionTypes";
import actionsIndex from "../../action-game/actions/index.json";
import CatalogCombatBowShot from "../../action-game/actions/catalog/combat/bow-shot.json";
import CatalogCombatMeleeStrike from "../../action-game/actions/catalog/combat/melee-strike.json";
import CatalogCombatSpellsAid from "../../action-game/actions/catalog/combat/spells/aid.json";
import CatalogCombatSpellsArcaneBolt from "../../action-game/actions/catalog/combat/spells/arcane-bolt.json";
import CatalogCombatSpellsAuraOfPurity from "../../action-game/actions/catalog/combat/spells/aura-of-purity.json";
import CatalogCombatSpellsBeaconOfHope from "../../action-game/actions/catalog/combat/spells/beacon-of-hope.json";
import CatalogCombatSpellsGreaterRestoration from "../../action-game/actions/catalog/combat/spells/greater-restoration.json";
import CatalogCombatSpellsHeroism from "../../action-game/actions/catalog/combat/spells/heroism.json";
import CatalogCombatSpellsMinorWard from "../../action-game/actions/catalog/combat/spells/minor-ward.json";
import CatalogCombatSpellsRarysTelepathicBond from "../../action-game/actions/catalog/combat/spells/rarys-telepathic-bond.json";
import CatalogCombatSpellsResilientSphere from "../../action-game/actions/catalog/combat/spells/resilient-sphere.json";
import CatalogCombatSpellsSanctuary from "../../action-game/actions/catalog/combat/spells/sanctuary.json";
import CatalogCombatSpellsSending from "../../action-game/actions/catalog/combat/spells/sending.json";
import CatalogCombatSpellsWardingBond from "../../action-game/actions/catalog/combat/spells/warding-bond.json";
import CatalogCombatThrowDagger from "../../action-game/actions/catalog/combat/throw-dagger.json";
import CatalogItemsTorchToggle from "../../action-game/actions/catalog/items/torch-toggle.json";
import CatalogMovementDash from "../../action-game/actions/catalog/movement/dash.json";
import CatalogMovementMove from "../../action-game/actions/catalog/movement/move.json";
import CatalogSupportSecondWind from "../../action-game/actions/catalog/support/second-wind.json";

const ACTION_MODULES: Record<string, ActionDefinition> = {
  "./catalog/combat/bow-shot.json": CatalogCombatBowShot as ActionDefinition,
  "./catalog/combat/melee-strike.json": CatalogCombatMeleeStrike as ActionDefinition,
  "./catalog/combat/spells/aid.json": CatalogCombatSpellsAid as ActionDefinition,
  "./catalog/combat/spells/arcane-bolt.json": CatalogCombatSpellsArcaneBolt as ActionDefinition,
  "./catalog/combat/spells/aura-of-purity.json": CatalogCombatSpellsAuraOfPurity as ActionDefinition,
  "./catalog/combat/spells/beacon-of-hope.json": CatalogCombatSpellsBeaconOfHope as ActionDefinition,
  "./catalog/combat/spells/greater-restoration.json": CatalogCombatSpellsGreaterRestoration as ActionDefinition,
  "./catalog/combat/spells/heroism.json": CatalogCombatSpellsHeroism as ActionDefinition,
  "./catalog/combat/spells/minor-ward.json": CatalogCombatSpellsMinorWard as ActionDefinition,
  "./catalog/combat/spells/rarys-telepathic-bond.json": CatalogCombatSpellsRarysTelepathicBond as ActionDefinition,
  "./catalog/combat/spells/resilient-sphere.json": CatalogCombatSpellsResilientSphere as ActionDefinition,
  "./catalog/combat/spells/sanctuary.json": CatalogCombatSpellsSanctuary as ActionDefinition,
  "./catalog/combat/spells/sending.json": CatalogCombatSpellsSending as ActionDefinition,
  "./catalog/combat/spells/warding-bond.json": CatalogCombatSpellsWardingBond as ActionDefinition,
  "./catalog/combat/throw-dagger.json": CatalogCombatThrowDagger as ActionDefinition,
  "./catalog/items/torch-toggle.json": CatalogItemsTorchToggle as ActionDefinition,
  "./catalog/movement/dash.json": CatalogMovementDash as ActionDefinition,
  "./catalog/movement/move.json": CatalogMovementMove as ActionDefinition,
  "./catalog/support/second-wind.json": CatalogSupportSecondWind as ActionDefinition
};

export function loadActionTypesFromIndex(): ActionDefinition[] {
  const indexed = Array.isArray((actionsIndex as any).actions)
    ? ((actionsIndex as any).actions as string[])
    : [];

  const loaded: ActionDefinition[] = [];
  for (const path of indexed) {
    const mod = ACTION_MODULES[path];
    if (mod) {
      loaded.push(mod);
    } else {
      console.warn("[actions] Action path missing in bundle:", path);
    }
  }

  if (loaded.length === 0) {
    console.warn("[actions] No actions loaded from index.json");
  }

  return loaded;
}
