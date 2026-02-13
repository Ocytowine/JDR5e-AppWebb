import type { GrantDefinition } from "./featureTypes";

export interface ArmorItemDefinition {
  id: string;
  label: string;
  type: "armor";
  category?: string;
  armorCategory?: "light" | "medium" | "heavy" | "shield" | string;
  baseAC?: number;
  dexCap?: number | null;
  weight?: number;
  harmonisable?: boolean;
  priceGp?: number;
  value?: {
    pp?: number;
    po?: number;
    pa?: number;
    pc?: number;
    platinum?: number;
    gold?: number;
    silver?: number;
    copper?: number;
  };
  tags?: string[];
  grants?: GrantDefinition[];
  description?: string;
}
