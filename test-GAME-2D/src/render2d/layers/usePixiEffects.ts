import { useEffect } from "react";
import { AnimatedSprite, Container, Sprite, Texture } from "pixi.js";
import type { RefObject } from "react";
import type { EffectInstance, EffectTypeDefinition } from "../../game/effectTypes";
import { gridToScreenForGrid } from "../../boardConfig";
import { getObstacleAnimationFrames, getObstaclePngUrl } from "../../obstacleTextureHelper";
import { DEPTH_Z } from "./depthOrdering";

export function usePixiEffects(options: {
  depthLayerRef: RefObject<Container | null>;
  effects: EffectInstance[];
  effectTypes: EffectTypeDefinition[];
  pixiReadyTick?: number;
  grid: { cols: number; rows: number };
  visibleCells?: Set<string> | null;
  showAllLevels?: boolean;
  suspendRendering?: boolean;
}): void {
  const hashString01 = (input: string): number => {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 0xffffffff;
  };

  const lerpColor = (a: number, b: number, t: number): number => {
    const ar = (a >> 16) & 0xff;
    const ag = (a >> 8) & 0xff;
    const ab = a & 0xff;
    const br = (b >> 16) & 0xff;
    const bg = (b >> 8) & 0xff;
    const bb = b & 0xff;
    const rr = Math.round(ar + (br - ar) * t);
    const rg = Math.round(ag + (bg - ag) * t);
    const rb = Math.round(ab + (bb - ab) * t);
    return (rr << 16) | (rg << 8) | rb;
  };

  useEffect(() => {
    const depthLayer = options.depthLayerRef.current;
    if (!depthLayer) return;

    for (const child of [...depthLayer.children]) {
      if (child.label === "effect") {
        depthLayer.removeChild(child);
        child.destroy?.();
      }
    }

    if (options.suspendRendering) return;

    const typeById = new Map<string, EffectTypeDefinition>();
    for (const t of options.effectTypes) typeById.set(t.id, t);

    const showAll = Boolean(options.showAllLevels);
    const visibleCells = options.visibleCells ?? null;
    const cellKey = (x: number, y: number) => `${x},${y}`;

    for (const effect of options.effects) {
      if (effect.active === false) continue;
      if (effect.sourceObstacleId) continue;
      const def = typeById.get(effect.typeId) ?? null;
      const appearance = def?.appearance;
      if (!appearance?.spriteKey) continue;

      const isVisible = showAll || (visibleCells?.has(cellKey(effect.x, effect.y)) ?? true);
      if (!isVisible) continue;

      const spriteUrl = getObstaclePngUrl(appearance.spriteKey);
      const animationFrames = spriteUrl ? null : getObstacleAnimationFrames(appearance.spriteKey);
      if (!spriteUrl && (!animationFrames || animationFrames.length === 0)) continue;

      let sprite: Sprite | AnimatedSprite;
      if (animationFrames && animationFrames.length > 0) {
        const textures = animationFrames.map(frame => Texture.from(frame));
        const anim = new AnimatedSprite(textures);
        anim.animationSpeed = typeof appearance.animationSpeed === "number" ? appearance.animationSpeed : 0.15;
        anim.loop = typeof appearance.animationLoop === "boolean" ? appearance.animationLoop : true;
        anim.play();
        sprite = anim;
      } else {
        sprite = Sprite.from(spriteUrl as string);
      }

      sprite.anchor.set(0.5, 0.5);

      const seed = `${effect.id}:${effect.typeId}`;
      const t = hashString01(seed);

      const scaleBase = typeof appearance.scale === "number" ? appearance.scale : 1;
      if (typeof appearance.targetSize === "number" && appearance.targetSize > 0) {
        const texture =
          sprite instanceof AnimatedSprite
            ? sprite.textures[0]
            : (sprite as Sprite).texture;
        const baseWidth = texture?.width ?? 0;
        const baseHeight = texture?.height ?? 0;
        const baseSize = Math.max(baseWidth, baseHeight);
        if (baseSize > 0) {
          const fitScale = appearance.targetSize / baseSize;
          sprite.scale.set(scaleBase * fitScale);
        } else {
          sprite.scale.set(scaleBase);
        }
      } else {
        sprite.scale.set(scaleBase);
      }
      if (appearance.scaleRange) {
        const { min, max } = appearance.scaleRange;
        const scale = min + (max - min) * t;
        sprite.scale.set(sprite.scale.x * scale, sprite.scale.y * scale);
      }

      const alphaBase = typeof appearance.alpha === "number" ? appearance.alpha : 1;
      if (appearance.alphaRange) {
        const { min, max } = appearance.alphaRange;
        sprite.alpha = alphaBase * (min + (max - min) * t);
      } else {
        sprite.alpha = alphaBase;
      }

      if (typeof appearance.tint === "number") {
        sprite.tint = appearance.tint;
      } else if (appearance.tintRange) {
        sprite.tint = lerpColor(appearance.tintRange.dark, appearance.tintRange.light, t);
      } else {
        sprite.tint = 0xffffff;
      }

      const center = gridToScreenForGrid(effect.x, effect.y, options.grid.cols, options.grid.rows);
      sprite.x = center.x;
      sprite.y = center.y;
      if (typeof effect.rotationDeg === "number") {
        sprite.rotation = (effect.rotationDeg * Math.PI) / 180;
      } else {
        sprite.rotation = 0;
      }

      const container = new Container();
      container.label = "effect";
      container.addChild(sprite);
      container.zIndex = center.y + DEPTH_Z.effects;
      depthLayer.addChild(container);
    }
  }, [
    options.depthLayerRef,
    options.effects,
    options.effectTypes,
    options.pixiReadyTick,
    options.grid,
    options.visibleCells,
    options.showAllLevels
  ]);
}
