import type { ObjectItemDefinition } from "./objectTypes";

import objectsIndex from "../../materiel-type/objets/index.json";
import grimoire from "../../materiel-type/objets/obj-grimoire.json";
import plumeEncre from "../../materiel-type/objets/obj-plume-encre.json";
import tenueAcademique from "../../materiel-type/objets/obj-tenue-academique.json";
import bourse10 from "../../materiel-type/objets/obj-bourse-10po.json";
import petitCouteau from "../../materiel-type/objets/obj-petit-couteau.json";
import vetementsCommuns from "../../materiel-type/objets/obj-vetements-communs.json";
import souvenirVole from "../../materiel-type/objets/obj-souvenir-vole.json";
import armeEndommagee from "../../materiel-type/objets/obj-arme-endommagee.json";
import insigneUnite from "../../materiel-type/objets/obj-insigne-unite.json";
import vetementsVoyage from "../../materiel-type/objets/obj-vetements-voyage.json";
import sacVoyage from "../../materiel-type/objets/obj-sac-voyage.json";
import besace from "../../materiel-type/objets/obj-besace.json";
import sacADos from "../../materiel-type/objets/obj-sac-a-dos.json";

const OBJECT_MODULES: Record<string, ObjectItemDefinition> = {
  "./obj-grimoire.json": grimoire as ObjectItemDefinition,
  "./obj-plume-encre.json": plumeEncre as ObjectItemDefinition,
  "./obj-tenue-academique.json": tenueAcademique as ObjectItemDefinition,
  "./obj-bourse-10po.json": bourse10 as ObjectItemDefinition,
  "./obj-petit-couteau.json": petitCouteau as ObjectItemDefinition,
  "./obj-vetements-communs.json": vetementsCommuns as ObjectItemDefinition,
  "./obj-souvenir-vole.json": souvenirVole as ObjectItemDefinition,
  "./obj-arme-endommagee.json": armeEndommagee as ObjectItemDefinition,
  "./obj-insigne-unite.json": insigneUnite as ObjectItemDefinition,
  "./obj-vetements-voyage.json": vetementsVoyage as ObjectItemDefinition,
  "./obj-sac-voyage.json": sacVoyage as ObjectItemDefinition,
  "./obj-besace.json": besace as ObjectItemDefinition,
  "./obj-sac-a-dos.json": sacADos as ObjectItemDefinition
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
