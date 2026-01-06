// Configuration centrale du plateau de jeu (test-GAME)
// ---------------------------------------------------
// L'idée est de regrouper ici :
// - la taille de la grille logique (nombre de cases)
// - la taille visuelle des tuiles
// - quelques helpers pour la projection isométrique
//
// Ainsi, GameBoard.tsx reste plus léger et on peut
// ajuster facilement la configuration du plateau.

// Nombre de colonnes / lignes de la grille logique
export const GRID_COLS = 12;
export const GRID_ROWS = 8;

// Taille "de base" d'une case (utile pour certains calculs génériques)
export const TILE_SIZE = 64;

// Dimensions de l'application Pixi (en coordonnées de scène)
export const BOARD_WIDTH = GRID_COLS * TILE_SIZE;
export const BOARD_HEIGHT = GRID_ROWS * TILE_SIZE;

// Paramètres spécifiques à l'affichage isométrique
// Largeur / hauteur d'un losange en pixels (projection iso)
export const ISO_TILE_WIDTH = TILE_SIZE;
export const ISO_TILE_HEIGHT = TILE_SIZE * 0.5;

// Offset d'origine de la grille iso dans la scène Pixi.
// On place la grille au centre horizontalement, et on laisse
// un léger espace en haut.
export const ISO_ORIGIN_X = BOARD_WIDTH / 2;
export const ISO_ORIGIN_Y = ISO_TILE_HEIGHT * 2;

// Couleur de fond par défaut (si aucune image n'est utilisée)
export const BOARD_BACKGROUND_COLOR = 0x1c1b29;

// URL optionnelle d'une image de fond.
// - Laisser `null` pour ne pas utiliser d'image.
// - Mettre par exemple "/assets/board-bg.png" si vous placez
//   l'image dans le dossier "public" de Vite.
export const BOARD_BACKGROUND_IMAGE_URL: string | null = null;

// Helper : vérifie si une case (x, y) appartient à la zone de jeu.
// Pour l'instant, il s'agit simplement d'un rectangle, mais
// on pourra plus tard changer cette logique pour des formes
// plus complexes (L, cercle, donjon, etc.).
export function isCellInsideBoard(x: number, y: number): boolean {
  return x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS;
}

// ---------------------------------------------------
// Variante dynamique (grille variable)
// ---------------------------------------------------

export function getBoardWidth(cols: number): number {
  return Math.max(1, Math.floor(cols)) * TILE_SIZE;
}

export function getBoardHeight(rows: number): number {
  return Math.max(1, Math.floor(rows)) * TILE_SIZE;
}

export function isCellInsideGrid(
  x: number,
  y: number,
  cols: number,
  rows: number
): boolean {
  return x >= 0 && x < cols && y >= 0 && y < rows;
}

export function gridToScreenForGrid(
  x: number,
  y: number,
  cols: number,
  rows: number
): { x: number; y: number } {
  const halfW = ISO_TILE_WIDTH / 2;
  const halfH = ISO_TILE_HEIGHT / 2;

  const originX = getBoardWidth(cols) / 2;
  const originY = ISO_TILE_HEIGHT * 2;

  const sx = (x - y) * halfW + originX;
  const sy = (x + y) * halfH + originY;

  return { x: sx, y: sy };
}

// Base sprite position: bottom-center of the iso cell.
export function gridToScreenBaseForGrid(
  x: number,
  y: number,
  cols: number,
  rows: number
): { x: number; y: number } {
  const pos = gridToScreenForGrid(x, y, cols, rows);
  return { x: pos.x, y: pos.y + ISO_TILE_HEIGHT / 2 };
}

export function screenToGridForGrid(
  screenX: number,
  screenY: number,
  cols: number,
  rows: number
): { x: number; y: number } {
  const halfW = ISO_TILE_WIDTH / 2;
  const halfH = ISO_TILE_HEIGHT / 2;

  const originX = getBoardWidth(cols) / 2;
  const originY = ISO_TILE_HEIGHT * 2;

  const dx = screenX - originX;
  const dy = screenY - originY;

  const nx = dx / halfW;
  const ny = dy / halfH;

  const gx = (nx + ny) / 2;
  const gy = (ny - nx) / 2;

  // On arrondit à la case la plus proche.
  const rx = Math.round(gx);
  const ry = Math.round(gy);

  return { x: rx, y: ry };
}

// Projection : coordonnées de grille -> coordonnées d'écran (isométrique)
export function gridToScreen(x: number, y: number): { x: number; y: number } {
  const halfW = ISO_TILE_WIDTH / 2;
  const halfH = ISO_TILE_HEIGHT / 2;

  const sx = (x - y) * halfW + ISO_ORIGIN_X;
  const sy = (x + y) * halfH + ISO_ORIGIN_Y;

  return { x: sx, y: sy };
}

// Projection inverse : coordonnées d'écran -> coordonnées de grille (approximation)
// On convertit d'abord les coordonnées dans le repère de l'origine iso,
// puis on applique la matrice inverse de la projection.
export function screenToGrid(
  screenX: number,
  screenY: number
): { x: number; y: number } {
  const halfW = ISO_TILE_WIDTH / 2;
  const halfH = ISO_TILE_HEIGHT / 2;

  const dx = screenX - ISO_ORIGIN_X;
  const dy = screenY - ISO_ORIGIN_Y;

  const nx = dx / halfW;
  const ny = dy / halfH;

  const gx = (nx + ny) / 2;
  const gy = (ny - nx) / 2;

  // On arrondit à la case la plus proche.
  const rx = Math.round(gx);
  const ry = Math.round(gy);

  return { x: rx, y: ry };
}
