export type WallDirection = "N" | "E" | "S" | "W";
export type WallKind = "wall" | "low" | "door";
export type WallState = "open" | "closed";

export interface WallSegment {
  id: string;
  typeId?: string;
  x: number;
  y: number;
  dir: WallDirection;
  kind: WallKind;
  state?: WallState;
  hp?: number;
  maxHp?: number;
}

export interface WallDoorSpec {
  x: number;
  y: number;
  dir: WallDirection;
  state?: WallState;
}

export interface WallAsciiSpec {
  ascii: string[];
  doors?: WallDoorSpec[];
}
