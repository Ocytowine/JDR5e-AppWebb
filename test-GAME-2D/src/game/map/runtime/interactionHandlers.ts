import type React from "react";
import type { ObstacleInstance, ObstacleTypeDefinition } from "../../obstacleTypes";
import type { InteractionSpec, InteractionCost } from "./interactions";
import type { WallSegment } from "../walls/types";
import type { WallTypeDefinition } from "../../wallTypes";
import { isWallDestructible } from "../walls/durability";

export type InteractionTarget =
  | { kind: "wall"; segmentId: string; cell: { x: number; y: number } }
  | { kind: "obstacle"; obstacleId: string; cell: { x: number; y: number } };

export type InteractionAvailability = { ok: boolean; reason?: string };

type CostCheck = (cost?: InteractionCost) => InteractionAvailability;

export function getInteractionAvailability(params: {
  interaction: InteractionSpec;
  target: InteractionTarget;
  player: { x: number; y: number };
  wallSegments: WallSegment[];
  obstacles: ObstacleInstance[];
  wallTypeById: Map<string, WallTypeDefinition>;
  obstacleTypeById: Map<string, ObstacleTypeDefinition>;
  canPayCost: CostCheck;
  getWallDistance: (player: { x: number; y: number }, wall: WallSegment) => number;
  getObstacleDistance: (
    player: { x: number; y: number },
    obstacle: ObstacleInstance,
    def: ObstacleTypeDefinition | null,
    targetCell: { x: number; y: number }
  ) => number;
}): InteractionAvailability {
  const {
    interaction,
    target,
    player,
    wallSegments,
    obstacles,
    wallTypeById,
    obstacleTypeById,
    canPayCost,
    getWallDistance,
    getObstacleDistance
  } = params;

  if (target.kind === "wall") {
    const wall = wallSegments.find(w => w.id === target.segmentId) ?? null;
    if (!wall) return { ok: false, reason: "Mur introuvable." };
    const def = wall.typeId ? wallTypeById.get(wall.typeId) ?? null : null;
    const dist = getWallDistance(player, wall);
    if (dist > 1) return { ok: false, reason: "Trop loin." };
    return resolveWallInteraction(interaction, wall, def, canPayCost);
  }

  const obstacle = obstacles.find(o => o.id === target.obstacleId) ?? null;
  if (!obstacle) return { ok: false, reason: "Obstacle introuvable." };
  const def = obstacleTypeById.get(obstacle.typeId) ?? null;
  const dist = getObstacleDistance(player, obstacle, def, target.cell);
  if (dist > 1) return { ok: false, reason: "Trop loin." };
  return resolveObstacleInteraction(interaction, obstacle, def, canPayCost);
}

function resolveWallInteraction(
  interaction: InteractionSpec,
  segment: WallSegment,
  def: WallTypeDefinition | null,
  canPayCost: CostCheck
): InteractionAvailability {
  const costCheck = canPayCost(interaction.cost);
  if (!costCheck.ok) return costCheck;

  if (interaction.kind === "open") {
    if (segment.kind !== "door") {
      return { ok: false, reason: "Interaction reservee aux portes." };
    }
    if (segment.state === "open") {
      return { ok: false, reason: "La porte est deja ouverte." };
    }
    return { ok: true };
  }

  if (interaction.kind === "break") {
    if (segment.kind !== "door") {
      return { ok: false, reason: "Interaction reservee aux portes." };
    }
    if (segment.state === "open") {
      return { ok: false, reason: "La porte est deja ouverte." };
    }
    if (!isWallDestructible(def)) {
      return { ok: false, reason: "Porte indestructible." };
    }
    if (typeof interaction.forceDc !== "number") {
      return { ok: false, reason: "DD de force manquant." };
    }
    return { ok: true };
  }

  return { ok: true };
}

function resolveObstacleInteraction(
  interaction: InteractionSpec,
  obstacle: ObstacleInstance,
  def: ObstacleTypeDefinition | null,
  canPayCost: CostCheck
): InteractionAvailability {
  const costCheck = canPayCost(interaction.cost);
  if (!costCheck.ok) return costCheck;

  if (interaction.kind === "open") {
    return { ok: false, reason: "Interaction reservee aux portes." };
  }

  if (interaction.kind === "break") {
    if (def?.durability?.destructible === false) {
      return { ok: false, reason: "Obstacle indestructible." };
    }
    if (obstacle.hp <= 0) {
      return { ok: false, reason: "Obstacle deja detruit." };
    }
    if (typeof interaction.forceDc !== "number") {
      return { ok: false, reason: "DD de force manquant." };
    }
  }

  if (interaction.kind === "toggle") {
    const targetLit = typeof interaction.setLit === "boolean" ? interaction.setLit : null;
    if (targetLit !== null) {
      const currentLit = obstacle.state?.lit !== false;
      if (currentLit === targetLit) {
        return { ok: false, reason: targetLit ? "Deja allume." : "Deja eteint." };
      }
    }
  }

  return { ok: true };
}

export function applyInteraction(params: {
  interaction: InteractionSpec;
  target: InteractionTarget;
  wallTypeById: Map<string, WallTypeDefinition>;
  setWallSegments: React.Dispatch<React.SetStateAction<WallSegment[]>>;
  setObstacles: React.Dispatch<React.SetStateAction<ObstacleInstance[]>>;
}): void {
  const { interaction, target, wallTypeById, setWallSegments, setObstacles } = params;

  if (target.kind === "wall") {
    setWallSegments(prev => {
      const idx = prev.findIndex(w => w.id === target.segmentId);
      if (idx === -1) return prev;
      const copy = [...prev];
      const segment = { ...copy[idx] };
      const def = segment.typeId ? wallTypeById.get(segment.typeId) ?? null : null;

      if (interaction.kind === "open") {
        if (segment.kind === "door" && segment.state !== "open") {
          segment.state = "open";
          copy[idx] = segment;
        }
      } else if (interaction.kind === "break") {
        if (segment.kind === "door" && segment.state !== "open" && isWallDestructible(def)) {
          const maxHp =
            typeof segment.maxHp === "number"
              ? segment.maxHp
              : typeof segment.hp === "number"
                ? segment.hp
                : null;
          if (maxHp !== null) {
            const fraction =
              typeof interaction.damageFraction === "number"
                ? interaction.damageFraction
                : 0.5;
            const damage = Math.max(0, Math.round(maxHp * fraction));
            const beforeHp = typeof segment.hp === "number" ? segment.hp : maxHp;
            segment.hp = Math.max(0, beforeHp - damage);
            segment.maxHp = maxHp;
          }
          segment.state = "open";
          copy[idx] = segment;
        }
      }

      return copy.filter(w => w.hp === undefined || w.hp > 0);
    });
    return;
  }

  setObstacles(prev => {
    const idx = prev.findIndex(o => o.id === target.obstacleId);
    if (idx === -1) return prev;
    const copy = [...prev];
    const obstacle = { ...copy[idx] };
    if (interaction.kind === "break" && obstacle.hp > 0) {
      const fraction =
        typeof interaction.damageFraction === "number"
          ? interaction.damageFraction
          : 0.5;
      const maxHp =
        typeof obstacle.maxHp === "number" ? obstacle.maxHp : obstacle.hp;
      const damage = Math.max(0, Math.round(maxHp * fraction));
      obstacle.hp = Math.max(0, obstacle.hp - damage);
      copy[idx] = obstacle;
    } else if (interaction.kind === "toggle") {
      const nextLit =
        typeof interaction.setLit === "boolean"
          ? interaction.setLit
          : !(obstacle.state?.lit !== false);
      obstacle.state = { ...(obstacle.state ?? {}), lit: nextLit };
      copy[idx] = obstacle;
    }
    return copy.filter(o => o.hp > 0);
  });
}

