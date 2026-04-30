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
import { formatCooldownValue, formatRejectionReason } from "./simulation/timeFormatting";
import { formatRuntimeMobileProgress } from "./simulation/mobileRuntimeDisplay";

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

function formatStringList(values: string[] | undefined, empty = "aucune"): string {
  return values && values.length > 0 ? values.join(", ") : empty;
}

function getHoursPerMicroTick(state: WorldState): number {
  return Math.max(state.clock.minutesPerMicroTick / 60, 0);
}

function formatDurationHours(hours: number | undefined | null): string {
  if (typeof hours !== "number" || !Number.isFinite(hours)) return "n/a";
  if (hours < 24) return `${hours.toFixed(hours >= 10 ? 0 : 1)} h`;
  const days = hours / 24;
  return `${days.toFixed(days >= 10 ? 0 : 1)} j`;
}

function formatClockTime(state: WorldState): string {
  const elapsedHours = state.clock.microTick * getHoursPerMicroTick(state);
  const roundedHours = Math.max(0, Math.round(elapsedHours));
  const day = Math.floor(roundedHours / 24);
  const hour = roundedHours % 24;
  return `J${day} ${String(hour).padStart(2, "0")}h`;
}

function formatAbsoluteTickTime(tick: number | undefined | null, state: WorldState): string {
  if (typeof tick !== "number" || !Number.isFinite(tick)) return "n/a";
  const hours = tick * getHoursPerMicroTick(state);
  const roundedHours = Math.max(0, Math.round(hours));
  const day = Math.floor(roundedHours / 24);
  const hour = roundedHours % 24;
  return `J${day} ${String(hour).padStart(2, "0")}h`;
}

function formatActionCooldownHours(hours: number | undefined): string {
  if (typeof hours !== "number" || !Number.isFinite(hours)) return "n/a";
  return formatCooldownValue(hours);
}

function formatObjectiveCategoryLabel(category: string | undefined): string {
  const labels: Record<string, string> = {
    search_object: "Recherche d'objet",
    take_control_place: "Prise de controle",
    weaken_rival: "Affaiblir un rival",
    extend_influence: "Etendre l'influence",
    protect_secret: "Proteger un secret",
    recruit_agents: "Recruter",
    acquire_resource: "Acquerir une ressource",
    open_route: "Ouvrir une route",
    eliminate_threat: "Eliminer une menace",
    recover_person: "Recuperer une personne",
    restore_order: "Retablir l'ordre",
    reduce_fear: "Reduire la peur",
    stabilize_supply: "Stabiliser l'approvisionnement",
    secure_corridor: "Securiser le corridor",
    reopen_market: "Relancer le marche",
    contain_unrest: "Contenir les troubles"
  };
  return labels[category ?? ""] ?? (category ? category.replace(/_/g, " ") : "inconnue");
}

function formatObjectiveFamilyLabel(tags: string[] | undefined): string {
  return tags?.includes("system_generated") ? "Systeme" : "Narratif";
}

function formatDeltaKindLabel(kind: string | undefined): string {
  if (kind === "territorial_wear") return "Usure";
  if (kind === "tension_conversion") return "Conversion";
  return "Runtime";
}

function formatObjectiveReadinessReason(reason: string): string {
  const labels: Record<string, string> = {
    missing_active_phase: "Aucune phase active valide n'est definie.",
    missing_required_anchor: "L'ancrage requis pour cette phase est introuvable.",
    missing_required_anchor_type: "Le type d'ancrage requis n'est pas disponible.",
    missing_phase_execution_target: "La cible locale de la phase ne peut pas etre resolue.",
    missing_execution_target: "La cible d'execution de l'objectif ne peut pas etre resolue.",
    missing_required_presence: "La presence requise pour cette phase est absente.",
    phase_failed: "La phase active est en echec.",
    phase_completed: "La phase active est deja terminee.",
    objective_failed: "L'objectif global est en echec.",
    objective_completed: "L'objectif global est deja termine.",
    phase_failure_threshold_blocked: "Le score d'echec de la phase a atteint son seuil de blocage.",
    phase_failure_threshold: "Le score d'echec de la phase a atteint son seuil critique.",
    objective_failure_threshold: "Le score d'echec global a atteint son seuil critique."
  };
  return labels[reason] ?? reason.replace(/_/g, " ");
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
  const selectedCell = props.layout.cells.find(cell => getWorldMapCellKey(cell.cell) === selectedCellKey) ?? null;
  const selectedCity =
    props.layout.cities.find(city => getWorldMapCellKey(city.cell) === selectedCellKey) ??
    props.layout.cities.find(city => city.wikiEntityId === selectedCell?.cityWikiId) ??
    null;
  const latestOutput = outputs[outputs.length - 1] ?? null;
  const latestTrace = latestOutput?.trace ?? null;
  const seedSummary = useMemo(() => summarizeSimulationSeed(state), [state]);

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
  const selectedMobileActorRuntime = selectedMobileActorId ? state.mobileActors[`mobile:map:${selectedMobileActorId}`] ?? null : null;
  const selectedMobileRuntimeSummary = useMemo(
    () => (selectedMobileActorRuntime ? formatRuntimeMobileProgress(props.layout, state, selectedMobileActorRuntime) : null),
    [props.layout, selectedMobileActorRuntime, state]
  );
  const simulationObjectivesByRuntimeId = useMemo(
    () =>
      new Map<string, (typeof simulationObjectives)[number]>(
        simulationObjectives.map(objective => [`objective:map:${objective.id}`, objective] as const)
      ),
    [simulationObjectives]
  );
  const runtimeObjectiveOptions = useMemo(() => {
    return Object.values(state.specialObjectives)
      .map(objective => {
        const sourceObjective = simulationObjectivesByRuntimeId.get(objective.id) ?? null;
        const label = sourceObjective?.label
          ? sourceObjective.label
          : `${formatObjectiveCategoryLabel(objective.category)} · ${objective.target?.id ?? objective.id}`;
        return {
          runtimeId: objective.id,
          label,
          family: formatObjectiveFamilyLabel(objective.tags),
          sourceObjective,
          runtimeObjective: objective
        };
      })
      .sort((left, right) => {
        if (left.family !== right.family) return left.family === "Narratif" ? -1 : 1;
        return right.runtimeObjective.priority - left.runtimeObjective.priority;
      });
  }, [simulationObjectivesByRuntimeId, state.specialObjectives]);
  const selectedObjectiveRuntimeId = useMemo(() => {
    if (!selectedObjectiveId) return "";
    if (selectedObjectiveId.startsWith("objective:")) return selectedObjectiveId;
    return `objective:map:${selectedObjectiveId}`;
  }, [selectedObjectiveId]);
  const selectedObjectiveRuntime = selectedObjectiveRuntimeId ? state.specialObjectives[selectedObjectiveRuntimeId] ?? null : null;
  const selectedObjectiveOption = useMemo(
    () => runtimeObjectiveOptions.find(option => option.runtimeId === selectedObjectiveRuntimeId) ?? null,
    [runtimeObjectiveOptions, selectedObjectiveRuntimeId]
  );
  const selectedObjective = selectedObjectiveOption?.sourceObjective ?? null;
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
  const selectedObjectiveReadiness = useMemo(
    () => (selectedObjectiveRuntime && latestTrace?.objectiveReadiness ? latestTrace.objectiveReadiness.find(entry => entry.objectiveId === selectedObjectiveRuntime.id) ?? null : null),
    [latestTrace?.objectiveReadiness, selectedObjectiveRuntime]
  );
  const selectedObjectiveLogisticsPlan = useMemo(
    () => (selectedObjectiveRuntime && latestTrace ? latestTrace.logisticsPlans.find(plan => plan.objectifId === selectedObjectiveRuntime.id) ?? null : null),
    [latestTrace, selectedObjectiveRuntime]
  );
  const selectedObjectiveAssignedMobileRuntime = useMemo(
    () => (selectedObjectiveLogisticsPlan?.acteurAssigneId ? state.mobileActors[selectedObjectiveLogisticsPlan.acteurAssigneId] ?? null : null),
    [selectedObjectiveLogisticsPlan?.acteurAssigneId, state.mobileActors]
  );
  const selectedObjectiveAssignedMobileSummary = useMemo(
    () => (selectedObjectiveAssignedMobileRuntime ? formatRuntimeMobileProgress(props.layout, state, selectedObjectiveAssignedMobileRuntime) : null),
    [props.layout, selectedObjectiveAssignedMobileRuntime, state]
  );
  const selectedObjectiveDominantPressure = useMemo(() => {
    const executionRef = selectedObjectiveReadiness?.executionTargetRef ?? selectedObjectiveLogisticsPlan?.cibleExecutionRef;
    if (!executionRef) return null;
    if (executionRef.kind !== "city" && executionRef.kind !== "district" && executionRef.kind !== "route" && executionRef.kind !== "region") {
      return null;
    }
    const pressureMap = state.pressures[executionRef.kind]?.[executionRef.id] ?? {};
    const dominant = Object.entries(pressureMap).sort((left, right) => (right[1] ?? 0) - (left[1] ?? 0))[0];
    return dominant ? { type: dominant[0], value: Math.round(dominant[1] ?? 0) } : null;
  }, [selectedObjectiveLogisticsPlan?.cibleExecutionRef, selectedObjectiveReadiness?.executionTargetRef, state.pressures]);
  const selectedObjectivePressureBreakdown = useMemo(() => {
    const executionRef = selectedObjectiveReadiness?.executionTargetRef ?? selectedObjectiveLogisticsPlan?.cibleExecutionRef;
    if (!executionRef || !latestTrace) return null;
    if (executionRef.kind !== "city" && executionRef.kind !== "district" && executionRef.kind !== "route" && executionRef.kind !== "region") {
      return null;
    }
    const evaluations = latestTrace.pressureSnapshots.after[executionRef.kind]?.[executionRef.id] ?? [];
    if (!selectedObjectiveDominantPressure) return null;
    return evaluations.find(entry => entry.pressureType === selectedObjectiveDominantPressure.type) ?? null;
  }, [latestTrace, selectedObjectiveDominantPressure, selectedObjectiveLogisticsPlan?.cibleExecutionRef, selectedObjectiveReadiness?.executionTargetRef]);
  const selectedObjectiveSelectedAction = useMemo(
    () => (selectedObjectiveRuntime && latestTrace ? latestTrace.selectedActions.find(action => action.objectiveId === selectedObjectiveRuntime.id) ?? null : null),
    [latestTrace, selectedObjectiveRuntime]
  );
  const selectedObjectiveActivePhase = useMemo(
    () => (selectedObjectiveRuntime?.phases ?? [])[selectedObjectiveRuntime?.currentPhaseIndex ?? 0] ?? null,
    [selectedObjectiveRuntime]
  );
  const selectedObjectiveActionCandidates = useMemo(
    () => (selectedObjectiveRuntime && latestTrace ? latestTrace.actionCandidates.filter(candidate => candidate.objectiveId === selectedObjectiveRuntime.id) : []),
    [latestTrace, selectedObjectiveRuntime]
  );
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
  const systemObjectiveCounts = useMemo(() => {
    const objectives = Object.values(state.specialObjectives);
    return {
      narrative: objectives.filter(objective => !objective.tags.includes("system_generated")).length,
      system: objectives.filter(objective => objective.tags.includes("system_generated")).length
    };
  }, [state.specialObjectives]);
  const latestWearDeltas = useMemo(
    () => (latestOutput?.deltas ?? []).filter(delta => delta.meta?.kind === "territorial_wear").slice(0, 8),
    [latestOutput?.deltas]
  );
  const latestConversionDeltas = useMemo(
    () => (latestOutput?.deltas ?? []).filter(delta => delta.meta?.kind === "tension_conversion").slice(0, 8),
    [latestOutput?.deltas]
  );
  const territorialCycleSummary = useMemo(() => {
    return Object.values(state.cities)
      .map(city => {
        const guard = state.factions[`faction:system:guard:${city.id}`] ?? null;
        const civic = state.factions[`faction:system:civic:${city.id}`] ?? null;
        const logistics = state.factions[`faction:system:logistics:${city.id}`] ?? null;
        const activeObjectiveIds = [
          ...(guard?.objectives ?? []),
          ...(civic?.objectives ?? []),
          ...(logistics?.objectives ?? [])
        ]
          .map(goal => state.specialObjectives[goal.objectiveId])
          .filter((objective): objective is NonNullable<typeof objective> => Boolean(objective) && objective.state !== "completed" && objective.state !== "failed")
          .sort((left, right) => right.priority - left.priority)
          .slice(0, 3)
          .map(objective => `${formatObjectiveFamilyLabel(objective.tags)} · ${formatObjectiveCategoryLabel(objective.category)} · ${objective.target?.id ?? objective.id}`);
        return {
          cityId: city.id,
          cityName: city.name,
          guardResources: guard?.state.resources ?? null,
          civicResources: civic?.state.resources ?? null,
          logisticsResources: logistics?.state.resources ?? null,
          activeObjectiveIds
        };
      })
      .sort((left, right) => right.activeObjectiveIds.length - left.activeObjectiveIds.length)
      .slice(0, 4);
  }, [state.cities, state.factions, state.specialObjectives]);

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
        activeToolHint="Lis le runtime directement sur la carte, puis avance heure par heure ou cycle par cycle sans quitter cette vue."
        persistenceLabel={`${formatClockTime(state)} · cycle ${state.clock.macroTick} · heure ${state.clock.microTick} · tick ${state.clock.tick}`}
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
            selectedObjectiveId={selectedObjectiveRuntimeId}
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
                      <span>Narratifs: {systemObjectiveCounts.narrative}</span>
                      <span>Systeme: {systemObjectiveCounts.system}</span>
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
                      +1 h
                    </button>
                    <button type="button" onClick={() => runTick("macro")} style={createEditorButtonStyle({ compact: true, active: true })}>
                      +6 h
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
                      Temps courant: {formatClockTime(state)} · evenements {latestOutput?.events.length ?? 0} · rumeurs {latestOutput?.rumors.length ?? 0}
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
                    {selectedMobileActorRuntime && selectedMobileRuntimeSummary ? (
                      <div style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#f4c967", marginBottom: 6 }}>Mobile suivi</div>
                        <div style={{ display: "grid", gap: 3, fontSize: 12, color: "#dce5f2" }}>
                          <div>Reference: {selectedMobileActorRuntime.id}</div>
                          <div>Position runtime: {formatEntityRef(selectedMobileActorRuntime.position)}</div>
                          <div>Route actuelle: {selectedMobileRuntimeSummary.routeLabel ?? "aucune"}</div>
                          <div>Progression: {selectedMobileRuntimeSummary.progressLabel}</div>
                          {selectedMobileRuntimeSummary.remainingLabel ? <div>{selectedMobileRuntimeSummary.remainingLabel}</div> : null}
                          {selectedMobileRuntimeSummary.etaLabel ? <div>{selectedMobileRuntimeSummary.etaLabel}</div> : null}
                          <div>Cap vers: {selectedMobileRuntimeSummary.targetLabel}</div>
                          <div>Destination finale: {formatEntityRef(selectedMobileActorRuntime.destination)}</div>
                          {selectedMobileRuntimeSummary.stopLabel ? <div>{selectedMobileRuntimeSummary.stopLabel}</div> : null}
                        </div>
                      </div>
                    ) : null}
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
                title="Objectif Suivi"
                summary={selectedObjectiveOption ? `${selectedObjectiveOption.label}. Cette section relie l'objectif a ses prerequis, sa projection logistique et le mobile qui le porte.` : "Choisis un objectif pour lire sa faisabilite runtime."}
              >
                {selectedObjectiveRuntime ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                      Objectif suivi
                      <select
                        value={selectedObjectiveRuntimeId}
                        onChange={event => {
                          setSelectedObjectiveId(event.target.value);
                          setVisualMode("objectives");
                        }}
                        style={FIELD_STYLE}
                      >
                        <option value="">Choisir un objectif</option>
                        {runtimeObjectiveOptions.map(objective => (
                          <option key={objective.runtimeId} value={objective.runtimeId}>
                            [{objective.family}] {objective.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div style={{ ...editorSurfaceStyles.subsection, gap: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#f4c967" }}>Diagnostic runtime</div>
                      <div style={{ display: "grid", gap: 3, fontSize: 12, color: "#dce5f2" }}>
                        <div>Famille: {formatObjectiveFamilyLabel(selectedObjectiveRuntime.tags)} · categorie {formatObjectiveCategoryLabel(selectedObjectiveRuntime.category)}</div>
                        <div>Etat: {selectedObjectiveRuntime.state}</div>
                        <div>Phase active: {selectedObjectiveActivePhase ? `${selectedObjectiveRuntime.currentPhaseIndex + 1}. ${selectedObjectiveActivePhase.label}` : "aucune"}</div>
                        <div>Prerequis: {selectedObjectiveReadiness ? (selectedObjectiveReadiness.ready ? "satisfaits" : "bloques") : "pas encore evalues"}</div>
                        <div>Cible globale: {selectedObjective ? (selectedObjective.targetKind && selectedObjective.targetId ? `${selectedObjective.targetKind}:${selectedObjective.targetId}` : "aucune") : formatEntityRef(selectedObjectiveRuntime.target)}</div>
                        <div>Cible locale de phase: {formatEntityRef(selectedObjectiveReadiness?.localTargetRef ?? selectedObjectiveActivePhase?.localTarget)}</div>
                        <div>Cible d'execution: {formatEntityRef(selectedObjectiveReadiness?.executionTargetRef ?? selectedObjectiveLogisticsPlan?.cibleExecutionRef)}</div>
                        <div>Projection logistique: {selectedObjectiveLogisticsPlan ? (selectedObjectiveLogisticsPlan.faisable ? "faisable" : "bloquee") : "aucun plan"}</div>
                        <div>Pression dominante: {selectedObjectiveDominantPressure ? `${selectedObjectiveDominantPressure.type} ${selectedObjectiveDominantPressure.value}` : "aucune"}</div>
                        <div>Echec global: {formatNumber(selectedObjectiveRuntime.failureScore)}/{formatNumber(selectedObjectiveRuntime.maxFailureScore)}</div>
                      </div>
                    </div>
                    {selectedObjectiveActivePhase ? (
                      <div style={{ ...editorSurfaceStyles.subsection, gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#8fb3ff" }}>Phase active</div>
                        <div style={{ display: "grid", gap: 3, fontSize: 12, color: "#dce5f2" }}>
                          <div>Etat: {selectedObjectiveActivePhase.state}</div>
                          <div>Progression: {formatNumber(selectedObjectiveActivePhase.progress)} / {formatNumber(selectedObjectiveActivePhase.completionThreshold)}</div>
                          <div>Poids global: {formatNumber(selectedObjectiveActivePhase.progressWeight)}</div>
                          <div>Echec local: {formatNumber(selectedObjectiveActivePhase.failureScore)} / {formatNumber(selectedObjectiveActivePhase.maxFailureScore)}</div>
                          <div>Completion: {selectedObjectiveActivePhase.completionMode}</div>
                          <div>Failure mode: {selectedObjectiveActivePhase.failureMode}</div>
                          <div>Actions autorisees: {formatStringList(selectedObjectiveActivePhase.compatibleActionIds, "fallback objectif global")}</div>
                          <div>Zones de phase: {formatStringList(selectedObjectiveActivePhase.zoneIds)}</div>
                          <div>Cible locale: {formatEntityRef(selectedObjectiveReadiness?.localTargetRef ?? selectedObjectiveActivePhase.localTarget)}</div>
                          <div>Presence requise: {formatEntityRef(selectedObjectiveActivePhase.requiredPresenceRef)}</div>
                          <div>Ancrage requis: {selectedObjectiveActivePhase.requiredAnchorId ?? selectedObjectiveActivePhase.requiredAnchorType ?? "aucun"}</div>
                          <div>Conditions fatales: {formatStringList(selectedObjectiveActivePhase.fatalFailureConditions)}</div>
                          <div>Notes: {formatStringList(selectedObjectiveActivePhase.notes)}</div>
                        </div>
                      </div>
                    ) : null}
                    {selectedObjectiveRuntime.phases.length > 0 ? (
                      <div style={{ ...editorSurfaceStyles.subsection, gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#f4c967" }}>Pile de phases</div>
                        <div style={{ display: "grid", gap: 6 }}>
                          {selectedObjectiveRuntime.phases.map((phase, index) => {
                            const selected = index === selectedObjectiveRuntime.currentPhaseIndex;
                            return (
                              <div
                                key={`${phase.id}:${index}`}
                                style={{
                                  display: "grid",
                                  gap: 2,
                                  padding: "8px 10px",
                                  borderRadius: 10,
                                  border: selected ? "1px solid rgba(114,197,143,0.45)" : "1px solid rgba(124,142,168,0.24)",
                                  background: selected ? "rgba(17,43,28,0.24)" : "rgba(17,24,39,0.18)",
                                  fontSize: 12,
                                  color: "#dce5f2"
                                }}
                              >
                                <div style={{ fontWeight: 700, color: selected ? "#b9f1c7" : "#eef6ff" }}>
                                  {index + 1}. {phase.label}
                                </div>
                                <div>Etat {phase.state} · progression {formatNumber(phase.progress)}/{formatNumber(phase.completionThreshold)} · echec {formatNumber(phase.failureScore)}/{formatNumber(phase.maxFailureScore)}</div>
                                <div>Actions {formatStringList(phase.compatibleActionIds, "fallback")}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    {selectedObjectiveRuntime.phaseHistory.length > 0 ? (
                      <div style={{ ...editorSurfaceStyles.subsection, gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#8fb3ff" }}>Historique des transitions</div>
                        <div style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                          {[...selectedObjectiveRuntime.phaseHistory].reverse().slice(0, 8).map((entry, index) => (
                            <div
                              key={`${entry.phaseId}:${entry.enteredAtTick}:${index}`}
                              style={{
                                padding: "8px 10px",
                                borderRadius: 10,
                                border: "1px solid rgba(124,142,168,0.24)",
                                background: "rgba(17,24,39,0.18)"
                              }}
                            >
                              <div style={{ fontWeight: 700 }}>{entry.phaseId}</div>
                              <div>Entree {formatAbsoluteTickTime(entry.enteredAtTick, state)}{typeof entry.exitedAtTick === "number" ? ` · sortie ${formatAbsoluteTickTime(entry.exitedAtTick, state)}` : " · phase encore ouverte"}</div>
                              <div>Issue: {entry.outcome ?? "en cours"}</div>
                              <div>Raisons: {formatStringList(entry.reasons, "aucune")}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {selectedObjectiveReadiness?.reasons.length ? (
                      <div style={{ ...editorSurfaceStyles.subsection, gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#ffcfad" }}>Blocages locaux</div>
                        <div style={{ display: "grid", gap: 3, fontSize: 12, color: "#ffd7d7" }}>
                          {selectedObjectiveReadiness.reasons.map(reason => (
                            <div key={reason}>- {formatObjectiveReadinessReason(reason)}</div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {selectedObjectiveLogisticsPlan ? (
                      <div style={{ ...editorSurfaceStyles.subsection, gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#f4c967" }}>Projection</div>
                        <div style={{ display: "grid", gap: 3, fontSize: 12, color: "#dce5f2" }}>
                          <div>Mode: {selectedObjectiveLogisticsPlan.modeRetenu ?? "aucun"}</div>
                          <div>Acteur assigne: {selectedObjectiveLogisticsPlan.acteurAssigneId ?? "aucun"}</div>
                          <div>Temps estime: {formatDurationHours(selectedObjectiveLogisticsPlan.heuresEstimees)}</div>
                          <div>Risque estime: {selectedObjectiveLogisticsPlan.scoreRisque ?? "n/a"}</div>
                          <div>Routes retenues: {selectedObjectiveLogisticsPlan.routeIds.length ? selectedObjectiveLogisticsPlan.routeIds.join(" -> ") : "aucune"}</div>
                        </div>
                        {selectedObjectiveLogisticsPlan.raisonsBlocage.length > 0 ? (
                          <div style={{ display: "grid", gap: 3, fontSize: 12, color: "#ffd7d7" }}>
                            {selectedObjectiveLogisticsPlan.raisonsBlocage.map(reason => (
                              <div key={reason}>- {reason}</div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {selectedObjectivePressureBreakdown ? (
                      <div style={{ ...editorSurfaceStyles.subsection, gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#8fb3ff" }}>Pourquoi la cible attire cette action</div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>
                          {selectedObjectivePressureBreakdown.pressureType} via `{selectedObjectivePressureBreakdown.definitionId}` · score {formatNumber(selectedObjectivePressureBreakdown.clampedValue)}
                        </div>
                        <div style={{ display: "grid", gap: 3, fontSize: 12, color: "#c8d0de" }}>
                          {selectedObjectivePressureBreakdown.terms.map(term => (
                            <div key={`${selectedObjectivePressureBreakdown.definitionId}:${term.source}`}>
                              {term.source} {"->"} raw {formatNumber(term.rawValue)} · adj {formatNumber(term.adjustedValue)} · contribution {formatNumber(term.contribution)}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {selectedObjectiveAssignedMobileRuntime && selectedObjectiveAssignedMobileSummary ? (
                      <div style={{ ...editorSurfaceStyles.subsection, gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#8fb3ff" }}>Mobile engage</div>
                        <div style={{ display: "grid", gap: 3, fontSize: 12, color: "#dce5f2" }}>
                          <div>{selectedObjectiveAssignedMobileRuntime.id}</div>
                          <div>Position runtime: {formatEntityRef(selectedObjectiveAssignedMobileRuntime.position)}</div>
                          <div>{selectedObjectiveAssignedMobileSummary.routeLabel ? `${selectedObjectiveAssignedMobileSummary.routeLabel} · ${selectedObjectiveAssignedMobileSummary.progressLabel}` : "Hors route"}</div>
                          {selectedObjectiveAssignedMobileSummary.remainingLabel ? <div>{selectedObjectiveAssignedMobileSummary.remainingLabel}</div> : null}
                          {selectedObjectiveAssignedMobileSummary.etaLabel ? <div>{selectedObjectiveAssignedMobileSummary.etaLabel}</div> : null}
                          <div>Cap vers: {selectedObjectiveAssignedMobileSummary.targetLabel}</div>
                          {selectedObjectiveAssignedMobileSummary.stopLabel ? <div>{selectedObjectiveAssignedMobileSummary.stopLabel}</div> : null}
                        </div>
                      </div>
                    ) : null}
                    {latestTrace ? (
                      <div style={{ ...editorSurfaceStyles.subsection, gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#f4c967" }}>Decision du dernier cycle horaire</div>
                        {selectedObjectiveSelectedAction ? (
                          <div style={{ display: "grid", gap: 3, fontSize: 12, color: "#dce5f2" }}>
                            <div>Action retenue: {selectedObjectiveSelectedAction.actionId}</div>
                            <div>Phase: {selectedObjectiveSelectedAction.phaseId ?? "aucune"}</div>
                            <div>Acteur: {formatEntityRef(selectedObjectiveSelectedAction.actorRef)}</div>
                            <div>Cible: {formatEntityRef(selectedObjectiveSelectedAction.targetRef)}</div>
                            <div>Score: {formatNumber(selectedObjectiveSelectedAction.score)} · {selectedObjectiveSelectedAction.success ? "succes" : "echec"}</div>
                            {selectedObjectiveSelectedAction.failureScoreApplied ? (
                              <div>Impact echec: +{formatNumber(selectedObjectiveSelectedAction.failureScoreApplied)} score d'echec</div>
                            ) : null}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: "#c8d0de" }}>Aucune action n'a ete retenue pour cet objectif sur le dernier cycle horaire.</div>
                        )}
                        {selectedObjectiveActionCandidates.length > 0 ? (
                          <div style={{ display: "grid", gap: 4, fontSize: 12, color: "#c8d0de" }}>
                            {selectedObjectiveActionCandidates.slice(0, 4).map(candidate => (
                              <div key={`${candidate.actorRef.id}:${candidate.actionId}:${candidate.targetRef.id}`}>
                                {formatEntityRef(candidate.actorRef)} {"->"} {candidate.actionId} · {candidate.passed ? `score ${formatNumber(candidate.score)}` : candidate.rejectionReasons.map(formatRejectionReason).join(" | ")}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#c8d0de" }}>Choisis un objectif pour lire sa faisabilite runtime.</div>
                )}
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
                title="Cycle Territorial"
                summary="Montre, par ville, quel trio public agit encore et quels objectifs systeme ou narratifs restent dominants."
              >
                <div style={{ display: "grid", gap: 8 }}>
                  {territorialCycleSummary.map(entry => (
                    <div
                      key={entry.cityId}
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        display: "grid",
                        gap: 4,
                        fontSize: 12,
                        color: "#dce5f2"
                      }}
                    >
                      <div style={{ fontWeight: 700, color: "#eef6ff" }}>{entry.cityName}</div>
                      <div>Ordre {entry.guardResources ?? "n/a"} · Civique {entry.civicResources ?? "n/a"} · Logistique {entry.logisticsResources ?? "n/a"}</div>
                      <div>Objectifs actifs: {entry.activeObjectiveIds.length > 0 ? entry.activeObjectiveIds.join(" | ") : "aucun"}</div>
                    </div>
                  ))}
                </div>
              </SimulationSidebarSection>

              <SimulationSidebarSection
                title="Entite Inspectee"
                summary={selectedInspectEntity ? `${selectedInspectEntity.label}. Cette section relie une entite aux pressions, candidats d'action et evenements recents.` : "Selectionne une case ou une faction pour construire le contexte d'inspection."}
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
                title="Deltas de Cycle"
                summary={latestOutput ? "Separer l'usure territoriale des conversions de tension aide a comprendre ce que le monde consomme et ce que les actions deplacent." : "Avance le temps pour lire l'usure et les conversions du cycle."}
              >
                {latestOutput ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#dce5f2" }}>Usure territoriale</div>
                      {latestWearDeltas.length > 0 ? (
                        <div style={{ display: "grid", gap: 4, fontSize: 12, color: "#c8d0de" }}>
                          {latestWearDeltas.map((delta, index) => (
                            <div key={`${delta.target.id}:${delta.key}:${index}`}>
                              [{formatDeltaKindLabel(String(delta.meta?.kind ?? ""))}] {formatEntityRef(delta.target)} · {delta.key} {formatNumber(delta.before)} {"->"} {formatNumber(delta.after)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "#c8d0de" }}>Aucune usure marquee sur ce cycle horaire.</div>
                      )}
                    </div>
                    <div style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#dce5f2" }}>Conversions de tension</div>
                      {latestConversionDeltas.length > 0 ? (
                        <div style={{ display: "grid", gap: 4, fontSize: 12, color: "#c8d0de" }}>
                          {latestConversionDeltas.map((delta, index) => (
                            <div key={`${delta.target.id}:${delta.key}:${index}`}>
                              [{formatDeltaKindLabel(String(delta.meta?.kind ?? ""))}] {formatEntityRef(delta.target)} · {delta.key} {formatNumber(delta.before)} {"->"} {formatNumber(delta.after)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "#c8d0de" }}>Aucune conversion marquee sur ce cycle horaire.</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#c8d0de" }}>Avance le temps pour lire l'usure et les conversions du cycle.</div>
                )}
              </SimulationSidebarSection>

              <SimulationSidebarSection
                title="Debug de Decision"
                summary={latestTrace ? `${latestTrace.selectedActions.length} action(s) retenue(s) sur le dernier cycle horaire. Cette section sert a comprendre pourquoi le moteur a choisi ces actions.` : "Avance le temps pour afficher la trace de decision."}
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
                        <div style={{ fontSize: 12, color: "#c8d0de" }}>Aucune action retenue sur ce cycle horaire.</div>
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
                                  {candidate.rejectionReasons.map(formatRejectionReason).join(" | ") || "preconditions non satisfaites"}
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "#c8d0de" }}>Aucun rejet sur le dernier cycle horaire.</div>
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
                  <div style={{ fontSize: 12, color: "#c8d0de" }}>Avance le temps pour afficher la trace de decision.</div>
                )}
              </SimulationSidebarSection>

              <SimulationSidebarSection
                title="Derniers Evenements"
                summary={latestOutput?.events.length ? `${latestOutput.events.length} evenement(s) sur le dernier cycle horaire. Cette section montre les resultats visibles produits par la simulation.` : "Aucun cycle horaire execute."}
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
                  <div style={{ fontSize: 12, color: "#c8d0de" }}>Aucun cycle horaire execute.</div>
                )}
              </SimulationSidebarSection>
            </MapEditorSidebar>
          </>
        }
      />
    </div>
  );
}
