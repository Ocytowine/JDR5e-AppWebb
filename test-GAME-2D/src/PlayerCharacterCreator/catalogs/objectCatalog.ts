// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
// Source of truth: src/data/items/objets (generated indexes)

import type { ObjectItemDefinition } from "../../game/objectTypes";


import objectsIndex from "../../data/items/objets/index.json";
import ObjBesace from "../../data/items/objets/obj-besace.json";
import ObjBourse from "../../data/items/objets/obj-bourse.json";
import ObjGrimoire from "../../data/items/objets/obj-grimoire.json";
import ObjInsigneUnite from "../../data/items/objets/obj-insigne-unite.json";
import ObjPlumeEncre from "../../data/items/objets/obj-plume-encre.json";
import ObjSacADos from "../../data/items/objets/obj-sac-a-dos.json";
import ObjSacVoyage from "../../data/items/objets/obj-sac-voyage.json";
import ObjSouvenirVole from "../../data/items/objets/obj-souvenir-vole.json";
import ObjSymboleSacre from "../../data/items/objets/obj-symbole-sacre.json";
import ObjTenueAcademique from "../../data/items/objets/obj-tenue-academique.json";
import ObjVetementsCommuns from "../../data/items/objets/obj-vetements-communs.json";
import ObjVetementsVoyage from "../../data/items/objets/obj-vetements-voyage.json";
import PieceArgent from "../../data/items/objets/piece-argent.json";
import PieceCuivre from "../../data/items/objets/piece-cuivre.json";
import PieceOr from "../../data/items/objets/piece-or.json";
import PiecePlatine from "../../data/items/objets/piece-platine.json";

const OBJECT_MODULES: Record<string, ObjectItemDefinition> = {
  "./obj-besace.json": ObjBesace as ObjectItemDefinition,
  "./obj-bourse.json": ObjBourse as ObjectItemDefinition,
  "./obj-grimoire.json": ObjGrimoire as ObjectItemDefinition,
  "./obj-insigne-unite.json": ObjInsigneUnite as ObjectItemDefinition,
  "./obj-plume-encre.json": ObjPlumeEncre as ObjectItemDefinition,
  "./obj-sac-a-dos.json": ObjSacADos as ObjectItemDefinition,
  "./obj-sac-voyage.json": ObjSacVoyage as ObjectItemDefinition,
  "./obj-souvenir-vole.json": ObjSouvenirVole as ObjectItemDefinition,
  "./obj-symbole-sacre.json": ObjSymboleSacre as ObjectItemDefinition,
  "./obj-tenue-academique.json": ObjTenueAcademique as ObjectItemDefinition,
  "./obj-vetements-communs.json": ObjVetementsCommuns as ObjectItemDefinition,
  "./obj-vetements-voyage.json": ObjVetementsVoyage as ObjectItemDefinition,
  "./piece-argent.json": PieceArgent as ObjectItemDefinition,
  "./piece-cuivre.json": PieceCuivre as ObjectItemDefinition,
  "./piece-or.json": PieceOr as ObjectItemDefinition,
  "./piece-platine.json": PiecePlatine as ObjectItemDefinition
};

export function loadObjectItemsFromIndex(): ObjectItemDefinition[] {
  const indexed = Array.isArray((objectsIndex as any).types)
    ? ((objectsIndex as any).types as string[])
    : [];

  const loaded: ObjectItemDefinition[] = [];
  for (const path of indexed) {
    const mod = OBJECT_MODULES[path];
    if (mod) {
      loaded.push(mod);
    } else {
      console.warn("[objects] Type path missing in bundle:", path);
    }
  }

  if (loaded.length === 0) {
    console.warn("[objects] No objects loaded from index.json");
  }

  return loaded;
}
