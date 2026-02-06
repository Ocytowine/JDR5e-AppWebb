import type { DamageTypeId } from "./damageTypes";

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
};

export type WeaponAttackProfile = {
  mod: string;
  bonus?: string | number | null;
};

export type WeaponDamageAlt = {
  dice: string;
  condition: string;
};

export type WeaponDamageProfile = {
  dice: string;
  damageType: string;
  damageTypeId?: DamageTypeId | null;
  alt?: WeaponDamageAlt | null;
};

export type WeaponOnHitProfile = {
  mod: string;
  damage: string;
  damageType: string;
  damageTypeId?: DamageTypeId | null;
};

export type WeaponLinks = {
  actionId?: string | null;
  effectId?: string | null;
};

export interface WeaponTypeDefinition {
  id: string;
  name: string;
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
  value?: { gold: number; silver: number; copper: number };
  rarity?: string;
  tags?: string[];
  properties?: WeaponProperties;
  attack?: WeaponAttackProfile;
  damage?: WeaponDamageProfile;
  effectOnHit?: WeaponOnHitProfile;
  links?: WeaponLinks;
}
