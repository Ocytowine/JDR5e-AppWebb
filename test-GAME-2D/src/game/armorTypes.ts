export interface ArmorItemDefinition {
  id: string;
  label: string;
  type: "armor";
  category?: string;
  armorCategory?: "light" | "medium" | "heavy" | "shield" | string;
  baseAC?: number;
  dexCap?: number | null;
  weight?: number;
  priceGp?: number;
  value?: { pp?: number; po?: number; pa?: number; pc?: number };
  tags?: string[];
  description?: string;
}
