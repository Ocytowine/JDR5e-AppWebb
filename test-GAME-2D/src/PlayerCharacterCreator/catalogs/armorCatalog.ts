import type { ArmorItemDefinition } from "../../game/armorTypes";

import armorsIndex from "../../../materiel-type/armures/index.json";
import cuir from "../../../materiel-type/armures/cuir.json";
import cuirCloute from "../../../materiel-type/armures/cuir-cloute.json";
import chemiseMailles from "../../../materiel-type/armures/chemise-mailles.json";
import demiPlaque from "../../../materiel-type/armures/demi-plaque.json";
import cotteMailles from "../../../materiel-type/armures/cotte-mailles.json";
import harnois from "../../../materiel-type/armures/harnois.json";
import bouclier from "../../../materiel-type/armures/bouclier.json";

const ARMOR_MODULES: Record<string, ArmorItemDefinition> = {
  "./cuir.json": cuir as ArmorItemDefinition,
  "./cuir-cloute.json": cuirCloute as ArmorItemDefinition,
  "./chemise-mailles.json": chemiseMailles as ArmorItemDefinition,
  "./demi-plaque.json": demiPlaque as ArmorItemDefinition,
  "./cotte-mailles.json": cotteMailles as ArmorItemDefinition,
  "./harnois.json": harnois as ArmorItemDefinition,
  "./bouclier.json": bouclier as ArmorItemDefinition
};

export function loadArmorItemsFromIndex(): ArmorItemDefinition[] {
  const indexed = Array.isArray((armorsIndex as any).types)
    ? ((armorsIndex as any).types as string[])
    : [];

  const loaded: ArmorItemDefinition[] = [];
  for (const path of indexed) {
    const mod = ARMOR_MODULES[path];
    if (mod) {
      loaded.push(mod);
    } else {
      console.warn("[armors] Type path missing in bundle:", path);
    }
  }

  return loaded;
}
