export interface ObjectItemDefinition {
  id: string;
  label: string;
  type: "object";
  category?: string;
  weight?: number;
  priceGp?: number;
  capacityWeight?: number;
  tags?: string[];
  description?: string;
}
