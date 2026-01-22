import { Assets } from "pixi.js";

const pngModules = import.meta.glob("../obstacle-types/Sprite/*.png", {
  query: "?url",
  import: "default",
  eager: true
});

const effectAnimationModules = import.meta.glob("../action-game/model/effect/animate/*.png", {
  query: "?url",
  import: "default",
  eager: true
});

const OBSTACLE_PNG_BY_KEY: Record<string, string> = {};
const EFFECT_ANIMATION_FRAMES_BY_KEY: Record<string, string[]> = {};
const loadedObstacleAliases = new Set<string>();
const pendingObstacleAliases = new Set<string>();

for (const [path, url] of Object.entries(pngModules)) {
  const file = path.split("/").pop() ?? "";
  const baseName = file.replace(/\.png$/i, "");
  if (!baseName) continue;
  OBSTACLE_PNG_BY_KEY[`obstacle:${baseName}`] = url as string;
}

const effectFramesByKey: Record<string, Array<{ index: number; url: string }>> = {};

for (const [path, url] of Object.entries(effectAnimationModules)) {
  const file = path.split("/").pop() ?? "";
  const baseName = file.replace(/\.png$/i, "");
  if (!baseName) continue;
  const match = baseName.match(/^(.*?)-(\d+)$/);
  if (!match) continue;
  const prefix = match[1];
  const index = Number.parseInt(match[2], 10);
  if (!Number.isFinite(index)) continue;
  const key = `effect:${prefix}`;
  if (!effectFramesByKey[key]) effectFramesByKey[key] = [];
  effectFramesByKey[key].push({ index, url: url as string });
}

for (const [key, entries] of Object.entries(effectFramesByKey)) {
  const sorted = [...entries].sort((a, b) => a.index - b.index);
  EFFECT_ANIMATION_FRAMES_BY_KEY[key] = sorted.map(entry => entry.url);
}

export function getObstaclePngUrl(spriteKey: string | null | undefined): string | null {
  if (!spriteKey) return null;
  const url = OBSTACLE_PNG_BY_KEY[spriteKey];
  return url ?? null;
}

export function getObstacleAnimationFrames(spriteKey: string | null | undefined): string[] | null {
  if (!spriteKey) return null;
  const frames = EFFECT_ANIMATION_FRAMES_BY_KEY[spriteKey];
  return frames ?? null;
}

let obstaclePngPreloadPromise: Promise<void> | null = null;

export async function preloadObstaclePngTextures(): Promise<void> {
  if (obstaclePngPreloadPromise) return obstaclePngPreloadPromise;

  const assets = Object.values(OBSTACLE_PNG_BY_KEY).map(url => ({
    alias: url,
    src: url,
    data: {
      autoGenerateMipmaps: true,
      scaleMode: "linear",
      mipmapFilter: "linear",
      maxAnisotropy: 4
    }
  }));

  const effectAssets = Object.values(EFFECT_ANIMATION_FRAMES_BY_KEY).flatMap(frames =>
    frames.map(src => ({
      alias: src,
      src,
      data: {
        autoGenerateMipmaps: true,
        scaleMode: "linear",
        mipmapFilter: "linear",
        maxAnisotropy: 4
      }
    }))
  );

  obstaclePngPreloadPromise = (async () => {
    for (const asset of [...assets, ...effectAssets]) {
      Assets.add(asset);
    }
    await Assets.load([...assets, ...effectAssets].map(asset => asset.alias));
  })();

  return obstaclePngPreloadPromise;
}

function collectObstacleAssets(spriteKey: string): Array<{
  alias: string;
  src: string;
  data: { autoGenerateMipmaps: boolean; scaleMode: string; mipmapFilter: string; maxAnisotropy: number };
}> {
  const assets: Array<{
    alias: string;
    src: string;
    data: { autoGenerateMipmaps: boolean; scaleMode: string; mipmapFilter: string; maxAnisotropy: number };
  }> = [];
  if (!spriteKey) return assets;

  if (spriteKey.startsWith("obstacle:")) {
    const url = OBSTACLE_PNG_BY_KEY[spriteKey];
    if (url) {
      assets.push({
        alias: url,
        src: url,
        data: {
          autoGenerateMipmaps: true,
          scaleMode: "linear",
          mipmapFilter: "linear",
          maxAnisotropy: 4
        }
      });
    }
  } else if (spriteKey.startsWith("effect:")) {
    const frames = EFFECT_ANIMATION_FRAMES_BY_KEY[spriteKey];
    if (frames && frames.length > 0) {
      frames.forEach(src => {
        assets.push({
          alias: src,
          src,
          data: {
            autoGenerateMipmaps: true,
            scaleMode: "linear",
            mipmapFilter: "linear",
            maxAnisotropy: 4
          }
        });
      });
    }
  }

  return assets;
}

export async function preloadObstaclePngTexturesFor(
  spriteKeys: string[]
): Promise<void> {
  if (!Array.isArray(spriteKeys) || spriteKeys.length === 0) return;

  const assets = new Map<
    string,
    { alias: string; src: string; data: { autoGenerateMipmaps: boolean; scaleMode: string; mipmapFilter: string; maxAnisotropy: number } }
  >();

  for (const spriteKey of spriteKeys) {
    if (!spriteKey) continue;
    const entries = collectObstacleAssets(spriteKey);
    for (const entry of entries) {
      if (loadedObstacleAliases.has(entry.alias) || pendingObstacleAliases.has(entry.alias)) continue;
      assets.set(entry.alias, entry);
      pendingObstacleAliases.add(entry.alias);
    }
  }

  if (assets.size === 0) return;

  try {
    for (const asset of assets.values()) {
      Assets.add(asset);
    }
    const aliases = [...assets.keys()];
    await Assets.load(aliases);
    for (const alias of aliases) {
      loadedObstacleAliases.add(alias);
      pendingObstacleAliases.delete(alias);
    }
  } catch (error) {
    for (const alias of assets.keys()) {
      pendingObstacleAliases.delete(alias);
    }
    throw error;
  }
}
