import type { MovementProfile, Personnage } from "../types";

export type MovementDirections = 4 | 8;

export interface MovementModeDefinition {
  id: string;
  label: string;
  speed: number;
  directions: MovementDirections;
  profile?: Partial<MovementProfile>;
}

export const DEFAULT_MOVEMENT_MODE_ID = "walk";

const MOVEMENT_MODE_CATALOG: Record<string, MovementModeDefinition> = {
  walk: {
    id: "walk",
    label: "Marcher",
    speed: 6,
    directions: 8,
    profile: {
      type: "ground",
      canPassThroughWalls: false,
      canPassThroughEntities: false,
      canStopOnOccupiedTile: false
    }
  },
  swim: {
    id: "swim",
    label: "Nager",
    speed: 3,
    directions: 8,
    profile: {
      type: "swim",
      canPassThroughWalls: false,
      canPassThroughEntities: false,
      canStopOnOccupiedTile: false
    }
  }
};

function getCatalogMode(id: string): MovementModeDefinition | null {
  return MOVEMENT_MODE_CATALOG[id] ?? null;
}

function buildLabelFromId(id: string): string {
  if (!id) return "Deplacement";
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export function getDefaultMovementMode(): MovementModeDefinition {
  return MOVEMENT_MODE_CATALOG[DEFAULT_MOVEMENT_MODE_ID];
}

export function buildMovementProfileFromMode(
  mode: MovementModeDefinition | null | undefined
): MovementProfile {
  const fallback = getDefaultMovementMode();
  const source = mode ?? fallback;
  const profile: MovementProfile = {
    type: source.profile?.type ?? "ground",
    speed: source.speed,
    directions: source.directions,
    canPassThroughWalls: source.profile?.canPassThroughWalls ?? false,
    canPassThroughEntities: source.profile?.canPassThroughEntities ?? false,
    canStopOnOccupiedTile: source.profile?.canStopOnOccupiedTile ?? false
  };
  return profile;
}

export function getMovementModesForCharacter(
  character: Personnage
): MovementModeDefinition[] {
  const raw = (character as any).movementModes;
  if (Array.isArray(raw) && raw.length > 0) {
    const modes: MovementModeDefinition[] = [];
    for (const entry of raw) {
      if (typeof entry === "string") {
        const def = MOVEMENT_MODE_CATALOG[entry];
        if (def) {
          modes.push(def);
        }
        continue;
      }
      if (entry && typeof entry === "object") {
        const id = String(entry.id || entry.label || "custom");
        const label = String(entry.label || entry.id || "Deplacement");
        const speed = Number.isFinite(entry.speed) ? Math.max(1, Number(entry.speed)) : 6;
        const directions: MovementDirections =
          entry.directions === 4 ? 4 : 8;
        modes.push({
          id,
          label,
          speed,
          directions,
          profile: entry.profile
        });
      }
    }
    if (modes.length > 0) return modes;
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const modes: MovementModeDefinition[] = [];
    for (const [key, value] of Object.entries(raw)) {
      const speed = Number.isFinite(value) ? Math.max(1, Number(value)) : null;
      if (speed === null) continue;
      const catalogMode = getCatalogMode(key);
      modes.push({
        id: key,
        label: catalogMode?.label ?? buildLabelFromId(key),
        speed,
        directions: catalogMode?.directions ?? 8,
        profile: catalogMode?.profile
      });
    }
    if (modes.length > 0) return modes;
  }

  return [getDefaultMovementMode()];
}
