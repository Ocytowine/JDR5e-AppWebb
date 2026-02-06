// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
// Source of truth: src/data/items/armes (generated indexes)

import type { WeaponTypeDefinition } from "../../game/weaponTypes";
import { normalizeDamageType } from "../../game/damageTypes";

import weaponsIndex from "../../../data/items/armes/index.json";
import MartialeArcLong from "../../../data/items/armes/martiale/arc-long.json";
import MartialeEpeeLongue from "../../../data/items/armes/martiale/epee-longue.json";
import MartialeHacheBataille from "../../../data/items/armes/martiale/hache-bataille.json";
import MonastiqueBaton from "../../../data/items/armes/monastique/baton.json";
import MonastiqueKama from "../../../data/items/armes/monastique/kama.json";
import MonastiqueNunchaku from "../../../data/items/armes/monastique/nunchaku.json";
import SimpleArcCourt from "../../../data/items/armes/simple/arc-court.json";
import SimpleArmeEndommagee from "../../../data/items/armes/simple/arme-endommagee.json";
import SimpleDague from "../../../data/items/armes/simple/dague.json";
import SimpleMassue from "../../../data/items/armes/simple/massue.json";
import SimplePetitCouteau from "../../../data/items/armes/simple/petit-couteau.json";
import SpecialeArbaleteRepetee from "../../../data/items/armes/speciale/arbalete-repetee.json";
import SpecialeEpeeElfique from "../../../data/items/armes/speciale/epee-elfique.json";
import SpecialeFouetDemon from "../../../data/items/armes/speciale/fouet-demon.json";

const WEAPON_MODULES: Record<string, WeaponTypeDefinition> = {
  "./martiale/arc-long.json": MartialeArcLong as WeaponTypeDefinition,
  "./martiale/epee-longue.json": MartialeEpeeLongue as WeaponTypeDefinition,
  "./martiale/hache-bataille.json": MartialeHacheBataille as WeaponTypeDefinition,
  "./monastique/baton.json": MonastiqueBaton as WeaponTypeDefinition,
  "./monastique/kama.json": MonastiqueKama as WeaponTypeDefinition,
  "./monastique/nunchaku.json": MonastiqueNunchaku as WeaponTypeDefinition,
  "./simple/arc-court.json": SimpleArcCourt as WeaponTypeDefinition,
  "./simple/arme-endommagee.json": SimpleArmeEndommagee as WeaponTypeDefinition,
  "./simple/dague.json": SimpleDague as WeaponTypeDefinition,
  "./simple/massue.json": SimpleMassue as WeaponTypeDefinition,
  "./simple/petit-couteau.json": SimplePetitCouteau as WeaponTypeDefinition,
  "./speciale/arbalete-repetee.json": SpecialeArbaleteRepetee as WeaponTypeDefinition,
  "./speciale/epee-elfique.json": SpecialeEpeeElfique as WeaponTypeDefinition,
  "./speciale/fouet-demon.json": SpecialeFouetDemon as WeaponTypeDefinition
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
    const mod = WEAPON_MODULES[path];
    if (mod) {
      loaded.push(normalizeWeaponDamageTypes(mod));
    } else {
      console.warn("[weapon-types] Type path missing in bundle:", path);
    }
  }

  if (loaded.length === 0) {
    console.warn("[weapon-types] No weapons loaded from index.json");
  }

  return loaded;
}
