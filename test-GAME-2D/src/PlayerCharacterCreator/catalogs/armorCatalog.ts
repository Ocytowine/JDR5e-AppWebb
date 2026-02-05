// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
// Source of truth: materiel-type/armures (generated indexes)

import type { ArmorItemDefinition } from "../../game/armorTypes";


import armorsIndex from "../../../materiel-type/armures/index.json";
import Bouclier from "../../../materiel-type/armures/bouclier.json";
import ChemiseMailles from "../../../materiel-type/armures/chemise-mailles.json";
import CotteMailles from "../../../materiel-type/armures/cotte-mailles.json";
import CuirCloute from "../../../materiel-type/armures/cuir-cloute.json";
import Cuir from "../../../materiel-type/armures/cuir.json";
import DemiPlaque from "../../../materiel-type/armures/demi-plaque.json";
import Harnois from "../../../materiel-type/armures/harnois.json";

const ARMOR_MODULES: Record<string, ArmorItemDefinition> = {
  "./bouclier.json": Bouclier as ArmorItemDefinition,
  "./chemise-mailles.json": ChemiseMailles as ArmorItemDefinition,
  "./cotte-mailles.json": CotteMailles as ArmorItemDefinition,
  "./cuir-cloute.json": CuirCloute as ArmorItemDefinition,
  "./cuir.json": Cuir as ArmorItemDefinition,
  "./demi-plaque.json": DemiPlaque as ArmorItemDefinition,
  "./harnois.json": Harnois as ArmorItemDefinition
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

  if (loaded.length === 0) {
    console.warn("[armors] No armors loaded from index.json");
  }

  return loaded;
}
