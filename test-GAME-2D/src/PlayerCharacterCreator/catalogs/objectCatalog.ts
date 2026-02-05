import type { ObjectItemDefinition } from "../../game/objectTypes";

import objectsIndex from "../../../materiel-type/objets/index.json";
import grimoire from "../../../materiel-type/objets/obj-grimoire.json";
import plumeEncre from "../../../materiel-type/objets/obj-plume-encre.json";
import tenueAcademique from "../../../materiel-type/objets/obj-tenue-academique.json";
import bourse from "../../../materiel-type/objets/obj-bourse.json";
import piecePlatine from "../../../materiel-type/objets/piece-platine.json";
import pieceOr from "../../../materiel-type/objets/piece-or.json";
import pieceArgent from "../../../materiel-type/objets/piece-argent.json";
import pieceCuivre from "../../../materiel-type/objets/piece-cuivre.json";
import vetementsCommuns from "../../../materiel-type/objets/obj-vetements-communs.json";
import souvenirVole from "../../../materiel-type/objets/obj-souvenir-vole.json";
import insigneUnite from "../../../materiel-type/objets/obj-insigne-unite.json";
import vetementsVoyage from "../../../materiel-type/objets/obj-vetements-voyage.json";
import sacVoyage from "../../../materiel-type/objets/obj-sac-voyage.json";
import besace from "../../../materiel-type/objets/obj-besace.json";
import sacADos from "../../../materiel-type/objets/obj-sac-a-dos.json";
import symboleSacre from "../../../materiel-type/objets/obj-symbole-sacre.json";

const OBJECT_MODULES: Record<string, ObjectItemDefinition> = {
  "./obj-grimoire.json": grimoire as ObjectItemDefinition,
  "./obj-plume-encre.json": plumeEncre as ObjectItemDefinition,
  "./obj-tenue-academique.json": tenueAcademique as ObjectItemDefinition,
  "./obj-bourse.json": bourse as ObjectItemDefinition,
  "./piece-platine.json": piecePlatine as ObjectItemDefinition,
  "./piece-or.json": pieceOr as ObjectItemDefinition,
  "./piece-argent.json": pieceArgent as ObjectItemDefinition,
  "./piece-cuivre.json": pieceCuivre as ObjectItemDefinition,
  "./obj-vetements-communs.json": vetementsCommuns as ObjectItemDefinition,
  "./obj-souvenir-vole.json": souvenirVole as ObjectItemDefinition,
  "./obj-insigne-unite.json": insigneUnite as ObjectItemDefinition,
  "./obj-vetements-voyage.json": vetementsVoyage as ObjectItemDefinition,
  "./obj-sac-voyage.json": sacVoyage as ObjectItemDefinition,
  "./obj-besace.json": besace as ObjectItemDefinition,
  "./obj-sac-a-dos.json": sacADos as ObjectItemDefinition,
  "./obj-symbole-sacre.json": symboleSacre as ObjectItemDefinition
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
