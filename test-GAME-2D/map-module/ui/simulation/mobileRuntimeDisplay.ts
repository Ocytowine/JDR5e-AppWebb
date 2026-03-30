import type { MapCell, WorldMapLayout } from "../../data/worldMapLayout";
import type { MobileActor, WorldState } from "../../world-simulation";
import { getAbsoluteRouteProgress, getRouteTraversalCost } from "../../world-simulation/travel";
import { getCellCenter } from "../mapShared";

type Point = { x: number; y: number };

function getRouteCells(layout: WorldMapLayout, routeId: string): MapCell[] {
  return layout.paths.find(path => path.id === routeId)?.cells ?? [];
}

function getRoutePoints(layout: WorldMapLayout, routeId: string): Point[] {
  return getRouteCells(layout, routeId).map(cell => getCellCenter(layout, cell));
}

function getPolylineLength(points: Point[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const dx = points[index].x - points[index - 1].x;
    const dy = points[index].y - points[index - 1].y;
    total += Math.hypot(dx, dy);
  }
  return total;
}

function interpolateAlongPoints(points: Point[], ratio: number): Point | null {
  if (points.length === 0) return null;
  if (points.length === 1) return points[0];
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const totalLength = getPolylineLength(points);
  if (totalLength <= 0) return points[0];
  const targetDistance = totalLength * clampedRatio;
  let traversed = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const segmentLength = Math.hypot(to.x - from.x, to.y - from.y);
    if (segmentLength <= 0) continue;
    if (traversed + segmentLength >= targetDistance) {
      const localRatio = (targetDistance - traversed) / segmentLength;
      return {
        x: from.x + (to.x - from.x) * localRatio,
        y: from.y + (to.y - from.y) * localRatio
      };
    }
    traversed += segmentLength;
  }
  return points[points.length - 1];
}

export function getRuntimeMobileMapPoint(layout: WorldMapLayout, state: WorldState, actor: MobileActor): Point | null {
  if (actor.position.kind !== "route") return null;
  const route = state.routes[actor.position.id];
  if (!route) return null;
  const routePoints = getRoutePoints(layout, route.id);
  if (routePoints.length === 0) return null;
  const totalCost = getRouteTraversalCost(route, actor);
  if (totalCost <= 0) return routePoints[0];
  const absoluteProgress = getAbsoluteRouteProgress(route, actor);
  return interpolateAlongPoints(routePoints, absoluteProgress / totalCost);
}

export function formatRuntimeMobileProgress(layout: WorldMapLayout, state: WorldState, actor: MobileActor): {
  routeLabel: string | null;
  progressLabel: string;
  targetLabel: string;
  stopLabel: string | null;
} {
  if (actor.position.kind !== "route") {
    return {
      routeLabel: null,
      progressLabel: "Hors route",
      targetLabel: actor.destination ? `${actor.destination.kind}:${actor.destination.id}` : "aucune destination",
      stopLabel: null
    };
  }
  const route = state.routes[actor.position.id];
  const layoutRoute = layout.paths.find(path => path.id === actor.position.id);
  if (!route) {
    return {
      routeLabel: layoutRoute?.label || actor.position.id,
      progressLabel: "Route runtime introuvable",
      targetLabel: actor.currentRouteTargetId ?? "aucune cible",
      stopLabel: null
    };
  }
  const totalCost = getRouteTraversalCost(route, actor);
  const absoluteProgress = getAbsoluteRouteProgress(route, actor);
  const progressPercent = totalCost > 0 ? Math.round((absoluteProgress / totalCost) * 100) : 0;
  return {
    routeLabel: layoutRoute?.label || route.id,
    progressLabel: `${progressPercent}% du troncon`,
    targetLabel: actor.currentRouteTargetId ?? "aucune cible",
    stopLabel:
      typeof actor.destinationRouteProgress === "number" && Number.isFinite(actor.destinationRouteProgress)
        ? `Arret prevu a ${Math.round((actor.destinationRouteProgress / Math.max(totalCost, 1)) * 100)}%`
        : null
  };
}
