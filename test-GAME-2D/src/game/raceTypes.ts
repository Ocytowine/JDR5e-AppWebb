export interface RaceTraitDefinition {
  id: string;
  label: string;
  description?: string;
}

export interface RaceDefinition {
  id: string;
  label: string;
  description: string;
  besoin?: string[];
  actionIds?: string[];
  reactionIds?: string[];
  size?: "small" | "medium" | "large" | string;
  speed?: number;
  vision?: {
    mode?: "normal" | "lowlight" | "darkvision" | string;
    range?: number;
  };
  traits?: RaceTraitDefinition[];
  grants?: Array<{
    kind: string;
    ids: string[];
    source?: string;
    meta?: Record<string, unknown>;
  }>;
  progression?: Record<
    string,
    {
      grants?: Array<{
        kind: string;
        ids: string[];
        source?: string;
        meta?: Record<string, unknown>;
      }>;
      notes?: string;
      description?: string;
    }
  >;
}
