import type {
  CombatStats,
  EnemyCombatProfile,
  FootprintSpec,
  MovementProfile,
  TokenAppearance,
  VisionProfile
} from "../types";

export interface EnemyTypeDefinition {
  id: string;
  label: string;
  description: string;
  aiRole: string;
  actions?: string[];
  reactionIds?: string[];
  combatProfile?: EnemyCombatProfile;
  behavior?: {
    preferredRangeMin?: number;
    preferredRangeMax?: number;
    panicRange?: number;
  };
  speechProfile?: import("../narrationTypes").EnemySpeechProfile;
  combatStats: CombatStats;
  appearance?: TokenAppearance;
  footprint?: FootprintSpec;
  movementModes?: Record<string, number>;
  movement?: MovementProfile;
  vision?: VisionProfile;
}
