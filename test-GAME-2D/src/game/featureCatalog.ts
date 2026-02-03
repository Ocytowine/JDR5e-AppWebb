import type { FeatureDefinition } from "./featureTypes";

import featuresIndex from "../../action-game/features/index.json";
import channelDivinity from "../../action-game/features/catalog/cleric/channel-divinity.json";
import turnUndead from "../../action-game/features/catalog/cleric/turn-undead.json";
import divineIntervention from "../../action-game/features/catalog/cleric/divine-intervention.json";
import peaceBond from "../../action-game/features/catalog/cleric/peace-bond.json";
import balmOfPeace from "../../action-game/features/catalog/cleric/balm-of-peace.json";
import protectiveBond from "../../action-game/features/catalog/cleric/protective-bond.json";
import expansiveBond from "../../action-game/features/catalog/cleric/expansive-bond.json";

const FEATURE_MODULES: Record<string, FeatureDefinition> = {
  "./catalog/cleric/channel-divinity.json": channelDivinity as FeatureDefinition,
  "./catalog/cleric/turn-undead.json": turnUndead as FeatureDefinition,
  "./catalog/cleric/divine-intervention.json": divineIntervention as FeatureDefinition,
  "./catalog/cleric/peace-bond.json": peaceBond as FeatureDefinition,
  "./catalog/cleric/balm-of-peace.json": balmOfPeace as FeatureDefinition,
  "./catalog/cleric/protective-bond.json": protectiveBond as FeatureDefinition,
  "./catalog/cleric/expansive-bond.json": expansiveBond as FeatureDefinition
};

export function loadFeatureTypesFromIndex(): FeatureDefinition[] {
  const indexed = Array.isArray((featuresIndex as any).features)
    ? ((featuresIndex as any).features as string[])
    : [];

  const loaded: FeatureDefinition[] = [];
  for (const path of indexed) {
    const mod = FEATURE_MODULES[path];
    if (mod) {
      loaded.push(mod);
    } else {
      console.warn("[features] Type path missing in bundle:", path);
    }
  }

  if (loaded.length === 0) {
    console.warn("[features] No features loaded from index.json");
  }

  return loaded;
}
