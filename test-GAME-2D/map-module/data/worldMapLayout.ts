import valmorinMapUrl from "../../src/data/world/Valmorin.png";
import worldMapLayoutJson from "./worldMapLayout.json";

export type MapCell = { x: number; y: number };
export type ReliefElevationLevel = "none" | "low_mountain" | "high_mountain";
export type CliffSegment = {
  a: MapCell;
  b: MapCell;
  high: MapCell;
  low: MapCell;
};

export type MapLayerId =
  | "background"
  | "grid"
  | "landWater"
  | "territories"
  | "regions"
  | "cities"
  | "roads"
  | "rivers";

export type WorldMapTerritory = {
  wikiEntityId: string;
  labelCell: MapCell;
  color: string;
};

export type WorldMapRegion = {
  wikiEntityId: string;
  territoryWikiId: string;
  labelCell: MapCell;
  color: string;
};

export type WorldMapCity = {
  id: string;
  wikiEntityId: string;
  regionWikiId: string;
  territoryWikiId: string;
  kind: "capital" | "secondary";
  cell: MapCell;
  markerColor?: string;
};

export type MapPath = {
  id: string;
  label: string;
  kind: "road" | "river";
  cells: MapCell[];
};

export type MapCellData = {
  cell: MapCell;
  surface: "land" | "ocean";
  geography: string;
  terrainDifficulty: number;
  riskLevel: number;
  reliefElevation: ReliefElevationLevel;
  territoryWikiId?: string;
  regionWikiId?: string;
  cityWikiId?: string;
  locationWikiIds?: string[];
  tags?: string[];
};

export type WorldMapLayoutSource = {
  id: string;
  title: string;
  backgroundImageKey: string;
  grid: {
    cols: number;
    rows: number;
    tileSize: number;
    orientation: "pointy-top";
    offset: "odd-r";
  };
  defaultLayers: Record<MapLayerId, boolean>;
  territories: WorldMapTerritory[];
  regions: WorldMapRegion[];
  cities: WorldMapCity[];
  paths: MapPath[];
  cliffSegments: CliffSegment[];
  cells: MapCellData[];
};

export type WorldMapLayout = Omit<WorldMapLayoutSource, "backgroundImageKey"> & {
  backgroundImageUrl: string;
};

const BACKGROUND_IMAGES: Record<string, string> = {
  valmorin: valmorinMapUrl
};

const DEFAULT_GEOGRAPHY_DIFFICULTY: Record<string, number> = {
  terre: 5,
  plaine: 5,
  colline: 6,
  foret_claire: 6,
  foret_dense: 7,
  marais: 7,
  montagne: 8,
  desert: 6,
  cote: 5,
  toundra: 6,
  jungle: 7,
  urbain: 4,
  ocean: 9
};

const source = worldMapLayoutJson as WorldMapLayoutSource;

export function createRuntimeWorldMapLayout(sourceLayout: WorldMapLayoutSource): WorldMapLayout {
  return {
    ...sourceLayout,
    cliffSegments: Array.isArray(sourceLayout.cliffSegments) ? sourceLayout.cliffSegments : [],
    cells: sourceLayout.cells.map(cell => ({
      ...cell,
      terrainDifficulty: DEFAULT_GEOGRAPHY_DIFFICULTY[cell.geography] ?? cell.terrainDifficulty ?? 5,
      riskLevel: 1,
      reliefElevation: cell.reliefElevation ?? "none"
    })),
    backgroundImageUrl: BACKGROUND_IMAGES[sourceLayout.backgroundImageKey] ?? valmorinMapUrl
  };
}

export function serializeWorldMapLayout(layout: WorldMapLayout): WorldMapLayoutSource {
  const backgroundImageKey =
    Object.entries(BACKGROUND_IMAGES).find(([, url]) => url === layout.backgroundImageUrl)?.[0] ?? "valmorin";
  return {
    id: layout.id,
    title: layout.title,
    backgroundImageKey,
    grid: layout.grid,
    defaultLayers: layout.defaultLayers,
    territories: layout.territories,
    regions: layout.regions,
    cities: layout.cities,
    paths: layout.paths,
    cliffSegments: layout.cliffSegments,
    cells: layout.cells
  };
}

export const WORLD_MAP_LAYOUT: WorldMapLayout = createRuntimeWorldMapLayout(source);

export function getWorldMapCellKey(cell: MapCell): string {
  return `${cell.x},${cell.y}`;
}
