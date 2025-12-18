import type { MovementProfile, VisionProfile } from "../types";

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
  movement?: MovementProfile;
  vision?: VisionProfile;
}
