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
    }
  >;
}

export interface SubclassDefinition {
  id: string;
  classId: string;
  label: string;
  description: string;
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
    }
  >;
}
