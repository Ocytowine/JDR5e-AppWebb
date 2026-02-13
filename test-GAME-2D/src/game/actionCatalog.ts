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
import SupportsActionSurge from "../data/supports/action-surge.json";
import SupportsCastMagic from "../data/supports/cast-magic.json";
import SupportsDisengage from "../data/supports/disengage.json";
import SupportsDivineSparkHeal from "../data/supports/divine-spark-heal.json";
import SupportsDivineSparkNecrotic from "../data/supports/divine-spark-necrotic.json";
import SupportsDivineSparkRadiant from "../data/supports/divine-spark-radiant.json";
import SupportsDodge from "../data/supports/dodge.json";
import SupportsHelp from "../data/supports/help.json";
import SupportsHide from "../data/supports/hide.json";
import SupportsIndomitable from "../data/supports/indomitable.json";
import SupportsInfluence from "../data/supports/influence.json";
import SupportsObserve from "../data/supports/observe.json";
import SupportsReadyAction from "../data/supports/ready-action.json";
import SupportsSecondWind from "../data/supports/second-wind.json";
import SupportsStudy from "../data/supports/study.json";
import SupportsTurnUndead from "../data/supports/turn-undead.json";
import SupportsUseItem from "../data/supports/use-item.json";
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
  "../supports/action-surge.json": SupportsActionSurge as ActionDefinition,
  "../supports/cast-magic.json": SupportsCastMagic as ActionDefinition,
  "../supports/disengage.json": SupportsDisengage as ActionDefinition,
  "../supports/divine-spark-heal.json": SupportsDivineSparkHeal as ActionDefinition,
  "../supports/divine-spark-necrotic.json": SupportsDivineSparkNecrotic as ActionDefinition,
  "../supports/divine-spark-radiant.json": SupportsDivineSparkRadiant as ActionDefinition,
  "../supports/dodge.json": SupportsDodge as ActionDefinition,
  "../supports/help.json": SupportsHelp as ActionDefinition,
  "../supports/hide.json": SupportsHide as ActionDefinition,
  "../supports/indomitable.json": SupportsIndomitable as ActionDefinition,
  "../supports/influence.json": SupportsInfluence as ActionDefinition,
  "../supports/observe.json": SupportsObserve as ActionDefinition,
  "../supports/ready-action.json": SupportsReadyAction as ActionDefinition,
  "../supports/second-wind.json": SupportsSecondWind as ActionDefinition,
  "../supports/study.json": SupportsStudy as ActionDefinition,
  "../supports/turn-undead.json": SupportsTurnUndead as ActionDefinition,
  "../supports/use-item.json": SupportsUseItem as ActionDefinition,
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
