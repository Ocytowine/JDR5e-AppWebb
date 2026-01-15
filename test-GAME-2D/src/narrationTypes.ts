export type CombatEventKind =
  | "player_attack"
  | "enemy_attack"
  | "move"
  | "damage"
  | "death"
  | "status"
  | "turn_start"
  | "turn_end"
  | "speech";

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
  enemyTypeId?: string | null;
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
  /**
   * Langue attendue.
   */
  language: "fr";
  /**
   * Toujours "player" ici: narration au point de vue du joueur.
   */
  focusSide: "player";
  /**
   * Identifiant du joueur (si disponible).
   */
  focusActorId?: string | null;
  /**
   * Etat du combat au debut et a la fin de la sequence a raconter.
   */
  stateStart: CombatStateSummary;
  stateEnd: CombatStateSummary;
  /**
   * Evenements (actions/deplacements/attaques/morts...) survenus pendant la sequence.
   */
  events: CombatEvent[];
  /**
   * Bulles deja prononcees pendant la sequence (ordre chronologique).
   * Sert de contexte pour le recap.
   */
  enemySpeeches?: EnemySpeech[];
}

export interface EnemySpeechProfile {
  /**
   * Origine/race/type "RP" (ex: gobelin, bandit, spectre...).
   */
  raceOrOrigin?: string;
  /**
   * Registre de langue.
   */
  register?: "familier" | "neutre" | "soutenu";
  /**
   * Tonalites possibles.
   */
  tone?: string[];
  /**
   * Mots/expressions a privilegier.
   */
  vocabulary?: string[];
  /**
   * Tics de langage / maniérismes.
   */
  quirks?: string[];
  /**
   * Choses a eviter (meta, modernisme, etc.).
   */
  taboos?: string[];
}

export interface EnemySpeechRequest {
  language: "fr";
  maxLines: 2;
  enemyId: string;
  enemyTypeId?: string | null;
  aiRole?: string | null;
  speechProfile?: EnemySpeechProfile | null;
  perception: {
    canSeePlayer: boolean;
    distanceToPlayer: number | null;
    hpRatio: number;
    alliesVisible: string[];
    enemiesVisible: string[];
    lastKnownPlayerPos?: { x: number; y: number } | null;
  };
  priorSpeechesThisRound: EnemySpeech[];
  selfLastSpeech?: string | null;
  recentEvents: CombatEvent[];
}

export interface EnemySpeechResponse {
  line: string;
}

export interface NarrationResponse {
  /**
   * Resume narratif global (2-6 phrases), point de vue joueur.
   */
  summary: string;
  /**
   * Message technique en cas d'IA indisponible (ex: "IA non fonctionnel.").
   * Si present, l'UI peut l'afficher tel quel.
   */
  error?: string;
}
