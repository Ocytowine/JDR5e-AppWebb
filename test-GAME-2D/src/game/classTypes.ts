export interface ClassDefinition {
  id: string;
  label: string;
  description: string;
  subclassLevel?: number;
  subclassIds?: string[];
  proficiencies?: {
    weapons?: string[];
    armors?: string[];
    tools?: string[];
    skills?: string[];
  };
}

export interface SubclassDefinition {
  id: string;
  classId: string;
  label: string;
  description: string;
}
