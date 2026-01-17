export type FloorTextureKind = "color" | "pattern" | "image";

export interface FloorTexture {
  id: string;
  label: string;
  kind: FloorTextureKind;
  color?: string;
  patternId?: string;
  imagePath?: string;
  scale?: number;
}

export type FloorId = string;

export interface FloorMaterial {
  id: string;
  label: string;
  textureId?: string;
  fallbackColor?: string;
  tags?: string[];
  passable?: boolean;
  moveCost?: number;
  blocksVision?: boolean;
  blocksProjectiles?: boolean;
  liquid?: boolean;
  depth?: number;
  effects?: string[];
}
