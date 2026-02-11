export interface EffectAppearance {
  spriteKey: string;
  animationSpeed?: number;
  animationLoop?: boolean;
  scale?: number;
  targetSize?: number;
  scaleRange?: { min: number; max: number };
  tint?: number;
  tintRange?: { dark: number; light: number };
  alpha?: number;
  alphaRange?: { min: number; max: number };
}

export interface EffectPlacement {
  allowedFloors?: string[];
  blockedFloors?: string[];
  allowedFloorTags?: string[];
  blockedFloorTags?: string[];
  avoidLiquid?: boolean;
}

export interface EffectHazard {
  damageFormula: string;
  statusRoll?: { die: number; trigger: number; statusId?: string };
  onTraverse?: boolean;
  tick?: "start" | "end" | "round";
}

export interface EffectLight {
  radius: number;
  color?: number;
}

export interface EffectTypeDefinition {
  id: string;
  label: string;
  tags?: string[];
  appearance: EffectAppearance;
  placement?: EffectPlacement;
  hazard?: EffectHazard;
  aura?: {
    radius: number;
    shape?: "SPHERE" | "CONE" | "LINE" | "CUBE" | "CYLINDER";
    includeSelf?: boolean;
  };
  light?: EffectLight;
  [key: string]: unknown;
}

export interface EffectInstance {
  id: string;
  typeId: string;
  x: number;
  y: number;
  active?: boolean;
  sourceObstacleId?: string;
  rotationDeg?: number;
  kind?: "zone" | "surface" | "aura";
  sourceId?: string;
  anchorTokenId?: string;
  concentrationSourceId?: string;
}
