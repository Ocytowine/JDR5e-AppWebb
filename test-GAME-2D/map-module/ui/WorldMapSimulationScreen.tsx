import React, { useEffect, useMemo, useRef, useState } from "react";
import { getWorldMapCellKey, type MapLayerId, type WorldMapLayout } from "../data/worldMapLayout";
import { createWorldStateFromMapLayout, runWorldTick, summarizeSimulationSeed } from "../world-simulation";
import type { EntityRef, TickOutput, WorldState } from "../world-simulation";
import { MapCanvas, useWikiEntries } from "./mapShared";
import { WorldSimulationOverlay } from "./WorldSimulationOverlay";
import { MapEditorSidebar } from "./editor/MapEditorSidebar";
import { MapEditorTopbar } from "./editor/MapEditorTopbar";
import { createEditorButtonStyle, editorFieldStyles, editorSurfaceStyles, EDITOR_THEME } from "./editor/editorTheme";
import { SimulationCellAnalysisPanel } from "./simulation/SimulationCellAnalysisPanel";
import { SimulationEntityAnalysisPanel } from "./simulation/SimulationEntityAnalysisPanel";
import { SimulationFactionAnalysisPanel } from "./simulation/SimulationFactionAnalysisPanel";
import { SimulationPressureAnalysisPanel } from "./simulation/SimulationPressureAnalysisPanel";
import { SimulationSidebarSection } from "./simulation/SimulationSidebarSection";

type SimulationVisualMode = "all" | "factions" | "objectives" | "mobility" | "pressures" | "relations";
type FactionPanelFocus = "summary" | "goals" | "mobility";

const PRESSURE_LABELS: Record<string, string> = {
  criminal: "Criminelle",
  social: "Sociale",
  commercial: "Commerciale",
  military: "Militaire",
  religious: "Religieuse",
  political: "Politique"
};

const RELATION_LABELS: Record<string, string> = {
  ally: "Allie",
  neutral: "Neutre",
  rival: "Rival",
  war: "Guerre"
};

const VISUAL_MODE_HELP: Record<SimulationVisualMode, { label: string; description: string }> = {
  all: {
    label: "Tout",
    description: "Affiche en meme temps la presence des factions, les objectifs, les mobiles, les pressions et les relations."
  },
  factions: {
    label: "Factions",
    description: "Montre les zones de presence. Si une faction est suivie, ses allies, rivaux et ennemis apparaissent aussi sur la carte."
  },
  objectives: {
    label: "Objectifs",
    description: "Montre les points d'action. Si une faction est suivie, seuls ses objectifs sont mis en avant, avec leurs zones de travail."
  },
  mobility: {
    label: "Mobilite",
    description: "Affiche les acteurs mobiles et leurs itineraires pour lire les deplacements et les retards."
  },
  pressures: {
    label: "Pressions",
    description: "Met en avant les points chauds du runtime: villes, routes, quartiers et regions sous tension."
  },
  relations: {
    label: "Relations",
    description: "Affiche les liens entre factions. Plus une faction est suivie, plus son reseau diplomatique ressort clairement."
  }
};

const PANEL_STYLE = editorSurfaceStyles.panel;
const FIELD_STYLE = editorFieldStyles.control;

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatEntityRef(ref: EntityRef | undefined): string {
  if (!ref) return "n/a";
  return `${ref.kind}:${ref.id}`;
}

function getEntityRefKey(ref: EntityRef): string {
  return `${ref.kind}:${ref.id}`;
}

function formatNumber(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function createSimulationLayerVisibility(): Record<MapLayerId, boolean> {
  return {
    background: false,
    grid: false,
    landWater: false,
    territories: true,
    regions: true,
    geographicZones: false,
    cities: true,
    roads: true,
    rivers: true
  };
}

export function WorldMapSimulationScreen(props: {
  layout: WorldMapLayout;
  onOpenEditor: () => void;
  onCloseSimulation: () => void;
}): React.JSX.Element {
  const [layerVisibility, setLayerVisibility] = useState<Record<MapLayerId, boolean>>(createSimulationLayerVisibility());
  const [selectedCellKey, setSelectedCellKey] = useState<string>(getWorldMapCellKey(props.layout.cities[0]?.cell ?? { x: 0, y: 0 }));
  const [selectedFactionId, setSelectedFactionId] = useState<string>(props.layout.simulation?.factions[0]?.id ?? "");
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string>(props.layout.simulation?.specialObjectives[0]?.id ?? "");
  const [selectedMobileActorId, setSelectedMobileActorId] = useState<string>(props.layout.simulation?.mobileActors[0]?.id ?? "");
  const [selectedInspectEntityKey, setSelectedInspectEntityKey] = useState<string>("");
  const [visualMode, setVisualMode] = useState<SimulationVisualMode>("all");
  const [factionPanelFocus, setFactionPanelFocus] = useState<FactionPanelFocus>("summary");
  const [state, setState] = useState<WorldState>(() => createWorldStateFromMapLayout(props.layout));
  const [outputs, setOutputs] = useState<TickOutput[]>([]);
  const [panelMenuOpen, setPanelMenuOpen] = useState(false);
  const [openPanels, setOpenPanels] = useState({
    layers: true,
    legend: true,
    analysis: true
  });
  const panelMenuRef = useRef<HTMLDivElement | null>(null);
  const { wikiEntriesById } = useWikiEntries(props.layout);

  const simulationFactions = props.layout.simulation?.factions ?? [];
  const simulationObjectives = props.layout.simulation?.specialObjectives ?? [];
  const simulationMobileActors = props.layout.simulation?.mobileActors ?? [];

  const selectedFaction = simulationFactions.find(faction => faction.id === selectedFactionId) ?? null;
  const selectedObjective = simulationObjectives.find(objective => objective.id === selectedObjectiveId) ?? null;
  const selectedCell = props.layout.cells.find(cell => getWorldMapCellKey(cell.cell) === selectedCellKey) ?? null;
  const selectedCity =
    props.layout.cities.find(city => getWorldMapCellKey(city.cell) === selectedCellKey) ??
    props.layout.cities.find(city => city.wikiEntityId === selectedCell?.cityWikiId) ??
    null;
  const latestOutput = outputs[outputs.length - 1] ?? null;
  const latestTrace = latestOutput?.trace ?? null;
  const seedSummary = useMemo(() => summarizeSimulationSeed(state), [state]);

  const highlightedCellKeys = useMemo(() => {
    const keys = new Set<string>();
    if (selectedFaction) {
      selectedFaction.presenceCells.forEach(cell => keys.add(getWorldMapCellKey(cell)));
    }
    if (selectedObjective?.anchorCell) {
      keys.add(getWorldMapCellKey(selectedObjective.anchorCell));
    }
    return Array.from(keys);
  }, [selectedFaction, selectedObjective]);

  const topPressureHotspots = useMemo(() => {
    const hotspots: Array<{ kind: string; id: string; pressureType: string; value: number }> = [];
    [
      ...Object.entries(state.pressures.city ?? {}).map(([id, pressures]) => ({ kind: "city", id, pressures })),
      ...Object.entries(state.pressures.district ?? {}).map(([id, pressures]) => ({ kind: "district", id, pressures })),
      ...Object.entries(state.pressures.route ?? {}).map(([id, pressures]) => ({ kind: "route", id, pressures })),
      ...Object.entries(state.pressures.region ?? {}).map(([id, pressures]) => ({ kind: "region", id, pressures }))
    ].forEach(entry => {
      const dominant = Object.entries(entry.pressures).sort((left, right) => (right[1] ?? 0) - (left[1] ?? 0))[0];
      if (!dominant) return;
      const value = Math.round(dominant[1] ?? 0);
      if (value < 18) return;
      hotspots.push({
        kind: entry.kind,
        id: entry.id,
        pressureType: dominant[0],
        value
      });
    });
    return hotspots.sort((left, right) => right.value - left.value).slice(0, 6);
  }, [state.pressures]);

  const dominantPressureBreakdown = useMemo(() => {
    const hotspot = topPressureHotspots[0];
    if (!hotspot || !latestTrace) return null;
    const snapshot = latestTrace.pressureSnapshots.after[hotspot.kind as "city" | "district" | "route" | "region"];
    const evaluations = snapshot?.[hotspot.id] ?? [];
    return evaluations.find(entry => entry.pressureType === hotspot.pressureType) ?? null;
  }, [latestTrace, topPressureHotspots]);
  const pressureEvaluationsByHotspot = useMemo(() => {
    const entries = Object.fromEntries(
      topPressureHotspots.map(hotspot => {
        const snapshot = latestTrace?.pressureSnapshots.after[hotspot.kind as "city" | "district" | "route" | "region"];
        const evaluations = snapshot?.[hotspot.id] ?? [];
        const evaluation = evaluations.find(entry => entry.pressureType === hotspot.pressureType) ?? null;
        return [`${hotspot.kind}:${hotspot.id}:${hotspot.pressureType}`, evaluation] as const;
      })
    );
    return entries as Record<string, typeof dominantPressureBreakdown>;
  }, [latestTrace, topPressureHotspots, dominantPressureBreakdown]);

  const selectedFactionRuntime = selectedFactionId ? state.factions[`faction:map:${selectedFactionId}`] ?? null : null;
  const selectedFactionLogisticsPlan = useMemo(() => {
    if (!selectedFactionRuntime || !latestTrace) return null;
    return latestTrace.logisticsPlans.find(plan => plan.factionId === selectedFactionRuntime.id) ?? null;
  }, [latestTrace, selectedFactionRuntime]);
  const selectedFactionObjectives = useMemo(
    () =>
      selectedFaction
        ? simulationObjectives
            .filter(objective => objective.ownerFactionId === selectedFaction.id)
            .sort((left, right) => right.priority - left.priority)
        : [],
    [selectedFaction, simulationObjectives]
  );
  const selectedFactionMobileActors = useMemo(
    () => (selectedFaction ? simulationMobileActors.filter(actor => actor.ownerFactionId === selectedFaction.id) : []),
    [selectedFaction, simulationMobileActors]
  );

  useEffect(() => {
    setLayerVisibility(createSimulationLayerVisibility());
  }, [props.layout]);

  useEffect(() => {
    if (!selectedFaction) return;
    const mainObjective = selectedFactionObjectives.find(objective => objective.state === "active") ?? selectedFactionObjectives[0] ?? null;
    if (mainObjective) {
      setSelectedObjectiveId(mainObjective.id);
    }
    const mainMobile = selectedFactionMobileActors[0] ?? null;
    if (mainMobile) {
      setSelectedMobileActorId(mainMobile.id);
    }
  }, [selectedFaction, selectedFactionMobileActors, selectedFactionObjectives]);

  const inspectTargets = useMemo(() => {
    const entries: Array<{ key: string; label: string; ref: EntityRef }> = [];
    const seen = new Set<string>();
    function push(ref: EntityRef, label: string) {
      const key = getEntityRefKey(ref);
      if (seen.has(key)) return;
      seen.add(key);
      entries.push({ key, label, ref });
    }

    if (selectedCity) {
      push({ kind: "city", id: selectedCity.id }, `Ville · ${wikiEntriesById[selectedCity.wikiEntityId]?.name ?? selectedCity.wikiEntityId}`);
      Object.values(state.districts)
        .filter(district => district.cityId === selectedCity.id)
        .forEach(district => push({ kind: "district", id: district.id }, `Quartier · ${district.name}`));
    }

    if (selectedCell?.governanceRegionId) {
      const regionLabel =
        props.layout.governanceRegions?.find(region => region.id === selectedCell.governanceRegionId)?.wikiEntityId ??
        selectedCell.governanceRegionId;
      push({ kind: "region", id: selectedCell.governanceRegionId }, `Region · ${regionLabel}`);
    }

    props.layout.paths
      .filter(path => path.cells.some(cell => getWorldMapCellKey(cell) === selectedCellKey))
      .forEach(path => push({ kind: "route", id: path.id }, `Route · ${path.label || path.id}`));

    if (selectedFactionRuntime) {
      push({ kind: "faction", id: selectedFactionRuntime.id }, `Faction · ${selectedFactionRuntime.name}`);
    }

    if (selectedObjectiveId) {
      const runtimeObjectiveId = selectedObjectiveId.startsWith("objective:")
        ? selectedObjectiveId
        : `objective:map:${selectedObjectiveId}`;
      const objective = state.specialObjectives[runtimeObjectiveId];
      if (objective) {
        push({ kind: "specialObjective", id: objective.id }, `Objectif · ${objective.id}`);
      }
    }

    if (selectedMobileActorId) {
      const runtimeMobileId = selectedMobileActorId.startsWith("mobile:")
        ? selectedMobileActorId
        : `mobile:map:${selectedMobileActorId}`;
      const actor = state.mobileActors[runtimeMobileId];
      if (actor) {
        push({ kind: "mobileActor", id: actor.id }, `Mobile · ${actor.id}`);
      }
    }

    return entries;
  }, [
    props.layout.governanceRegions,
    props.layout.paths,
    selectedCell,
    selectedCellKey,
    selectedCity,
    selectedFactionRuntime,
    selectedMobileActorId,
    selectedObjectiveId,
    state.districts,
    state.mobileActors,
    state.specialObjectives,
    wikiEntriesById
  ]);

  const selectedInspectEntity =
    inspectTargets.find(entry => entry.key === selectedInspectEntityKey) ??
    inspectTargets[0] ??
    null;

  const inspectedPressureEvaluations = useMemo(() => {
    if (!selectedInspectEntity || !latestTrace) return [];
    if (
      selectedInspectEntity.ref.kind !== "city" &&
      selectedInspectEntity.ref.kind !== "district" &&
      selectedInspectEntity.ref.kind !== "route" &&
      selectedInspectEntity.ref.kind !== "region"
    ) {
      return [];
    }
    return latestTrace.pressureSnapshots.after[selectedInspectEntity.ref.kind]?.[selectedInspectEntity.ref.id] ?? [];
  }, [latestTrace, selectedInspectEntity]);

  const inspectedActionCandidates = useMemo(() => {
    if (!selectedInspectEntity || !latestTrace) return [];
    return latestTrace.actionCandidates.filter(candidate => {
      const selectedKey = selectedInspectEntity.key;
      return (
        getEntityRefKey(candidate.actorRef) === selectedKey ||
        getEntityRefKey(candidate.targetRef) === selectedKey
      );
    });
  }, [latestTrace, selectedInspectEntity]);

  const inspectedEvents = useMemo(() => {
    if (!selectedInspectEntity || !latestOutput) return [];
    return latestOutput.events.filter(event => {
      const selectedKey = selectedInspectEntity.key;
      return (
        getEntityRefKey(event.actor) === selectedKey ||
        (event.target ? getEntityRefKey(event.target) === selectedKey : false) ||
        event.objectiveId === selectedInspectEntity.ref.id
      );
    });
  }, [latestOutput, selectedInspectEntity]);

  useEffect(() => {
    setSelectedInspectEntityKey(current =>
      inspectTargets.some(entry => entry.key === current) ? current : (inspectTargets[0]?.key ?? "")
    );
  }, [inspectTargets]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent): void {
      if (!panelMenuRef.current?.contains(event.target as Node)) {
        setPanelMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  function resetSimulation() {
    setState(createWorldStateFromMapLayout(props.layout));
    setOutputs([]);
  }

  function runTick(scale: "micro" | "macro") {
    setState(current => {
      const next = cloneState(current);
      const output = runWorldTick(next, scale);
      setOutputs(previous => [...previous, output]);
      return next;
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", minHeight: "100%" }}>
      <MapEditorTopbar
        title={props.layout.title}
        activeToolLabel="Simulation monde"
        activeToolHint="Lis le runtime directement sur la carte, puis lance des ticks micro ou macro sans quitter cette vue."
        persistenceLabel={`Tick ${state.clock.tick} · micro ${state.clock.microTick} · macro ${state.clock.macroTick}`}
        persistenceColor={EDITOR_THEME.colors.accent}
        actions={
          <button type="button" onClick={props.onCloseSimulation} style={createEditorButtonStyle({ compact: true })}>
            Retour carte
          </button>
        }
      />

      <MapCanvas
        layout={props.layout}
        layerVisibility={layerVisibility}
        selectedCellKey={selectedCellKey}
        highlightedCellKeys={highlightedCellKeys}
        featureFade={{ roads: 0.12, rivers: 0.12 }}
        selectedCityId={selectedCity?.id ?? null}
        wikiEntriesById={wikiEntriesById}
        onCellClick={cell => setSelectedCellKey(getWorldMapCellKey(cell))}
        onCityClick={cityId => {
          const city = props.layout.cities.find(entry => entry.id === cityId);
          if (!city) return;
          setSelectedCellKey(getWorldMapCellKey(city.cell));
        }}
        minHeight="calc(100vh - 180px)"
        svgOverlay={
          <WorldSimulationOverlay
            layout={props.layout}
            mode={visualMode}
            selectedFactionId={selectedFactionId}
            selectedObjectiveId={selectedObjectiveId}
            selectedMobileActorId={selectedMobileActorId}
            state={state}
          />
        }
        overlay={
          <>
            <div
              style={{
                position: "absolute",
                right: 16,
                top: 16,
                zIndex: 5,
                width: "min(420px, calc(100vw - 32px))",
                display: "grid",
                gap: 12,
                maxHeight: "calc(100% - 32px)",
                overflowY: "auto",
                overscrollBehavior: "contain",
                scrollbarGutter: "stable",
                paddingRight: 4
              }}
            >
              <section style={PANEL_STYLE}>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Commandes simulation</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: "#c8d0de" }}>
                      <span>Events: {latestOutput?.events.length ?? 0}</span>
                      <span>Deltas: {latestOutput?.deltas.length ?? 0}</span>
                      <span>Rumors: {latestOutput?.rumors.length ?? 0}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12, color: "#c8d0de" }}>Mode visuel: {visualMode}</div>
                    <div ref={panelMenuRef} style={{ position: "relative" }}>
                      <button
                        type="button"
                        onClick={() => setPanelMenuOpen(current => !current)}
                        style={createEditorButtonStyle({ compact: true, active: panelMenuOpen })}
                      >
                        Panneaux
                      </button>
                      {panelMenuOpen && (
                        <div
                          style={{
                            position: "absolute",
                            top: "calc(100% + 8px)",
                            right: 0,
                            minWidth: 180,
                            display: "grid",
                            gap: 8,
                            padding: 10,
                            borderRadius: 12,
                            border: `1px solid ${EDITOR_THEME.colors.border}`,
                            background: EDITOR_THEME.colors.panelBgRaised,
                            boxShadow: "0 12px 32px rgba(0,0,0,0.35)"
                          }}
                        >
                          {([
                            ["layers", "Couches"],
                            ["legend", "Legende"],
                            ["analysis", "Analyse"]
                          ] as const).map(([panelId, label]) => (
                            <label
                              key={panelId}
                              style={{ display: "flex", alignItems: "center", gap: 8, color: EDITOR_THEME.colors.text, fontSize: 13, fontFamily: EDITOR_THEME.fontFamily }}
                            >
                              <input
                                type="checkbox"
                                checked={openPanels[panelId]}
                                onChange={() => setOpenPanels(current => ({ ...current, [panelId]: !current[panelId] }))}
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => runTick("micro")} style={createEditorButtonStyle({ compact: true })}>
                      Micro tick
                    </button>
                    <button type="button" onClick={() => runTick("macro")} style={createEditorButtonStyle({ compact: true, active: true })}>
                      Macro tick
                    </button>
                    <button type="button" onClick={resetSimulation} style={createEditorButtonStyle({ compact: true })}>
                      Reset
                    </button>
                    <button type="button" onClick={props.onOpenEditor} style={createEditorButtonStyle({ compact: true })}>
                      Editer simulation
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {([
                      ["all", "Tout"],
                      ["factions", "Factions"],
                      ["objectives", "Objectifs"],
                      ["mobility", "Mobilite"],
                      ["pressures", "Pressions"],
                      ["relations", "Relations"]
                    ] as const).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setVisualMode(mode)}
                        style={createEditorButtonStyle({ compact: true, active: visualMode === mode })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: "#c8d0de", lineHeight: 1.45 }}>
                    {VISUAL_MODE_HELP[visualMode].description}
                  </div>
                </div>
              </section>

              {openPanels.layers && (
                <section style={PANEL_STYLE}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff", marginBottom: 8 }}>Couches</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                    {(Object.keys(layerVisibility) as MapLayerId[]).map(layerId => (
                      <label key={layerId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#dce5f2" }}>
                        <input type="checkbox" checked={layerVisibility[layerId]} onChange={() => setLayerVisibility(current => ({ ...current, [layerId]: !current[layerId] }))} />
                        {layerId}
                      </label>
                    ))}
                  </div>
                </section>
              )}

              {openPanels.legend && (
                <section style={PANEL_STYLE}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff", marginBottom: 8 }}>Legende toujours visible</div>
                  <div style={{ display: "grid", gap: 8, fontSize: 12, color: "#dce5f2" }}>
                    <div>Factions: cellules teintees avec la couleur de faction et pastille au point d'ancrage.</div>
                    <div>Objectifs: anneau or sur la cible, avec trait depuis la faction suivie vers ses zones de travail.</div>
                    <div>Mobilite: pion colore, avec trace d'itineraire si le mobile est suivi.</div>
                    <div>Pressions: halos et traits colores selon la pression dominante.</div>
                    <div>Relations: liens entre factions, avec couleur selon le statut diplomatique.</div>
                    <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
                      {Object.entries(RELATION_LABELS).map(([status, label]) => (
                        <div key={status} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              width: 18,
                              height: 3,
                              borderRadius: 999,
                              background:
                                status === "ally"
                                  ? "#72c58f"
                                  : status === "neutral"
                                    ? "rgba(220,229,242,0.52)"
                                    : status === "rival"
                                      ? "#d49a52"
                                      : "#c85c5c",
                              display: "inline-block"
                            }}
                          />
                          {label}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "grid", gap: 4, marginTop: 6, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ fontWeight: 700, color: "#f4c967" }}>Lecture rapide</div>
                      <div>1. Choisis une faction pour voir sa zone, ses liens et ses objectifs.</div>
                      <div>2. Passe en `Objectifs` pour voir ou elle agit concretement.</div>
                      <div>3. Clique une case pour lire ce qu'elle contient et ce qui s'y passe.</div>
                    </div>
                  </div>
                </section>
              )}

              {openPanels.analysis && (
                <section style={PANEL_STYLE}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff", marginBottom: 8 }}>Analyse par case</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <SimulationCellAnalysisPanel
                      layout={props.layout}
                      state={state}
                      selectedCellKey={selectedCellKey}
                      latestOutput={latestOutput}
                      wikiEntriesById={wikiEntriesById}
                    />
                    <div style={{ fontSize: 12, color: "#dce5f2" }}>
                      Tick courant: {state.clock.tick} · evenements {latestOutput?.events.length ?? 0} · rumeurs {latestOutput?.rumors.length ?? 0}
                    </div>
                    <div style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#f4c967", marginBottom: 6 }}>Seed runtime</div>
                      <div style={{ display: "grid", gap: 3, fontSize: 12, color: "#dce5f2" }}>
                        <div>Villes: {seedSummary.cityCount}</div>
                        <div>Quartiers: {seedSummary.districtCount}</div>
                        <div>Routes: {seedSummary.routeCount}</div>
                        <div>Regions: {seedSummary.regionCount}</div>
                        <div>Factions: {seedSummary.factionCount}</div>
                        <div>Objectifs: {seedSummary.objectiveCount}</div>
                        <div>Mobiles: {seedSummary.mobileActorCount}</div>
                      </div>
                    </div>
                    {topPressureHotspots.length > 0 ? topPressureHotspots.slice(0, 3).map(entry => (
                      <div key={`analysis:${entry.kind}:${entry.id}:${entry.pressureType}`} style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{entry.kind} {entry.id}</div>
                        <div style={{ fontSize: 12, color: "#dce5f2", marginTop: 4 }}>
                          {PRESSURE_LABELS[entry.pressureType] ?? entry.pressureType} · score {entry.value}
                        </div>
                      </div>
                    )) : (
                      <div style={{ fontSize: 12, color: "#c8d0de" }}>Pas de point chaud notable pour l'instant.</div>
                    )}
                    {dominantPressureBreakdown && (
                      <div style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#f4c967", marginBottom: 6 }}>
                          Pourquoi la pression dominante est elevee
                        </div>
                        <div style={{ fontSize: 12, color: "#dce5f2", marginBottom: 6 }}>
                          {PRESSURE_LABELS[dominantPressureBreakdown.pressureType] ?? dominantPressureBreakdown.pressureType} via `{dominantPressureBreakdown.definitionId}`
                        </div>
                        <div style={{ display: "grid", gap: 4, fontSize: 12, color: "#c8d0de" }}>
                          {dominantPressureBreakdown.terms.map(term => (
                            <div key={`${dominantPressureBreakdown.definitionId}:${term.source}`}>
                              {term.source} {"->"} raw {formatNumber(term.rawValue)} · adj {formatNumber(term.adjustedValue)} · poids {formatNumber(term.weight)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>

            <MapEditorSidebar>
              <SimulationSidebarSection
                title="Factions"
                summary={selectedFaction ? `Faction suivie: ${selectedFaction.label}. Cette section sert a lire son ancrage, son agenda et sa presence sur la carte.` : "Choisir une faction pour afficher son contexte local, ses zones de presence et son role dans la simulation."}
              >
                <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2", marginBottom: 10 }}>
                  Faction suivie
                  <select
                    value={selectedFactionId}
                    onChange={event => {
                      setSelectedFactionId(event.target.value);
                      setFactionPanelFocus("summary");
                      setVisualMode("factions");
                    }}
                    style={FIELD_STYLE}
                  >
                    <option value="">Choisir une faction</option>
                    {simulationFactions.map(faction => (
                      <option key={faction.id} value={faction.id}>
                        {faction.label}
                      </option>
                    ))}
                  </select>
                </label>
                <SimulationFactionAnalysisPanel
                  layout={props.layout}
                  faction={selectedFaction}
                  runtimeFaction={selectedFactionRuntime}
                  logisticsPlan={selectedFactionLogisticsPlan}
                  objectives={simulationObjectives}
                  mobileActors={simulationMobileActors}
                  wikiEntriesById={wikiEntriesById}
                  panelFocus={factionPanelFocus}
                  onFocusPanel={panel => {
                    setFactionPanelFocus(panel);
                    setVisualMode(panel === "goals" ? "objectives" : panel === "mobility" ? "mobility" : "factions");
                  }}
                  onSelectObjective={objectiveId => {
                    setSelectedObjectiveId(objectiveId);
                    setFactionPanelFocus("goals");
                    setVisualMode("objectives");
                  }}
                  onSelectMobileActor={actorId => {
                    setSelectedMobileActorId(actorId);
                    setFactionPanelFocus("mobility");
                    setVisualMode("mobility");
                  }}
                />
              </SimulationSidebarSection>

              <SimulationSidebarSection
                title="Pressions"
                summary={topPressureHotspots.length > 0 ? `${topPressureHotspots.length} point(s) chauds detectes. Cette section sert a comprendre ou le monde pousse vers des evenements.` : "Aucune pression notable pour l'instant. Cette section sert a lire les tensions qui montent dans le monde."}
              >
                <SimulationPressureAnalysisPanel
                  hotspots={topPressureHotspots}
                  evaluationsByEntity={pressureEvaluationsByHotspot}
                />
              </SimulationSidebarSection>

              <SimulationSidebarSection
                title="Entite Inspectee"
                summary={selectedInspectEntity ? `${selectedInspectEntity.label}. Cette section relie une entite aux pressions, candidats d'action et evenements du dernier tick.` : "Selectionne une case ou une faction pour construire le contexte d'inspection."}
              >
                {inspectTargets.length > 0 ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                      Entite suivie
                      <select value={selectedInspectEntityKey} onChange={event => setSelectedInspectEntityKey(event.target.value)} style={FIELD_STYLE}>
                        {inspectTargets.map(entry => (
                          <option key={entry.key} value={entry.key}>
                            {entry.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <SimulationEntityAnalysisPanel
                      selectedEntity={selectedInspectEntity}
                      pressureEvaluations={inspectedPressureEvaluations}
                      actionCandidates={inspectedActionCandidates}
                      events={inspectedEvents}
                      latestOutput={latestOutput}
                    />
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#c8d0de" }}>Selectionne une case ou une faction pour construire le contexte d'inspection.</div>
                )}
              </SimulationSidebarSection>

              <SimulationSidebarSection
                title="Debug de Decision"
                summary={latestTrace ? `${latestTrace.selectedActions.length} action(s) retenue(s) au dernier tick. Cette section sert a comprendre pourquoi le moteur a choisi ces actions.` : "Execute un tick pour afficher la trace de decision."}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: "#f4c967", marginBottom: 8 }}>Decision debug</div>
                {latestTrace ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#dce5f2" }}>Acteurs analyses</div>
                      <div style={{ display: "grid", gap: 4, fontSize: 12, color: "#c8d0de" }}>
                        {latestTrace.actorCandidates.map(candidate => (
                          <div key={`${candidate.actorRef.kind}:${candidate.actorRef.id}`}>
                            {formatEntityRef(candidate.actorRef)} · objectif {candidate.objectiveId ?? "aucun"} · priorite {candidate.priority ?? 0}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#dce5f2" }}>Actions retenues</div>
                      {latestTrace.selectedActions.length > 0 ? (
                        <div style={{ display: "grid", gap: 6, fontSize: 12, color: "#c8d0de" }}>
                          {latestTrace.selectedActions.map(action => (
                            <div key={action.eventId}>
                              {formatEntityRef(action.actorRef)} {"->"} {action.actionId} {"->"} {formatEntityRef(action.targetRef)} · score {formatNumber(action.score)} · {action.success ? "succes" : "echec"}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "#c8d0de" }}>Aucune action retenue sur ce tick.</div>
                      )}
                    </div>

                    <div style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#dce5f2" }}>Candidats rejetes</div>
                      {latestTrace.actionCandidates.filter(candidate => !candidate.passed).length > 0 ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          {latestTrace.actionCandidates
                            .filter(candidate => !candidate.passed)
                            .slice(0, 8)
                            .map(candidate => (
                              <div key={`${candidate.actorRef.id}:${candidate.actionId}:${candidate.targetRef.id}`} style={{ fontSize: 12, color: "#c8d0de" }}>
                                <div>
                                  {formatEntityRef(candidate.actorRef)} {"->"} {candidate.actionId} {"->"} {formatEntityRef(candidate.targetRef)}
                                </div>
                                <div style={{ marginTop: 3, color: "#9fb0c6" }}>
                                  {candidate.rejectionReasons.join(" | ") || "preconditions non satisfaites"}
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "#c8d0de" }}>Aucun rejet sur le dernier tick.</div>
                      )}
                    </div>

                    {latestTrace.mobility.length > 0 && (
                      <div style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#dce5f2" }}>Mobilite</div>
                        <div style={{ display: "grid", gap: 4, fontSize: 12, color: "#c8d0de" }}>
                          {latestTrace.mobility.map(entry => (
                            <div key={`${entry.actorId}:${entry.routeId ?? "none"}:${entry.outcome}`}>
                              {entry.actorId} · {entry.outcome} · {formatNumber(entry.beforeProgress)} {"->"} {formatNumber(entry.afterProgress)} · {entry.notes.join(", ")}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#c8d0de" }}>Execute un tick pour afficher la trace de decision.</div>
                )}
              </SimulationSidebarSection>

              <SimulationSidebarSection
                title="Derniers Evenements"
                summary={latestOutput?.events.length ? `${latestOutput.events.length} evenement(s) sur le dernier tick. Cette section montre les resultats visibles produits par la simulation.` : "Aucun tick execute."}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: "#f4c967", marginBottom: 8 }}>Derniers evenements</div>
                {latestOutput?.events.length ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {latestOutput.events.map(event => (
                      <div key={event.id} style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{event.type}</div>
                        <div style={{ fontSize: 12, color: "#c8d0de", marginTop: 4 }}>
                          acteur `{event.actor.id}` {event.target ? `-> cible \`${event.target.id}\`` : ""} · {event.success ? "succes" : "echec"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#c8d0de" }}>Aucun tick execute.</div>
                )}
              </SimulationSidebarSection>
            </MapEditorSidebar>
          </>
        }
      />
    </div>
  );
}
