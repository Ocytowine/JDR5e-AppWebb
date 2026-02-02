export interface BackgroundFeatureDefinition {
  name: string;
  description: string;
}

export interface BackgroundTraitsDefinition {
  personality?: string[];
  ideals?: string[];
  bond?: string;
  flaw?: string;
}

export interface BackgroundChoiceDefinition {
  count: number;
  options?: string[];
}

export interface BackgroundDefinition {
  id: string;
  label: string;
  description: string;
  skillProficiencies?: string[];
  toolProficiencies?: string[];
  toolChoices?: BackgroundChoiceDefinition;
  toolNotes?: string[];
  languageChoices?: BackgroundChoiceDefinition;
  equipment?: string[];
  feature?: BackgroundFeatureDefinition;
  traits?: BackgroundTraitsDefinition;
}
