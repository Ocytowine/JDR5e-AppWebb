export interface ClassDefinition {
  id: string;
  label: string;
  description: string;
  hitDie?: number;
  subclassLevel?: number;
  subclassIds?: string[];
  proficiencies?: {
    weapons?: string[];
    armors?: string[];
    tools?: string[];
    skills?: string[];
  };
  equipment?: string[];
  progression?: Record<
    string,
    {
      grants?: Array<{
        kind: string;
        ids: string[];
        source?: string;
        meta?: Record<string, unknown>;
      }>;
      description?: string;
    }
  >;
  spellcasting?: {
    ability: "SAG" | "INT" | "CHA";
    preparation: "prepared" | "known";
    storage: "memory" | "innate" | "grimoire";
    focusTypes?: string[];
    spellFilterTags?: string[];
    freePreparedFromGrants?: boolean;
    casterProgression: "full" | "half" | "third" | "none";
    slotsByLevel?: Record<string, number[]>;
  };
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
      description?: string;
    }
  >;
  spellcasting?: {
    ability: "SAG" | "INT" | "CHA";
    preparation: "prepared" | "known";
    storage: "memory" | "innate" | "grimoire";
    focusTypes?: string[];
    spellFilterTags?: string[];
    freePreparedFromGrants?: boolean;
    casterProgression: "full" | "half" | "third" | "none";
    slotsByLevel?: Record<string, number[]>;
  };
}
