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
import SpellsRayonDeFeu from "../data/spells/rayon-de-feu.json";
import SpellsResilientSphere from "../data/spells/resilient-sphere.json";
import SpellsSanctuary from "../data/spells/sanctuary.json";
import SpellsSending from "../data/spells/sending.json";
import SpellsVagueArdente from "../data/spells/vague-ardente.json";
import SpellsWardingBond from "../data/spells/warding-bond.json";
import AttacksBowShot from "../data/attacks/bow-shot.json";
import AttacksMeleeStrike from "../data/attacks/melee-strike.json";
import AttacksThrowDagger from "../data/attacks/throw-dagger.json";
import MovesDash from "../data/moves/dash.json";
import MovesMove from "../data/moves/move.json";
import SupportsSecondWind from "../data/supports/second-wind.json";
import ItemsTorchToggle from "../data/items/torch-toggle.json";
import WeaponMasteryCoupDouble from "../data/actions/weapon-mastery/wm-coup-double.json";
import WeaponMasteryEcorchure from "../data/actions/weapon-mastery/wm-ecorchure.json";
import WeaponMasteryEnchainement from "../data/actions/weapon-mastery/wm-enchainement.json";
import WeaponMasteryOuverture from "../data/actions/weapon-mastery/wm-ouverture.json";
import WeaponMasteryPoussee from "../data/actions/weapon-mastery/wm-poussee.json";
import WeaponMasteryRalentissement from "../data/actions/weapon-mastery/wm-ralentissement.json";
import WeaponMasteryRenversement from "../data/actions/weapon-mastery/wm-renversement.json";
import WeaponMasterySape from "../data/actions/weapon-mastery/wm-sape.json";

const ACTION_MODULES: Record<string, ActionDefinition> = {
  "../spells/aid.json": SpellsAid as ActionDefinition,
  "../spells/arcane-bolt.json": SpellsArcaneBolt as ActionDefinition,
  "../spells/aura-of-purity.json": SpellsAuraOfPurity as ActionDefinition,
  "../spells/beacon-of-hope.json": SpellsBeaconOfHope as ActionDefinition,
  "../spells/greater-restoration.json": SpellsGreaterRestoration as ActionDefinition,
  "../spells/heroism.json": SpellsHeroism as ActionDefinition,
  "../spells/minor-ward.json": SpellsMinorWard as ActionDefinition,
  "../spells/rarys-telepathic-bond.json": SpellsRarysTelepathicBond as ActionDefinition,
  "../spells/rayon-de-feu.json": SpellsRayonDeFeu as ActionDefinition,
  "../spells/resilient-sphere.json": SpellsResilientSphere as ActionDefinition,
  "../spells/sanctuary.json": SpellsSanctuary as ActionDefinition,
  "../spells/sending.json": SpellsSending as ActionDefinition,
  "../spells/vague-ardente.json": SpellsVagueArdente as ActionDefinition,
  "../spells/warding-bond.json": SpellsWardingBond as ActionDefinition,
  "../attacks/bow-shot.json": AttacksBowShot as ActionDefinition,
  "../attacks/melee-strike.json": AttacksMeleeStrike as ActionDefinition,
  "../attacks/throw-dagger.json": AttacksThrowDagger as ActionDefinition,
  "../moves/dash.json": MovesDash as ActionDefinition,
  "../moves/move.json": MovesMove as ActionDefinition,
  "../supports/second-wind.json": SupportsSecondWind as ActionDefinition,
  "../items/torch-toggle.json": ItemsTorchToggle as ActionDefinition,
  "./weapon-mastery/wm-coup-double.json": WeaponMasteryCoupDouble as ActionDefinition,
  "./weapon-mastery/wm-ecorchure.json": WeaponMasteryEcorchure as ActionDefinition,
  "./weapon-mastery/wm-enchainement.json": WeaponMasteryEnchainement as ActionDefinition,
  "./weapon-mastery/wm-ouverture.json": WeaponMasteryOuverture as ActionDefinition,
  "./weapon-mastery/wm-poussee.json": WeaponMasteryPoussee as ActionDefinition,
  "./weapon-mastery/wm-ralentissement.json": WeaponMasteryRalentissement as ActionDefinition,
  "./weapon-mastery/wm-renversement.json": WeaponMasteryRenversement as ActionDefinition,
  "./weapon-mastery/wm-sape.json": WeaponMasterySape as ActionDefinition
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
