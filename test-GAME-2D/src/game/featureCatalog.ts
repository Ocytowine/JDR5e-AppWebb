import type { FeatureDefinition } from "./featureTypes";

import featuresIndex from "../data/features/index.json";
import channelDivinity from "../data/features/cleric/channel-divinity.json";
import turnUndead from "../data/features/cleric/turn-undead.json";
import divineIntervention from "../data/features/cleric/divine-intervention.json";
import peaceBond from "../data/features/cleric/peace-bond.json";
import balmOfPeace from "../data/features/cleric/balm-of-peace.json";
import protectiveBond from "../data/features/cleric/protective-bond.json";
import expansiveBond from "../data/features/cleric/expansive-bond.json";

const FEATURE_MODULES: Record<string, FeatureDefinition> = {
  "./cleric/channel-divinity.json": channelDivinity as FeatureDefinition,
  "./cleric/turn-undead.json": turnUndead as FeatureDefinition,
  "./cleric/divine-intervention.json": divineIntervention as FeatureDefinition,
  "./cleric/peace-bond.json": peaceBond as FeatureDefinition,
  "./cleric/balm-of-peace.json": balmOfPeace as FeatureDefinition,
  "./cleric/protective-bond.json": protectiveBond as FeatureDefinition,
  "./cleric/expansive-bond.json": expansiveBond as FeatureDefinition
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

