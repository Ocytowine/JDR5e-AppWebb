import React, { useEffect, useMemo, useRef, useState } from "react";
import { getWorldMapCellKey, type MapLayerId, type WorldMapLayout } from "../data/worldMapLayout";
import { createWorldStateFromMapLayout, runWorldTick } from "../world-simulation";
import type { TickOutput, WorldState } from "../world-simulation";
import { MapCanvas, useWikiEntries } from "./mapShared";
import { WorldSimulationOverlay } from "./WorldSimulationOverlay";
import { MapEditorSidebar } from "./editor/MapEditorSidebar";
import { MapEditorTopbar } from "./editor/MapEditorTopbar";
import { createEditorButtonStyle, editorFieldStyles, editorSurfaceStyles, EDITOR_THEME } from "./editor/editorTheme";

type SimulationVisualMode = "all" | "factions" | "objectives" | "mobility" | "pressures" | "relations";

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

const PANEL_STYLE = editorSurfaceStyles.panel;
const FIELD_STYLE = editorFieldStyles.control;

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function WorldMapSimulationScreen(props: {
  layout: WorldMapLayout;
  onOpenEditor: () => void;
  onCloseSimulation: () => void;
}): React.JSX.Element {
  const [layerVisibility, setLayerVisibility] = useState<Record<MapLayerId, boolean>>(props.layout.defaultLayers);
  const [selectedCellKey, setSelectedCellKey] = useState<string>(getWorldMapCellKey(props.layout.cities[0]?.cell ?? { x: 0, y: 0 }));
  const [selectedFactionId, setSelectedFactionId] = useState<string>(props.layout.simulation?.factions[0]?.id ?? "");
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string>(props.layout.simulation?.specialObjectives[0]?.id ?? "");
  const [selectedMobileActorId, setSelectedMobileActorId] = useState<string>(props.layout.simulation?.mobileActors[0]?.id ?? "");
  const [visualMode, setVisualMode] = useState<SimulationVisualMode>("all");
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

  const factionStateCards = useMemo(
    () =>
      Object.values(state.factions).map(faction => ({
        faction,
        matchingDefinition: simulationFactions.find(entry => `faction:map:${entry.id}` === faction.id) ?? null
      })),
    [simulationFactions, state.factions]
  );

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

  const selectedFactionRuntime = selectedFactionId ? state.factions[`faction:map:${selectedFactionId}`] ?? null : null;
  const selectedFactionRelations = useMemo(() => {
    if (!selectedFaction) return [];
    return selectedFaction.relations.map(relation => ({
      ...relation,
      targetFaction: simulationFactions.find(entry => entry.id === relation.targetFactionId) ?? null
    }));
  }, [selectedFaction, simulationFactions]);

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
                gap: 12
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
                      ["objectives", "Objectives"],
                      ["mobility", "Mobility"],
                      ["pressures", "Pressures"],
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
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff", marginBottom: 8 }}>Legende</div>
                  <div style={{ display: "grid", gap: 8, fontSize: 12, color: "#dce5f2" }}>
                    <div>Factions: cellules teintees avec la couleur de faction.</div>
                    <div>Objectives: anneau or autour de la zone ou de la cible suivie.</div>
                    <div>Mobility: pion colore, avec trace d'itineraire si le mobile est suivi.</div>
                    <div>Pressures: halos et traits colores selon la pression dominante.</div>
                    <div>Relations: liens entre factions, avec couleur selon le statut.</div>
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
                  </div>
                </section>
              )}

              {openPanels.analysis && (
                <section style={PANEL_STYLE}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff", marginBottom: 8 }}>Analyse</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ fontSize: 12, color: "#dce5f2" }}>
                      Tick courant: {state.clock.tick} · evenements {latestOutput?.events.length ?? 0} · rumeurs {latestOutput?.rumors.length ?? 0}
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
                  </div>
                </section>
              )}
            </div>

            <MapEditorSidebar>
              <section style={PANEL_STYLE}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff", marginBottom: 8 }}>Factions carte</div>
                <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2", marginBottom: 10 }}>
                  Faction suivie
                  <select value={selectedFactionId} onChange={event => setSelectedFactionId(event.target.value)} style={FIELD_STYLE}>
                    <option value="">Choisir une faction</option>
                    {simulationFactions.map(faction => (
                      <option key={faction.id} value={faction.id}>
                        {faction.label}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedFaction ? (
                  <div style={{ display: "grid", gap: 8, fontSize: 12, color: "#dce5f2" }}>
                    <div>Type: {selectedFaction.type}</div>
                    <div>Agenda: {selectedFaction.agenda || "aucun"}</div>
                    <div>Methodes: {selectedFaction.methods.join(", ") || "aucune"}</div>
                    <div>Presence: {selectedFaction.presenceCells.length} cases</div>
                    <div>Ville d'ancrage: {selectedFaction.homeCityId || "aucune"}</div>
                    <div>Relations: {selectedFactionRelations.length}</div>
                    {selectedFactionRuntime && (
                      <>
                        <div>Influence runtime: {Math.round(selectedFactionRuntime.state.influence ?? 0)}</div>
                        <div>Puissance runtime: {Math.round(selectedFactionRuntime.state.power ?? 0)}</div>
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#c8d0de" }}>Aucune faction definie sur la carte.</div>
                )}
              </section>

              <section style={PANEL_STYLE}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff", marginBottom: 8 }}>Relations factionnelles</div>
                {selectedFactionRelations.length > 0 ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {selectedFactionRelations.map(relation => (
                      <button
                        key={`${selectedFaction?.id}:${relation.targetFactionId}`}
                        type="button"
                        onClick={() => setSelectedFactionId(relation.targetFactionId)}
                        style={{
                          padding: 10,
                          borderRadius: 10,
                          textAlign: "left",
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(255,255,255,0.04)",
                          color: "#dce5f2",
                          cursor: "pointer"
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700 }}>
                          {relation.targetFaction?.label ?? relation.targetFactionId}
                        </div>
                        <div style={{ display: "grid", gap: 3, fontSize: 12, marginTop: 4 }}>
                          <div>Statut: {RELATION_LABELS[relation.status] ?? relation.status}</div>
                          <div>Confiance: {relation.trust}</div>
                          <div>Hostilite: {relation.hostility}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#c8d0de" }}>
                    {selectedFaction ? "Aucune relation definie pour cette faction." : "Selectionne une faction pour lire son reseau."}
                  </div>
                )}
              </section>

              <section style={PANEL_STYLE}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff", marginBottom: 8 }}>Etat runtime</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {factionStateCards.length > 0 ? factionStateCards.map(({ faction, matchingDefinition }) => (
                    <div key={faction.id} style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{matchingDefinition?.label ?? faction.name}</div>
                      <div style={{ display: "grid", gap: 3, fontSize: 12, color: "#dce5f2" }}>
                        <div>resources {faction.state.resources ?? 0}</div>
                        <div>power {faction.state.power ?? 0}</div>
                        <div>influence {faction.state.influence ?? 0}</div>
                        <div>cohesion {faction.state.cohesion ?? 0}</div>
                        <div>relations {faction.relations.length}</div>
                      </div>
                    </div>
                  )) : <div style={{ fontSize: 12, color: "#c8d0de" }}>Le runtime ne dispose d'aucune faction active. Ajoute-les dans l'editeur simulation.</div>}
                </div>
              </section>

              <section style={PANEL_STYLE}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff", marginBottom: 8 }}>Pressions actives</div>
                {topPressureHotspots.length > 0 ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {topPressureHotspots.map(entry => (
                      <div key={`${entry.kind}:${entry.id}:${entry.pressureType}`} style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{entry.kind} {entry.id}</div>
                        <div style={{ fontSize: 12, color: "#dce5f2", marginTop: 4 }}>
                          {PRESSURE_LABELS[entry.pressureType] ?? entry.pressureType} · score {entry.value}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#c8d0de" }}>Aucune pression notable pour l'instant.</div>
                )}
              </section>

              <section style={PANEL_STYLE}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff", marginBottom: 8 }}>Objectifs speciaux</div>
                <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2", marginBottom: 10 }}>
                  Objectif suivi
                  <select value={selectedObjectiveId} onChange={event => setSelectedObjectiveId(event.target.value)} style={FIELD_STYLE}>
                    <option value="">Choisir un objectif</option>
                    {simulationObjectives.map(objective => (
                      <option key={objective.id} value={objective.id}>
                        {objective.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div style={{ display: "grid", gap: 8 }}>
                  {Object.values(state.specialObjectives).length > 0 ? Object.values(state.specialObjectives).map(objective => (
                    <button
                      key={objective.id}
                      type="button"
                      onClick={() => setSelectedObjectiveId(objective.id.replace("objective:map:", ""))}
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        textAlign: "left",
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: selectedObjectiveId && objective.id.endsWith(selectedObjectiveId) ? "rgba(244,201,103,0.16)" : "rgba(255,255,255,0.04)",
                        color: "#dce5f2",
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{objective.id}</div>
                      <div style={{ display: "grid", gap: 3, fontSize: 12 }}>
                        <div>categorie {objective.category}</div>
                        <div>etat {objective.state}</div>
                        <div>priorite {objective.priority}</div>
                        <div>progression {objective.progress}</div>
                        <div>cible {objective.target?.id ?? "aucune"}</div>
                      </div>
                    </button>
                  )) : <div style={{ fontSize: 12, color: "#c8d0de" }}>Aucun objectif defini.</div>}
                </div>
              </section>

              <section style={PANEL_STYLE}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff", marginBottom: 8 }}>Acteurs mobiles</div>
                <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2", marginBottom: 10 }}>
                  Mobile suivi
                  <select value={selectedMobileActorId} onChange={event => setSelectedMobileActorId(event.target.value)} style={FIELD_STYLE}>
                    <option value="">Choisir un mobile</option>
                    {simulationMobileActors.map(actor => (
                      <option key={actor.id} value={actor.id}>
                        {actor.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div style={{ display: "grid", gap: 8 }}>
                  {Object.values(state.mobileActors).length > 0 ? Object.values(state.mobileActors).map(actor => (
                    <button
                      key={actor.id}
                      type="button"
                      onClick={() => setSelectedMobileActorId(actor.id.replace("mobile:map:", ""))}
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        textAlign: "left",
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: selectedMobileActorId && actor.id.endsWith(selectedMobileActorId) ? "rgba(119,179,212,0.18)" : "rgba(255,255,255,0.04)",
                        color: "#dce5f2",
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{actor.id}</div>
                      <div style={{ display: "grid", gap: 3, fontSize: 12 }}>
                        <div>type {actor.typeEntity}</div>
                        <div>position {actor.position.id}</div>
                        <div>destination {actor.destination?.id ?? "aucune"}</div>
                        <div>mode {actor.travelMode}</div>
                        <div>vitesse {actor.speed}</div>
                      </div>
                    </button>
                  )) : <div style={{ fontSize: 12, color: "#c8d0de" }}>Aucun acteur mobile defini.</div>}
                </div>
              </section>

              <section style={PANEL_STYLE}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff", marginBottom: 8 }}>Case selectionnee</div>
                <div style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                  <div>Hex: {selectedCellKey}</div>
                  <div>Geographie: {selectedCell?.geography ?? "n/a"}</div>
                  <div>Risque: {selectedCell?.riskLevel ?? "n/a"}</div>
                  <div>Ville: {selectedCity ? wikiEntriesById[selectedCity.wikiEntityId]?.name ?? selectedCity.wikiEntityId : "aucune"}</div>
                </div>
              </section>

              <section style={PANEL_STYLE}>
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
              </section>
            </MapEditorSidebar>
          </>
        }
      />
    </div>
  );
}
