import valmorinMapUrl from "../../src/data/world/Valmorin.png";
import worldMapLayoutJson from "./worldMapLayout.json";

export type MapCell = { x: number; y: number };

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
  cells: MapCellData[];
};

export type WorldMapLayout = Omit<WorldMapLayoutSource, "backgroundImageKey"> & {
  backgroundImageUrl: string;
};

const BACKGROUND_IMAGES: Record<string, string> = {
  valmorin: valmorinMapUrl
};

const source = worldMapLayoutJson as WorldMapLayoutSource;

export const WORLD_MAP_LAYOUT: WorldMapLayout = {
  ...source,
  backgroundImageUrl: BACKGROUND_IMAGES[source.backgroundImageKey] ?? valmorinMapUrl
};

export function getWorldMapCellKey(cell: MapCell): string {
  return `${cell.x},${cell.y}`;
}
