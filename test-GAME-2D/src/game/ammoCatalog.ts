import type { AmmoItemDefinition } from "./ammoTypes";

import ammoIndex from "../data/items/armes/munitions/index.json";
import Arrow from "../data/items/armes/munitions/arrow.json";
import Bolt from "../data/items/armes/munitions/bolt.json";
import Bullet from "../data/items/armes/munitions/bullet.json";
import Dart from "../data/items/armes/munitions/dart.json";
import Stone from "../data/items/armes/munitions/stone.json";
import Needle from "../data/items/armes/munitions/needle.json";

const AMMO_MODULES: Record<string, AmmoItemDefinition> = {
  "./arrow.json": Arrow as AmmoItemDefinition,
  "./bolt.json": Bolt as AmmoItemDefinition,
  "./bullet.json": Bullet as AmmoItemDefinition,
  "./dart.json": Dart as AmmoItemDefinition,
  "./stone.json": Stone as AmmoItemDefinition,
  "./needle.json": Needle as AmmoItemDefinition
};

export function loadAmmoTypesFromIndex(): AmmoItemDefinition[] {
  const indexed = Array.isArray((ammoIndex as any).types)
    ? ((ammoIndex as any).types as string[])
    : [];

  const loaded: AmmoItemDefinition[] = [];
  for (const path of indexed) {
    const mod = AMMO_MODULES[path];
    if (mod) {
      loaded.push(mod);
    } else {
      console.warn("[ammo-types] Type path missing in bundle:", path);
    }
  }

  if (loaded.length === 0) {
    console.warn("[ammo-types] No ammo loaded from index.json");
  }

  return loaded;
}
