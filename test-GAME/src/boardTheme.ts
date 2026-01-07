import type { MapTheme } from "./game/map/types";

const THEME_COLORS: Record<MapTheme, number> = {
  forest: 0x2f6b2f,
  dungeon: 0x2a2a3a,
  city: 0x4f4233,
  generic: 0x1c1b29
};

export function boardThemeColor(theme: MapTheme | null | undefined): number {
  return THEME_COLORS[theme ?? "generic"] ?? THEME_COLORS.generic;
}

export function colorToCssHex(color: number): string {
  return `#${Math.max(0, Math.min(0xffffff, color)).toString(16).padStart(6, "0")}`;
}
