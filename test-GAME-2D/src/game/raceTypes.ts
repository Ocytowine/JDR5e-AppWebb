export interface RaceTraitDefinition {
  id: string;
  label: string;
  description?: string;
}

export interface RaceDefinition {
  id: string;
  label: string;
  description: string;
  size?: "small" | "medium" | "large" | string;
  speed?: number;
  vision?: {
    mode?: "normal" | "lowlight" | "darkvision" | string;
    range?: number;
  };
  traits?: RaceTraitDefinition[];
}
