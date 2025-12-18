export type TurnPhase = "player" | "enemies";

export type EnemyActionType = "move" | "attack" | "wait";

export type TurnKind = "player" | "enemy";

export interface TurnEntry {
  id: string;
  kind: TurnKind;
  initiative: number;
}

export interface EnemyDecision {
  enemyId: string;
  action: EnemyActionType;
  targetX?: number;
  targetY?: number;
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
  attackDamage?: number | null;
}

export interface PlayerSummary {
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
}

export interface SpeechBubbleEntry {
  tokenId: string;
  text: string;
  updatedAtRound: number;
}

export type EffectSpecKind = "circle" | "rectangle" | "cone";

export interface EffectSpec {
  id: string;
  kind: EffectSpecKind;
  radius?: number;
  width?: number;
  height?: number;
  range?: number;
  direction?: "up" | "down" | "left" | "right";
}

