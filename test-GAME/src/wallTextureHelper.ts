import { Assets } from "pixi.js";

const pngModules = import.meta.glob("../wall/*.png", {
  query: "?url",
  import: "default",
  eager: true
});

const WALL_PNG_BY_KEY: Record<string, string> = {};

function normalizeKey(baseName: string): string {
  return baseName.trim().toLowerCase().replace(/\s+/g, "-");
}

for (const [path, url] of Object.entries(pngModules)) {
  const file = path.split("/").pop() ?? "";
  const baseName = file.replace(/\.png$/i, "");
  if (!baseName) continue;
  WALL_PNG_BY_KEY[`wall:${normalizeKey(baseName)}`] = url as string;
}

export function getWallPngUrl(spriteKey: string | null | undefined): string | null {
  if (!spriteKey) return null;
  const url = WALL_PNG_BY_KEY[spriteKey];
  return url ?? null;
}

let wallTexturesPreloadPromise: Promise<void> | null = null;

export async function preloadWallTextures(): Promise<void> {
  if (wallTexturesPreloadPromise) return wallTexturesPreloadPromise;

  const assets = Object.entries(WALL_PNG_BY_KEY).map(([alias, url]) => ({
    alias,
    src: url
  }));

  wallTexturesPreloadPromise = (async () => {
    for (const asset of assets) {
      Assets.add(asset);
    }

    for (const asset of assets) {
      try {
        await Assets.load(asset.alias);
      } catch (error) {
        console.warn(`[wall-texture] Failed to load ${asset.alias}:`, error);
      }
    }
  })();

  return wallTexturesPreloadPromise;
}
