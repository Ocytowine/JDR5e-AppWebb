import type { Personnage as RawPersonnage } from "../docs projet/Gestion et Création de données/templates/Template Personnages";

export type Personnage = RawPersonnage;

export type TokenType = "player" | "enemy";

export interface TokenState {
  id: string;
  type: TokenType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

