import React, { useMemo } from "react";
import { getWorldMapCellKey, type WorldMapLayout } from "../../data/worldMapLayout";
import type { TickOutput, WorldState, WorldTension } from "../../world-simulation";
import type { WikiEntry } from "../mapShared";
import { editorSurfaceStyles, editorTextStyles } from "../editor/editorTheme";

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));
}

function formatPressureEntries(pressures: Record<string, number> | undefined): string[] {
  if (!pressures) return [];
  return Object.entries(pressures)
    .filter(([, value]) => typeof value === "number" && value >= 1)
    .sort((left, right) => right[1] - left[1])
    .map(([label, value]) => `${label} ${Math.round(value)}`);
}

function formatEventRefs(event: TickOutput["events"][number]): string[] {
  const refs = [event.actor, event.target].filter(Boolean).map(ref => `${ref!.kind}:${ref!.id}`);
  return Array.from(new Set(refs));
}

function formatTensionType(type: WorldTension["type"]): string {
  const labels: Record<WorldTension["type"], string> = {
    criminal: "criminelle",
    social: "sociale",
    commercial: "commerciale",
    military: "militaire",
    religious: "religieuse",
    political: "politique",
    scarcity: "penurie",
    control_conflict: "controle",
    mobility_risk: "mobilite"
  };
  return labels[type] ?? type.replace(/_/g, " ");
}

export function SimulationCellAnalysisPanel(props: {
  layout: WorldMapLayout;
  state: WorldState;
  selectedCellKey: string;
  latestOutput: TickOutput | null;
  wikiEntriesById: Record<string, WikiEntry>;
}): React.JSX.Element {
  const selectedCell = props.layout.cells.find(cell => getWorldMapCellKey(cell.cell) === props.selectedCellKey) ?? null;
  const selectedCity =
    props.layout.cities.find(city => getWorldMapCellKey(city.cell) === props.selectedCellKey) ??
    props.layout.cities.find(city => city.wikiEntityId === selectedCell?.cityWikiId) ??
    null;
  const selectedTerritory =
    props.layout.governanceTerritories?.find(entry => entry.id === selectedCell?.governanceTerritoryId) ?? null;
  const selectedRegion =
    props.layout.governanceRegions?.find(entry => entry.id === selectedCell?.governanceRegionId) ?? null;
  const selectedGovernance =
    props.layout.governances?.find(entry => entry.id === (selectedTerritory?.governanceId ?? selectedRegion?.governanceId)) ?? null;
  const localPaths = props.layout.paths.filter(path => path.cells.some(cell => getWorldMapCellKey(cell) === props.selectedCellKey));
  const localPathIds = localPaths.map(path => path.id);
  const localFactions = props.layout.simulation?.factions?.filter(faction => faction.presenceCells.some(cell => getWorldMapCellKey(cell) === props.selectedCellKey)) ?? [];
  const localObjectives =
    props.layout.simulation?.specialObjectives?.filter(objective => {
      const anchorMatches = objective.anchorCell ? getWorldMapCellKey(objective.anchorCell) === props.selectedCellKey : false;
      const zoneMatches = objective.zoneIds.some(zoneId =>
        zoneId === selectedCity?.id ||
        zoneId === selectedRegion?.id ||
        zoneId === selectedTerritory?.id ||
        localPathIds.includes(zoneId)
      );
      return anchorMatches || zoneMatches;
    }) ?? [];
  const localMobiles =
    props.layout.simulation?.mobileActors?.filter(actor => {
      if (actor.positionKind === "cell" && actor.positionId === props.selectedCellKey) return true;
      if (actor.positionKind === "city" && actor.positionId === selectedCity?.id) return true;
      if (actor.positionKind === "region" && actor.positionId === selectedRegion?.id) return true;
      if (actor.positionKind === "route" && localPathIds.includes(actor.positionId ?? "")) return true;
      return false;
    }) ?? [];

  const localRefs = useMemo(() => {
    return new Set(
      uniqueStrings([
        selectedCity ? `city:${selectedCity.id}` : null,
        selectedRegion ? `region:${selectedRegion.id}` : null,
        ...localPathIds.map(pathId => `route:${pathId}`)
      ])
    );
  }, [localPathIds, selectedCity, selectedRegion]);

  const runtimeCity = selectedCity ? props.state.cities[selectedCity.id] ?? null : null;
  const runtimeRegion = selectedRegion ? props.state.regions[selectedRegion.id] ?? null : null;
  const cityPressures = runtimeCity ? formatPressureEntries(props.state.pressures.city?.[runtimeCity.id] ?? {}) : [];
  const regionPressures = runtimeRegion ? formatPressureEntries(props.state.pressures.region?.[runtimeRegion.id] ?? {}) : [];
  const routePressures = localPaths.flatMap(path =>
    formatPressureEntries(props.state.pressures.route?.[path.id] ?? {}).map(entry => `${path.label || path.id}: ${entry}`)
  );
  const localTensions = useMemo(() => {
    const tensionIds = uniqueStrings([
      ...(runtimeCity?.activeTensionIds ?? []),
      ...(runtimeRegion?.activeTensionIds ?? []),
      ...localPaths.flatMap(path => props.state.routes[path.id]?.activeTensionIds ?? [])
    ]);
    return tensionIds
      .map(tensionId => props.state.tensions[tensionId])
      .filter((tension): tension is WorldTension => Boolean(tension))
      .sort((left, right) => right.severity - left.severity)
      .slice(0, 5);
  }, [localPaths, props.state.routes, props.state.tensions, runtimeCity?.activeTensionIds, runtimeRegion?.activeTensionIds]);

  const recentEvents = props.latestOutput?.events.filter(event => formatEventRefs(event).some(ref => localRefs.has(ref))) ?? [];
  const recentDeltas = props.latestOutput?.deltas.filter(delta => localRefs.has(`${delta.target.kind}:${delta.target.id}`)) ?? [];
  const recentSignals = props.latestOutput?.signals.filter(signal => localRefs.has(`${signal.location.kind}:${signal.location.id}`)) ?? [];
  const recentRumors =
    props.latestOutput?.rumors.filter(rumor => {
      if (localRefs.has(`${rumor.origin.kind}:${rumor.origin.id}`)) return true;
      return rumor.spreadTo.some(ref => localRefs.has(`${ref.kind}:${ref.id}`));
    }) ?? [];
  const recentOpportunities =
    props.latestOutput?.opportunities.filter(opportunity => localRefs.has(`${opportunity.location.kind}:${opportunity.location.id}`)) ?? [];

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ ...editorSurfaceStyles.subsection, gap: 6 }}>
        <div style={editorTextStyles.sectionTitle}>Identite</div>
        <div style={{ fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
          <div>Hex: {props.selectedCellKey}</div>
          <div>Surface: {selectedCell?.surface ?? "ocean"}</div>
          <div>Geographie: {selectedCell?.geography ?? "ocean"}</div>
          <div>Difficulte: {selectedCell?.terrainDifficulty ?? "n/a"}</div>
          <div>Risque: {selectedCell?.riskLevel ?? "n/a"}</div>
          <div>Tags: {selectedCell?.tags?.length ? selectedCell.tags.join(", ") : "aucun"}</div>
        </div>
      </div>

      <div style={{ ...editorSurfaceStyles.subsection, gap: 6 }}>
        <div style={editorTextStyles.sectionTitle}>Politique</div>
        <div style={{ fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
          <div>Territoire: {selectedTerritory ? props.wikiEntriesById[selectedTerritory.wikiEntityId]?.name ?? selectedTerritory.wikiEntityId : selectedCell?.governanceTerritoryId ?? "aucun"}</div>
          <div>Region: {selectedRegion ? props.wikiEntriesById[selectedRegion.wikiEntityId]?.name ?? selectedRegion.wikiEntityId : selectedCell?.governanceRegionId ?? "aucune"}</div>
          <div>Gouvernance: {selectedGovernance?.label ?? selectedGovernance?.id ?? "aucune"}</div>
          <div>Capitale: {selectedGovernance?.capitalCityId ?? "aucune"}</div>
        </div>
      </div>

      <div style={{ ...editorSurfaceStyles.subsection, gap: 6 }}>
        <div style={editorTextStyles.sectionTitle}>Contenu local</div>
        <div style={{ fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
          <div>Ville: {selectedCity ? props.wikiEntriesById[selectedCity.wikiEntityId]?.name ?? selectedCity.wikiEntityId : "aucune"}</div>
          <div>Lieux: {selectedCell?.locationWikiIds?.length ? selectedCell.locationWikiIds.join(", ") : "aucun"}</div>
          <div>Zones geographiques: {selectedCell?.geographicZoneIds?.length ? selectedCell.geographicZoneIds.join(", ") : "aucune"}</div>
          <div>Routes et cours d'eau: {localPaths.length ? localPaths.map(path => path.label || path.id).join(", ") : "aucun"}</div>
        </div>
      </div>

      <div style={{ ...editorSurfaceStyles.subsection, gap: 6 }}>
        <div style={editorTextStyles.sectionTitle}>Simulation locale</div>
        <div style={{ fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
          <div>Factions presentes: {localFactions.length ? localFactions.map(faction => faction.label).join(", ") : "aucune"}</div>
          <div>Objectifs lies: {localObjectives.length ? localObjectives.map(objective => objective.label).join(", ") : "aucun"}</div>
          <div>Mobiles lies: {localMobiles.length ? localMobiles.map(actor => actor.label).join(", ") : "aucun"}</div>
          <div>Pressions ville: {cityPressures.length ? cityPressures.join(" | ") : "aucune"}</div>
          <div>Pressions region: {regionPressures.length ? regionPressures.join(" | ") : "aucune"}</div>
          <div>Pressions routes: {routePressures.length ? routePressures.join(" | ") : "aucune"}</div>
          <div>
            Tensions actives:{" "}
            {localTensions.length
              ? localTensions.map(tension => `${formatTensionType(tension.type)} ${Math.round(tension.severity)}`).join(" | ")
              : "aucune"}
          </div>
          {runtimeCity ? <div>Historique ville: {runtimeCity.recentHistory.length} entree(s)</div> : null}
        </div>
      </div>

      <div style={{ ...editorSurfaceStyles.subsection, gap: 6 }}>
        <div style={editorTextStyles.sectionTitle}>Dernier cycle horaire</div>
        <div style={{ fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
          <div>Evenements lies: {recentEvents.length}</div>
          <div>Deltas lies: {recentDeltas.length}</div>
          <div>Signaux perceptibles: {recentSignals.length}</div>
          <div>Rumeurs: {recentRumors.length}</div>
          <div>Opportunites: {recentOpportunities.length}</div>
          {recentEvents.length > 0 ? <div>Types d'evenements: {uniqueStrings(recentEvents.map(event => event.type)).join(", ")}</div> : null}
        </div>
      </div>
    </div>
  );
}
