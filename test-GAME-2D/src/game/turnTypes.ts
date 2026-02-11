export type TurnPhase = "player" | "enemies";

export type EnemyActionType = "move" | "attack" | "wait";

export type TurnKind = "player" | "enemy" | "summon";

export interface TurnEntry {
  id: string;
  kind: TurnKind;
  initiative: number;
  ownerType?: "player" | "enemy";
  ownerId?: string;
}

export interface EnemyDecision {
  enemyId: string;
  action: EnemyActionType;
  targetX?: number;
  targetY?: number;
}

export type EnemyIntentTarget =
  | { kind: "token"; tokenId: string }
  | { kind: "cell"; x: number; y: number }
  | { kind: "none" };

export interface EnemyActionIntent {
  enemyId: string;
  actionId: string;
  target: EnemyIntentTarget;
  advantageMode?: "normal" | "advantage" | "disadvantage";
}

export interface EnemySummary {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  type?: string;
  aiRole?: string | null;
  moveRange?: number | null;
  maxAttacksPerTurn?: number | null;
  actionIds?: string[] | null;
}

export interface PlayerSummary {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export interface EnemyAiStateSummary {
  round: number;
  phase: TurnPhase;
  grid: { cols: number; rows: number };
  player: PlayerSummary;
  enemies: EnemySummary[];
  actionsCatalog?: {
    id: string;
    name: string;
    category: string;
    targeting: { target: string; range: { min: number; max: number; shape: string }; requiresLos: boolean };
  }[];
}

export interface SpeechBubbleEntry {
  tokenId: string;
  text: string;
  updatedAtRound: number;
}

export type EffectSpecKind = "circle" | "rectangle" | "cone" | "line";

export interface EffectSpec {
  id: string;
  kind: EffectSpecKind;
  radius?: number;
  width?: number;
  height?: number;
  range?: number;
  direction?: "up" | "down" | "left" | "right";
  toX?: number;
  toY?: number;
  color?: number;
  alpha?: number;
  thickness?: number;
}
