export type CombatEventKind =
  | "player_attack"
  | "enemy_attack"
  | "move"
  | "damage"
  | "death"
  | "status"
  | "turn_start"
  | "turn_end";

export type CombatSide = "player" | "enemies";

export interface CombatEvent {
  id: string;
  /**
   * Numero de round au moment de l'evenement.
   */
  round: number;
  /**
   * Phase en cours ("player" ou "enemies").
   */
  phase: CombatSide;
  kind: CombatEventKind;
  actorId: string;
  actorKind: "player" | "enemy";
  targetId?: string | null;
  targetKind?: "player" | "enemy" | null;
  /**
   * Resume court, deja formate, de ce qui s'est passe.
   * Sert de fallback si l'API de narration n'est pas disponible.
   */
  summary: string;
  /**
   * Informations optionnelles: degats, critique, distance, etc.
   */
  data?: Record<string, unknown>;
  /**
   * Timestamp (ms) au moment de l'enregistrement (Date.now()).
   */
  timestamp: number;
}

export interface CombatActorState {
  id: string;
  kind: "player" | "enemy";
  label?: string;
  aiRole?: string | null;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export interface CombatStateSummary {
  round: number;
  phase: CombatSide;
  grid: { cols: number; rows: number };
  actors: CombatActorState[];
}

export interface EnemySpeech {
  enemyId: string;
  line: string;
}

export interface NarrationRequest {
  focusSide: CombatSide;
  focusActorId?: string | null;
  state: CombatStateSummary;
  events: CombatEvent[];
}

export interface EnemySpeech {
  enemyId: string;
  line: string;
}

export interface NarrationResponse {
  /**
   * Resume narratif global (1-3 phrases).
   */
  summary: string;
  playerPerspective?: string;
  /**
   * Repliques roleplay d'ennemis, par id.
   */
  enemySpeeches?: EnemySpeech[];
}
