import type { MapSpec } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function nextEven(value: number): number {
  const v = Math.max(1, Math.floor(value));
  return v % 2 === 0 ? v : v + 1;
}

/**
 * Recommande une taille de grille minimum en fonction du prompt/spec.
 *
 * Objectif:
 * - éviter les maps "confinées" quand le prompt demande "grand"
 * - préserver la stabilité: si aucune recommandation => on garde la grille actuelle
 */
export function recommendGridFromSpec(params: {
  spec: MapSpec;
  enemyCount: number;
}): { cols: number; rows: number; reason: string } | null {
  const { spec } = params;
  const cols = Math.max(1, spec.grid.cols);
  const rows = Math.max(1, spec.grid.rows);

  // Base: besoin d'espace pour les entités
  const targetPlayableCells =
    spec.sizeHint === "large"
      ? Math.max(120, params.enemyCount * 28 + 80)
      : spec.sizeHint === "small"
        ? Math.max(48, params.enemyCount * 16 + 20)
        : Math.max(72, params.enemyCount * 22 + 40);

  // Si cercle: approx area ~ πr² => r ~ sqrt(area/π)
  if (spec.layoutId === "dungeon_circular_room") {
    const r = Math.sqrt(targetPlayableCells / Math.PI);
    const minDim = nextEven(Math.ceil(r * 2 + 4)); // marge pour murs + accès

    const desiredRows = Math.max(rows, minDim);
    const desiredCols = Math.max(cols, nextEven(Math.ceil(minDim * 1.4)));

    if (desiredCols > cols || desiredRows > rows) {
      return {
        cols: clamp(desiredCols, cols, 60),
        rows: clamp(desiredRows, rows, 40),
        reason: `salle circulaire '${spec.sizeHint ?? "medium"}' -> minDim≈${minDim}, cible≈${targetPlayableCells} cases`
      };
    }
    return null;
  }

  // Rectangle/carré: viser une densité raisonnable, en privilégiant une grille "carrée" si possible.
  if (spec.layoutId === "dungeon_square_room") {
    const minSide = nextEven(Math.ceil(Math.sqrt(targetPlayableCells) + 4)); // marge murs + respiration
    const desiredSide = Math.max(minSide, Math.max(cols, rows));

    // On garde une grille plutôt carrée, mais on respecte l'orientation actuelle si elle est très différente.
    const aspect = cols / rows;
    const wantSquare = aspect > 0.75 && aspect < 1.33;

    const desiredCols = Math.max(cols, wantSquare ? desiredSide : nextEven(Math.ceil(desiredSide * Math.max(1, aspect))));
    const desiredRows = Math.max(rows, wantSquare ? desiredSide : nextEven(Math.ceil(desiredSide / Math.max(1, aspect))));

    if (desiredCols > cols || desiredRows > rows) {
      return {
        cols: clamp(desiredCols, cols, 70),
        rows: clamp(desiredRows, rows, 50),
        reason: `salle carrée '${spec.sizeHint ?? "medium"}' -> minDim≈${minSide}, cible≈${targetPlayableCells} cases`
      };
    }
    return null;
  }

  // Rue: plus de colonnes si horizontale, plus de lignes si verticale
  if (spec.layoutId === "city_street") {
    const scale = spec.sizeHint === "large" ? 1.6 : spec.sizeHint === "small" ? 1.0 : 1.25;
    const desiredCols = Math.max(cols, nextEven(Math.ceil(cols * scale)));
    const desiredRows = Math.max(rows, nextEven(Math.ceil(rows * (spec.sizeHint === "large" ? 1.4 : 1.1))));
    if (desiredCols > cols || desiredRows > rows) {
      return {
        cols: clamp(desiredCols, cols, 70),
        rows: clamp(desiredRows, rows, 50),
        reason: `rue '${spec.sizeHint ?? "medium"}' -> agrandissement pour réduire la densité`
      };
    }
    return null;
  }

  // Forêt/clairière: augmenter un peu si "large"
  if (spec.layoutId === "forest_clearing") {
    const scale = spec.sizeHint === "large" ? 1.5 : spec.sizeHint === "small" ? 1.0 : 1.2;
    const desiredCols = Math.max(cols, nextEven(Math.ceil(cols * scale)));
    const desiredRows = Math.max(rows, nextEven(Math.ceil(rows * scale)));
    if (desiredCols > cols || desiredRows > rows) {
      return {
        cols: clamp(desiredCols, cols, 70),
        rows: clamp(desiredRows, rows, 50),
        reason: `clairière '${spec.sizeHint ?? "medium"}' -> plus d'espace autour`
      };
    }
    return null;
  }

  // Fallback générique
  if (spec.sizeHint === "large") {
    const desiredCols = Math.max(cols, 18);
    const desiredRows = Math.max(rows, 12);
    if (desiredCols > cols || desiredRows > rows) {
      return {
        cols: desiredCols,
        rows: desiredRows,
        reason: "taille 'large' (fallback générique)"
      };
    }
  }

  return null;
}
