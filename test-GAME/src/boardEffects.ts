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

export type ConeDirection = "up" | "down" | "left" | "right";

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

  const useCustomAngle =
    typeof apertureDeg === "number" &&
    apertureDeg > 0 &&
    apertureDeg < 180;
  const halfAngleRad = useCustomAngle
    ? (apertureDeg * Math.PI) / 360
    : null;

  for (let r = 1; r <= range; r++) {
    let maxOffset = r;

    if (halfAngleRad !== null) {
      const raw = Math.tan(halfAngleRad) * r;
      maxOffset = Math.floor(raw);
      if (maxOffset < 0) maxOffset = 0;
      if (maxOffset > r) maxOffset = r;
    }

    for (let offset = -maxOffset; offset <= maxOffset; offset++) {
      let x = cx;
      let y = cy;

      switch (direction) {
        case "right":
          x = cx + r;
          y = cy + offset;
          break;
        case "left":
          x = cx - r;
          y = cy + offset;
          break;
        case "down":
          x = cx + offset;
          y = cy + r;
          break;
        case "up":
          x = cx + offset;
          y = cy - r;
          break;
      }

      if (!allowCell(x, y, options)) continue;
      cells.push({ x, y });
    }
  }

  return { id, type: "cone", cells };
}

