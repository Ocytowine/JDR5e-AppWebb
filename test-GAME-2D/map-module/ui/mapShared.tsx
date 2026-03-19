import React, { useEffect, useMemo, useRef, useState } from "react";
import { createGridAdapter } from "../../src/ui/grid";
import {
  createRuntimeWorldMapLayout,
  getWorldMapCellKey,
  serializeWorldMapLayout,
  type MapCell,
  type MapCellData,
  type MapLayerId,
  type ReliefElevationLevel,
  type WorldMapLayout,
  type WorldMapLayoutSource
} from "../data/worldMapLayout";
import { computeCliffOverlay, getSharedHexEdge } from "./cliffOverlayHelpers";
import {
  buildCellFeatureIndex,
  buildRiverVisualData,
  getRiverFlowValue,
  getRiverStrokeWidth,
  getRoadStrokeWidth
} from "./mapTraversal";

export type WikiEntry = {
  id: string;
  type: string;
  name: string;
  relativePath: string;
  frontMatter: Record<string, unknown>;
  snippet: string;
  body: string;
};

export const GEOGRAPHY_PRESET_COLORS: Record<string, string> = {
  ocean: "rgba(76,132,196,0.78)",
  plaine: "rgba(171,145,99,0.56)",
  colline: "rgba(178,148,104,0.62)",
  foret_claire: "rgba(103,150,103,0.58)",
  foret_dense: "rgba(67,115,72,0.66)",
  marais: "rgba(89,125,103,0.64)",
  montagne: "rgba(132,132,144,0.62)",
  desert: "rgba(206,180,115,0.62)",
  cote: "rgba(124,162,132,0.58)",
  toundra: "rgba(173,190,198,0.56)",
  jungle: "rgba(55,124,77,0.68)",
  urbain: "rgba(138,121,145,0.60)"
};

export const TAG_PRESET_COLORS: Record<string, string> = {
  maritime: "#5fa8d3",
  commerce: "#d2a95a",
  dangereux: "#d76c6c",
  sacre: "#b99cf2",
  ruines: "#8e7f72",
  frontalier: "#9dc27f",
  agricole: "#c3b064",
  minier: "#8d98a8",
  forestier: "#5da06d",
  urbain: "#c08ad6"
};

const HEX_START_ANGLE = -Math.PI / 2;
const ZOOM_MIN = 0.35;
const ZOOM_MAX = 3;
const ZOOM_STEP = 1.15;

export function cloneLayout(layout: WorldMapLayout): WorldMapLayout {
  return JSON.parse(JSON.stringify(layout)) as WorldMapLayout;
}

function createGrid(layout: WorldMapLayout) {
  return createGridAdapter({
    kind: "hex",
    tileSize: layout.grid.tileSize / Math.sqrt(3),
    origin: { x: layout.grid.tileSize / 2, y: layout.grid.tileSize / 2 },
    hex: {
      offset: layout.grid.offset,
      orientation: layout.grid.orientation
    }
  });
}

export function getCellCenter(layout: WorldMapLayout, cell: MapCell): { x: number; y: number } {
  return createGrid(layout).toScreen(cell, layout.grid);
}

export function getCellPolygon(layout: WorldMapLayout, cell: MapCell): string {
  const center = getCellCenter(layout, cell);
  const radius = layout.grid.tileSize / Math.sqrt(3);
  const points: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = HEX_START_ANGLE + (Math.PI / 3) * i;
    points.push(`${center.x + radius * Math.cos(angle)},${center.y + radius * Math.sin(angle)}`);
  }
  return points.join(" ");
}

export function getMapBounds(layout: WorldMapLayout): { width: number; height: number } {
  let maxX = layout.grid.tileSize;
  let maxY = layout.grid.tileSize;
  const radius = layout.grid.tileSize / Math.sqrt(3);
  for (let y = 0; y < layout.grid.rows; y += 1) {
    for (let x = 0; x < layout.grid.cols; x += 1) {
      const center = getCellCenter(layout, { x, y });
      maxX = Math.max(maxX, center.x + radius);
      maxY = Math.max(maxY, center.y + radius);
    }
  }
  return {
    width: Math.ceil(maxX + layout.grid.tileSize / 2),
    height: Math.ceil(maxY + layout.grid.tileSize / 2)
  };
}

export function buildPathPoints(layout: WorldMapLayout, cells: MapCell[]): string {
  return cells
    .map(cell => {
      const center = getCellCenter(layout, cell);
      return `${center.x},${center.y}`;
    })
    .join(" ");
}

function getPoliticalTerritoryKey(cell: MapCellData): string {
  return cell.governanceTerritoryId ?? "";
}

function getAdministrativeRegionKey(cell: MapCellData): string {
  return cell.governanceRegionId ?? "";
}

function buildCellEdgeContext(layout: WorldMapLayout, cellByKey: Map<string, MapCellData>) {
  const grid = createGrid(layout);
  const bounds = layout.grid;
  return (cell: MapCellData) => {
    const centerPoint = getCellCenter(layout, cell.cell);
    const polygon = getCellPolygon(layout, cell.cell).split(" ").map(point => {
      const [x, y] = point.split(",").map(Number);
      return { x, y };
    });
    const edgeMidpoints = polygon.map((point, index) => {
      const next = polygon[(index + 1) % polygon.length];
      return {
        index,
        angle: Math.atan2((point.y + next.y) / 2 - centerPoint.y, (point.x + next.x) / 2 - centerPoint.x)
      };
    });
    const edgeNeighborMap = new Map<number, MapCellData | null>();

    grid.neighbors(cell.cell, bounds).forEach(neighborCell => {
      const neighborCenter = getCellCenter(layout, neighborCell);
      const angle = Math.atan2(neighborCenter.y - centerPoint.y, neighborCenter.x - centerPoint.x);
      let bestIndex = edgeMidpoints[0]?.index ?? 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      edgeMidpoints.forEach(edge => {
        const distance = Math.abs(angle - edge.angle);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = edge.index;
        }
      });
      edgeNeighborMap.set(bestIndex, cellByKey.get(getWorldMapCellKey(neighborCell)) ?? null);
    });

    return { centerPoint, polygon, edgeNeighborMap };
  };
}

export function computeBorderSegments(
  layout: WorldMapLayout
): Array<{ path: string; type: "coast" | "territory" | "region"; color?: string }> {
  const segments: Array<{ path: string; type: "coast" | "territory" | "region"; color?: string }> = [];
  const cellByKey = new Map(layout.cells.map(cell => [getWorldMapCellKey(cell.cell), cell]));
  const getEdgeContext = buildCellEdgeContext(layout, cellByKey);

  layout.cells.forEach(cell => {
    const { polygon, edgeNeighborMap } = getEdgeContext(cell);
    polygon.forEach((_point, index) => {
      const neighbor = edgeNeighborMap.has(index) ? edgeNeighborMap.get(index) ?? null : null;
      let type: "coast" | null = null;
      if (!neighbor) {
        type = cell.surface === "land" ? "coast" : null;
      } else if (neighbor.surface !== cell.surface && cell.surface === "land") {
        type = "coast";
      }
      if (!type) return;
      const a = polygon[index];
      const b = polygon[(index + 1) % polygon.length];
      segments.push({ path: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, type });
    });
  });

  return segments;
}

export function computePoliticalBoundaryOverlay(layout: WorldMapLayout): {
  territorySegments: Array<{ path: string; territoryId: string; color: string }>;
  regionSegments: Array<{ path: string; regionId: string; color: string }>;
} {
  const renderableCells = getRenderableCells(layout);
  const cellByKey = new Map(renderableCells.map(cell => [getWorldMapCellKey(cell.cell), cell]));
  const getEdgeContext = buildCellEdgeContext(layout, cellByKey);
  const territorySegments: Array<{ path: string; territoryId: string; color: string }> = [];
  const regionSegments: Array<{ path: string; regionId: string; color: string }> = [];

  (layout.governanceTerritories ?? []).forEach(territory => {
    renderableCells
      .filter(cell => cell.governanceTerritoryId === territory.id)
      .forEach(cell => {
        const { polygon, edgeNeighborMap } = getEdgeContext(cell);
        polygon.forEach((_point, index) => {
          const neighbor = edgeNeighborMap.has(index) ? edgeNeighborMap.get(index) ?? null : null;
          if (neighbor && neighbor.governanceTerritoryId === territory.id) return;
          const a = polygon[index];
          const b = polygon[(index + 1) % polygon.length];
          territorySegments.push({ path: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, territoryId: territory.id, color: territory.color });
        });
      });
  });

  (layout.governanceRegions ?? []).forEach(region => {
    renderableCells
      .filter(cell => cell.governanceRegionId === region.id)
      .forEach(cell => {
        const { centerPoint, polygon, edgeNeighborMap } = getEdgeContext(cell);
        polygon.forEach((_point, index) => {
          const neighbor = edgeNeighborMap.has(index) ? edgeNeighborMap.get(index) ?? null : null;
          if (neighbor && neighbor.governanceRegionId === region.id) return;
          const a = polygon[index];
          const b = polygon[(index + 1) % polygon.length];
          const inset = layout.grid.tileSize * 0.045;
          const edgeVector = { x: b.x - a.x, y: b.y - a.y };
          const edgeLength = Math.max(Math.hypot(edgeVector.x, edgeVector.y), 1);
          const tangent = { x: edgeVector.x / edgeLength, y: edgeVector.y / edgeLength };
          const extend = layout.grid.tileSize * 0.018;
          const insetA = {
            x: a.x + ((centerPoint.x - a.x) * inset) / Math.max(Math.hypot(centerPoint.x - a.x, centerPoint.y - a.y), 1),
            y: a.y + ((centerPoint.y - a.y) * inset) / Math.max(Math.hypot(centerPoint.x - a.x, centerPoint.y - a.y), 1)
          };
          const insetB = {
            x: b.x + ((centerPoint.x - b.x) * inset) / Math.max(Math.hypot(centerPoint.x - b.x, centerPoint.y - b.y), 1),
            y: b.y + ((centerPoint.y - b.y) * inset) / Math.max(Math.hypot(centerPoint.x - b.x, centerPoint.y - b.y), 1)
          };
          const extendedA = {
            x: insetA.x - tangent.x * extend,
            y: insetA.y - tangent.y * extend
          };
          const extendedB = {
            x: insetB.x + tangent.x * extend,
            y: insetB.y + tangent.y * extend
          };
          regionSegments.push({ path: `M ${extendedA.x} ${extendedA.y} L ${extendedB.x} ${extendedB.y}`, regionId: region.id, color: region.color });
        });
      });
  });

  return { territorySegments, regionSegments };
}

function buildRiverArrowTransform(layout: WorldMapLayout, cells: MapCell[]): string | null {
  if (cells.length < 2) return null;
  const segmentIndex = Math.floor((cells.length - 1) / 2);
  const start = getCellCenter(layout, cells[segmentIndex]);
  const end = getCellCenter(layout, cells[segmentIndex + 1]);
  const x = start.x + (end.x - start.x) * 0.58;
  const y = start.y + (end.y - start.y) * 0.58;
  const angle = Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI);
  return `translate(${x} ${y}) rotate(${angle})`;
}

function getCoastalSegmentEndpoints(
  layout: WorldMapLayout,
  from: MapCell,
  to: MapCell
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const fromCenter = getCellCenter(layout, from);
  const toCenter = getCellCenter(layout, to);
  const fromCellData = layout.cells.find(cell => getWorldMapCellKey(cell.cell) === getWorldMapCellKey(from)) ?? null;
  const toCellData = layout.cells.find(cell => getWorldMapCellKey(cell.cell) === getWorldMapCellKey(to)) ?? null;
  if (!fromCellData || !toCellData || fromCellData.surface === toCellData.surface) {
    return { start: fromCenter, end: toCenter };
  }

  const sharedEdge = getSharedHexEdge(layout, from, to);
  if (!sharedEdge) {
    return { start: fromCenter, end: toCenter };
  }

  const coastMid = {
    x: (sharedEdge.start.x + sharedEdge.end.x) / 2,
    y: (sharedEdge.start.y + sharedEdge.end.y) / 2
  };
  if (fromCellData.surface === "land") {
    return { start: fromCenter, end: coastMid };
  }
  return { start: toCenter, end: coastMid };
}

function getCliffSegmentBetweenCells(layout: WorldMapLayout, first: MapCell, second: MapCell) {
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

function buildWaterfallPath(layout: WorldMapLayout, highCell: MapCell, lowCell: MapCell): { path: string; transform: string } | null {
  const edge = getSharedHexEdge(layout, highCell, lowCell);
  if (!edge) return null;
  const center = getCellCenter(layout, lowCell);
  const mid = {
    x: (edge.start.x + edge.end.x) / 2,
    y: (edge.start.y + edge.end.y) / 2
  };
  const edgeVector = {
    x: edge.end.x - edge.start.x,
    y: edge.end.y - edge.start.y
  };
  const edgeLength = Math.hypot(edgeVector.x, edgeVector.y) || 1;
  const tangent = {
    x: edgeVector.x / edgeLength,
    y: edgeVector.y / edgeLength
  };
  const normals = [
    { x: -tangent.y, y: tangent.x },
    { x: tangent.y, y: -tangent.x }
  ];
  const toLowCell = {
    x: center.x - mid.x,
    y: center.y - mid.y
  };
  const normal =
    normals[0].x * toLowCell.x + normals[0].y * toLowCell.y >= normals[1].x * toLowCell.x + normals[1].y * toLowCell.y
      ? normals[0]
      : normals[1];
  const halfWidth = Math.min(12, edgeLength * 0.32);
  const depth = 8;
  const path = `M ${-halfWidth} 0 Q 0 ${depth} ${halfWidth} 0 L ${-halfWidth} 0 Z`;
  return {
    path,
    transform: `matrix(${tangent.x} ${tangent.y} ${normal.x} ${normal.y} ${mid.x} ${mid.y})`
  };
}

function getFeatureLabelTransform(layout: WorldMapLayout, cells: MapCell[]): { x: number; y: number; angle: number } | null {
  if (cells.length < 2) return null;
  const segmentIndex = Math.floor((cells.length - 1) / 2);
  const start = getCellCenter(layout, cells[segmentIndex]);
  const end = getCellCenter(layout, cells[segmentIndex + 1]);
  const x = (start.x + end.x) / 2;
  const y = (start.y + end.y) / 2;
  let angle = Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI);
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return { x, y, angle };
}

export function computeGeographyOverlay(layout: WorldMapLayout): {
  segments: Array<{ path: string; geography: string; color: string }>;
  labels: Array<{
    key: string;
    geography: string;
    color: string;
    cells: MapCell[];
    preferredCell: MapCell;
  }>;
} {
  const renderableCells = getRenderableCells(layout);
  const cellByKey = new Map(renderableCells.map(cell => [getWorldMapCellKey(cell.cell), cell]));
  const grid = createGrid(layout);
  const bounds = layout.grid;
  const visited = new Set<string>();
  const components: MapCellData[][] = [];

  renderableCells.forEach(cell => {
    const startKey = getWorldMapCellKey(cell.cell);
    if (visited.has(startKey)) return;
    visited.add(startKey);
    const queue = [cell];
    const component: MapCellData[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      grid.neighbors(current.cell, bounds).forEach(neighborCell => {
        const neighbor = cellByKey.get(getWorldMapCellKey(neighborCell));
        if (!neighbor) return;
        const neighborKey = getWorldMapCellKey(neighbor.cell);
        if (visited.has(neighborKey)) return;
        if (neighbor.geography !== cell.geography) return;
        visited.add(neighborKey);
        queue.push(neighbor);
      });
    }

    components.push(component);
  });

  const segments: Array<{ path: string; geography: string; color: string }> = [];
  const labels = components.map(component => {
    const geography = component[0]?.geography ?? "terrain";
    const color = resolveGeographyColor(component[0]?.geography ?? "terre", component[0]?.surface ?? "land");
    let sumX = 0;
    let sumY = 0;

    component.forEach(cell => {
      const center = getCellCenter(layout, cell.cell);
      sumX += center.x;
      sumY += center.y;

      const polygon = getCellPolygon(layout, cell.cell).split(" ").map(point => {
        const [x, y] = point.split(",").map(Number);
        return { x, y };
      });

      const centerPoint = getCellCenter(layout, cell.cell);
      const edgeMidpoints = polygon.map((point, index) => {
        const next = polygon[(index + 1) % polygon.length];
        return {
          index,
          angle: Math.atan2((point.y + next.y) / 2 - centerPoint.y, (point.x + next.x) / 2 - centerPoint.x)
        };
      });
      const edgeNeighborMap = new Map<number, MapCellData | null>();

      grid.neighbors(cell.cell, bounds).forEach(neighborCell => {
        const neighborCenter = getCellCenter(layout, neighborCell);
        const angle = Math.atan2(neighborCenter.y - centerPoint.y, neighborCenter.x - centerPoint.x);
        let bestIndex = edgeMidpoints[0]?.index ?? 0;
        let bestDistance = Number.POSITIVE_INFINITY;
        edgeMidpoints.forEach(edge => {
          const distance = Math.abs(angle - edge.angle);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = edge.index;
          }
        });
        edgeNeighborMap.set(bestIndex, cellByKey.get(getWorldMapCellKey(neighborCell)) ?? null);
      });

      edgeMidpoints.forEach(edge => {
        const neighbor = edgeNeighborMap.has(edge.index) ? edgeNeighborMap.get(edge.index) ?? null : null;
        if (neighbor && neighbor.geography === cell.geography) return;
        const a = polygon[edge.index];
        const b = polygon[(edge.index + 1) % polygon.length];
        segments.push({ path: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, geography, color });
      });
    });

    const preferredCell =
      component
        .map(cell => {
          const center = getCellCenter(layout, cell.cell);
          const dx = center.x - sumX / Math.max(component.length, 1);
          const dy = center.y - sumY / Math.max(component.length, 1);
          return { cell: cell.cell, distance: Math.hypot(dx, dy) };
        })
        .sort((a, b) => a.distance - b.distance)[0]?.cell ?? component[0]?.cell ?? { x: 0, y: 0 };

    return {
      key: `${geography}-${component[0] ? getWorldMapCellKey(component[0].cell) : "0,0"}`,
      geography,
      color,
      cells: component.map(cell => cell.cell),
      preferredCell
    };
  });

  return { segments, labels };
}

export function computeGeographicZonesOverlay(layout: WorldMapLayout): {
  segments: Array<{ path: string; zoneId: string; color: string; width: number; dashArray: string }>;
  labels: Array<{
    key: string;
    label: string;
    color: string;
    cells: MapCell[];
    preferredCell: MapCell;
  }>;
} {
  const renderableCells = getRenderableCells(layout);
  const cellByKey = new Map(renderableCells.map(cell => [getWorldMapCellKey(cell.cell), cell]));
  const grid = createGrid(layout);
  const bounds = layout.grid;
  const segments: Array<{ path: string; zoneId: string; color: string; width: number; dashArray: string }> = [];
  const labels = (layout.geographicZones ?? [])
    .map(zone => {
      const zoneCells = renderableCells.filter(cell => (cell.geographicZoneIds ?? []).includes(zone.id));
      if (zoneCells.length === 0) return null;
      let sumX = 0;
      let sumY = 0;

      zoneCells.forEach(cell => {
        const center = getCellCenter(layout, cell.cell);
        sumX += center.x;
        sumY += center.y;

        const polygon = getCellPolygon(layout, cell.cell).split(" ").map(point => {
          const [x, y] = point.split(",").map(Number);
          return { x, y };
        });

        const centerPoint = getCellCenter(layout, cell.cell);
        const edgeMidpoints = polygon.map((point, index) => {
          const next = polygon[(index + 1) % polygon.length];
          return {
            index,
            angle: Math.atan2((point.y + next.y) / 2 - centerPoint.y, (point.x + next.x) / 2 - centerPoint.x)
          };
        });
        const edgeNeighborMap = new Map<number, MapCellData | null>();

        grid.neighbors(cell.cell, bounds).forEach(neighborCell => {
          const neighborCenter = getCellCenter(layout, neighborCell);
          const angle = Math.atan2(neighborCenter.y - centerPoint.y, neighborCenter.x - centerPoint.x);
          let bestIndex = edgeMidpoints[0]?.index ?? 0;
          let bestDistance = Number.POSITIVE_INFINITY;
          edgeMidpoints.forEach(edge => {
            const distance = Math.abs(angle - edge.angle);
            if (distance < bestDistance) {
              bestDistance = distance;
              bestIndex = edge.index;
            }
          });
          edgeNeighborMap.set(bestIndex, cellByKey.get(getWorldMapCellKey(neighborCell)) ?? null);
        });

        edgeMidpoints.forEach(edge => {
          const neighbor = edgeNeighborMap.has(edge.index) ? edgeNeighborMap.get(edge.index) ?? null : null;
          if (neighbor && (neighbor.geographicZoneIds ?? []).includes(zone.id)) return;
          const a = polygon[edge.index];
          const b = polygon[(edge.index + 1) % polygon.length];
          segments.push({
            path: `M ${a.x} ${a.y} L ${b.x} ${b.y}`,
            zoneId: zone.id,
            color: zone.borderColor ?? zone.color,
            width: Math.max(1, Number(zone.borderWidth) || 1.6),
            dashArray: zone.borderDashArray ?? "5 4"
          });
        });
      });

      const preferredCell =
        zoneCells
          .map(cell => {
            const center = getCellCenter(layout, cell.cell);
            const dx = center.x - sumX / Math.max(zoneCells.length, 1);
            const dy = center.y - sumY / Math.max(zoneCells.length, 1);
            return { cell: cell.cell, distance: Math.hypot(dx, dy) };
          })
          .sort((a, b) => a.distance - b.distance)[0]?.cell ?? zone.labelCell;

      return {
        key: zone.id,
        label: zone.label,
        color: zone.color,
        cells: zoneCells.map(cell => cell.cell),
        preferredCell
      };
    })
    .filter(
      (
        entry
      ): entry is {
        key: string;
        label: string;
        color: string;
        cells: MapCell[];
        preferredCell: MapCell;
      } => Boolean(entry)
    );

  return { segments, labels };
}

function getViewportWorldRect(
  viewportWidth: number,
  viewportHeight: number,
  pan: { x: number; y: number },
  zoom: number
): { left: number; top: number; right: number; bottom: number } {
  return {
    left: (-pan.x) / zoom,
    top: (-pan.y) / zoom,
    right: (viewportWidth - pan.x) / zoom,
    bottom: (viewportHeight - pan.y) / zoom
  };
}

function isCellCenterVisible(
  layout: WorldMapLayout,
  cell: MapCell,
  viewportRect: { left: number; top: number; right: number; bottom: number }
): boolean {
  const center = getCellCenter(layout, cell);
  const radius = layout.grid.tileSize / Math.sqrt(3);
  return (
    center.x >= viewportRect.left - radius &&
    center.x <= viewportRect.right + radius &&
    center.y >= viewportRect.top - radius &&
    center.y <= viewportRect.bottom + radius
  );
}

function chooseVisibleLabelCell(
  layout: WorldMapLayout,
  cells: MapCell[],
  preferredCell: MapCell,
  viewportRect: { left: number; top: number; right: number; bottom: number }
): MapCell | null {
  if (cells.length === 0) return null;
  const viewportCenter = {
    x: (viewportRect.left + viewportRect.right) / 2,
    y: (viewportRect.top + viewportRect.bottom) / 2
  };
  if (isCellCenterVisible(layout, preferredCell, viewportRect)) {
    return preferredCell;
  }
  const visibleCells = cells.filter(cell => isCellCenterVisible(layout, cell, viewportRect));
  if (visibleCells.length === 0) return null;
  return visibleCells
    .map(cell => {
      const center = getCellCenter(layout, cell);
      return { cell, distance: Math.hypot(center.x - viewportCenter.x, center.y - viewportCenter.y) };
    })
    .sort((a, b) => a.distance - b.distance)[0]?.cell ?? null;
}

export function computeReliefOverlay(layout: WorldMapLayout): {
  cliffPolygons: Array<{ key: string; points: string }>;
  markers: Array<{ key: string; center: { x: number; y: number }; label: string; level: ReliefElevationLevel }>;
} {
  const renderableCells = getRenderableCells(layout);
  return {
    cliffPolygons: [],
    markers: renderableCells
      .filter(cell => cell.reliefElevation !== "none")
      .map(cell => ({
        key: `relief-${getWorldMapCellKey(cell.cell)}`,
        center: getCellCenter(layout, cell.cell),
        label: cell.reliefElevation === "high_mountain" ? "HM" : "BM",
        level: cell.reliefElevation
      }))
  };
}

export function useWikiEntries(layout: WorldMapLayout): {
  wikiEntriesById: Record<string, WikiEntry>;
  wikiLoading: boolean;
  wikiError: string | null;
} {
  const [wikiEntriesById, setWikiEntriesById] = useState<Record<string, WikiEntry>>({});
  const [wikiLoading, setWikiLoading] = useState<boolean>(true);
  const [wikiError, setWikiError] = useState<string | null>(null);

  const wikiIds = useMemo(() => {
    const ids = new Set<string>();
    (layout.governances ?? []).forEach(item => ids.add(item.wikiEntityId));
    (layout.governanceTerritories ?? []).forEach(item => ids.add(item.wikiEntityId));
    (layout.governanceRegions ?? []).forEach(item => ids.add(item.wikiEntityId));
    (layout.geographicZones ?? []).forEach(item => {
      if (item.wikiEntityId) ids.add(item.wikiEntityId);
    });
    layout.cities.forEach(item => ids.add(item.wikiEntityId));
    layout.cells.forEach(cell => {
      if (cell.cityWikiId) ids.add(cell.cityWikiId);
      (cell.locationWikiIds ?? []).forEach(id => ids.add(id));
    });
    return Array.from(ids);
  }, [layout]);

  useEffect(() => {
    let cancelled = false;
    async function loadWikiEntries() {
      setWikiLoading(true);
      setWikiError(null);
      try {
        const response = await fetch(
          `/api/map-module/wiki-entries?ids=${encodeURIComponent(wikiIds.join(","))}`
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        const nextEntries: Record<string, WikiEntry> = {};
        const entries = Array.isArray(payload?.entries) ? payload.entries : [];
        entries.forEach((entry: WikiEntry) => {
          if (entry?.id) nextEntries[entry.id] = entry;
        });
        if (!cancelled) setWikiEntriesById(nextEntries);
      } catch (error) {
        if (!cancelled) {
          setWikiError(error instanceof Error ? error.message : "Erreur inconnue");
        }
      } finally {
        if (!cancelled) setWikiLoading(false);
      }
    }
    void loadWikiEntries();
    return () => {
      cancelled = true;
    };
  }, [wikiIds]);

  return { wikiEntriesById, wikiLoading, wikiError };
}

export function useWikiCatalog(types?: string[]): {
  wikiCatalog: WikiEntry[];
  wikiCatalogLoading: boolean;
  wikiCatalogError: string | null;
} {
  const [wikiCatalog, setWikiCatalog] = useState<WikiEntry[]>([]);
  const [wikiCatalogLoading, setWikiCatalogLoading] = useState<boolean>(true);
  const [wikiCatalogError, setWikiCatalogError] = useState<string | null>(null);
  const typesKey = (types ?? []).map(item => item.trim().toLowerCase()).filter(Boolean).sort().join(",");

  useEffect(() => {
    let cancelled = false;

    async function loadWikiCatalog() {
      setWikiCatalogLoading(true);
      setWikiCatalogError(null);
      try {
        const searchParams = new URLSearchParams({ all: "1" });
        if (typesKey) searchParams.set("types", typesKey);
        const response = await fetch(`/api/map-module/wiki-entries?${searchParams.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        const entries = Array.isArray(payload?.entries) ? payload.entries : [];
        if (!cancelled) setWikiCatalog(entries);
      } catch (error) {
        if (!cancelled) {
          setWikiCatalogError(error instanceof Error ? error.message : "Erreur inconnue");
        }
      } finally {
        if (!cancelled) setWikiCatalogLoading(false);
      }
    }

    void loadWikiCatalog();
    return () => {
      cancelled = true;
    };
  }, [typesKey]);

  return { wikiCatalog, wikiCatalogLoading, wikiCatalogError };
}

export async function fetchWorldMapLayout(): Promise<WorldMapLayout> {
  const response = await fetch("/api/map-module/layout");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  return createRuntimeWorldMapLayout(payload.source as WorldMapLayoutSource);
}

export async function saveWorldMapLayout(layout: WorldMapLayout): Promise<WorldMapLayout> {
  const source = serializeWorldMapLayout(layout);
  const response = await fetch("/api/map-module/layout", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ source })
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? `HTTP ${response.status}`);
  }
  const payload = await response.json();
  return createRuntimeWorldMapLayout(payload.source as WorldMapLayoutSource);
}

export function getFrontMatterList(frontMatter: Record<string, unknown>, key: string): string[] {
  const value = frontMatter[key];
  if (Array.isArray(value)) return value.map(item => String(item)).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

export function createDefaultCellData(cell: MapCell): MapCellData {
  return {
    cell,
    surface: "ocean",
    geography: "ocean",
    terrainDifficulty: 9,
    riskLevel: 1,
    reliefElevation: "none",
    tags: ["maritime"]
  };
}

function normalizeSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function resolveGeographyColor(geography: string, surface: "land" | "ocean"): string {
  if (surface === "ocean") return GEOGRAPHY_PRESET_COLORS.ocean;
  const normalized = normalizeSlug(geography);
  if (GEOGRAPHY_PRESET_COLORS[normalized]) return GEOGRAPHY_PRESET_COLORS[normalized];
  if (normalized.includes("foret") && normalized.includes("dense")) return GEOGRAPHY_PRESET_COLORS.foret_dense;
  if (normalized.includes("foret")) return GEOGRAPHY_PRESET_COLORS.foret_claire;
  if (normalized.includes("mont")) return GEOGRAPHY_PRESET_COLORS.montagne;
  if (normalized.includes("marais")) return GEOGRAPHY_PRESET_COLORS.marais;
  if (normalized.includes("colline")) return GEOGRAPHY_PRESET_COLORS.colline;
  if (normalized.includes("plaine")) return GEOGRAPHY_PRESET_COLORS.plaine;
  if (normalized.includes("desert")) return GEOGRAPHY_PRESET_COLORS.desert;
  if (normalized.includes("cote")) return GEOGRAPHY_PRESET_COLORS.cote;
  if (normalized.includes("urb")) return GEOGRAPHY_PRESET_COLORS.urbain;
  return "rgba(154,127,81,0.20)";
}

export function getRenderableCells(layout: WorldMapLayout): MapCellData[] {
  const cellsByKey = new Map(layout.cells.map(cell => [getWorldMapCellKey(cell.cell), cell]));
  const cells: MapCellData[] = [];
  for (let y = 0; y < layout.grid.rows; y += 1) {
    for (let x = 0; x < layout.grid.cols; x += 1) {
      const key = getWorldMapCellKey({ x, y });
      cells.push(cellsByKey.get(key) ?? createDefaultCellData({ x, y }));
    }
  }
  return cells;
}

export function ensureCell(layout: WorldMapLayout, cell: MapCell): WorldMapLayout["cells"][number] {
  const existing = layout.cells.find(entry => getWorldMapCellKey(entry.cell) === getWorldMapCellKey(cell));
  if (existing) return existing;
  const created: WorldMapLayout["cells"][number] = createDefaultCellData(cell);
  layout.cells.push(created);
  return created;
}

export function createCityId(wikiEntityId: string): string {
  return `city-${wikiEntityId}-${Math.random().toString(36).slice(2, 7)}`;
}

export function MapCanvas(props: {
  layout: WorldMapLayout;
  layerVisibility: Record<MapLayerId, boolean>;
  selectedCellKey: string | null;
  highlightedCellKeys?: string[];
  selectedCityId?: string | null;
  selectedRouteId?: string | null;
  routeEditorActive?: boolean;
  terrainOverlayActive?: boolean;
  organizationOverlayActive?: boolean;
  cliffEditPair?: { first: MapCell; second: MapCell } | null;
  onSetCliffHighCell?: (cell: MapCell) => void;
  onRemoveCliffPair?: () => void;
  wikiEntriesById: Record<string, WikiEntry>;
  onCellClick: (cell: MapCell, meta?: { shiftKey: boolean }) => void;
  onCityClick?: (cityId: string, meta?: { shiftKey: boolean }) => void;
  minHeight: string | number;
  overlay?: React.ReactNode;
}): React.JSX.Element {
  const [zoom, setZoom] = useState<number>(0.8);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [spacePressed, setSpacePressed] = useState<boolean>(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const movedDuringPanRef = useRef<boolean>(false);

  const mapBounds = useMemo(() => getMapBounds(props.layout), [props.layout]);
  const renderableCells = useMemo(() => getRenderableCells(props.layout), [props.layout]);
  const borderSegments = useMemo(() => computeBorderSegments({ ...props.layout, cells: renderableCells }), [props.layout, renderableCells]);
  const politicalBoundaryOverlay = useMemo(
    () => computePoliticalBoundaryOverlay({ ...props.layout, cells: renderableCells }),
    [props.layout, renderableCells]
  );
  const geographyOverlay = useMemo(
    () => (props.terrainOverlayActive ? computeGeographyOverlay({ ...props.layout, cells: renderableCells }) : { segments: [], labels: [] }),
    [props.layout, props.terrainOverlayActive, renderableCells]
  );
  const geographicZonesOverlay = useMemo(
    () => (props.layerVisibility.geographicZones ? computeGeographicZonesOverlay({ ...props.layout, cells: renderableCells }) : { segments: [], labels: [] }),
    [props.layout, props.layerVisibility.geographicZones, renderableCells]
  );
  const reliefOverlay = useMemo(
    () => (props.terrainOverlayActive ? computeReliefOverlay({ ...props.layout, cells: renderableCells }) : { cliffPolygons: [], markers: [] }),
    [props.layout, props.terrainOverlayActive, renderableCells]
  );
  const cliffOverlay = useMemo(() => computeCliffOverlay(props.layout), [props.layout]);
  const cellFeatureIndex = useMemo(() => buildCellFeatureIndex(props.layout), [props.layout]);
  const riverVisualData = useMemo(() => buildRiverVisualData(props.layout), [props.layout]);
  const viewportWorldRect = useMemo(
    () => getViewportWorldRect(viewportSize.width, viewportSize.height, pan, zoom),
    [viewportSize, pan, zoom]
  );
  const territoryEntities = useMemo(() => props.layout.governanceTerritories ?? [], [props.layout]);
  const regionEntities = useMemo(() => props.layout.governanceRegions ?? [], [props.layout]);
  const territoryColorById = useMemo(() => new Map(territoryEntities.map(entry => [entry.id, entry.color])), [territoryEntities]);
  const regionColorById = useMemo(() => new Map(regionEntities.map(entry => [entry.id, entry.color])), [regionEntities]);
  const territoryFillOpacity = props.organizationOverlayActive ? 0.12 : 0.2;
  const regionFillOpacity = props.organizationOverlayActive ? 0.2 : 0.28;
  const territoryLabelAnchors = useMemo(
    () =>
      territoryEntities
        .map(territory => {
          const cells = renderableCells
            .filter(cell => cell.governanceTerritoryId === territory.id)
            .map(cell => cell.cell);
          const labelCell = chooseVisibleLabelCell(props.layout, cells, territory.labelCell, viewportWorldRect);
          return labelCell ? { territory, cell: labelCell } : null;
        })
        .filter((entry): entry is { territory: (typeof territoryEntities)[number]; cell: MapCell } => Boolean(entry)),
    [props.layout, renderableCells, territoryEntities, viewportWorldRect]
  );
  const regionLabelAnchors = useMemo(
    () =>
      regionEntities
        .map(region => {
          const cells = renderableCells
            .filter(cell => cell.governanceRegionId === region.id)
            .map(cell => cell.cell);
          const labelCell = chooseVisibleLabelCell(props.layout, cells, region.labelCell, viewportWorldRect);
          return labelCell ? { region, cell: labelCell } : null;
        })
        .filter((entry): entry is { region: (typeof regionEntities)[number]; cell: MapCell } => Boolean(entry)),
    [props.layout, regionEntities, renderableCells, viewportWorldRect]
  );
  const selectedRoute = props.selectedRouteId
    ? props.layout.paths.find(path => path.id === props.selectedRouteId) ?? null
    : null;

  function clampZoom(value: number): number {
    return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, value));
  }

  function zoomAtClientPoint(clientX: number, clientY: number, nextZoom: number): void {
    const viewport = viewportRef.current;
    if (!viewport) {
      setZoom(nextZoom);
      return;
    }
    const rect = viewport.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const worldX = (localX - pan.x) / zoom;
    const worldY = (localY - pan.y) / zoom;
    setZoom(nextZoom);
    setPan({
      x: localX - worldX * nextZoom,
      y: localY - worldY * nextZoom
    });
  }

  function stopPanning(): void {
    panDragRef.current = null;
    setIsPanning(false);
  }

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateViewportSize = () => {
      setViewportSize({
        width: viewport.clientWidth,
        height: viewport.clientHeight
      });
    };
    updateViewportSize();
    const observer = new ResizeObserver(() => {
      updateViewportSize();
    });
    observer.observe(viewport);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    function handleWheel(event: WheelEvent): void {
      event.preventDefault();
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const nextZoom = clampZoom(Number((zoom * factor).toFixed(4)));
      if (Math.abs(nextZoom - zoom) < 1e-6) return;
      zoomAtClientPoint(event.clientX, event.clientY, nextZoom);
    }

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", handleWheel);
    };
  }, [zoom, pan]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.code === "Space") setSpacePressed(true);
    }

    function handleKeyUp(event: KeyboardEvent): void {
      if (event.code === "Space") setSpacePressed(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return (
    <div
      style={{
        position: "relative",
        minHeight: props.minHeight,
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "linear-gradient(180deg, rgba(72,96,122,0.32) 0%, rgba(116,138,159,0.28) 100%)",
        width: "100%"
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 14,
          top: 14,
          zIndex: 3,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 10,
          borderRadius: 12,
          background: "rgba(9,13,20,0.88)",
          border: "1px solid rgba(255,255,255,0.12)"
        }}
      >
        <button
          type="button"
          onClick={() => {
            const viewport = viewportRef.current;
            const rect = viewport?.getBoundingClientRect();
            const cx = rect ? rect.left + rect.width / 2 : 0;
            const cy = rect ? rect.top + rect.height / 2 : 0;
            zoomAtClientPoint(cx, cy, clampZoom(Number((zoom * ZOOM_STEP).toFixed(4))));
          }}
          style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: "pointer", fontSize: 20, fontWeight: 800 }}
        >
          +
        </button>
        <button
          type="button"
          onClick={() => {
            const viewport = viewportRef.current;
            const rect = viewport?.getBoundingClientRect();
            const cx = rect ? rect.left + rect.width / 2 : 0;
            const cy = rect ? rect.top + rect.height / 2 : 0;
            zoomAtClientPoint(cx, cy, clampZoom(Number((zoom / ZOOM_STEP).toFixed(4))));
          }}
          style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: "pointer", fontSize: 24, fontWeight: 800 }}
        >
          -
        </button>
        <button
          type="button"
          onClick={() => {
            setZoom(0.8);
            setPan({ x: 0, y: 0 });
          }}
          style={{ width: 34, height: 28, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: "pointer", fontSize: 10, fontWeight: 800 }}
        >
          1:1
        </button>
        <div style={{ textAlign: "center", fontSize: 11, color: "#c8d0de", fontWeight: 700 }}>
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {props.layerVisibility.background && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 50% 20%, rgba(214,226,239,0.28) 0%, rgba(179,197,214,0.16) 38%, rgba(104,128,149,0.10) 100%)"
          }}
        />
      )}

      <div
        ref={viewportRef}
        onMouseDown={event => {
          const shouldStartPan = event.button === 1 || (event.button === 0 && spacePressed);
          if (!shouldStartPan) return;
          event.preventDefault();
          panDragRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            originX: pan.x,
            originY: pan.y
          };
          movedDuringPanRef.current = false;
          setIsPanning(true);
        }}
        onMouseMove={event => {
          const drag = panDragRef.current;
          if (!drag) return;
          if (Math.abs(event.clientX - drag.startX) > 2 || Math.abs(event.clientY - drag.startY) > 2) {
            movedDuringPanRef.current = true;
          }
          setPan({
            x: drag.originX + (event.clientX - drag.startX),
            y: drag.originY + (event.clientY - drag.startY)
          });
        }}
        onMouseUp={stopPanning}
        onMouseLeave={stopPanning}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          overflow: "hidden",
          cursor: isPanning ? "grabbing" : spacePressed ? "grab" : "default"
        }}
      >
        <svg
          viewBox={`0 0 ${mapBounds.width} ${mapBounds.height}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            display: "block",
            width: mapBounds.width,
            height: mapBounds.height,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0"
          }}
        >
          {renderableCells.map(cell => {
            const isSelected = getWorldMapCellKey(cell.cell) === props.selectedCellKey;
            const isHighlighted = (props.highlightedCellKeys ?? []).includes(getWorldMapCellKey(cell.cell));
            const fill =
              !props.layerVisibility.landWater
                ? "rgba(255,255,255,0.02)"
                : resolveGeographyColor(cell.geography, cell.surface);
            return (
              <polygon
                key={getWorldMapCellKey(cell.cell)}
                points={getCellPolygon(props.layout, cell.cell)}
                fill={isSelected ? "rgba(244,201,103,0.28)" : isHighlighted ? "rgba(122, 195, 255, 0.22)" : fill}
                stroke={isSelected ? "rgba(244,201,103,0.95)" : isHighlighted ? "rgba(122,195,255,0.9)" : props.layerVisibility.grid ? "rgba(231,239,255,0.14)" : "transparent"}
                strokeWidth={isSelected || isHighlighted ? "2" : "1"}
                style={{ cursor: "pointer" }}
                onClick={event => {
                  if (movedDuringPanRef.current) {
                    movedDuringPanRef.current = false;
                    return;
                  }
                  props.onCellClick(cell.cell, { shiftKey: event.shiftKey });
                }}
              />
            );
          })}

          {props.layerVisibility.territories &&
            renderableCells.map(cell => {
              if (!cell.governanceTerritoryId) return null;
              const color = territoryColorById.get(cell.governanceTerritoryId);
              if (!color) return null;
              return (
                <polygon
                  key={`territory-fill-${getWorldMapCellKey(cell.cell)}`}
                  points={getCellPolygon(props.layout, cell.cell)}
                  fill={color}
                  opacity={territoryFillOpacity}
                  stroke="none"
                  pointerEvents="none"
                />
              );
            })}

          {props.layerVisibility.regions &&
            renderableCells.map(cell => {
              if (!cell.governanceRegionId) return null;
              const color = regionColorById.get(cell.governanceRegionId);
              if (!color) return null;
              return (
                <polygon
                  key={`region-fill-${getWorldMapCellKey(cell.cell)}`}
                  points={getCellPolygon(props.layout, cell.cell)}
                  fill={color}
                  opacity={regionFillOpacity}
                  stroke="none"
                  pointerEvents="none"
                />
              );
            })}

          {borderSegments
            .filter(segment => segment.type === "coast" && props.layerVisibility.landWater)
            .map((segment, index) => (
              <path
                key={`coast-${index}`}
                d={segment.path}
                fill="none"
                stroke="#dce9f7"
                strokeWidth={3}
                opacity={0.9}
                strokeLinecap="round"
                pointerEvents="none"
              />
            ))}

          {props.terrainOverlayActive &&
            geographyOverlay.segments.map((segment, index) => (
              <path
                key={`geography-${segment.geography}-${index}`}
                d={segment.path}
                fill="none"
                stroke={segment.color.replace(/0\.\d+\)/, "0.9)")}
                strokeWidth={1.8}
                opacity={0.9}
                strokeLinecap="round"
                pointerEvents="none"
              />
            ))}

          {props.terrainOverlayActive &&
            geographyOverlay.labels.map(label => (
              (() => {
                const cell = chooseVisibleLabelCell(props.layout, label.cells, label.preferredCell, viewportWorldRect);
                if (!cell) return null;
                const center = getCellCenter(props.layout, cell);
                return (
                  <text
                    key={label.key}
                    x={center.x}
                    y={center.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={label.color.replace(/0\.\d+\)/, "0.96)")}
                    style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.6, paintOrder: "stroke", stroke: "rgba(7,10,15,0.86)", strokeWidth: 4 }}
                    pointerEvents="none"
                  >
                    {label.geography}
                  </text>
                );
              })()
            ))}

          {props.layerVisibility.geographicZones &&
            geographicZonesOverlay.segments.map((segment, index) => (
              <path
                key={`geo-zone-${segment.zoneId}-${index}`}
                d={segment.path}
                fill="none"
                stroke={segment.color}
                strokeWidth={segment.width + (props.organizationOverlayActive ? 0.35 : 0.2)}
                opacity={props.organizationOverlayActive ? 0.9 : 0.8}
                strokeLinecap="round"
                strokeDasharray={segment.dashArray}
                pointerEvents="none"
              />
            ))}

          {props.layerVisibility.regions &&
            politicalBoundaryOverlay.regionSegments.map((segment, index) => (
              <path
                key={`region-border-${index}`}
                d={segment.path}
                fill="none"
                stroke={segment.color}
                strokeWidth={1.15}
                opacity={0.92}
                strokeLinecap="round"
                pointerEvents="none"
              />
            ))}

          {props.layerVisibility.territories &&
            politicalBoundaryOverlay.territorySegments.map((segment, index) => (
              <path
                key={`territory-border-${index}`}
                d={segment.path}
                fill="none"
                stroke={segment.color}
                strokeWidth={2.35}
                opacity={0.96}
                strokeLinecap="round"
                pointerEvents="none"
              />
            ))}

          {props.layerVisibility.geographicZones &&
            geographicZonesOverlay.labels.map(label => {
              const cell = chooseVisibleLabelCell(props.layout, label.cells, label.preferredCell, viewportWorldRect);
              if (!cell) return null;
              const center = getCellCenter(props.layout, cell);
              return (
                <text
                  key={`geo-zone-label-${label.key}`}
                  x={center.x}
                  y={center.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={label.color}
                  style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0.8, paintOrder: "stroke", stroke: "rgba(7,10,15,0.84)", strokeWidth: 4 }}
                  pointerEvents="none"
                >
                  {label.label}
                </text>
              );
            })}

          {props.layerVisibility.landWater &&
            cliffOverlay.shadowPolygons.map(polygon => (
              <path
                key={polygon.key}
                d={polygon.path}
                fill="rgba(7,10,15,0.22)"
                opacity={0.95}
              />
            ))}

          {props.layerVisibility.landWater &&
            cliffOverlay.ridgePaths.map(path => (
              <path
                key={path.key}
                d={path.path}
                fill="none"
                stroke="rgba(168,176,188,0.62)"
                strokeWidth={1.4}
                opacity={0.92}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

          {props.terrainOverlayActive && props.cliffEditPair && (() => {
            const pair = props.cliffEditPair;
            const firstCenter = getCellCenter(props.layout, pair.first);
            const secondCenter = getCellCenter(props.layout, pair.second);
            const currentSegment = cliffOverlay.ridgeSegments.find(segment => {
              const firstKey = getWorldMapCellKey(pair.first);
              const secondKey = getWorldMapCellKey(pair.second);
              const highKey = getWorldMapCellKey(segment.highCell);
              const lowKey = getWorldMapCellKey(segment.lowCell);
              return (
                (highKey === firstKey && lowKey === secondKey) ||
                (highKey === secondKey && lowKey === firstKey) ||
                (getWorldMapCellKey(segment.highCell) === firstKey && getWorldMapCellKey(segment.lowCell) === secondKey) ||
                (getWorldMapCellKey(segment.highCell) === secondKey && getWorldMapCellKey(segment.lowCell) === firstKey)
              );
            });
            const currentHighKey = currentSegment ? getWorldMapCellKey(currentSegment.highCell) : "";
            const buttons = [
              { cell: pair.first, center: firstCenter, label: "+", active: currentHighKey === getWorldMapCellKey(pair.first) },
              { cell: pair.second, center: secondCenter, label: "+", active: currentHighKey === getWorldMapCellKey(pair.second) }
            ];
            return (
              <g>
                {buttons.map(button => (
                  <g
                    key={`cliff-high-${getWorldMapCellKey(button.cell)}`}
                    transform={`translate(${button.center.x} ${button.center.y})`}
                    style={{ cursor: "pointer" }}
                    onClick={event => {
                      event.stopPropagation();
                      props.onSetCliffHighCell?.(button.cell);
                    }}
                  >
                    <circle r={16} fill={button.active ? "rgba(143,179,255,0.94)" : "rgba(9,13,20,0.82)"} stroke="rgba(255,255,255,0.72)" strokeWidth="1.5" />
                    <text x={0} y={5} textAnchor="middle" fill={button.active ? "#08111a" : "#eef3ff"} style={{ fontSize: 18, fontWeight: 900 }}>
                      +
                    </text>
                  </g>
                ))}
                <g
                  transform={`translate(${(firstCenter.x + secondCenter.x) / 2} ${(firstCenter.y + secondCenter.y) / 2})`}
                  style={{ cursor: props.onRemoveCliffPair ? "pointer" : "default" }}
                  onClick={event => {
                    event.stopPropagation();
                    props.onRemoveCliffPair?.();
                  }}
                >
                  <circle r={12} fill="rgba(130,28,28,0.74)" stroke="rgba(255,215,215,0.82)" strokeWidth="1.5" />
                  <text x={0} y={4} textAnchor="middle" fill="#fff1f1" style={{ fontSize: 14, fontWeight: 900 }}>
                    -
                  </text>
                </g>
              </g>
            );
          })()}

          {props.terrainOverlayActive &&
            reliefOverlay.markers.map(marker => (
              <g key={marker.key} transform={`translate(${marker.center.x} ${marker.center.y + 16})`}>
                <circle r={13} fill={marker.level === "high_mountain" ? "rgba(214,223,236,0.9)" : "rgba(173,191,212,0.88)"} stroke="rgba(7,10,15,0.9)" strokeWidth="2" />
                <text
                  x={0}
                  y={4}
                  textAnchor="middle"
                  fill="#08111a"
                  style={{ fontSize: 10, fontWeight: 900, letterSpacing: 0.4 }}
                >
                  {marker.label}
                </text>
              </g>
            ))}

          {props.layerVisibility.territories &&
            territoryLabelAnchors.map(({ territory, cell }) => {
              const center = getCellCenter(props.layout, cell);
              const wiki = props.wikiEntriesById[territory.wikiEntityId];
              return (
                <text
                  key={territory.wikiEntityId}
                  x={center.x}
                  y={center.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={territory.color}
                  style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1.6, paintOrder: "stroke", stroke: "rgba(7,10,15,0.86)", strokeWidth: 5 }}
                  pointerEvents="none"
                >
                  {wiki?.name ?? territory.wikiEntityId}
                </text>
              );
            })}

          {props.layerVisibility.regions &&
            regionLabelAnchors.map(({ region, cell }) => {
              const center = getCellCenter(props.layout, cell);
              const wiki = props.wikiEntriesById[region.wikiEntityId];
              return (
                <text
                  key={region.wikiEntityId}
                  x={center.x}
                  y={center.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={region.color}
                  style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.8, paintOrder: "stroke", stroke: "rgba(7,10,15,0.86)", strokeWidth: 4 }}
                  pointerEvents="none"
                >
                  {wiki?.name ?? region.wikiEntityId}
                </text>
              );
            })}

          {props.layerVisibility.rivers &&
            props.layout.paths.filter(path => path.kind === "river").map(path => {
              const flowValue = getRiverFlowValue(path);
              const sourceCell = path.cells[0] ?? null;
              const sourceCenter = sourceCell ? getCellCenter(props.layout, sourceCell) : null;
              const arrowTransform = buildRiverArrowTransform(props.layout, path.cells);
              const segments = riverVisualData.segmentsByRiverId[path.id] ?? [];
              return (
                <g key={path.id}>
                  {segments.length > 0
                    ? segments.map(segment => {
                        const segmentPoints = getCoastalSegmentEndpoints(props.layout, segment.from, segment.to);
                        return (
                          <line
                            key={segment.key}
                            x1={segmentPoints.start.x}
                            y1={segmentPoints.start.y}
                            x2={segmentPoints.end.x}
                            y2={segmentPoints.end.y}
                            stroke="#6ec9ff"
                            strokeWidth={segment.width}
                            strokeLinecap="round"
                            opacity={0.88}
                          />
                        );
                      })
                    : (
                      <polyline
                        points={buildPathPoints(props.layout, path.cells)}
                        fill="none"
                        stroke="#6ec9ff"
                        strokeWidth={getRiverStrokeWidth(flowValue)}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={0.88}
                      />
                    )}
                  {sourceCenter && (
                    <g transform={`translate(${sourceCenter.x} ${sourceCenter.y})`}>
                      <circle
                        r={Math.max(3, Math.min(9, 2.5 + (Number(path.sourceFlow) || 1) * 1.2))}
                        fill="rgba(110,201,255,0.88)"
                        stroke="rgba(214,244,255,0.92)"
                        strokeWidth="1.2"
                      />
                    </g>
                  )}
                  {arrowTransform && (
                    <path
                      d="M -8 -5 L 0 0 L -8 5"
                      transform={arrowTransform}
                      fill="none"
                      stroke="rgba(214,244,255,0.9)"
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </g>
              );
            })}

          {props.layerVisibility.rivers &&
            riverVisualData.confluenceMarkers.map(marker => {
              const center = getCellCenter(props.layout, marker.cell);
              return (
                <g key={marker.key} transform={`translate(${center.x} ${center.y})`}>
                  <circle r={6} fill="rgba(18,34,48,0.82)" stroke="rgba(214,244,255,0.84)" strokeWidth="1.5" />
                  <circle r={2.4} fill="rgba(214,244,255,0.96)" />
                </g>
              );
            })}

          {props.layerVisibility.rivers &&
            riverVisualData.errorMarkers.map(marker => {
              const center = getCellCenter(props.layout, marker.cell);
              return (
                <g key={marker.key} transform={`translate(${center.x} ${center.y - 18})`}>
                  <circle r={9} fill="rgba(128,24,24,0.9)" stroke="rgba(255,210,210,0.9)" strokeWidth="1.5" />
                  <text
                    x={0}
                    y={4}
                    textAnchor="middle"
                    fill="#fff4f4"
                    style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.2 }}
                  >
                    !
                  </text>
                </g>
              );
            })}

          {props.layerVisibility.rivers &&
            riverVisualData.labelAnchors.map(anchor => {
              const riverPath = props.layout.paths.find(path => path.id === anchor.key.replace("river-label-", ""));
              const labelTransform = riverPath ? getFeatureLabelTransform(props.layout, riverPath.cells) : null;
              if (!labelTransform) return null;
              return (
                <text
                  key={anchor.key}
                  x={labelTransform.x}
                  y={labelTransform.y - 10}
                  textAnchor="middle"
                  fill="rgba(110,201,255,0.96)"
                  transform={`rotate(${labelTransform.angle} ${labelTransform.x} ${labelTransform.y - 10})`}
                  style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.4, paintOrder: "stroke", stroke: "rgba(7,10,15,0.86)", strokeWidth: 4 }}
                >
                  {anchor.label}
                </text>
              );
            })}

          {props.layerVisibility.roads &&
            props.layout.paths.filter(path => path.kind === "road").map(path => (
              <g key={path.id}>
                {path.cells.slice(1).map((cell, index) => {
                  const previous = path.cells[index];
                  const segmentPoints = getCoastalSegmentEndpoints(props.layout, previous, cell);
                  return (
                    <line
                      key={`${path.id}-${index}`}
                      x1={segmentPoints.start.x}
                      y1={segmentPoints.start.y}
                      x2={segmentPoints.end.x}
                      y2={segmentPoints.end.y}
                      stroke="#cfa96b"
                      strokeWidth={getRoadStrokeWidth(path.roadType ?? "road")}
                      strokeLinecap="round"
                      opacity={0.92}
                    />
                  );
                })}
                {(() => {
                  const labelTransform = getFeatureLabelTransform(props.layout, path.cells);
                  if (!labelTransform || !path.label.trim()) return null;
                  return (
                    <text
                      x={labelTransform.x}
                      y={labelTransform.y - 10}
                      textAnchor="middle"
                      fill="rgba(207,169,107,0.96)"
                      transform={`rotate(${labelTransform.angle} ${labelTransform.x} ${labelTransform.y - 10})`}
                      style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.4, paintOrder: "stroke", stroke: "rgba(7,10,15,0.86)", strokeWidth: 4 }}
                    >
                      {path.label}
                    </text>
                  );
                })()}
              </g>
            ))}

          {props.layerVisibility.rivers &&
            props.layout.paths
              .filter(path => path.kind === "river")
              .flatMap(path => (riverVisualData.segmentsByRiverId[path.id] ?? []).map(segment => {
                  if (!segment.waterfall) return null;
                  const cliffSegment = getCliffSegmentBetweenCells(props.layout, segment.from, segment.to);
                  if (!cliffSegment) return null;
                  const waterfallShape = buildWaterfallPath(props.layout, cliffSegment.high, cliffSegment.low);
                  if (!waterfallShape) return null;
                  return (
                    <g key={`waterfall-${segment.key}`}>
                      <path
                        d={waterfallShape.path}
                        transform={waterfallShape.transform}
                        fill="rgba(110,201,255,0.88)"
                        stroke="none"
                      />
                    </g>
                  );
                })
              )}

          {props.routeEditorActive && selectedRoute && selectedRoute.kind === "road" &&
            selectedRoute.cells.map((cell, index) => {
              const center = getCellCenter(props.layout, cell);
              return (
                <g key={`${selectedRoute.id}-${index}`} transform={`translate(${center.x} ${center.y})`}>
                  <circle r={14} fill="rgba(255,255,255,0.12)" />
                  <circle r={8} fill="#ffb454" stroke="#0b0b12" strokeWidth="2" />
                  <text x={0} y={4} textAnchor="middle" fill="#0b0b12" style={{ fontSize: 10, fontWeight: 900 }}>
                    {index + 1}
                  </text>
                </g>
              );
            })}

          {props.layerVisibility.cities &&
            props.layout.cities.map(city => {
              const center = getCellCenter(props.layout, city.cell);
              const isSelected = city.id === props.selectedCityId;
              const wiki = props.wikiEntriesById[city.wikiEntityId];
              return (
                <g
                  key={city.id}
                  transform={`translate(${center.x} ${center.y})`}
                  style={{ cursor: "pointer" }}
                  onClick={event => {
                    if (movedDuringPanRef.current) {
                      movedDuringPanRef.current = false;
                      return;
                    }
                    props.onCityClick?.(city.id, { shiftKey: event.shiftKey });
                  }}
                >
                  <circle r={isSelected ? 22 : 18} fill="rgba(255,255,255,0.14)" />
                  <circle r={isSelected ? 10 : 8} fill={city.markerColor ?? "#f4c967"} stroke="#0b0b12" strokeWidth="2" />
                  {city.kind === "capital" && (
                    <path d="M -4 -14 L 0 -22 L 4 -14 Z" fill="#f4c967" stroke="#0b0b12" strokeWidth="1.5" />
                  )}
                  <text
                    x={0}
                    y={isSelected ? -28 : -24}
                    textAnchor="middle"
                    fill="#f7fbff"
                    style={{ fontSize: 12, fontWeight: 700, paintOrder: "stroke", stroke: "rgba(6,8,12,0.88)", strokeWidth: 4 }}
                  >
                    {wiki?.name ?? city.wikiEntityId}
                  </text>
                </g>
              );
            })}
        </svg>
      </div>

      {props.overlay}
    </div>
  );
}
