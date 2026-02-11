import type {
  CombatStats,
  EnemyCombatProfile,
  FootprintSpec,
  MovementProfile,
  SpellcastingState,
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
  armesDefaut?: {
    main_droite?: string | null;
    main_gauche?: string | null;
    mains?: string | null;
  };
  proficiencies?: {
    weapons?: string[];
    armors?: string[];
    tools?: string[];
  };
  combatProfile?: EnemyCombatProfile;
  behavior?: {
    preferredRangeMin?: number;
    preferredRangeMax?: number;
    panicRange?: number;
  };
  speechProfile?: import("../narrationTypes").EnemySpeechProfile;
  combatStats: CombatStats;
  spellcastingState?: SpellcastingState;
  appearance?: TokenAppearance;
  footprint?: FootprintSpec;
  movementModes?: Record<string, number>;
  movement?: MovementProfile;
  vision?: VisionProfile;
  summonBehavior?: {
    controlMode?: "direct" | "auto" | "obedient" | "chaotic";
    turnTiming?: "player_turn" | "after_player" | "initiative";
    initiativeMode?: "existing_roll" | "roll_on_spawn" | "attach_to_player";
    obeyChance?: number;
    order?: { kind: "hold" | "follow_owner" | "attack_nearest" };
  };
}
