import type { MapCell, WorldMapLayout } from "../../data/worldMapLayout";
import type { MobileActor, WorldState } from "../../world-simulation";
import {
  canUseAbstractWaterTravel,
  getAbsoluteRouteProgress,
  getOffRouteTraversalCost,
  getProgressPerTick,
  getRouteTraversalCost,
  isRouteCompatibleWithActor
} from "../../world-simulation/travel";
import { getCellCenter } from "../mapShared";

type Point = { x: number; y: number };
type RuntimeMobileStatusKind =
  | "en_route"
  | "hors_route"
  | "navigation_abstraite"
  | "bloque_eau"
  | "bloque"
  | "arrive"
  | "sans_mission";

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
  statusKind: RuntimeMobileStatusKind;
  statusLabel: string;
  statusReason: string;
  routeLabel: string | null;
  progressLabel: string;
  targetLabel: string;
  stopLabel: string | null;
  remainingLabel: string | null;
  etaLabel: string | null;
} {
  const waterMode = actor.modeTransport === "bateau" || actor.travelMode === "river" || actor.travelMode === "sea";
  const hasDestination = Boolean(actor.destination);
  const hasItinerary = actor.itinerary.length > 0;
  const progressPerTick = getProgressPerTick(actor, state);
  const hoursPerTick = Math.max(state.clock.minutesPerMicroTick / 60, 0);
  const formatEstimate = (remainingCost: number) => {
    const estimatedRemainingHours =
      progressPerTick > 0 && hoursPerTick > 0 ? (remainingCost / progressPerTick) * hoursPerTick : null;
    const estimatedRemainingDays =
      typeof estimatedRemainingHours === "number" ? estimatedRemainingHours / 24 : null;
    return {
      remainingLabel:
        typeof estimatedRemainingHours === "number"
          ? `${estimatedRemainingHours.toFixed(1)} h restantes`
          : null,
      etaLabel:
        typeof estimatedRemainingHours === "number"
          ? `${estimatedRemainingDays && estimatedRemainingDays >= 1 ? `${estimatedRemainingDays.toFixed(1)} j` : `${estimatedRemainingHours.toFixed(1)} h`} avant arrivee`
          : null
    };
  };

  if (!hasDestination && !hasItinerary) {
    const arrivedRecently = actor.recentHistory.some(entry => entry.type === "mobile_arrival_effect" || entry.type === "mobile_actor_arrived");
    return {
      statusKind: arrivedRecently ? "arrive" : "sans_mission",
      statusLabel: arrivedRecently ? "Arrive" : "Sans mission",
      statusReason: arrivedRecently ? "destination atteinte, aucun trajet actif" : "aucune destination ni itineraire actif",
      routeLabel: actor.position.kind === "route" ? layout.paths.find(path => path.id === actor.position.id)?.label || actor.position.id : null,
      progressLabel: actor.position.kind === "route" ? "stationne sur corridor" : "stationne hors corridor",
      targetLabel: "aucune cible",
      stopLabel: null,
      remainingLabel: null,
      etaLabel: null
    };
  }

  if (actor.position.kind !== "route") {
    if (hasDestination && !hasItinerary) {
      if (waterMode && !canUseAbstractWaterTravel(state, actor)) {
        return {
          statusKind: "bloque_eau",
          statusLabel: "Bloque eau",
          statusReason: "mode navigation demande mais depart et arrivee sans acces eau",
          routeLabel: null,
          progressLabel: "navigation impossible",
          targetLabel: actor.destination ? `${actor.destination.kind}:${actor.destination.id}` : "aucune destination",
          stopLabel: null,
          remainingLabel: null,
          etaLabel: null
        };
      }
      const offRouteCost = getOffRouteTraversalCost(state, actor);
      const clampedProgress = Math.max(0, Math.min(actor.routeProgress, offRouteCost));
      const progressPercent = offRouteCost > 0 ? Math.round((clampedProgress / offRouteCost) * 100) : 0;
      const estimate = formatEstimate(Math.max(0, offRouteCost - clampedProgress));
      return {
        statusKind: waterMode ? "navigation_abstraite" : "hors_route",
        statusLabel: waterMode ? "Navigation abstraite" : "Hors-route",
        statusReason: waterMode ? "aucun corridor d'eau trouve, progression abstraite autorisee" : "aucun corridor compatible trouve, progression hors-route",
        routeLabel: null,
        progressLabel: `${progressPercent}% du trajet abstrait`,
        targetLabel: actor.destination ? `${actor.destination.kind}:${actor.destination.id}` : "aucune destination",
        stopLabel: null,
        remainingLabel: estimate.remainingLabel,
        etaLabel: estimate.etaLabel
      };
    }

    return {
      statusKind: "bloque",
      statusLabel: "Bloque",
      statusReason: hasDestination ? "destination presente mais aucun corridor utilisable" : "position hors corridor sans destination active",
      routeLabel: null,
      progressLabel: "Hors route",
      targetLabel: actor.destination ? `${actor.destination.kind}:${actor.destination.id}` : "aucune destination",
      stopLabel: null,
      remainingLabel: null,
      etaLabel: null
    };
  }
  const route = state.routes[actor.position.id];
  const layoutRoute = layout.paths.find(path => path.id === actor.position.id);
  if (!route) {
    return {
      statusKind: "bloque",
      statusLabel: "Bloque",
      statusReason: "corridor absent de l'etat runtime",
      routeLabel: layoutRoute?.label || actor.position.id,
      progressLabel: "Route runtime introuvable",
      targetLabel: actor.currentRouteTargetId ?? "aucune cible",
      stopLabel: null,
      remainingLabel: null,
      etaLabel: null
    };
  }
  if (!isRouteCompatibleWithActor(route, actor)) {
    return {
      statusKind: waterMode ? "bloque_eau" : "bloque",
      statusLabel: waterMode ? "Bloque eau" : "Bloque",
      statusReason: "mode de transport incompatible avec le corridor actuel",
      routeLabel: layoutRoute?.label || route.id,
      progressLabel: "mode incompatible",
      targetLabel: actor.currentRouteTargetId ?? "aucune cible",
      stopLabel: null,
      remainingLabel: null,
      etaLabel: null
    };
  }
  const totalCost = getRouteTraversalCost(route, actor);
  const absoluteProgress = getAbsoluteRouteProgress(route, actor);
  const progressPercent = totalCost > 0 ? Math.round((absoluteProgress / totalCost) * 100) : 0;
  const remainingCost = Math.max(0, totalCost - absoluteProgress);
  const estimate = formatEstimate(remainingCost);
  return {
    statusKind: "en_route",
    statusLabel: waterMode ? "En navigation" : "En route",
    statusReason: hasItinerary || hasDestination ? "trajet actif sur corridor compatible" : "position sur corridor",
    routeLabel: layoutRoute?.label || route.id,
    progressLabel: `${progressPercent}% du troncon`,
    targetLabel: actor.currentRouteTargetId ?? "aucune cible",
    stopLabel:
      typeof actor.destinationRouteProgress === "number" && Number.isFinite(actor.destinationRouteProgress)
        ? `Arret prevu a ${Math.round((actor.destinationRouteProgress / Math.max(totalCost, 1)) * 100)}%`
        : null,
    remainingLabel: estimate.remainingLabel,
    etaLabel: estimate.etaLabel
  };
}
