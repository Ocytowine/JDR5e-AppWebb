export interface AmmoItemDefinition {
  id: string;
  name?: string;
  label?: string;
  type: "munition";
  subtype?: string;
  category?: string;
  descriptionCourte?: string;
  descriptionLongue?: string;
  allowStack?: boolean;
  weight?: number;
  size?: number;
  value?: {
    platinum?: number;
    gold?: number;
    silver?: number;
    copper?: number;
  };
  rarity?: string;
  tags?: string[];
  ammoType: string;
  bundleSize?: number;
  storage?: {
    preferredSlot?: string | null;
    allowedSlots?: string[] | null;
  };
  compatibility?: {
    weaponAmmoTypes?: string[];
    weaponTags?: string[];
  };
  [key: string]: unknown;
}
