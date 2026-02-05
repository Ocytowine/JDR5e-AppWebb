import type { WeaponTypeDefinition } from "../../game/weaponTypes";
import { normalizeDamageType } from "../../game/damageTypes";

import weaponsIndex from "../../../materiel-type/armes/index.json";
import dagger from "../../../materiel-type/armes/simple/dague.json";
import petitCouteau from "../../../materiel-type/armes/simple/petit-couteau.json";
import armeEndommagee from "../../../materiel-type/armes/simple/arme-endommagee.json";
import club from "../../../materiel-type/armes/simple/massue.json";
import shortbow from "../../../materiel-type/armes/simple/arc-court.json";
import longsword from "../../../materiel-type/armes/martiale/epee-longue.json";
import battleaxe from "../../../materiel-type/armes/martiale/hache-bataille.json";
import longbow from "../../../materiel-type/armes/martiale/arc-long.json";
import elvenSword from "../../../materiel-type/armes/speciale/epee-elfique.json";
import demonWhip from "../../../materiel-type/armes/speciale/fouet-demon.json";
import repeatingCrossbow from "../../../materiel-type/armes/speciale/arbalete-repetee.json";
import staff from "../../../materiel-type/armes/monastique/baton.json";
import nunchaku from "../../../materiel-type/armes/monastique/nunchaku.json";
import kama from "../../../materiel-type/armes/monastique/kama.json";

const WEAPON_TYPE_MODULES: Record<string, WeaponTypeDefinition> = {
  "./simple/dague.json": dagger as WeaponTypeDefinition,
  "./simple/petit-couteau.json": petitCouteau as WeaponTypeDefinition,
  "./simple/arme-endommagee.json": armeEndommagee as WeaponTypeDefinition,
  "./simple/massue.json": club as WeaponTypeDefinition,
  "./simple/arc-court.json": shortbow as WeaponTypeDefinition,
  "./martiale/epee-longue.json": longsword as WeaponTypeDefinition,
  "./martiale/hache-bataille.json": battleaxe as WeaponTypeDefinition,
  "./martiale/arc-long.json": longbow as WeaponTypeDefinition,
  "./speciale/epee-elfique.json": elvenSword as WeaponTypeDefinition,
  "./speciale/fouet-demon.json": demonWhip as WeaponTypeDefinition,
  "./speciale/arbalete-repetee.json": repeatingCrossbow as WeaponTypeDefinition,
  "./monastique/baton.json": staff as WeaponTypeDefinition,
  "./monastique/nunchaku.json": nunchaku as WeaponTypeDefinition,
  "./monastique/kama.json": kama as WeaponTypeDefinition
};

function normalizeWeaponDamageTypes(def: WeaponTypeDefinition): WeaponTypeDefinition {
  const damage = def.damage;
  const effectOnHit = def.effectOnHit;
  const damageTypeId = normalizeDamageType(damage?.damage_type ?? null);
  const onHitDamageTypeId = normalizeDamageType(effectOnHit?.damage_type ?? null);

  if (damage?.damage_type && !damageTypeId) {
    console.warn(
      "[weapon-types] Unknown damage type for weapon:",
      def.id,
      "->",
      damage.damage_type
    );
  }
  if (effectOnHit?.damage_type && !onHitDamageTypeId) {
    console.warn(
      "[weapon-types] Unknown on-hit damage type for weapon:",
      def.id,
      "->",
      effectOnHit.damage_type
    );
  }

  return {
    ...def,
    damage: damage
      ? {
          ...damage,
          damage_type_id: damageTypeId
        }
      : damage,
    effectOnHit: effectOnHit
      ? {
          ...effectOnHit,
          damage_type_id: onHitDamageTypeId
        }
      : effectOnHit
  };
}

export function loadWeaponTypesFromIndex(): WeaponTypeDefinition[] {
  const indexed = Array.isArray((weaponsIndex as any).types)
    ? ((weaponsIndex as any).types as string[])
    : [];

  const loaded: WeaponTypeDefinition[] = [];
  for (const path of indexed) {
    const mod = WEAPON_TYPE_MODULES[path];
    if (mod) {
      loaded.push(normalizeWeaponDamageTypes(mod));
    } else {
      console.warn("[weapon-types] Type path missing in bundle:", path);
    }
  }

  if (loaded.length === 0) {
    console.warn("[weapon-types] No weapon types loaded from index.json");
  }

  return loaded;
}
