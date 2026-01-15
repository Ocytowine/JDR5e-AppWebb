export type DecorLayer = "ground" | "wall";

export interface DecorInstance {
  id: string;
  spriteKey: string;
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
  layer?: DecorLayer;
}
