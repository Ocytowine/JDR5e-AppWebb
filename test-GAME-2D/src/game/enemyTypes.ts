import type { FootprintSpec, MovementProfile, TokenAppearance, VisionProfile } from "../types";

export interface EnemyTypeDefinition {
  id: string;
  label: string;
  description: string;
  aiRole: string;
  actions?: string[];
  behavior?: {
    preferredRangeMin?: number;
    preferredRangeMax?: number;
    panicRange?: number;
  };
  speechProfile?: import("../narrationTypes").EnemySpeechProfile;
  baseStats: {
    hp: number;
    moveRange: number;
    attackDamage: number;
    armorClass: number;
    attackRange?: number;
    maxAttacksPerTurn?: number;
  };
  appearance?: TokenAppearance;
  footprint?: FootprintSpec;
  movement?: MovementProfile;
  vision?: VisionProfile;
}
