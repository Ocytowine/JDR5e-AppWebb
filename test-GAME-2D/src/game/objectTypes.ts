export interface ObjectItemDefinition {
  id: string;
  label: string;
  type: "object";
  category?: string;
  weight?: number;
  priceGp?: number;
  value?: { pp?: number; po?: number; pa?: number; pc?: number };
  capacityWeight?: number;
  tags?: string[];
  description?: string;
}
