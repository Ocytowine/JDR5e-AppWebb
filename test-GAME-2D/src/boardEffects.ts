// Utilitaires pour les tracés et zones d'effet sur la grille.
// -----------------------------------------------------------
// Ces fonctions travaillent uniquement en coordonnées de grille
// (x, y) et ne connaissent rien de Pixi ou de l'affichage.
// GameBoard s'occupe ensuite de projeter ces cases en isométrique.

import { isCellInsideBoard, isCellInsideGrid } from "./boardConfig";

export type EffectType = "circle" | "rectangle" | "cone";

export interface GridCell {
  x: number;
  y: number;
}

export interface BoardEffect {
  id: string;
  type: EffectType;
  cells: GridCell[];
}

export interface BoardEffectBoundsOptions {
  /**
   * Masque de cases jouables (limites de la battlemap).
   * Si fourni, il prime sur `grid`.
   */
  playableCells?: Set<string> | null;
  /**
   * Grille logique (cols/rows) utilisée comme bornes si aucun mask.
   * Si absent, fallback sur la grille "par défaut" via `isCellInsideBoard`.
   */
  grid?: { cols: number; rows: number } | null;
}

function allowCell(x: number, y: number, options?: BoardEffectBoundsOptions): boolean {
  const playable = options?.playableCells ?? null;
  if (playable && playable.size > 0) {
    return playable.has(`${x},${y}`);
  }

  const grid = options?.grid ?? null;
  if (grid) {
    return isCellInsideGrid(x, y, grid.cols, grid.rows);
  }

  return isCellInsideBoard(x, y);
}

// Génère un disque (approximation) de rayon `radius` autour de (cx, cy).
export function generateCircleEffect(
  id: string,
  cx: number,
  cy: number,
  radius: number,
  options?: BoardEffectBoundsOptions
): BoardEffect {
  const cells: GridCell[] = [];

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (!allowCell(x, y, options)) continue;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius + 0.01) {
        cells.push({ x, y });
      }
    }
  }

  return { id, type: "circle", cells };
}

// Génère un rectangle centré sur (cx, cy), de largeur/hauteur en cases.
export function generateRectangleEffect(
  id: string,
  cx: number,
  cy: number,
  width: number,
  height: number,
  options?: BoardEffectBoundsOptions
): BoardEffect {
  const cells: GridCell[] = [];
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);

  for (let y = cy - halfH; y <= cy + halfH; y++) {
    for (let x = cx - halfW; x <= cx + halfW; x++) {
      if (!allowCell(x, y, options)) continue;
      cells.push({ x, y });
    }
  }

  return { id, type: "rectangle", cells };
}

export type ConeDirection =
  | "up"
  | "down"
  | "left"
  | "right"
  | "up-left"
  | "up-right"
  | "down-left"
  | "down-right";

// Génère un cône très simple partant de (cx, cy) dans une direction donnée.
// Cette approximation est suffisante pour un premier rendu visuel.
export function generateConeEffect(
  id: string,
  cx: number,
  cy: number,
  range: number,
  direction: ConeDirection,
  apertureDeg?: number,
  options?: BoardEffectBoundsOptions
): BoardEffect {
  const cells: GridCell[] = [];

  const angle =
    typeof apertureDeg === "number" && apertureDeg > 0
      ? Math.min(180, apertureDeg)
      : 90;
  const halfAngleRad = (angle * Math.PI) / 360;
  const cosMin = Math.cos(halfAngleRad);

  const dirVector = (() => {
    switch (direction) {
      case "up":
        return { x: 0, y: -1 };
      case "down":
        return { x: 0, y: 1 };
      case "left":
        return { x: -1, y: 0 };
      case "right":
        return { x: 1, y: 0 };
      case "up-left":
        return { x: -1, y: -1 };
      case "up-right":
        return { x: 1, y: -1 };
      case "down-left":
        return { x: -1, y: 1 };
      case "down-right":
        return { x: 1, y: 1 };
      default:
        return { x: 1, y: 0 };
    }
  })();

  const dirLen = Math.hypot(dirVector.x, dirVector.y);

  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      if (dx === 0 && dy === 0) continue;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > range + 1e-6) continue;

      const dot = dirVector.x * dx + dirVector.y * dy;
      const cosTheta = dot / (dirLen * dist);
      if (cosTheta < cosMin) continue;

      const x = cx + dx;
      const y = cy + dy;
      if (!allowCell(x, y, options)) continue;
      cells.push({ x, y });
    }
  }

  return { id, type: "cone", cells };
}
