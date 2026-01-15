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

export interface FloorMaterial {
  id: string;
  label: string;
  terrain: string;
  textureId?: string;
  fallbackColor?: string;
}
