import { getWorldMapCellKey, type MapCell, type MapPath, type RoadType, type WorldMapLayout } from "../data/worldMapLayout";
import { hasCliffBetweenCells } from "./editor/mapEditorLayoutUtils";

export type RiverFlowCategory = "stream" | "river" | "fleuve";

export type CellFeatureIndexEntry = {
  roads: Array<{ featureId: string; roadType: RoadType }>;
  rivers: Array<{
    featureId: string;
    flowValue: number;
    flowCategory: RiverFlowCategory;
    sourceType: "source" | "tributary" | "main";
    cliffDrop: boolean;
  }>;
};

export type EdgeTraversalEntry = {
  from: string;
  to: string;
  roadId?: string;
  riverId?: string;
  cliffBlocked: boolean;
  waterfall: boolean;
  moveCost: number;
};

export type RiverSegmentVisual = {
  key: string;
  from: MapCell;
  to: MapCell;
  flowValue: number;
  width: number;
  waterfall: boolean;
  flowError: boolean;
};

export type RiverConfluenceMarker = {
  key: string;
  cell: MapCell;
  riverIds: string[];
};

export type RiverLabelAnchor = {
  key: string;
  cell: MapCell;
  label: string;
  flowValue: number;
  sourceType: "source" | "tributary" | "main";
};

export type RiverErrorMarker = {
  key: string;
  cell: MapCell;
  riverId: string;
};

function getCliffSegment(layout: WorldMapLayout, first: MapCell, second: MapCell) {
  const firstKey = getWorldMapCellKey(first);
  const secondKey = getWorldMapCellKey(second);
  return (
    layout.cliffSegments.find(segment => {
      const aKey = getWorldMapCellKey(segment.a);
      const bKey = getWorldMapCellKey(segment.b);
      return (aKey === firstKey && bKey === secondKey) || (aKey === secondKey && bKey === firstKey);
    }) ?? null
  );
}

export function getOrderedPathCells(path: MapPath): MapCell[] {
  return path.cells;
}

export function reversePathCells(path: MapPath): MapCell[] {
  return [...path.cells].reverse();
}

export function getRiverFlowValue(path: MapPath): number {
  if (path.kind !== "river") return 0;
  const baseFlow = Math.max(1, Number(path.sourceFlow) || 1);
  const growth = Math.max(path.cells.length - 1, 0) * 0.12;
  return Number((baseFlow + growth).toFixed(2));
}

export function getRiverFlowCategory(flowValue: number): RiverFlowCategory {
  if (flowValue >= 3.5) return "fleuve";
  if (flowValue >= 1.75) return "river";
  return "stream";
}

export function getRiverFlowCategoryLabel(flowValue: number): string {
  const category = getRiverFlowCategory(flowValue);
  if (category === "fleuve") return "Fleuve";
  if (category === "river") return "Riviere";
  return "Ruisseau";
}

export function getRiverSourceTypeLabel(sourceType: "source" | "tributary" | "main"): string {
  switch (sourceType) {
    case "tributary":
      return "Affluent";
    case "main":
      return "Cours principal";
    default:
      return "Source";
  }
}

export function getRoadStrokeWidth(roadType: RoadType): number {
  switch (roadType) {
    case "track":
      return 4.5;
    case "major_road":
      return 9;
    default:
      return 7;
  }
}

export function getRiverStrokeWidth(flowValue: number): number {
  if (flowValue >= 3.5) return 12;
  if (flowValue >= 1.75) return 9;
  return 6;
}

export function buildRiverVisualData(layout: WorldMapLayout): {
  segmentsByRiverId: Record<string, RiverSegmentVisual[]>;
  confluenceMarkers: RiverConfluenceMarker[];
  labelAnchors: RiverLabelAnchor[];
  errorMarkers: RiverErrorMarker[];
} {
  const riverPaths = layout.paths.filter(path => path.kind === "river");
  const incomingByCellKey = new Map<string, number>();
  const riversByCellKey = new Map<string, Set<string>>();

  riverPaths.forEach(path => {
    path.cells.forEach(cell => {
      const key = getWorldMapCellKey(cell);
      const bucket = riversByCellKey.get(key) ?? new Set<string>();
      bucket.add(path.id);
      riversByCellKey.set(key, bucket);
    });
    if (path.cells.length > 0) {
      const endCell = path.cells[path.cells.length - 1];
      const endKey = getWorldMapCellKey(endCell);
      incomingByCellKey.set(endKey, (incomingByCellKey.get(endKey) ?? 0) + getRiverFlowValue(path));
    }
  });

  const segmentsByRiverId: Record<string, RiverSegmentVisual[]> = {};
  const errorMarkers: RiverErrorMarker[] = [];
  const labelAnchors: RiverLabelAnchor[] = riverPaths
    .filter(path => path.cells.length > 0)
    .map(path => ({
      key: `river-label-${path.id}`,
      cell: path.cells[Math.floor(path.cells.length / 2)],
      label: path.label,
      flowValue: getRiverFlowValue(path),
      sourceType: path.sourceType ?? "source"
    }));

  riverPaths.forEach(path => {
    const segments: RiverSegmentVisual[] = [];
    let flow = Math.max(1, Number(path.sourceFlow) || 1);
    for (let index = 0; index < path.cells.length - 1; index += 1) {
      const from = path.cells[index];
      const to = path.cells[index + 1];
      const fromKey = getWorldMapCellKey(from);
      const incomingAtFrom = incomingByCellKey.get(fromKey) ?? 0;
      const ownFinalFlow = index === path.cells.length - 1 ? getRiverFlowValue(path) : 0;
      const cliffSegment = getCliffSegment(layout, from, to);
      const waterfall = cliffSegment
        ? getWorldMapCellKey(cliffSegment.high) === getWorldMapCellKey(from) &&
          getWorldMapCellKey(cliffSegment.low) === getWorldMapCellKey(to)
        : false;
      const flowError = cliffSegment
        ? getWorldMapCellKey(cliffSegment.low) === getWorldMapCellKey(from) &&
          getWorldMapCellKey(cliffSegment.high) === getWorldMapCellKey(to)
        : false;
      flow += Math.max(0, incomingAtFrom - ownFinalFlow) + 0.12;
      segments.push({
        key: `${path.id}-${index}`,
        from,
        to,
        flowValue: Number(flow.toFixed(2)),
        width: getRiverStrokeWidth(flow),
        waterfall,
        flowError
      });
      if (flowError) {
        errorMarkers.push({
          key: `river-error-${path.id}-${index}`,
          cell: to,
          riverId: path.id
        });
      }
    }
    segmentsByRiverId[path.id] = segments;
  });

  const confluenceMarkers: RiverConfluenceMarker[] = Array.from(riversByCellKey.entries())
    .filter(([, riverIds]) => riverIds.size > 1)
    .map(([cellKey, riverIds]) => {
      const [x, y] = cellKey.split(",").map(Number);
      return {
        key: `confluence-${cellKey}`,
        cell: { x, y },
        riverIds: Array.from(riverIds)
      };
    });

  return { segmentsByRiverId, confluenceMarkers, labelAnchors, errorMarkers };
}

export function buildCellFeatureIndex(layout: WorldMapLayout): Record<string, CellFeatureIndexEntry> {
  const index: Record<string, CellFeatureIndexEntry> = {};

  function ensureEntry(cell: MapCell): CellFeatureIndexEntry {
    const key = getWorldMapCellKey(cell);
    if (!index[key]) {
      index[key] = { roads: [], rivers: [] };
    }
    return index[key];
  }

  layout.paths.forEach(path => {
    if (path.kind === "road") {
      const roadType = path.roadType ?? "road";
      path.cells.forEach(cell => {
        ensureEntry(cell).roads.push({ featureId: path.id, roadType });
      });
      return;
    }

    const flowValue = getRiverFlowValue(path);
    const flowCategory = getRiverFlowCategory(flowValue);
    path.cells.forEach((cell, indexInPath) => {
      const previous = indexInPath > 0 ? path.cells[indexInPath - 1] : null;
      ensureEntry(cell).rivers.push({
        featureId: path.id,
        flowValue,
        flowCategory,
        sourceType: path.sourceType ?? "source",
        cliffDrop: previous ? hasCliffBetweenCells(layout, previous, cell) : false
      });
    });
  });

  return index;
}

export function buildEdgeTraversalIndex(layout: WorldMapLayout): Record<string, EdgeTraversalEntry> {
  const index: Record<string, EdgeTraversalEntry> = {};

  function writeEntry(from: MapCell, to: MapCell, entry: Omit<EdgeTraversalEntry, "from" | "to">): void {
    const fromKey = getWorldMapCellKey(from);
    const toKey = getWorldMapCellKey(to);
    index[`${fromKey}->${toKey}`] = {
      from: fromKey,
      to: toKey,
      ...entry
    };
  }

  layout.paths.forEach(path => {
    for (let i = 1; i < path.cells.length; i += 1) {
      const previous = path.cells[i - 1];
      const current = path.cells[i];
      const cliffBetween = hasCliffBetweenCells(layout, previous, current);

      if (path.kind === "road") {
        const moveCost = path.roadType === "track" ? 0.85 : path.roadType === "major_road" ? 0.45 : 0.6;
        writeEntry(previous, current, {
          roadId: path.id,
          cliffBlocked: cliffBetween,
          waterfall: false,
          moveCost
        });
        writeEntry(current, previous, {
          roadId: path.id,
          cliffBlocked: cliffBetween,
          waterfall: false,
          moveCost
        });
        continue;
      }

      const flowValue = getRiverFlowValue(path);
      writeEntry(previous, current, {
        riverId: path.id,
        cliffBlocked: false,
        waterfall: cliffBetween,
        moveCost: 1
      });
      writeEntry(current, previous, {
        riverId: path.id,
        cliffBlocked: false,
        waterfall: cliffBetween,
        moveCost: 1 + flowValue * 0.15
      });
    }
  });

  return index;
}
