import type { ConeDirection } from "./boardEffects";
import type { EnemySpeechProfile } from "./narrationTypes";

export interface Personnage {
  id: string;
  nom: {
    nomcomplet: string;
    prenom?: string;
    surnom?: string;
  };
  niveauGlobal?: number;
  classe: Record<
    string | number,
    { classeId: string; subclasseId?: string | null; niveau: number }
  >;
  CA?: number;
  caracs: {
    force: { FOR: number; modFOR?: number };
    dexterite: { DEX: number; modDEX?: number };
    constitution: { CON: number; modCON?: number };
    [key: string]: any;
  };
  visionProfile?: VisionProfile;
  appearance?: TokenAppearance;
  actionIds?: string[];
  reactionIds?: string[];
  movementModes?: Record<string, number> | string[];
  combatStats?: CombatStats;
  [key: string]: any;
}

export interface CombatStats {
  level: number;
  mods: {
    modFOR: number;
    modDEX: number;
    modCON: number;
    modINT: number;
    modSAG: number;
    modCHA: number;
  };
  maxHp: number;
  armorClass: number;
  attackBonus: number;
  moveRange?: number;
  maxAttacksPerTurn: number;
  actionsPerTurn: number;
  bonusActionsPerTurn: number;
  actionRules?: {
    forbidSecondAttack?: boolean;
  };
  resources: Record<string, { current: number; max?: number }>;
  tags?: string[];
}

export type TokenType = "player" | "enemy";

export interface GridPosition {
  x: number;
  y: number;
}

export interface TokenAppearance {
  spriteKey?: string;
  /**
   * List of allowed sprite variant indices (ex: [1, 2, 4]).
   * When omitted, all existing variants are eligible.
   */
  spriteVariants?: number[];
  /**
   * Percentage scale, 100 = normal size.
   */
  tokenScale?: number;
}

export type FootprintSpec =
  | { kind: "rect"; width: number; height: number }
  | { kind: "cells"; cells: GridPosition[] };

export type MovementType = "ground" | "flying" | "ghost" | string;

export interface MovementProfile {
  type: MovementType;
  /**
   * Directions autorisees pour le pathfinding (4 ou 8).
   */
  directions?: 4 | 8;
  /**
   * Nombre maximum de cases (distance de Manhattan) que
   * l'entite peut parcourir pendant son tour.
   */
  speed: number;
  /**
   * Peut traverser les murs / obstacles "durs".
   * (Actuellement sans effet tant qu'il n'y a pas de carte de murs.)
   */
  canPassThroughWalls?: boolean;
  /**
   * Peut traverser les autres entites pendant le trajet.
   */
  canPassThroughEntities?: boolean;
  /**
   * Peut terminer son deplacement sur une case occupee.
   */
  canStopOnOccupiedTile?: boolean;
}

export interface VisionProfile {
  /**
   * Forme de base du champ de vision.
   * - "cone" pour une vue directionnelle (humain, la plupart des creatures).
   * - "circle" pour une vision omnidirectionnelle simple.
   */
  shape: "cone" | "circle";
  /**
   * Portee maximale en cases (distance de grille).
   */
  range: number;
  /**
   * Ouverture du cone en degres (optionnel).
   * Exemple: 60, 90, 120. Si absent ou invalide,
   * on utilise l'ouverture par defaut de generateConeEffect.
   */
  apertureDeg?: number;
  /**
   * Peut voir correctement dans l'obscurite ou des zones sombres.
   * (Non exploite tant que le plateau n'expose pas de niveaux de lumiere.)
   */
  canSeeInDark?: boolean;
  /**
   * Mode de vision face a la lumiere ambiante.
   */
  lightVision?: "normal" | "lowlight" | "darkvision";
}

export type EnemyCombatStyle = "melee" | "ranged" | "support";

export interface EnemyCombatProfile {
  primaryStyle?: EnemyCombatStyle;
  allowedStyles?: EnemyCombatStyle[];
  preferredAbilities?: Array<"FOR" | "DEX" | "CON" | "INT" | "SAG" | "CHA">;
  preferredRangeMin?: number;
  preferredRangeMax?: number;
  avoidRangeMin?: number;
  avoidRangeMax?: number;
  intelligence?: 0 | 1 | 2;
  awareness?: 0 | 1 | 2;
  tactics?: string[];
}

export interface TokenState {
  id: string;
  type: TokenType;
  appearance?: TokenAppearance;
  enemyTypeId?: string;
  enemyTypeLabel?: string;
  aiRole?: string | null;
  /**
   * Liste d'actions que l'entite peut utiliser (IDs ActionDefinition).
   * Pour le joueur, cela correspond au catalogue d'actions charge.
   * Pour les ennemis, cela vient de src/data/enemies/*.json.
   */
  actionIds?: string[] | null;
  /**
   * Liste de reactions que l'entite peut declencher (IDs ReactionDefinition).
   */
  reactionIds?: string[] | null;
  /**
   * Stats de combat standardisees partagees entre joueurs/ennemis.
   */
  combatStats?: CombatStats;
  /**
   * Profil RP pour guider les bulles de dialogue (src/data/enemies).
   */
  speechProfile?: EnemySpeechProfile | null;
  moveRange?: number;
  /**
   * Nombre maximum d'attaques que l'entite
   * peut effectuer pendant son tour.
   */
  maxAttacksPerTurn?: number;
  armorClass?: number;
  /**
   * Profil de deplacement derive des JSON src/data/enemies
   * ou des capacites du personnage joueur.
   */
  movementProfile?: MovementProfile;
  /**
   * Orientation actuelle de l'entite sur la grille.
   * Utilisee pour les cones de vision et certaines attaques directionnelles.
   */
  facing?: ConeDirection;
  /**
   * Emprise au sol de l'entite (en cases).
   * Par defaut: 1x1.
   */
  footprint?: FootprintSpec;
  /**
   * Profil de vision de base de l'entite.
   * Sert de reference pour le calcul des cones et zones visibles.
   */
  visionProfile?: VisionProfile;
  /**
   * Score d'initiative pour l'ordre de tour.
   */
  initiative?: number | null;
  /**
   * Trajectoire planifiee pour ce tour (utile pour l'IA
   * et pour l'affichage des chemins).
   */
  plannedPath?: GridPosition[] | null;
  /**
   * Hauteur relative par rapport au sol.
   * 0 = au sol, >0 = en elevation.
   */
  elevation?: number;
  statuses?: Array<{
    id: string;
    remainingTurns: number;
    sourceId?: string;
  }>;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  tempHp?: number;
}
