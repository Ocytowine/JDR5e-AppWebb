import type { GrantDefinition } from "./featureTypes";

export interface ObjectItemDefinition {
  id: string;
  label: string;
  type: "object";
  category?: string;
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
  capacityWeight?: number;
  tags?: string[];
  grants?: GrantDefinition[];
  description?: string;
}
