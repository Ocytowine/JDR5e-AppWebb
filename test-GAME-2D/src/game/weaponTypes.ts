import type { DamageTypeId } from "./damageTypes";
import type { FeatureGrant } from "./featureTypes";

export type WeaponCategory = "melee" | "distance" | "polyvalent";
export type WeaponMastery = "simple" | "martiale" | "speciale" | "monastique";

export type WeaponRange = {
  normal: number;
  long: number;
};

export type WeaponThrownRange = {
  normal: number;
  long: number;
};

export type WeaponProperties = {
  finesse?: boolean;
  light?: boolean;
  heavy?: boolean;
  twoHanded?: boolean;
  reach?: number;
  versatile?: string | null;
  thrown?: WeaponThrownRange | null;
  ammunition?: boolean;
  loading?: boolean;
  reload?: number | null;
  range?: WeaponRange | null;
  special?: string | null;
  ammoType?: string | null;
  ammoPerShot?: number | null;
};

export type WeaponAttackProfile = {
  mod: string;
  bonus?: string | number | null;
};

export type WeaponDamageProfile = {
  dice: string;
  damageType: string;
  damageTypeId?: DamageTypeId | null;
};

export type WeaponExtraDamageProfile = {
  dice: string;
  damageType: string;
  damageTypeId?: DamageTypeId | null;
  when?: "onHit" | "onCrit" | "onResolve" | "onMiss" | string;
};

export type WeaponOnHitProfile = {
  mod: string;
  damage: string;
  damageType: string;
  damageTypeId?: DamageTypeId | null;
};

export interface WeaponTypeDefinition {
  id: string;
  name: string;
  label?: string;
  type: "arme";
  subtype: WeaponMastery;
  category: WeaponCategory;
  descriptionCourte?: string;
  descriptionLongue?: string;
  allowStack?: boolean;
  harmonisable?: boolean;
  focalisateur?: boolean;
  weight?: number;
  size?: number;
  value?: { platinum?: number; gold: number; silver: number; copper: number };
  rarity?: string;
  tags?: string[];
  grants?: FeatureGrant[];
  properties?: WeaponProperties;
  attack?: WeaponAttackProfile;
  damage?: WeaponDamageProfile;
  extraDamage?: WeaponExtraDamageProfile[];
  effectOnHit?: WeaponOnHitProfile;
  weaponMastery?: string[];
}
