import React from "react";
import {
  getWorldMapCellKey,
  type MapCell,
  type SimulationFactionRelationStatus,
  type WorldMapLayout
} from "../data/worldMapLayout";
import { buildPathPoints, getCellCenter, getCellPolygon } from "./mapShared";
import type { PressureMap, PressureType, WorldState } from "../world-simulation";
import { formatRuntimeMobileProgress, getRuntimeMobileMapPoint } from "./simulation/mobileRuntimeDisplay";

type OverlayMode = "factions" | "objectives" | "mobility" | "pressures" | "relations" | "all";

const PRESSURE_COLORS: Record<PressureType, string> = {
  criminal: "#c96f4a",
  social: "#d2a94f",
  commercial: "#5eaf7c",
  military: "#5f86d8",
  religious: "#d4b16a",
  political: "#6ba8a1"
};

const RELATION_STYLES: Record<SimulationFactionRelationStatus, { stroke: string; dasharray?: string; width: number }> = {
  ally: { stroke: "#72c58f", width: 3.2 },
  neutral: { stroke: "rgba(220,229,242,0.52)", dasharray: "5 8", width: 2.2 },
  rival: { stroke: "#d49a52", dasharray: "10 6", width: 3 },
  war: { stroke: "#c85c5c", dasharray: "12 5", width: 3.6 }
};

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const source = normalized.length === 3
    ? normalized.split("").map(char => `${char}${char}`).join("")
    : normalized.padEnd(6, "0").slice(0, 6);
  const r = Number.parseInt(source.slice(0, 2), 16);
  const g = Number.parseInt(source.slice(2, 4), 16);
  const b = Number.parseInt(source.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getRouteAnchorCell(layout: WorldMapLayout, routeId: string): MapCell | null {
  const route = layout.paths.find(path => path.id === routeId);
  if (!route || route.cells.length === 0) return null;
  return route.cells[Math.floor(route.cells.length / 2)] ?? route.cells[0] ?? null;
}

function getEntityAnchorCell(layout: WorldMapLayout, kind: string | undefined, id: string | undefined): MapCell | null {
  if (!kind || !id) return null;
  if (kind === "city") {
    return layout.cities.find(city => city.id === id)?.cell ?? null;
  }
  if (kind === "route") {
    return getRouteAnchorCell(layout, id);
  }
  if (kind === "region") {
    return layout.governanceRegions?.find(region => region.id === id)?.labelCell ?? null;
  }
  if (kind === "cell") {
    const [x, y] = id.split(",").map(Number);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }
  return null;
}

function getDistrictAnchorCell(layout: WorldMapLayout, districtId: string): MapCell | null {
  const lastSeparator = districtId.lastIndexOf(":");
  if (lastSeparator <= 0) return null;
  const cityId = districtId.slice(0, lastSeparator);
  const profile = districtId.slice(lastSeparator + 1);
  const city = layout.cities.find(entry => entry.id === cityId);
  if (!city) return null;
  const nearbyCells = layout.cells.filter(cell => {
    const distance = Math.abs(cell.cell.x - city.cell.x) + Math.abs(cell.cell.y - city.cell.y);
    return cell.cityWikiId === city.wikiEntityId || distance <= 2;
  });
  const profileCells =
    profile === "harbor"
      ? nearbyCells.filter(cell => (cell.tags ?? []).includes("maritime") || cell.surface === "ocean")
      : profile === "sanctuary"
        ? nearbyCells.filter(cell => (cell.tags ?? []).includes("sacre"))
        : profile === "outskirts"
          ? nearbyCells.filter(cell => (cell.tags ?? []).some(tag => ["agricole", "minier", "forestier", "frontalier"].includes(tag)))
          : nearbyCells.filter(cell => cell.cityWikiId === city.wikiEntityId || getWorldMapCellKey(cell.cell) === getWorldMapCellKey(city.cell));
  return profileCells[0]?.cell ?? nearbyCells[0]?.cell ?? city.cell;
}

function getFactionAnchorCell(layout: WorldMapLayout, factionId: string): MapCell | null {
  const faction = layout.simulation?.factions.find(entry => entry.id === factionId);
  if (!faction) return null;
  if (faction.baseCell) return faction.baseCell;
  if (faction.homeCityId) {
    return layout.cities.find(city => city.id === faction.homeCityId)?.cell ?? null;
  }
  if (faction.homeRegionId) {
    return layout.governanceRegions?.find(region => region.id === faction.homeRegionId)?.labelCell ?? null;
  }
  return faction.presenceCells[0] ?? null;
}

function getDominantPressure(pressures: PressureMap | undefined): { type: PressureType; value: number } | null {
  if (!pressures) return null;
  const result = (Object.keys(PRESSURE_COLORS) as PressureType[]).reduce<{ type: PressureType; value: number } | null>(
    (current, type) => {
      const value = pressures[type] ?? 0;
      if (!current || value > current.value) {
        return { type, value };
      }
      return current;
    },
    null
  );
  return result && result.value > 0 ? result : null;
}

function getObjectiveTargetLabel(targetId: string | undefined): string | null {
  if (!targetId) return null;
  const leaf = targetId.split(":").pop() ?? targetId;
  return leaf.replace(/_/g, " ");
}

export function WorldSimulationOverlay(props: {
  layout: WorldMapLayout;
  mode: OverlayMode;
  selectedFactionId: string;
  selectedObjectiveId: string;
  selectedMobileActorId: string;
  state: WorldState;
}): React.JSX.Element {
  const factions = props.layout.simulation?.factions ?? [];
  const objectives = props.layout.simulation?.specialObjectives ?? [];
  const mobileActors = props.layout.simulation?.mobileActors ?? [];
  const pressureEntries = {
    cities: Object.entries(props.state.pressures.city ?? {}),
    districts: Object.entries(props.state.pressures.district ?? {}),
    routes: Object.entries(props.state.pressures.route ?? {}),
    regions: Object.entries(props.state.pressures.region ?? {})
  };
  const relationSegments = factions.flatMap(faction =>
    faction.relations.map(relation => {
      const sortedIds = [faction.id, relation.targetFactionId].sort();
      const key = `${sortedIds[0]}:${sortedIds[1]}:${relation.status}`;
      return {
        key,
        sourceId: faction.id,
        targetId: relation.targetFactionId,
        status: relation.status
      };
    })
  ).filter((entry, index, collection) => collection.findIndex(candidate => candidate.key === entry.key) === index);
  const selectedFaction = factions.find(faction => faction.id === props.selectedFactionId) ?? null;
  const selectedFactionObjectiveIds = new Set(
    objectives.filter(objective => objective.ownerFactionId === props.selectedFactionId).map(objective => objective.id)
  );

  return (
    <g pointerEvents="none">
      {(props.mode === "factions" || props.mode === "all" || props.mode === "relations") &&
        factions.flatMap(faction =>
          faction.presenceCells.map(cell => {
            const key = `${faction.id}:${getWorldMapCellKey(cell)}`;
            const selected = !props.selectedFactionId || props.selectedFactionId === faction.id;
            return (
              <polygon
                key={key}
                points={getCellPolygon(props.layout, cell)}
                fill={hexToRgba(faction.color, selected ? 0.28 : 0.12)}
                stroke={selected ? hexToRgba(faction.color, 0.9) : "rgba(255,255,255,0.12)"}
                strokeWidth={selected ? 2.4 : 1}
              />
            );
          })
        )}

      {(props.mode === "factions" || props.mode === "all" || props.mode === "relations") &&
        factions.map(faction => {
          const anchorCell = getFactionAnchorCell(props.layout, faction.id);
          if (!anchorCell) return null;
          const center = getCellCenter(props.layout, anchorCell);
          const selected = props.selectedFactionId === faction.id;
          const relatedToSelection =
            Boolean(props.selectedFactionId) &&
            relationSegments.some(
              entry =>
                (entry.sourceId === props.selectedFactionId && entry.targetId === faction.id) ||
                (entry.targetId === props.selectedFactionId && entry.sourceId === faction.id)
            );
          if (!selected && !relatedToSelection && props.selectedFactionId) return null;
          return (
            <g key={`faction-anchor:${faction.id}`} transform={`translate(${center.x} ${center.y})`}>
              <circle
                r={selected ? 14 : 10}
                fill={hexToRgba(faction.color, selected ? 0.95 : 0.78)}
                stroke={selected ? "rgba(255,255,255,0.94)" : "rgba(12,16,24,0.88)"}
                strokeWidth={selected ? 2.4 : 1.6}
              />
              <text
                x={0}
                y={selected ? -18 : -14}
                textAnchor="middle"
                fill="#eef3ff"
                style={{ fontSize: selected ? 11 : 10, fontWeight: 800, paintOrder: "stroke", stroke: "rgba(8,11,17,0.86)", strokeWidth: 4 }}
              >
                {faction.label}
              </text>
            </g>
          );
        })}

      {(props.mode === "objectives" || props.mode === "all") &&
        objectives.map(objective => {
          if (props.selectedFactionId && objective.ownerFactionId !== props.selectedFactionId) return null;
          const anchorCell =
            objective.anchorCell ??
            getEntityAnchorCell(props.layout, objective.targetKind, objective.targetId) ??
            null;
          if (!anchorCell) return null;
          const center = getCellCenter(props.layout, anchorCell);
          const selected =
            (!props.selectedObjectiveId || props.selectedObjectiveId === objective.id) &&
            (!props.selectedFactionId || selectedFactionObjectiveIds.has(objective.id));
          return (
            <g key={objective.id}>
              <circle
                cx={center.x}
                cy={center.y}
                r={selected ? 22 : 15}
                fill="rgba(244,201,103,0.16)"
                stroke={selected ? "rgba(244,201,103,0.92)" : "rgba(244,201,103,0.55)"}
                strokeWidth={selected ? 2.6 : 1.6}
                strokeDasharray={selected ? undefined : "4 4"}
              />
              <circle
                cx={center.x}
                cy={center.y}
                r={6}
                fill={selected ? "#f4c967" : "rgba(244,201,103,0.72)"}
              />
              <text
                x={center.x}
                y={center.y - (selected ? 28 : 20)}
                textAnchor="middle"
                fill="#f6e7a7"
                style={{ fontSize: selected ? 11 : 10, fontWeight: 800, paintOrder: "stroke", stroke: "rgba(8,11,17,0.86)", strokeWidth: 4 }}
              >
                {objective.label}
              </text>
              {selected && getObjectiveTargetLabel(objective.targetId) ? (
                <text
                  x={center.x}
                  y={center.y + 28}
                  textAnchor="middle"
                  fill="#ffe5a4"
                  style={{ fontSize: 10, fontWeight: 800, paintOrder: "stroke", stroke: "rgba(8,11,17,0.86)", strokeWidth: 4 }}
                >
                  {getObjectiveTargetLabel(objective.targetId)}
                </text>
              ) : null}
            </g>
          );
        })}

      {(props.mode === "objectives" || props.mode === "all") &&
        selectedFaction &&
        objectives
          .filter(objective => objective.ownerFactionId === selectedFaction.id)
          .map(objective => {
            const factionCell = getFactionAnchorCell(props.layout, selectedFaction.id);
            const anchorCell =
              objective.anchorCell ??
              getEntityAnchorCell(props.layout, objective.targetKind, objective.targetId) ??
              null;
            if (!factionCell || !anchorCell) return null;
            const source = getCellCenter(props.layout, factionCell);
            const target = getCellCenter(props.layout, anchorCell);
            return (
              <g key={`objective-link:${objective.id}`}>
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="rgba(244,201,103,0.68)"
                  strokeWidth={2.4}
                  strokeDasharray="8 6"
                />
              </g>
            );
          })}

      {(props.mode === "pressures" || props.mode === "all") && (
        <g>
          {pressureEntries.routes.map(([routeId, pressures]) => {
            const route = props.layout.paths.find(path => path.id === routeId);
            const dominant = getDominantPressure(pressures);
            if (!route || route.cells.length < 2 || !dominant || dominant.value < 18) return null;
            return (
              <polyline
                key={`pressure-route:${routeId}`}
                points={buildPathPoints(props.layout, route.cells)}
                fill="none"
                stroke={hexToRgba(PRESSURE_COLORS[dominant.type], Math.min(0.88, 0.24 + dominant.value / 180))}
                strokeWidth={2 + dominant.value / 30}
                strokeDasharray={dominant.type === "military" || dominant.type === "criminal" ? "10 6" : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}

          {pressureEntries.cities.map(([cityId, pressures]) => {
            const city = props.layout.cities.find(entry => entry.id === cityId);
            const dominant = getDominantPressure(pressures);
            if (!city || !dominant || dominant.value < 20) return null;
            const center = getCellCenter(props.layout, city.cell);
            return (
              <g key={`pressure-city:${cityId}`}>
                <circle
                  cx={center.x}
                  cy={center.y}
                  r={18 + dominant.value / 7}
                  fill={hexToRgba(PRESSURE_COLORS[dominant.type], 0.08)}
                  stroke={hexToRgba(PRESSURE_COLORS[dominant.type], 0.72)}
                  strokeWidth={2}
                />
                <circle
                  cx={center.x}
                  cy={center.y}
                  r={4}
                  fill={PRESSURE_COLORS[dominant.type]}
                />
              </g>
            );
          })}

          {pressureEntries.districts.map(([districtId, pressures]) => {
            const anchorCell = getDistrictAnchorCell(props.layout, districtId);
            const dominant = getDominantPressure(pressures);
            if (!anchorCell || !dominant || dominant.value < 22) return null;
            const center = getCellCenter(props.layout, anchorCell);
            return (
              <circle
                key={`pressure-district:${districtId}`}
                cx={center.x}
                cy={center.y}
                r={6 + dominant.value / 16}
                fill={hexToRgba(PRESSURE_COLORS[dominant.type], 0.24)}
                stroke={hexToRgba(PRESSURE_COLORS[dominant.type], 0.84)}
                strokeWidth={1.8}
              />
            );
          })}

          {pressureEntries.regions.map(([regionId, pressures]) => {
            const region = props.layout.governanceRegions?.find(entry => entry.id === regionId);
            const dominant = getDominantPressure(pressures);
            if (!region || !dominant || dominant.value < 24) return null;
            const center = getCellCenter(props.layout, region.labelCell);
            return (
              <rect
                key={`pressure-region:${regionId}`}
                x={center.x - 16}
                y={center.y - 16}
                width={32}
                height={32}
                rx={8}
                fill={hexToRgba(PRESSURE_COLORS[dominant.type], 0.14)}
                stroke={hexToRgba(PRESSURE_COLORS[dominant.type], 0.88)}
                strokeWidth={2}
              />
            );
          })}
        </g>
      )}

      {(props.mode === "relations" || props.mode === "all" || (props.mode === "factions" && Boolean(props.selectedFactionId))) &&
        relationSegments.map(entry => {
          const fromCell = getFactionAnchorCell(props.layout, entry.sourceId);
          const toCell = getFactionAnchorCell(props.layout, entry.targetId);
          if (!fromCell || !toCell) return null;
          const source = getCellCenter(props.layout, fromCell);
          const target = getCellCenter(props.layout, toCell);
          const style = RELATION_STYLES[entry.status];
          const selected =
            !props.selectedFactionId ||
            props.selectedFactionId === entry.sourceId ||
            props.selectedFactionId === entry.targetId;
          return (
            <line
              key={`relation:${entry.key}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={style.stroke}
              strokeWidth={selected ? style.width : Math.max(1.5, style.width - 0.8)}
              strokeDasharray={style.dasharray}
              strokeOpacity={selected ? 0.9 : 0.3}
            />
          );
        })}

      {(props.mode === "mobility" || props.mode === "all") &&
        mobileActors.map(actor => {
          const runtimeActor = props.state.mobileActors[`mobile:map:${actor.id}`];
          const runtimePoint = runtimeActor ? getRuntimeMobileMapPoint(props.layout, props.state, runtimeActor) : null;
          const positionCell = actor.positionCell ?? getEntityAnchorCell(props.layout, actor.positionKind, actor.positionId) ?? null;
          if (!positionCell && !runtimePoint) return null;
          const fallbackCenter = positionCell ? getCellCenter(props.layout, positionCell) : null;
          const center = runtimePoint ?? fallbackCenter;
          if (!center) return null;
          const selected = !props.selectedMobileActorId || props.selectedMobileActorId === actor.id;
          const routeCells = actor.itineraryRouteIds
            .map(routeId => props.layout.paths.find(path => path.id === routeId))
            .flatMap(path => path?.cells ?? []);
          const runtimeSummary = runtimeActor ? formatRuntimeMobileProgress(props.layout, props.state, runtimeActor) : null;
          return (
            <g key={actor.id}>
              {selected && routeCells.length > 1 && (
                <polyline
                  points={buildPathPoints(props.layout, routeCells)}
                  fill="none"
                  stroke={hexToRgba(actor.color, 0.7)}
                  strokeWidth={4}
                  strokeDasharray="8 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              <g transform={`translate(${center.x} ${center.y})`}>
                <circle
                  r={selected ? 14 : 11}
                  fill={hexToRgba(actor.color, 0.9)}
                  stroke={selected ? "rgba(255,255,255,0.92)" : "rgba(7,10,15,0.85)"}
                  strokeWidth={selected ? 2.4 : 1.8}
                />
                <path
                  d="M -4 5 L 0 -5 L 4 5 Z"
                  fill={selected ? "#08111a" : "rgba(255,255,255,0.88)"}
                />
              </g>
              {selected && runtimeSummary?.routeLabel ? (
                <text
                  x={center.x}
                  y={center.y + 26}
                  textAnchor="middle"
                  fill="#eef3ff"
                  style={{ fontSize: 10, fontWeight: 800, paintOrder: "stroke", stroke: "rgba(8,11,17,0.86)", strokeWidth: 4 }}
                >
                  {runtimeSummary.progressLabel}
                </text>
              ) : null}
            </g>
          );
        })}
    </g>
  );
}
