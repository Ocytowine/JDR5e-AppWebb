export interface BackgroundTraitsDefinition {
  personality?: string[];
  ideals?: string[];
  bond?: string;
  flaw?: string;
}

export interface BackgroundDefinition {
  id: string;
  label: string;
  description: string;
  toolNotes?: string[];
  equipment?: string[];
  traits?: BackgroundTraitsDefinition;
  grants?: Array<{
    kind: string;
    ids: string[];
    source?: string;
    meta?: Record<string, unknown>;
  }>;
}
