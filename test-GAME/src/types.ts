import type { Personnage as RawPersonnage } from "../docs projet/Gestion et Création de données/templates/Template Personnages";

export type Personnage = RawPersonnage;

export type TokenType = "player" | "enemy";

export interface GridPosition {
  x: number;
  y: number;
}

export type MovementType = "ground" | "flying" | "ghost" | string;

export interface MovementProfile {
  type: MovementType;
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

export interface TokenState {
  id: string;
  type: TokenType;
  enemyTypeId?: string;
  enemyTypeLabel?: string;
  aiRole?: string | null;
  moveRange?: number;
  attackDamage?: number;
  /**
   * Profil de deplacement derive des JSON enemy-types
   * ou des capacites du personnage joueur.
   */
  movementProfile?: MovementProfile;
  /**
   * Score d'initiative pour l'ordre de tour.
   */
  initiative?: number | null;
  /**
   * Trajectoire planifiee pour ce tour (utile pour l'IA
   * et pour l'affichage des chemins).
   */
  plannedPath?: GridPosition[] | null;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}
