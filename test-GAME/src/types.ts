import type { Personnage as RawPersonnage } from "../docs projet/Gestion et Création de données/templates/Template Personnages";

export type Personnage = RawPersonnage;

export type TokenType = "player" | "enemy";

export interface TokenState {
  id: string;
  type: TokenType;
  enemyTypeId?: string;
  enemyTypeLabel?: string;
  aiRole?: string | null;
  moveRange?: number;
  attackDamage?: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}
