import type { ManualMapOptions } from "./types";

export interface ManualMapPreset {
  id: string;
  label: string;
  grid: { cols: number; rows: number };
  options: ManualMapOptions;
}

const baseBorderMask = {
  north: true,
  south: true,
  west: true,
  east: true
};

export const MANUAL_MAP_PRESETS: ManualMapPreset[] = [
  {
    id: "arena_small",
    label: "Arene small",
    grid: { cols: 10, rows: 8 },
    options: {
      walls: true,
      density: "medium",
      corridors: false,
      entrances: 2,
      lighting: "normal",
      theme: "generic",
      borderMask: { ...baseBorderMask }
    }
  },
  {
    id: "arena_medium",
    label: "Arene medium",
    grid: { cols: 12, rows: 10 },
    options: {
      walls: true,
      density: "medium",
      corridors: false,
      entrances: 2,
      lighting: "normal",
      theme: "generic",
      borderMask: { ...baseBorderMask }
    }
  },
  {
    id: "arena_large",
    label: "Arene large",
    grid: { cols: 16, rows: 12 },
    options: {
      walls: true,
      density: "low",
      corridors: false,
      entrances: 2,
      lighting: "normal",
      theme: "generic",
      borderMask: { ...baseBorderMask }
    }
  }
];

export function getManualPresetById(presetId: string): ManualMapPreset {
  return (
    MANUAL_MAP_PRESETS.find(p => p.id === presetId) ?? MANUAL_MAP_PRESETS[0]
  );
}
