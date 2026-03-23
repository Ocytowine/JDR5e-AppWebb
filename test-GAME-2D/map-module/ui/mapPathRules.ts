import { getWorldMapCellKey, type MapCell, type MapPath, type WorldMapLayout } from "../data/worldMapLayout";

type RouteAppendValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export type LayoutPathIssue = {
  pathId: string;
  message: string;
};

export type InvalidPathSegment = {
  pathId: string;
  pathKind: MapPath["kind"];
  from: MapCell;
  to: MapCell;
  reason: string;
};

function getCellRecord(layout: WorldMapLayout, cell: MapCell) {
  return layout.cells.find(entry => getWorldMapCellKey(entry.cell) === getWorldMapCellKey(cell)) ?? null;
}

function isLandCell(layout: WorldMapLayout, cell: MapCell): boolean {
  const record = getCellRecord(layout, cell);
  return record?.surface === "land";
}

function isOceanCell(layout: WorldMapLayout, cell: MapCell): boolean {
  const record = getCellRecord(layout, cell);
  return record?.surface === "ocean";
}

function getOddRNeighbors(cell: MapCell): MapCell[] {
  const isOddRow = Math.abs(cell.y % 2) === 1;
  const deltas = isOddRow
    ? [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: -1 },
        { x: 1, y: -1 },
        { x: 0, y: 1 },
        { x: 1, y: 1 }
      ]
    : [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: -1, y: -1 },
        { x: 0, y: -1 },
        { x: -1, y: 1 },
        { x: 0, y: 1 }
      ];
  return deltas.map(delta => ({ x: cell.x + delta.x, y: cell.y + delta.y }));
}

function getRenderableNeighborCells(layout: WorldMapLayout, cell: MapCell): MapCell[] {
  return getOddRNeighbors(cell).filter(neighbor => Boolean(getCellRecord(layout, neighbor)));
}

export function areNeighborCells(first: MapCell, second: MapCell): boolean {
  const secondKey = getWorldMapCellKey(second);
  return getOddRNeighbors(first).some(candidate => getWorldMapCellKey(candidate) === secondKey);
}

function hasCliffBetweenCells(layout: WorldMapLayout, first: MapCell, second: MapCell): boolean {
  const firstKey = getWorldMapCellKey(first);
  const secondKey = getWorldMapCellKey(second);
  return layout.cliffSegments.some(segment => {
    const aKey = getWorldMapCellKey(segment.a);
    const bKey = getWorldMapCellKey(segment.b);
    return (aKey === firstKey && bKey === secondKey) || (aKey === secondKey && bKey === firstKey);
  });
}

export function validateRouteAppend(layout: WorldMapLayout, route: MapPath, cell: MapCell): RouteAppendValidationResult {
  const cellKey = getWorldMapCellKey(cell);
  const lastCell = route.cells[route.cells.length - 1] ?? null;
  const lastKey = lastCell ? getWorldMapCellKey(lastCell) : null;

  if (cellKey === lastKey) {
    return { ok: false, reason: "Cette case est deja le dernier point du trace." };
  }

  if (!lastCell) {
    if (route.kind === "road" && !isLandCell(layout, cell)) {
      return { ok: false, reason: "Une route doit commencer sur une case terrestre." };
    }
    if (route.kind === "river" && !isLandCell(layout, cell)) {
      return { ok: false, reason: "Un cours d'eau doit commencer sur une case terrestre." };
    }
    return { ok: true };
  }

  if (!areNeighborCells(lastCell, cell)) {
    return { ok: false, reason: "Le trace doit avancer de case voisine en case voisine." };
  }

  if (route.kind === "road") {
    if (!isLandCell(layout, cell)) {
      return { ok: false, reason: "Une route ne peut passer que sur des cases terrestres." };
    }
    if (hasCliffBetweenCells(layout, lastCell, cell)) {
      return { ok: false, reason: "Une route ne peut pas traverser une falaise." };
    }
    return { ok: true };
  }

  const hasOceanAlready = route.cells.some(point => isOceanCell(layout, point));
  if (hasOceanAlready) {
    return { ok: false, reason: "Le trace de la riviere est termine des qu'il atteint la mer." };
  }
  if (isOceanCell(layout, cell)) {
    return { ok: true };
  }
  if (!isLandCell(layout, cell)) {
    return { ok: false, reason: "Un cours d'eau doit rester sur terre jusqu'a son embouchure en mer." };
  }
  return { ok: true };
}

export function getAllowedRouteAppendCells(layout: WorldMapLayout, route: MapPath | null): MapCell[] {
  if (!route) return [];

  if (route.cells.length === 0) {
    return layout.cells
      .filter(cell => {
        if (route.kind === "road") return cell.surface === "land";
        return cell.surface === "land";
      })
      .map(cell => cell.cell);
  }

  const lastCell = route.cells[route.cells.length - 1];
  return getRenderableNeighborCells(layout, lastCell).filter(cell => validateRouteAppend(layout, route, cell).ok);
}

export function collectInvalidPathSegments(layout: WorldMapLayout): InvalidPathSegment[] {
  const segments: InvalidPathSegment[] = [];

  layout.paths.forEach(path => {
    path.cells.slice(1).forEach((cell, index) => {
      const previous = path.cells[index];
      if (!areNeighborCells(previous, cell)) {
        segments.push({
          pathId: path.id,
          pathKind: path.kind,
          from: previous,
          to: cell,
          reason: "Le trace saute des cases non voisines."
        });
        return;
      }
      if (path.kind === "road" && hasCliffBetweenCells(layout, previous, cell)) {
        segments.push({
          pathId: path.id,
          pathKind: path.kind,
          from: previous,
          to: cell,
          reason: "La route traverse une falaise."
        });
      }
    });
  });

  return segments;
}

export function validateLayoutPathRules(layout: WorldMapLayout): LayoutPathIssue[] {
  const issues: LayoutPathIssue[] = [];

  layout.paths.forEach(path => {
    if (path.cells.length === 0) return;

    path.cells.forEach((cell, index) => {
      if (path.kind === "road" && !isLandCell(layout, cell)) {
        issues.push({
          pathId: path.id,
          message: `La route ${path.label || path.id} passe sur une case non terrestre (${cell.x},${cell.y}).`
        });
      }

      if (path.kind === "river") {
        const isLast = index === path.cells.length - 1;
        if (index === 0 && !isLandCell(layout, cell)) {
          issues.push({
            pathId: path.id,
            message: `Le cours d'eau ${path.label || path.id} doit commencer sur terre.`
          });
        } else if (!isLast && !isLandCell(layout, cell)) {
          issues.push({
            pathId: path.id,
            message: `Le cours d'eau ${path.label || path.id} doit rester sur terre avant son embouchure.`
          });
        } else if (isLast && !isOceanCell(layout, cell)) {
          issues.push({
            pathId: path.id,
            message: `Le cours d'eau ${path.label || path.id} doit se terminer en mer.`
          });
        }
      }

      if (index === 0) return;
      const previous = path.cells[index - 1];
      if (!areNeighborCells(previous, cell)) {
        issues.push({
          pathId: path.id,
          message: `Le trace ${path.label || path.id} saute des cases entre (${previous.x},${previous.y}) et (${cell.x},${cell.y}).`
        });
      }
      if (path.kind === "road" && hasCliffBetweenCells(layout, previous, cell)) {
        issues.push({
          pathId: path.id,
          message: `La route ${path.label || path.id} traverse une falaise entre (${previous.x},${previous.y}) et (${cell.x},${cell.y}).`
        });
      }
    });
  });

  return issues;
}
