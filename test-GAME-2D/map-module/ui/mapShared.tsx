import React, { useEffect, useMemo, useRef, useState } from "react";
import { createGridAdapter } from "../../src/ui/grid";
import {
  createRuntimeWorldMapLayout,
  type CliffSegment,
  getWorldMapCellKey,
  serializeWorldMapLayout,
  type MapCell,
  type MapCellData,
  type MapLayerId,
  type ReliefElevationLevel,
  type WorldMapLayout,
  type WorldMapLayoutSource
} from "../data/worldMapLayout";

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
  ocean: "rgba(52,107,166,0.44)",
  plaine: "rgba(154,127,81,0.24)",
  colline: "rgba(168,138,92,0.30)",
  foret_claire: "rgba(92,136,92,0.28)",
  foret_dense: "rgba(58,104,63,0.34)",
  marais: "rgba(77,113,92,0.34)",
  montagne: "rgba(118,118,128,0.30)",
  desert: "rgba(196,168,102,0.30)",
  cote: "rgba(112,148,120,0.30)",
  toundra: "rgba(158,176,186,0.28)",
  jungle: "rgba(44,112,68,0.34)",
  urbain: "rgba(126,109,133,0.30)"
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

export function computeBorderSegments(
  layout: WorldMapLayout
): Array<{ path: string; type: "coast" | "territory" | "region" }> {
  const segments: Array<{ path: string; type: "coast" | "territory" | "region" }> = [];
  const cellByKey = new Map(layout.cells.map(cell => [getWorldMapCellKey(cell.cell), cell]));
  const grid = createGrid(layout);
  const bounds = layout.grid;

  function normalizeAngle(angle: number): number {
    let value = angle;
    while (value <= -Math.PI) value += Math.PI * 2;
    while (value > Math.PI) value -= Math.PI * 2;
    return value;
  }

  layout.cells.forEach(cell => {
    const center = getCellCenter(layout, cell.cell);
    const polygon = getCellPolygon(layout, cell.cell).split(" ").map(point => {
      const [x, y] = point.split(",").map(Number);
      return { x, y };
    });
    const edgeMidpoints = polygon.map((point, index) => {
      const next = polygon[(index + 1) % polygon.length];
      return {
        index,
        angle: normalizeAngle(Math.atan2((point.y + next.y) / 2 - center.y, (point.x + next.x) / 2 - center.x))
      };
    });
    const edgeNeighborMap = new Map<number, MapCellData | null>();

    grid.neighbors(cell.cell, bounds).forEach(neighborCell => {
      const neighborCenter = getCellCenter(layout, neighborCell);
      const angle = normalizeAngle(Math.atan2(neighborCenter.y - center.y, neighborCenter.x - center.x));
      let bestIndex = edgeMidpoints[0]?.index ?? 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      edgeMidpoints.forEach(edge => {
        const distance = Math.abs(normalizeAngle(angle - edge.angle));
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = edge.index;
        }
      });
      edgeNeighborMap.set(bestIndex, cellByKey.get(getWorldMapCellKey(neighborCell)) ?? null);
    });

    edgeMidpoints.forEach(edge => {
      const neighbor = edgeNeighborMap.has(edge.index) ? edgeNeighborMap.get(edge.index) ?? null : null;
      let type: "coast" | "territory" | "region" | null = null;

      if (!neighbor) {
        type = cell.surface === "land" ? "coast" : null;
      } else if (neighbor.surface !== cell.surface) {
        if (cell.surface === "land") type = "coast";
      } else if (neighbor.territoryWikiId !== cell.territoryWikiId) {
        const cellId = cell.territoryWikiId ?? "";
        const neighborId = neighbor.territoryWikiId ?? "";
        if (cellId < neighborId) type = "territory";
      } else if (neighbor.regionWikiId !== cell.regionWikiId) {
        const cellId = cell.regionWikiId ?? "";
        const neighborId = neighbor.regionWikiId ?? "";
        if (cellId < neighborId) type = "region";
      }

      if (!type) return;
      const a = polygon[edge.index];
      const b = polygon[(edge.index + 1) % polygon.length];
      segments.push({ path: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, type });
    });
  });

  return segments;
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

function samePoint(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001;
}

function getCellPolygonPoints(layout: WorldMapLayout, cell: MapCell): Array<{ x: number; y: number }> {
  return getCellPolygon(layout, cell).split(" ").map(point => {
    const [x, y] = point.split(",").map(Number);
    return { x, y };
  });
}

export function getSharedHexEdge(layout: WorldMapLayout, a: MapCell, b: MapCell): { start: { x: number; y: number }; end: { x: number; y: number } } | null {
  const aPoints = getCellPolygonPoints(layout, a);
  const bPoints = getCellPolygonPoints(layout, b);
  for (let i = 0; i < aPoints.length; i += 1) {
    const start = aPoints[i];
    const end = aPoints[(i + 1) % aPoints.length];
    for (let j = 0; j < bPoints.length; j += 1) {
      const otherStart = bPoints[j];
      const otherEnd = bPoints[(j + 1) % bPoints.length];
      if ((samePoint(start, otherEnd) && samePoint(end, otherStart)) || (samePoint(start, otherStart) && samePoint(end, otherEnd))) {
        return { start, end };
      }
    }
  }
  return null;
}

export function computeCliffOverlay(layout: WorldMapLayout): Array<{
  key: string;
  line: string;
  shadow: string;
}> {
  return layout.cliffSegments
    .map((segment: CliffSegment) => {
      const edge = getSharedHexEdge(layout, segment.a, segment.b);
      if (!edge) return null;
      const lowCenter = getCellCenter(layout, segment.low);
      const midX = (edge.start.x + edge.end.x) / 2;
      const midY = (edge.start.y + edge.end.y) / 2;
      const towardLowX = lowCenter.x - midX;
      const towardLowY = lowCenter.y - midY;
      const length = Math.hypot(towardLowX, towardLowY) || 1;
      const inset = 10;
      const offsetX = (towardLowX / length) * inset;
      const offsetY = (towardLowY / length) * inset;
      return {
        key: `cliff-${getWorldMapCellKey(segment.a)}-${getWorldMapCellKey(segment.b)}`,
        line: `M ${edge.start.x} ${edge.start.y} L ${edge.end.x} ${edge.end.y}`,
        shadow: `${edge.start.x},${edge.start.y} ${edge.end.x},${edge.end.y} ${edge.end.x + offsetX},${edge.end.y + offsetY} ${edge.start.x + offsetX},${edge.start.y + offsetY}`
      };
    })
    .filter((entry): entry is { key: string; line: string; shadow: string } => Boolean(entry));
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
    layout.territories.forEach(item => ids.add(item.wikiEntityId));
    layout.regions.forEach(item => ids.add(item.wikiEntityId));
    layout.cities.forEach(item => ids.add(item.wikiEntityId));
    layout.cells.forEach(cell => {
      if (cell.territoryWikiId) ids.add(cell.territoryWikiId);
      if (cell.regionWikiId) ids.add(cell.regionWikiId);
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
  const geographyOverlay = useMemo(
    () => (props.terrainOverlayActive ? computeGeographyOverlay({ ...props.layout, cells: renderableCells }) : { segments: [], labels: [] }),
    [props.layout, props.terrainOverlayActive, renderableCells]
  );
  const reliefOverlay = useMemo(
    () => (props.terrainOverlayActive ? computeReliefOverlay({ ...props.layout, cells: renderableCells }) : { cliffPolygons: [], markers: [] }),
    [props.layout, props.terrainOverlayActive, renderableCells]
  );
  const cliffOverlay = useMemo(() => computeCliffOverlay(props.layout), [props.layout]);
  const viewportWorldRect = useMemo(
    () => getViewportWorldRect(viewportSize.width, viewportSize.height, pan, zoom),
    [viewportSize, pan, zoom]
  );
  const territoryLabelAnchors = useMemo(
    () =>
      props.layout.territories
        .map(territory => {
          const cells = renderableCells.filter(cell => cell.territoryWikiId === territory.wikiEntityId).map(cell => cell.cell);
          const labelCell = chooseVisibleLabelCell(props.layout, cells, territory.labelCell, viewportWorldRect);
          return labelCell ? { territory, cell: labelCell } : null;
        })
        .filter((entry): entry is { territory: WorldMapLayout["territories"][number]; cell: MapCell } => Boolean(entry)),
    [props.layout, renderableCells, viewportWorldRect]
  );
  const regionLabelAnchors = useMemo(
    () =>
      props.layout.regions
        .map(region => {
          const cells = renderableCells.filter(cell => cell.regionWikiId === region.wikiEntityId).map(cell => cell.cell);
          const labelCell = chooseVisibleLabelCell(props.layout, cells, region.labelCell, viewportWorldRect);
          return labelCell ? { region, cell: labelCell } : null;
        })
        .filter((entry): entry is { region: WorldMapLayout["regions"][number]; cell: MapCell } => Boolean(entry)),
    [props.layout, renderableCells, viewportWorldRect]
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
        background: "linear-gradient(180deg, rgba(6,11,18,0.96) 0%, rgba(11,17,26,0.9) 100%)",
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
            backgroundImage: `linear-gradient(rgba(4,8,12,0.26), rgba(4,8,12,0.54)), url(${props.layout.backgroundImageUrl})`,
            backgroundPosition: "center",
            backgroundSize: "cover",
            filter: "saturate(0.82) contrast(1.08)"
          }}
        />
      )}

      <div
        ref={viewportRef}
        onWheel={event => {
          event.preventDefault();
          const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
          const nextZoom = clampZoom(Number((zoom * factor).toFixed(4)));
          if (Math.abs(nextZoom - zoom) < 1e-6) return;
          zoomAtClientPoint(event.clientX, event.clientY, nextZoom);
        }}
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

          {borderSegments.map((segment, index) => {
            const visible =
              (segment.type === "coast" && props.layerVisibility.landWater) ||
              (segment.type === "territory" && props.layerVisibility.territories) ||
              (segment.type === "region" && props.layerVisibility.regions);
            if (!visible) return null;
            return (
              <path
                key={`${segment.type}-${index}`}
                d={segment.path}
                fill="none"
                stroke={segment.type === "coast" ? "#dce9f7" : segment.type === "territory" ? "#f1cf7a" : "#ffffff"}
                strokeWidth={segment.type === "coast" ? 3 : segment.type === "territory" ? 2.2 : 1.4}
                opacity={segment.type === "coast" ? 0.9 : 0.58}
                strokeLinecap="round"
              />
            );
          })}

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
                  >
                    {label.geography}
                  </text>
                );
              })()
            ))}

          {props.layerVisibility.landWater &&
            cliffOverlay.map(segment => (
              <g key={segment.key}>
                <polygon points={segment.shadow} fill="rgba(7,10,15,0.28)" opacity={0.95} />
                <path d={segment.line} fill="none" stroke="rgba(168,176,188,0.62)" strokeWidth={1.4} opacity={0.92} strokeLinecap="round" />
              </g>
            ))}

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
                >
                  {wiki?.name ?? region.wikiEntityId}
                </text>
              );
            })}

          {props.layerVisibility.rivers &&
            props.layout.paths.filter(path => path.kind === "river").map(path => (
              <polyline
                key={path.id}
                points={buildPathPoints(props.layout, path.cells)}
                fill="none"
                stroke="#6ec9ff"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.88}
              />
            ))}

          {props.layerVisibility.roads &&
            props.layout.paths.filter(path => path.kind === "road").map(path => (
              <polyline
                key={path.id}
                points={buildPathPoints(props.layout, path.cells)}
                fill="none"
                stroke="#cfa96b"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.92}
              />
            ))}

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
