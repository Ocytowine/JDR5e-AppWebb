// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
// Source of truth: src/data (generated index)

import type { ActionDefinition } from "./engine/rules/actionTypes";
import actionsIndex from "../data/actions/index.json";
import SpellsAid from "../data/spells/aid.json";
import SpellsArcaneBolt from "../data/spells/arcane-bolt.json";
import SpellsAuraOfPurity from "../data/spells/aura-of-purity.json";
import SpellsBeaconOfHope from "../data/spells/beacon-of-hope.json";
import SpellsCantripsAcidSplash from "../data/spells/cantrips/acid-splash.json";
import SpellsCantripsFireBolt from "../data/spells/cantrips/fire-bolt.json";
import SpellsCantripsFrostbite from "../data/spells/cantrips/frostbite.json";
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

function normalizeActionDefinition(raw: unknown): ActionDefinition {
  const action = raw as Partial<ActionDefinition> & Record<string, unknown>;
  return {
    ...action,
    id: String(action.id ?? ""),
    name: String(action.name ?? ""),
    category: String(action.category ?? "support"),
    actionCost: (action.actionCost ?? { actionType: "action", movementCost: 0 }) as ActionDefinition["actionCost"],
    targeting: (action.targeting ?? {
      target: "self",
      range: { min: 0, max: 0, shape: "self" },
      maxTargets: 1,
      requiresLos: false
    }) as ActionDefinition["targeting"],
    usage: (action.usage ?? { perTurn: null, perEncounter: null, resource: null }) as ActionDefinition["usage"],
    conditions: Array.isArray(action.conditions) ? (action.conditions as ActionDefinition["conditions"]) : [],
    hooks: Array.isArray(action.hooks) ? (action.hooks as NonNullable<ActionDefinition["hooks"]>) : [],
    reactionWindows: Array.isArray(action.reactionWindows)
      ? (action.reactionWindows as NonNullable<ActionDefinition["reactionWindows"]>)
      : [],
    tags: Array.isArray(action.tags) ? (action.tags as string[]) : []
  } as ActionDefinition;
}

const ACTION_MODULES: Record<string, unknown> = {
  "../spells/aid.json": SpellsAid,
  "../spells/arcane-bolt.json": SpellsArcaneBolt,
  "../spells/aura-of-purity.json": SpellsAuraOfPurity,
  "../spells/beacon-of-hope.json": SpellsBeaconOfHope,
  "../spells/cantrips/acid-splash.json": SpellsCantripsAcidSplash,
  "../spells/cantrips/fire-bolt.json": SpellsCantripsFireBolt,
  "../spells/cantrips/frostbite.json": SpellsCantripsFrostbite,
  "../spells/greater-restoration.json": SpellsGreaterRestoration,
  "../spells/heroism.json": SpellsHeroism,
  "../spells/minor-ward.json": SpellsMinorWard,
  "../spells/rarys-telepathic-bond.json": SpellsRarysTelepathicBond,
  "../spells/rayon-de-feu.json": SpellsRayonDeFeu,
  "../spells/resilient-sphere.json": SpellsResilientSphere,
  "../spells/sanctuary.json": SpellsSanctuary,
  "../spells/sending.json": SpellsSending,
  "../spells/vague-ardente.json": SpellsVagueArdente,
  "../spells/warding-bond.json": SpellsWardingBond,
  "../attacks/bow-shot.json": AttacksBowShot,
  "../attacks/melee-strike.json": AttacksMeleeStrike,
  "../attacks/throw-dagger.json": AttacksThrowDagger,
  "../moves/dash.json": MovesDash,
  "../moves/move.json": MovesMove,
  "../supports/action-surge.json": SupportsActionSurge,
  "../supports/cast-magic.json": SupportsCastMagic,
  "../supports/disengage.json": SupportsDisengage,
  "../supports/divine-spark-heal.json": SupportsDivineSparkHeal,
  "../supports/divine-spark-necrotic.json": SupportsDivineSparkNecrotic,
  "../supports/divine-spark-radiant.json": SupportsDivineSparkRadiant,
  "../supports/dodge.json": SupportsDodge,
  "../supports/help.json": SupportsHelp,
  "../supports/hide.json": SupportsHide,
  "../supports/indomitable.json": SupportsIndomitable,
  "../supports/influence.json": SupportsInfluence,
  "../supports/observe.json": SupportsObserve,
  "../supports/ready-action.json": SupportsReadyAction,
  "../supports/second-wind.json": SupportsSecondWind,
  "../supports/study.json": SupportsStudy,
  "../supports/turn-undead.json": SupportsTurnUndead,
  "../supports/use-item.json": SupportsUseItem,
  "../items/torch-toggle.json": ItemsTorchToggle
};

export function loadActionTypesFromIndex(): ActionDefinition[] {
  const indexed = Array.isArray((actionsIndex as any).actions)
    ? ((actionsIndex as any).actions as string[])
    : [];

  const loaded: ActionDefinition[] = [];
  for (const path of indexed) {
    const mod = ACTION_MODULES[path];
    if (mod) {
      loaded.push(normalizeActionDefinition(mod));
    } else {
      console.warn("[actions] Action path missing in bundle:", path);
    }
  }

  if (loaded.length === 0) {
    console.warn("[actions] No actions loaded from index.json");
  }

  return loaded;
}
