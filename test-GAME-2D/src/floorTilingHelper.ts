import { Assets, Texture } from "pixi.js";

const tilingModules = import.meta.glob("./game/map/floors/tiling/*.png", {
  query: "?url",
  import: "default",
  eager: true
});

const FLOOR_TILING_BY_ID: Record<string, string> = {};
const FLOOR_TILING_VARIANTS_BY_ID: Record<string, string[]> = {};
const loadedAliases = new Set<string>();
const pendingAliases = new Set<string>();
const resizedTextureByKey = new Map<string, Texture>();
const resizedPendingByKey = new Set<string>();

const tilingEntries = Object.entries(tilingModules).map(([path, url]) => {
  const file = path.split("/").pop() ?? "";
  const baseName = file.replace(/\.png$/i, "");
  return { baseName, url: url as string };
});
const tilingBaseNames = new Set(tilingEntries.map(entry => entry.baseName));

for (const { baseName, url } of tilingEntries) {
  if (!baseName) continue;
  if (baseName.endsWith("-bump")) continue;
  if (/^bump-/i.test(baseName)) continue;

  const variantMatch = baseName.match(/^(.*?)(?:[-_]?)(\d+)$/);
  const hasVariantSuffix = Boolean(variantMatch && variantMatch[1]);
  const baseId = hasVariantSuffix ? variantMatch?.[1] ?? "" : baseName;
  const isVariantOfExisting = hasVariantSuffix && tilingBaseNames.has(baseId);

  if (!isVariantOfExisting) {
    FLOOR_TILING_BY_ID[baseName] = url;
    const list = FLOOR_TILING_VARIANTS_BY_ID[baseName] ?? [];
    list.push(url);
    FLOOR_TILING_VARIANTS_BY_ID[baseName] = list;
  } else if (baseId) {
    const list = FLOOR_TILING_VARIANTS_BY_ID[baseId] ?? [];
    list.push(url);
    FLOOR_TILING_VARIANTS_BY_ID[baseId] = list;
  }
}

for (const [id, list] of Object.entries(FLOOR_TILING_VARIANTS_BY_ID)) {
  const unique = Array.from(new Set(list));
  unique.sort();
  FLOOR_TILING_VARIANTS_BY_ID[id] = unique;
}

export function getFloorTilingUrl(id: string | null | undefined): string | null {
  if (!id) return null;
  return FLOOR_TILING_BY_ID[id] ?? null;
}

export function getFloorTilingVariantUrls(id: string | null | undefined): string[] {
  if (!id) return [];
  return FLOOR_TILING_VARIANTS_BY_ID[id] ?? [];
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = "async";
  img.crossOrigin = "anonymous";
  const done = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
  });
  img.src = url;
  await done;
  return img;
}

async function buildResizedTexture(url: string, size: number): Promise<Texture> {
  const image = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Cannot get 2D context for floor tiling resize.");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, 0, 0, size, size);
  const texture = Texture.from(canvas);
  if (texture.source) {
    texture.source.scaleMode = "linear";
    texture.source.mipmapFilter = "linear";
    texture.source.autoGenerateMipmaps = true;
    texture.source.addressMode = "repeat";
  }
  console.log("[floor-tiling] resized", url, "->", size, "x", size);
  return texture;
}

export function getFloorTilingTexture(id: string | null | undefined, size: number): Texture | null {
  if (!id) return null;
  const url = getFloorTilingUrl(id);
  if (!url) return null;
  const key = `${url}:${size}`;
  return resizedTextureByKey.get(key) ?? null;
}

export function getFloorTilingTextureFromUrl(url: string | null | undefined, size: number): Texture | null {
  if (!url) return null;
  const key = `${url}:${size}`;
  return resizedTextureByKey.get(key) ?? null;
}

export async function preloadFloorTilingTexturesFor(ids: string[], size: number): Promise<void> {
  if (!Array.isArray(ids) || ids.length === 0) return;

  const assets = new Map<
    string,
    { alias: string; src: string; data: { autoGenerateMipmaps: boolean; scaleMode: string; mipmapFilter: string; maxAnisotropy: number } }
  >();

  for (const id of ids) {
    const urls = [...getFloorTilingVariantUrls(id)].filter(Boolean) as string[];
    for (const url of urls) {
      if (loadedAliases.has(url) || pendingAliases.has(url)) continue;
      assets.set(url, {
        alias: url,
        src: url,
        data: {
          autoGenerateMipmaps: true,
          scaleMode: "linear",
          mipmapFilter: "linear",
          maxAnisotropy: 4
        }
      });
      pendingAliases.add(url);
    }
  }

  if (assets.size === 0 && ids.length > 0) {
    // Still ensure resized textures exist for already-loaded urls.
    for (const id of ids) {
      const urls = [...getFloorTilingVariantUrls(id)].filter(Boolean) as string[];
      for (const url of urls) {
        const key = `${url}:${size}`;
        if (resizedTextureByKey.has(key) || resizedPendingByKey.has(key)) continue;
        resizedPendingByKey.add(key);
        buildResizedTexture(url, size)
          .then(texture => {
            resizedTextureByKey.set(key, texture);
          })
          .finally(() => {
            resizedPendingByKey.delete(key);
          });
      }
    }
    return;
  }

  try {
    for (const asset of assets.values()) {
      Assets.add(asset);
    }
    const aliases = [...assets.keys()];
    await Assets.load(aliases);
    for (const alias of aliases) {
      loadedAliases.add(alias);
      pendingAliases.delete(alias);
    }
    for (const id of ids) {
      const urls = [...getFloorTilingVariantUrls(id)].filter(Boolean) as string[];
      for (const url of urls) {
        const key = `${url}:${size}`;
        if (resizedTextureByKey.has(key) || resizedPendingByKey.has(key)) continue;
        resizedPendingByKey.add(key);
        buildResizedTexture(url, size)
          .then(texture => {
            resizedTextureByKey.set(key, texture);
          })
          .finally(() => {
            resizedPendingByKey.delete(key);
          });
      }
    }
  } catch (error) {
    for (const alias of assets.keys()) {
      pendingAliases.delete(alias);
    }
    throw error;
  }
}
