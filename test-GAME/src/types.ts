import type { Personnage as RawPersonnage } from "../docs projet/Gestion et CrǸation de donnǸes/templates/Template Personnages";
import type { ConeDirection } from "./boardEffects";

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
   * Portee d'attaque de base (en cases).
   * 1 = corps a corps, >1 = attaque a distance.
   */
  attackRange?: number;
  /**
   * Nombre maximum d'attaques que l'entite
   * peut effectuer pendant son tour.
   */
  maxAttacksPerTurn?: number;
  armorClass?: number;
  /**
   * Profil de deplacement derive des JSON enemy-types
   * ou des capacites du personnage joueur.
   */
  movementProfile?: MovementProfile;
  /**
   * Orientation actuelle de l'entite sur la grille.
   * Utilisee pour les cones de vision et certaines attaques directionnelles.
   */
  facing?: ConeDirection;
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
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}
