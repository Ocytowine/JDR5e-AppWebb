// Utilitaires pour les tracés et zones d'effet sur la grille.
// -----------------------------------------------------------
// Ces fonctions travaillent uniquement en coordonnées de grille
// (x, y) et ne connaissent rien de Pixi ou de l'affichage.
// GameBoard s'occupe ensuite de projeter ces cases en isométrique.

import { GRID_COLS, GRID_ROWS, isCellInsideBoard } from "./boardConfig";

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

// Génère un disque (approximation) de rayon `radius` autour de (cx, cy).
export function generateCircleEffect(
  id: string,
  cx: number,
  cy: number,
  radius: number
): BoardEffect {
  const cells: GridCell[] = [];

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (!isCellInsideBoard(x, y)) continue;
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
  height: number
): BoardEffect {
  const cells: GridCell[] = [];
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);

  for (let y = cy - halfH; y <= cy + halfH; y++) {
    for (let x = cx - halfW; x <= cx + halfW; x++) {
      if (!isCellInsideBoard(x, y)) continue;
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
  apertureDeg?: number
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

      if (!isCellInsideBoard(x, y)) continue;
      cells.push({ x, y });
    }
  }

  return { id, type: "cone", cells };
}
