// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
// Source of truth: src/data (generated index)

import type { ActionDefinition } from "./actionTypes";
import actionsIndex from "../data/actions/index.json";
import SpellsAid from "../data/spells/aid.json";
import SpellsArcaneBolt from "../data/spells/arcane-bolt.json";
import SpellsAuraOfPurity from "../data/spells/aura-of-purity.json";
import SpellsBeaconOfHope from "../data/spells/beacon-of-hope.json";
import SpellsGreaterRestoration from "../data/spells/greater-restoration.json";
import SpellsHeroism from "../data/spells/heroism.json";
import SpellsMinorWard from "../data/spells/minor-ward.json";
import SpellsRarysTelepathicBond from "../data/spells/rarys-telepathic-bond.json";
import SpellsResilientSphere from "../data/spells/resilient-sphere.json";
import SpellsSanctuary from "../data/spells/sanctuary.json";
import SpellsSending from "../data/spells/sending.json";
import SpellsWardingBond from "../data/spells/warding-bond.json";
import AttacksBowShot from "../data/attacks/bow-shot.json";
import AttacksMeleeStrike from "../data/attacks/melee-strike.json";
import AttacksThrowDagger from "../data/attacks/throw-dagger.json";
import MovesDash from "../data/moves/dash.json";
import MovesMove from "../data/moves/move.json";
import SupportsSecondWind from "../data/supports/second-wind.json";
import ItemsTorchToggle from "../data/items/torch-toggle.json";

const ACTION_MODULES: Record<string, ActionDefinition> = {
  "../spells/aid.json": SpellsAid as ActionDefinition,
  "../spells/arcane-bolt.json": SpellsArcaneBolt as ActionDefinition,
  "../spells/aura-of-purity.json": SpellsAuraOfPurity as ActionDefinition,
  "../spells/beacon-of-hope.json": SpellsBeaconOfHope as ActionDefinition,
  "../spells/greater-restoration.json": SpellsGreaterRestoration as ActionDefinition,
  "../spells/heroism.json": SpellsHeroism as ActionDefinition,
  "../spells/minor-ward.json": SpellsMinorWard as ActionDefinition,
  "../spells/rarys-telepathic-bond.json": SpellsRarysTelepathicBond as ActionDefinition,
  "../spells/resilient-sphere.json": SpellsResilientSphere as ActionDefinition,
  "../spells/sanctuary.json": SpellsSanctuary as ActionDefinition,
  "../spells/sending.json": SpellsSending as ActionDefinition,
  "../spells/warding-bond.json": SpellsWardingBond as ActionDefinition,
  "../attacks/bow-shot.json": AttacksBowShot as ActionDefinition,
  "../attacks/melee-strike.json": AttacksMeleeStrike as ActionDefinition,
  "../attacks/throw-dagger.json": AttacksThrowDagger as ActionDefinition,
  "../moves/dash.json": MovesDash as ActionDefinition,
  "../moves/move.json": MovesMove as ActionDefinition,
  "../supports/second-wind.json": SupportsSecondWind as ActionDefinition,
  "../items/torch-toggle.json": ItemsTorchToggle as ActionDefinition
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
