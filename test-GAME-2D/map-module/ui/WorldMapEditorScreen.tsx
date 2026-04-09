import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  createRuntimeWorldMapLayout,
  type GeographicZoneKind,
  getWorldMapCellKey,
  serializeWorldMapLayout,
  type MapCell,
  type MapLayerId,
  type ReliefElevationLevel,
  type SimulationActorLevel,
  type SimulationActorPositionKind,
  type SimulationAnchorTargetKind,
  type SimulationFactionRelationStatus,
  type SimulationMobileItineraryMode,
  type SimulationMobileMissionPriority,
  type SimulationMobileMissionStatus,
  type SimulationObjectiveCategory,
  type SimulationObjectiveTargetKind,
  type SimulationTravelMode,
  type WorldMapCity,
  type WorldMapGeographicZone,
  type WorldMapLayout,
  type WorldMapSimulationConsequence,
  type WorldMapSimulationDistrict,
  type WorldMapSimulationFaction,
  type WorldMapSimulationFactionAnchor,
  type WorldMapSimulationMobileActor,
  type WorldMapSimulationObjective,
  type WorldMapSimulationObjectivePhase,
  type WorldMapLayoutSource,
  type PopulationGroupRole,
  type PopulationProfile
} from "../data/worldMapLayout";
import {
  GEOGRAPHY_PRESET_COLORS,
  MapCanvas,
  TAG_PRESET_COLORS,
  type MapLabelAppearanceSet,
  buildPathPoints,
  getCellCenter,
  getCellPolygon,
  getFrontMatterList,
  cloneLayout,
  fetchWorldMapLayout,
  saveWorldMapLayout,
  useWikiCatalog,
  useWikiEntries
} from "./mapShared";
import { getSharedHexEdge } from "./cliffOverlayHelpers";
import { collectInvalidPathSegments, getAllowedRouteAppendCells, validateLayoutPathRules, validateRouteAppend } from "./mapPathRules";
import { buildCellFeatureIndex, getRiverFlowCategoryLabel, getRiverSourceTypeLabel, getRiverFlowValue } from "./mapTraversal";
import { MapEditorSidebar } from "./editor/MapEditorSidebar";
import { MapSelectionSummary } from "./editor/MapSelectionSummary";
import { MapEditorToolbar } from "./editor/MapEditorToolbar";
import { MapEditorTopbar } from "./editor/MapEditorTopbar";
import { CollapsibleSection } from "./editor/CollapsibleSection";
import { EDITOR_THEME, createEditorButtonStyle, editorFieldStyles, editorSurfaceStyles, editorTextStyles } from "./editor/editorTheme";
import { createInitialMapEditorState } from "./editor/mapEditorInitialState";
import {
  createMapEditorHistoryState,
  mapEditorReducer,
  type EditorToolId,
  type PanelId
} from "./editor/mapEditorReducer";
import { DataPanel } from "./editor/panels/DataPanel";
import { HexPlacesPanel } from "./editor/panels/HexPlacesPanel";
import { HexTerrainPanel } from "./editor/panels/HexTerrainPanel";
import { HexZonesPanel } from "./editor/panels/HexZonesPanel";
import { LayerPanel } from "./editor/panels/LayerPanel";
import { LegendPanel } from "./editor/panels/LegendPanel";
import { SimulationPanel } from "./editor/panels/SimulationPanel";
import {
  buildFactionLogisticsPlans,
  createWorldStateFromMapLayout,
  evaluateObjectiveReadiness,
  recomputePressuresDetailed,
  recomputePressures,
  reinitialiserRessourcesTransport,
  runWorldTick,
  runSimulationPreflight,
  WORLD_ACTION_DEFINITIONS,
  type SimulationPreflightIssue
} from "../world-simulation";
import { findShortestRouteItinerary } from "../world-simulation/travel";
import { SimulationLogisticsPanel } from "./simulation/SimulationLogisticsPanel";
import { formatRuntimeMobileProgress } from "./simulation/mobileRuntimeDisplay";

const PANEL_LABELS: Record<PanelId, string> = {
  legend: "Legende",
  layers: "Couches",
  json: "Donnees"
};

type MobileArchetypePreset = {
  id: string;
  label: string;
  internalType: string;
  defaultMissionLabel: string;
  recommendedSimulationLevel: SimulationActorLevel;
  recommendedInteractionTags: string[];
  stats: Pick<WorldMapSimulationMobileActor, "speed" | "security" | "fatigue" | "cargo" | "headcount" | "resources">;
};

const MOBILE_ARCHETYPE_PRESETS: MobileArchetypePreset[] = [
  {
    id: "patrol",
    label: "Patrouille",
    internalType: "patrol",
    defaultMissionLabel: "Securiser une zone",
    recommendedSimulationLevel: "active",
    recommendedInteractionTags: ["patrol", "security", "escort"],
    stats: { speed: 55, security: 75, fatigue: 25, cargo: 20, headcount: 45, resources: 40 }
  },
  {
    id: "merchant_convoy",
    label: "Convoi marchand",
    internalType: "caravan",
    defaultMissionLabel: "Acheminer des marchandises",
    recommendedSimulationLevel: "active",
    recommendedInteractionTags: ["trade", "escort"],
    stats: { speed: 38, security: 45, fatigue: 20, cargo: 78, headcount: 30, resources: 48 }
  },
  {
    id: "supply_train",
    label: "Train de ravitaillement",
    internalType: "supply_train",
    defaultMissionLabel: "Ravitaillement prioritaire",
    recommendedSimulationLevel: "summary",
    recommendedInteractionTags: ["logistics", "supply"],
    stats: { speed: 34, security: 52, fatigue: 24, cargo: 85, headcount: 36, resources: 62 }
  },
  {
    id: "pilgrims",
    label: "Pelerins",
    internalType: "pilgrims",
    defaultMissionLabel: "Atteindre un lieu de pelerinage",
    recommendedSimulationLevel: "summary",
    recommendedInteractionTags: ["religion", "rumor"],
    stats: { speed: 28, security: 30, fatigue: 35, cargo: 26, headcount: 60, resources: 24 }
  },
  {
    id: "smugglers",
    label: "Contrebandiers",
    internalType: "smugglers",
    defaultMissionLabel: "Faire passer une cargaison",
    recommendedSimulationLevel: "active",
    recommendedInteractionTags: ["smuggling", "stealth", "trade"],
    stats: { speed: 62, security: 42, fatigue: 18, cargo: 46, headcount: 18, resources: 55 }
  },
  {
    id: "couriers",
    label: "Courriers",
    internalType: "courier",
    defaultMissionLabel: "Transmettre un message",
    recommendedSimulationLevel: "summary",
    recommendedInteractionTags: ["message", "escort"],
    stats: { speed: 76, security: 28, fatigue: 14, cargo: 10, headcount: 8, resources: 18 }
  },
  {
    id: "escort",
    label: "Escorte",
    internalType: "escort",
    defaultMissionLabel: "Proteger un autre mobile",
    recommendedSimulationLevel: "active",
    recommendedInteractionTags: ["escort", "security"],
    stats: { speed: 52, security: 70, fatigue: 22, cargo: 18, headcount: 28, resources: 36 }
  },
  {
    id: "scouts",
    label: "Eclaireurs",
    internalType: "scouts",
    defaultMissionLabel: "Reconnaissance",
    recommendedSimulationLevel: "active",
    recommendedInteractionTags: ["scouting", "intel"],
    stats: { speed: 72, security: 36, fatigue: 16, cargo: 12, headcount: 12, resources: 22 }
  }
];

const SIMULATION_LEVEL_PRODUCT_LABELS: Record<SimulationActorLevel, string> = {
  active: "Pion suivi",
  summary: "Unite resumee",
  abstract: "Presence abstraite"
};

const MOBILE_MISSION_PRIORITY_LABELS: Record<SimulationMobileMissionPriority, string> = {
  low: "Basse",
  standard: "Standard",
  high: "Haute",
  critical: "Critique"
};

const MOBILE_MISSION_STATUS_LABELS: Record<SimulationMobileMissionStatus, string> = {
  preparing: "En preparation",
  en_route: "En route",
  on_site: "Sur zone",
  in_action: "En action",
  blocked: "Bloque",
  withdrawing: "En repli",
  completed: "Termine"
};

const MOBILE_ITINERARY_MODE_LABELS: Record<SimulationMobileItineraryMode, string> = {
  auto: "Auto",
  locked: "Verrouille"
};

function sanitizeLayoutSource(value: unknown): WorldMapLayoutSource | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<WorldMapLayoutSource>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.title !== "string" ||
    typeof candidate.backgroundImageKey !== "string" ||
    !candidate.grid ||
    !candidate.defaultLayers ||
    !Array.isArray(candidate.cities) ||
    !Array.isArray(candidate.paths) ||
    !Array.isArray(candidate.cliffSegments ?? []) ||
    !Array.isArray(candidate.cells) ||
    !Array.isArray(candidate.editorPresets?.customGeographies ?? []) ||
    !Array.isArray(candidate.editorPresets?.customTags ?? [])
  ) {
    return null;
  }
  return candidate as WorldMapLayoutSource;
}

function layoutToJson(layout: WorldMapLayout): string {
  return JSON.stringify(serializeWorldMapLayout(layout), null, 2);
}

function withEditorPresets(
  layout: WorldMapLayout,
  customGeographies: Array<{ id: string; label: string; geography: string; color: string; surface: "land" | "ocean"; difficulty: number }>,
  customTags: Array<{ id: string; label: string; color: string }>
): WorldMapLayout {
  return {
    ...layout,
    editorPresets: {
      customGeographies,
      customTags
    }
  };
}

function getSelectedCity(layout: WorldMapLayout, selectedCellKey: string | null): WorldMapCity | null {
  if (!selectedCellKey) return null;
  return layout.cities.find(city => getWorldMapCellKey(city.cell) === selectedCellKey) ?? null;
}

function getCellRoutePlacementHint(layout: WorldMapLayout, cell: MapCell | undefined): { routeId: string; routeLabel: string; index: number; isIntermediate: boolean } | null {
  if (!cell) return null;
  for (const path of layout.paths) {
    if (path.kind !== "road" || path.cells.length === 0) continue;
    const index = path.cells.findIndex(routeCell => routeCell.x === cell.x && routeCell.y === cell.y);
    if (index < 0) continue;
    return {
      routeId: path.id,
      routeLabel: path.label || path.id,
      index,
      isIntermediate: index > 0 && index < path.cells.length - 1
    };
  }
  return null;
}

const UTILITY_PANEL_IDS: PanelId[] = ["legend", "layers", "json"];

function slugifyDraft(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formatPopulationProfile(profile?: PopulationProfile): string {
  if (!profile?.groups?.length) return "";
  return profile.groups
    .map(group => [group.groupId, String(group.weight), group.role].filter(Boolean).join(":"))
    .join(", ");
}

const POPULATION_GROUP_ROLE_OPTIONS: Array<{ value: PopulationGroupRole; label: string }> = [
  { value: "dominant", label: "Dominant" },
  { value: "minority", label: "Minorite" },
  { value: "elite", label: "Elite" },
  { value: "servitor", label: "Serviteur" },
  { value: "outsider", label: "Exterieur" }
];

type PopulationProfileDraft = {
  groupId: string;
  weight: string;
  role: PopulationGroupRole;
};

function buildPopulationProfileInputValue(groups: PopulationProfile["groups"]): string {
  if (!groups.length) return "";
  return groups
    .map(group => [group.groupId, String(group.weight), group.role].filter(Boolean).join(":"))
    .join(", ");
}

function createEmptyPopulationProfileDraft(): PopulationProfileDraft {
  return {
    groupId: "",
    weight: "10",
    role: "minority"
  };
}

function upsertPopulationProfileGroup(profile: PopulationProfile | undefined, draft: PopulationProfileDraft): string {
  const groupId = draft.groupId.trim();
  if (!groupId) return formatPopulationProfile(profile);
  const weight = Math.max(0, Number(draft.weight) || 0);
  const nextGroups = [...(profile?.groups ?? []).filter(group => group.groupId !== groupId), { groupId, weight, role: draft.role }];
  return buildPopulationProfileInputValue(nextGroups);
}

function removePopulationProfileGroup(profile: PopulationProfile | undefined, groupId: string): string {
  const nextGroups = (profile?.groups ?? []).filter(group => group.groupId !== groupId);
  return buildPopulationProfileInputValue(nextGroups);
}

type PopulationProfileFieldProps = {
  profile?: PopulationProfile;
  effectiveProfile?: PopulationProfile;
  effectiveSource: string;
  inheritanceHint: string;
  emptyAddLabel?: string;
  onChange: (value: string) => void;
};

function PopulationProfileField({
  profile,
  effectiveProfile,
  effectiveSource,
  inheritanceHint,
  emptyAddLabel = "Ajouter un groupe",
  onChange
}: PopulationProfileFieldProps) {
  const [draft, setDraft] = useState<PopulationProfileDraft>(createEmptyPopulationProfileDraft);
  const hasOverride = Boolean(profile?.groups?.length);
  const canAddDraft = draft.groupId.trim().length > 0;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gap: 6 }}>
        {(profile?.groups ?? []).length > 0 ? (
          profile!.groups.map(group => (
            <div
              key={group.groupId}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto auto auto",
                gap: 8,
                alignItems: "center",
                padding: "8px 10px",
                borderRadius: 10,
                border: `1px solid ${EDITOR_THEME.colors.border}`,
                background: "rgba(17, 24, 39, 0.22)"
              }}
            >
              <strong style={{ fontSize: 12 }}>{group.groupId}</strong>
              <span style={editorTextStyles.helper}>{group.weight}%</span>
              <span style={editorTextStyles.helper}>
                {POPULATION_GROUP_ROLE_OPTIONS.find(option => option.value === group.role)?.label ?? group.role ?? "Sans role"}
              </span>
              <button
                type="button"
                onClick={() => onChange(removePopulationProfileGroup(profile, group.groupId))}
                style={{ ...createEditorButtonStyle({ danger: true, compact: true }), borderRadius: 8 }}
              >
                Retirer
              </button>
            </div>
          ))
        ) : (
          <div style={editorTextStyles.helper}>{inheritanceHint}</div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) 120px 140px auto", gap: 8 }}>
        <input
          value={draft.groupId}
          onChange={event => setDraft(current => ({ ...current, groupId: event.target.value }))}
          style={FIELD_STYLE}
          placeholder="groupe_id"
        />
        <input
          type="number"
          min={0}
          value={draft.weight}
          onChange={event => setDraft(current => ({ ...current, weight: event.target.value }))}
          style={FIELD_STYLE}
        />
        <select
          value={draft.role}
          onChange={event => setDraft(current => ({ ...current, role: event.target.value as PopulationGroupRole }))}
          style={FIELD_STYLE}
        >
          {POPULATION_GROUP_ROLE_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            onChange(upsertPopulationProfileGroup(profile, draft));
            setDraft(current => ({ ...current, groupId: "", weight: current.weight || "10" }));
          }}
          disabled={!canAddDraft}
          style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: canAddDraft ? 1 : 0.6 }}
        >
          {emptyAddLabel}
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => onChange("")}
          disabled={!hasOverride}
          style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: hasOverride ? 1 : 0.6 }}
        >
          Revenir a l'heritage
        </button>
      </div>
      <div style={editorTextStyles.helper}>
        Profil effectif: {formatPopulationProfile(effectiveProfile) || "aucun"}.
      </div>
      <div style={editorTextStyles.helper}>Source effective: {effectiveSource}.</div>
    </div>
  );
}

function formatSimulationConsequences(consequences?: WorldMapSimulationConsequence[]): string {
  if (!consequences?.length) return "";
  return consequences
    .map(consequence => {
      if (consequence.type === "create_tension") {
        return [consequence.type, consequence.tensionType, String(consequence.severity), consequence.tags.join("|")]
          .filter(Boolean)
          .join(":");
      }
      if (consequence.type === "open_opportunity") {
        return [consequence.type, consequence.kind, String(consequence.score), consequence.tags.join("|")]
          .filter(Boolean)
          .join(":");
      }
      return [consequence.type, consequence.signalKind, String(consequence.intensity), consequence.tags.join("|")]
        .filter(Boolean)
        .join(":");
    })
    .join("\n");
}

function formatListFieldValue(values?: string[]): string {
  return (values ?? []).join(", ");
}

function normalizeListDraftValue(value: string): string {
  return value.trim();
}

function upsertStringListValue(values: string[] | undefined, draft: string): string {
  const normalizedValue = normalizeListDraftValue(draft);
  if (!normalizedValue) return formatListFieldValue(values);
  return formatListFieldValue([...(values ?? []).filter(value => value !== normalizedValue), normalizedValue]);
}

function removeStringListValue(values: string[] | undefined, target: string): string {
  return formatListFieldValue((values ?? []).filter(value => value !== target));
}

type StringListFieldProps = {
  values?: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  emptyHint: string;
  addLabel?: string;
  presetOptions?: string[];
};

function StringListField({
  values,
  onChange,
  placeholder = "Ajouter une valeur",
  emptyHint,
  addLabel = "Ajouter",
  presetOptions
}: StringListFieldProps) {
  const [draft, setDraft] = useState("");
  const normalizedDraft = normalizeListDraftValue(draft);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {(values ?? []).length > 0 ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(values ?? []).map(value => (
            <button
              key={value}
              type="button"
              onClick={() => onChange(removeStringListValue(values, value))}
              style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 999 }}
              title="Retirer cette valeur"
            >
              {value} x
            </button>
          ))}
        </div>
      ) : (
        <div style={editorTextStyles.helper}>{emptyHint}</div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8 }}>
        <input value={draft} onChange={event => setDraft(event.target.value)} style={FIELD_STYLE} placeholder={placeholder} />
        <button
          type="button"
          onClick={() => {
            onChange(upsertStringListValue(values, draft));
            setDraft("");
          }}
          disabled={!normalizedDraft}
          style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: normalizedDraft ? 1 : 0.6 }}
        >
          {addLabel}
        </button>
      </div>
      {presetOptions && presetOptions.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {presetOptions
            .filter(option => !(values ?? []).includes(option))
            .map(option => (
              <button
                key={option}
                type="button"
                onClick={() => onChange(upsertStringListValue(values, option))}
                style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 999 }}
              >
                + {option}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function parseStringListInput(value: string): string[] {
  return value
    .split(",")
    .map(entry => normalizeListDraftValue(entry))
    .filter(Boolean);
}

function formatEntityRefSummary(ref: { kind: string; id: string } | undefined | null): string {
  if (!ref) return "aucune";
  return `${ref.kind}:${ref.id}`;
}

function colorWithAlpha(color: string | undefined, alpha: number, fallback = `rgba(122, 195, 255, ${alpha})`): string {
  if (!color) return fallback;
  const trimmed = color.trim();
  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    const normalized = hex.length === 3
      ? hex.split("").map(char => char + char).join("")
      : hex.length === 6
        ? hex
        : null;
    if (!normalized) return fallback;
    const red = Number.parseInt(normalized.slice(0, 2), 16);
    const green = Number.parseInt(normalized.slice(2, 4), 16);
    const blue = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }
  const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const channels = rgbMatch[1].split(",").map(entry => entry.trim());
    if (channels.length >= 3) {
      return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
    }
  }
  return fallback;
}

type ObjectivePreviewDraft = {
  mode: "create" | "modify";
  ownerFaction: WorldMapSimulationFaction | null;
  objective: WorldMapSimulationObjective | null;
  label: string;
  category: SimulationObjectiveCategory;
  targetKind?: "city" | "district" | "route" | "region" | "faction" | "place";
  targetId?: string;
  zoneIds: string[];
  anchorCell?: MapCell;
};

type ObjectiveMapPreview = ObjectivePreviewDraft & {
  ownerColor: string;
  ownerLabel: string;
  ownerCellKeys: string[];
  targetCellKeys: string[];
  zoneCellKeys: string[];
  anchorCellKey: string | null;
  targetLabel: string | null;
  targetRoute: WorldMapLayout["paths"][number] | null;
};

function formatObjectiveTargetKindLabel(kind: ObjectivePreviewDraft["targetKind"]): string {
  if (kind === "city") return "ville";
  if (kind === "district") return "quartier";
  if (kind === "route") return "route";
  if (kind === "region") return "region";
  if (kind === "faction") return "faction";
  if (kind === "place") return "lieu";
  return "cible";
}

function getMarkerStackOffset(index: number, count: number, radius = 14): { x: number; y: number } {
  if (count <= 1) return { x: 0, y: 0 };
  const angle = (-Math.PI / 2) + (index / count) * Math.PI * 2;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius
  };
}

function createEditorObjectivePhase(label: string, index: number, compatibleActionIds: string[] = []): WorldMapSimulationObjectivePhase {
  return {
    id: slugifyDraft(label) || `phase_${index + 1}`,
    label,
    description: "",
    state: index === 0 ? "active" : "planned",
    zoneIds: [],
    compatibleActionIds,
    completionMode: "progress_threshold",
    completionThreshold: 100,
    progress: 0,
    progressWeight: 1,
    failureScore: 0,
    maxFailureScore: 100,
    failureMode: "score_threshold",
    fatalFailureConditions: [],
    notes: []
  };
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

function formatSimulationTargetRef(ref: { kind: string; id: string } | undefined | null): string {
  if (!ref?.id) return "aucune";
  return `${ref.kind}:${ref.id}`;
}

function isClickableEntityRef(ref: { kind: string; id: string } | undefined | null): boolean {
  return Boolean(ref?.id);
}

function formatDeltaLabel(key: string): string {
  if (key === "objective_progress") return "Progression objectif";
  if (key === "phase_progress") return "Progression phase";
  if (key === "objective_failure") return "Echec objectif";
  if (key === "phase_failure") return "Echec phase";
  if (key === "cooldown") return "Cooldown";
  return key;
}

function getDeltaVisualStyle(amount?: number): React.CSSProperties {
  if ((amount ?? 0) > 0) {
    return {
      border: "1px solid rgba(114,197,143,0.34)",
      background: "rgba(114,197,143,0.12)",
      color: "#b9f1c7"
    };
  }
  if ((amount ?? 0) < 0) {
    return {
      border: "1px solid rgba(200,92,92,0.34)",
      background: "rgba(200,92,92,0.12)",
      color: "#ffcccc"
    };
  }
  return {
    border: "1px solid rgba(124, 142, 168, 0.24)",
    background: "rgba(31, 38, 48, 0.72)",
    color: "#dce5f2"
  };
}

function getProjectionCardStyle(tone: "default" | "accent" | "success" | "warning" = "default"): React.CSSProperties {
  if (tone === "accent") {
    return {
      ...SUBSECTION_STYLE,
      gap: 6,
      border: "1px solid rgba(143,179,255,0.28)",
      background: "linear-gradient(180deg, rgba(36,52,79,0.7), rgba(24,31,41,0.88))"
    };
  }
  if (tone === "success") {
    return {
      ...SUBSECTION_STYLE,
      gap: 6,
      border: "1px solid rgba(114,197,143,0.28)",
      background: "linear-gradient(180deg, rgba(35,67,49,0.44), rgba(24,31,41,0.88))"
    };
  }
  if (tone === "warning") {
    return {
      ...SUBSECTION_STYLE,
      gap: 6,
      border: "1px solid rgba(221,173,86,0.28)",
      background: "linear-gradient(180deg, rgba(88,67,24,0.34), rgba(24,31,41,0.88))"
    };
  }
  return {
    ...SUBSECTION_STYLE,
    gap: 6,
    border: "1px solid rgba(124, 142, 168, 0.24)",
    background: "linear-gradient(180deg, rgba(41,49,61,0.78), rgba(24,31,41,0.9))"
  };
}

function getProjectionSectionTitleStyle(): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.3,
    color: "#dce5f2",
    textTransform: "uppercase"
  };
}

function formatObjectiveConsequenceSummary(consequence: WorldMapSimulationConsequence): string {
  if (consequence.type === "create_tension") {
    return `Tension ${consequence.tensionType} (${consequence.severity})`;
  }
  if (consequence.type === "open_opportunity") {
    return `Opportunite ${consequence.kind} (${consequence.score})`;
  }
  return `Signal ${consequence.signalKind} (${consequence.intensity})`;
}

function formatActionConditionSummary(condition: (typeof WORLD_ACTION_DEFINITIONS)[number]["preconditions"][number]): string {
  if (condition.type === "self_state") return `Etat acteur: ${condition.key} ${condition.op} ${condition.value}`;
  if (condition.type === "target_pressure") return `Pression cible: ${condition.pressure} ${condition.op} ${condition.value}`;
  if (condition.type === "objective_category") return `Categorie objectif: ${condition.category}`;
  return `Tag cible requis: ${condition.tag}`;
}

function formatActionDeltaSummary(delta: (typeof WORLD_ACTION_DEFINITIONS)[number]["successEffects"][number]): string {
  if (delta.type === "state") {
    return `${delta.selector} -> ${delta.key} ${delta.amount >= 0 ? "+" : ""}${delta.amount}`;
  }
  if (delta.type === "objective_progress") {
    return `${delta.selector} -> progression objectif +${delta.amount}`;
  }
  return `${delta.selector} -> cooldown ${delta.actionId} (${delta.ticks})`;
}

function createObjectiveConsequencePreset(
  type: WorldMapSimulationConsequence["type"],
  subtype: string,
  amount: string,
  tags: string[]
): { type: WorldMapSimulationConsequence["type"]; subtype: string; amount: string; tags: string[] } {
  return { type, subtype, amount, tags };
}

function getObjectiveConsequencePresets(
  category: SimulationObjectiveCategory | undefined,
  field: "onSuccess" | "onFailure"
): Array<{ label: string; draft: { type: WorldMapSimulationConsequence["type"]; subtype: string; amount: string; tags: string[] } }> {
  if (category === "open_route") {
    return field === "onSuccess"
      ? [
          { label: "Route plus sure", draft: createObjectiveConsequencePreset("open_opportunity", "scarcity_trade", "58", ["route", "trade"]) },
          { label: "Signal marchand", draft: createObjectiveConsequencePreset("spawn_signal", "market", "36", ["route", "reopened"]) }
        ]
      : [
          { label: "Risque de mobilite", draft: createObjectiveConsequencePreset("create_tension", "mobility_risk", "52", ["route", "unsafe"]) },
          { label: "Signal militaire", draft: createObjectiveConsequencePreset("spawn_signal", "military", "34", ["raid", "route"]) }
        ];
  }
  if (category === "protect_secret") {
    return field === "onSuccess"
      ? [
          { label: "Signal religieux", draft: createObjectiveConsequencePreset("spawn_signal", "religious", "60", ["secret", "ritual"]) },
          { label: "Ouverture d'enquete", draft: createObjectiveConsequencePreset("open_opportunity", "investigation_lead", "44", ["secret", "trace"]) }
        ]
      : [
          { label: "Tension religieuse", draft: createObjectiveConsequencePreset("create_tension", "religious", "56", ["secret", "panic"]) },
          { label: "Signal institutionnel", draft: createObjectiveConsequencePreset("spawn_signal", "institutional", "42", ["leak", "watch"]) }
        ];
  }
  if (category === "search_object") {
    return field === "onSuccess"
      ? [
          { label: "Piste d'investigation", draft: createObjectiveConsequencePreset("open_opportunity", "investigation_lead", "68", ["artifact", "clue"]) },
          { label: "Signal discret", draft: createObjectiveConsequencePreset("spawn_signal", "religious", "48", ["artifact", "ritual"]) }
        ]
      : [
          { label: "Conflit de controle", draft: createObjectiveConsequencePreset("create_tension", "control_conflict", "50", ["artifact", "rivalry"]) },
          { label: "Tension criminelle", draft: createObjectiveConsequencePreset("create_tension", "criminal", "42", ["loot", "hunt"]) }
        ];
  }
  return field === "onSuccess"
    ? [{ label: "Ouverture politique", draft: createObjectiveConsequencePreset("open_opportunity", "political_opening", "40", ["shift"]) }]
    : [{ label: "Tension sociale", draft: createObjectiveConsequencePreset("create_tension", "social", "36", ["backlash"]) }];
}

function getSuggestedActionIdsForObjectiveCategory(category: SimulationObjectiveCategory | undefined): string[] {
  if (!category) return [];
  return WORLD_ACTION_DEFINITIONS
    .filter(action => action.compatibleObjectives.includes(category))
    .map(action => action.id);
}

const SIMULATION_TENSION_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "criminal", label: "Criminelle" },
  { value: "social", label: "Sociale" },
  { value: "commercial", label: "Commerciale" },
  { value: "political", label: "Politique" },
  { value: "religious", label: "Religieuse" },
  { value: "scarcity", label: "Penurie" },
  { value: "control_conflict", label: "Conflit de controle" },
  { value: "mobility_risk", label: "Risque de mobilite" }
];

const SIMULATION_OPPORTUNITY_KIND_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "escort_needed", label: "Besoin d'escorte" },
  { value: "weak_control", label: "Controle faible" },
  { value: "scarcity_trade", label: "Commerce de penurie" },
  { value: "investigation_lead", label: "Piste d'investigation" },
  { value: "political_opening", label: "Ouverture politique" }
];

const SIMULATION_SIGNAL_KIND_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "visual", label: "Visuel" },
  { value: "auditory", label: "Auditif" },
  { value: "institutional", label: "Institutionnel" },
  { value: "market", label: "Marche" },
  { value: "religious", label: "Religieux" },
  { value: "military", label: "Militaire" }
];

const SIMULATION_OBJECTIVE_CATEGORY_OPTIONS: Array<{ value: SimulationObjectiveCategory; label: string }> = [
  { value: "search_object", label: "Recherche d'objet" },
  { value: "take_control_place", label: "Prise de controle" },
  { value: "weaken_rival", label: "Affaiblir un rival" },
  { value: "extend_influence", label: "Etendre l'influence" },
  { value: "protect_secret", label: "Proteger un secret" },
  { value: "recruit_agents", label: "Recruter" },
  { value: "acquire_resource", label: "Acquerir une ressource" },
  { value: "open_route", label: "Ouvrir une route" },
  { value: "eliminate_threat", label: "Eliminer une menace" },
  { value: "recover_person", label: "Recuperer une personne" }
];

const SIMULATION_FACTION_METHOD_SUGGESTIONS = [
  "patrouille",
  "corruption",
  "rituel",
  "espionnage",
  "recrutement",
  "propagande",
  "intimidation",
  "contrebande"
];

const SIMULATION_MOBILE_INTERACTION_TAG_SUGGESTIONS = [
  "trade",
  "escort",
  "patrol",
  "smuggling",
  "ritual",
  "message",
  "recon",
  "combat"
];

function getUniquePathsByKind(layout: WorldMapLayout, kind: "road" | "river") {
  const unique = new Map<string, (typeof layout.paths)[number]>();
  layout.paths.forEach(path => {
    if (path.kind !== kind) return;
    if (!unique.has(path.id)) {
      unique.set(path.id, path);
    }
  });
  return Array.from(unique.values());
}

function getSuggestedObjectivePhases(category: SimulationObjectiveCategory): string[] {
  switch (category) {
    case "search_object":
      return ["collecter_indices", "obtenir_acces", "recuperer_objet"];
    case "take_control_place":
      return ["sonder_la_zone", "neutraliser_resistance", "tenir_la_position"];
    case "weaken_rival":
      return ["identifier_faiblesse", "perturber_reseau", "capitaliser"];
    case "extend_influence":
      return ["ouvrir_contact", "installer_presence", "stabiliser_influence"];
    case "protect_secret":
      return ["identifier_fuite", "verrouiller_acces", "camoufler_traces"];
    case "recruit_agents":
      return ["identifier_profils", "approcher_cibles", "integrer_agents"];
    case "acquire_resource":
      return ["trouver_source", "negocier_ou_prendre", "securiser_stock"];
    case "open_route":
      return ["reconnaitre_trajet", "lever_blocage", "securiser_passage"];
    case "eliminate_threat":
      return ["localiser_menace", "preparer_intervention", "neutraliser"];
    case "recover_person":
      return ["confirmer_position", "obtenir_acces", "extraire_cible"];
    default:
      return [];
  }
}

function buildObjectiveTargetOptionsForKind(
  kind: SimulationObjectiveTargetKind | undefined,
  params: {
    layout: WorldMapLayout;
    simulationFactions: WorldMapSimulationFaction[];
    objectiveDistrictTargetOptions: Array<{ id: string; label: string }>;
    placeTargetOptions: Array<{ id: string; label: string }>;
    roadPaths: ReturnType<typeof getUniquePathsByKind>;
    wikiEntriesById: Record<string, { name?: string }>;
  }
): Array<{ id: string; label: string }> {
  if (!kind) return [];
  if (kind === "city") {
    return params.layout.cities.map(city => ({ id: city.id, label: params.wikiEntriesById[city.wikiEntityId]?.name ?? city.wikiEntityId ?? city.id }));
  }
  if (kind === "district") {
    return params.objectiveDistrictTargetOptions;
  }
  if (kind === "route") {
    return params.roadPaths.map(path => ({ id: path.id, label: path.label || path.id }));
  }
  if (kind === "region") {
    return (params.layout.governanceRegions ?? []).map(region => ({ id: region.id, label: params.wikiEntriesById[region.wikiEntityId]?.name ?? region.wikiEntityId ?? region.id }));
  }
  if (kind === "faction") {
    return params.simulationFactions.map(faction => ({ id: faction.id, label: faction.label || faction.id }));
  }
  if (kind === "place") {
    return params.placeTargetOptions;
  }
  return [];
}

function createObjectivePhasePreset(
  category: SimulationObjectiveCategory,
  objectiveCompatibleActionIds: string[] = []
): WorldMapSimulationObjectivePhase[] {
  const fallbackActions = objectiveCompatibleActionIds.length > 0 ? objectiveCompatibleActionIds : getSuggestedActionIdsForObjectiveCategory(category);
  const actionSet = (...preferred: string[]) => preferred.filter(actionId => fallbackActions.includes(actionId));
  const createPhase = (
    label: string,
    index: number,
    patch: Partial<WorldMapSimulationObjectivePhase> = {}
  ): WorldMapSimulationObjectivePhase => ({
    ...createEditorObjectivePhase(label, index, patch.compatibleActionIds ?? fallbackActions),
    completionThreshold: 100,
    progressWeight: 1,
    ...patch
  });

  switch (category) {
    case "open_route":
      return [
        createPhase("reconnaitre_trajet", 0, { compatibleActionIds: actionSet("investigate", "secure_route"), completionThreshold: 60, notes: ["recon", "corridor"] }),
        createPhase("lever_blocage", 1, { compatibleActionIds: actionSet("secure_route", "patrol"), completionThreshold: 100, maxFailureScore: 70, fatalFailureConditions: ["phase_failure_threshold"] }),
        createPhase("securiser_passage", 2, { compatibleActionIds: actionSet("escort_convoy", "secure_route"), completionThreshold: 80, notes: ["escort", "maintenance"] })
      ];
    case "search_object":
      return [
        createPhase("collecter_indices", 0, { compatibleActionIds: actionSet("investigate"), completionThreshold: 70, notes: ["intel"] }),
        createPhase("obtenir_acces", 1, { compatibleActionIds: actionSet("investigate", "sanctify_site"), completionThreshold: 60, notes: ["entry"] }),
        createPhase("recuperer_objet", 2, { compatibleActionIds: actionSet("investigate", "sanctify_site"), completionThreshold: 100, maxFailureScore: 60, fatalFailureConditions: ["phase_failure_threshold"] })
      ];
    case "protect_secret":
      return [
        createPhase("identifier_fuite", 0, { compatibleActionIds: actionSet("investigate", "patrol"), completionThreshold: 60 }),
        createPhase("verrouiller_acces", 1, { compatibleActionIds: actionSet("patrol", "sanctify_site"), completionThreshold: 70, notes: ["lockdown"] }),
        createPhase("camoufler_traces", 2, { compatibleActionIds: actionSet("sanctify_site", "investigate"), completionThreshold: 80, notes: ["concealment"] })
      ];
    case "take_control_place":
      return [
        createPhase("sonder_la_zone", 0, { compatibleActionIds: actionSet("investigate", "patrol"), completionThreshold: 55 }),
        createPhase("neutraliser_resistance", 1, { compatibleActionIds: actionSet("patrol", "secure_route"), completionThreshold: 85, maxFailureScore: 70 }),
        createPhase("tenir_la_position", 2, { compatibleActionIds: actionSet("patrol", "recruit"), completionThreshold: 75, notes: ["hold"] })
      ];
    case "extend_influence":
      return [
        createPhase("ouvrir_contact", 0, { compatibleActionIds: actionSet("recruit", "investigate"), completionThreshold: 55 }),
        createPhase("installer_presence", 1, { compatibleActionIds: actionSet("recruit", "patrol"), completionThreshold: 75 }),
        createPhase("stabiliser_influence", 2, { compatibleActionIds: actionSet("recruit", "sanctify_site"), completionThreshold: 80 })
      ];
    case "recruit_agents":
      return [
        createPhase("identifier_profils", 0, { compatibleActionIds: actionSet("investigate", "recruit"), completionThreshold: 50 }),
        createPhase("approcher_cibles", 1, { compatibleActionIds: actionSet("recruit"), completionThreshold: 70 }),
        createPhase("integrer_agents", 2, { compatibleActionIds: actionSet("recruit"), completionThreshold: 90, notes: ["integration"] })
      ];
    case "acquire_resource":
      return [
        createPhase("trouver_source", 0, { compatibleActionIds: actionSet("investigate", "secure_route"), completionThreshold: 55 }),
        createPhase("negocier_ou_prendre", 1, { compatibleActionIds: actionSet("extort", "move_resources", "escort_convoy"), completionThreshold: 85 }),
        createPhase("securiser_stock", 2, { compatibleActionIds: actionSet("escort_convoy", "secure_route"), completionThreshold: 70 })
      ];
    case "eliminate_threat":
      return [
        createPhase("localiser_menace", 0, { compatibleActionIds: actionSet("investigate", "patrol"), completionThreshold: 60 }),
        createPhase("preparer_intervention", 1, { compatibleActionIds: actionSet("patrol", "secure_route"), completionThreshold: 65 }),
        createPhase("neutraliser", 2, { compatibleActionIds: actionSet("patrol", "secure_route"), completionThreshold: 100, maxFailureScore: 60, fatalFailureConditions: ["phase_failure_threshold"] })
      ];
    case "recover_person":
      return [
        createPhase("confirmer_position", 0, { compatibleActionIds: actionSet("investigate"), completionThreshold: 60 }),
        createPhase("obtenir_acces", 1, { compatibleActionIds: actionSet("secure_route", "escort_convoy"), completionThreshold: 70 }),
        createPhase("extraire_cible", 2, { compatibleActionIds: actionSet("escort_convoy", "secure_route"), completionThreshold: 100, maxFailureScore: 60 })
      ];
    case "weaken_rival":
      return [
        createPhase("identifier_faiblesse", 0, { compatibleActionIds: actionSet("investigate"), completionThreshold: 55 }),
        createPhase("perturber_reseau", 1, { compatibleActionIds: actionSet("patrol", "secure_route", "extort"), completionThreshold: 80 }),
        createPhase("capitaliser", 2, { compatibleActionIds: actionSet("recruit", "investigate"), completionThreshold: 70 })
      ];
    default:
      return getSuggestedObjectivePhases(category).map((label, index) => createPhase(label, index));
  }
}

const GEOGRAPHY_PRESETS: Array<{ id: string; label: string; geography: string; color: string; surface: "land" | "ocean"; difficulty: number }> = [
  { id: "terre", label: "Terre", geography: "terre", color: "#8c7a58", surface: "land", difficulty: 5 },
  { id: "plaine", label: "Plaine", geography: "plaine", color: GEOGRAPHY_PRESET_COLORS.plaine, surface: "land", difficulty: 5 },
  { id: "colline", label: "Colline", geography: "colline", color: GEOGRAPHY_PRESET_COLORS.colline, surface: "land", difficulty: 6 },
  { id: "foret_claire", label: "Foret claire", geography: "foret_claire", color: GEOGRAPHY_PRESET_COLORS.foret_claire, surface: "land", difficulty: 6 },
  { id: "foret_dense", label: "Foret dense", geography: "foret_dense", color: GEOGRAPHY_PRESET_COLORS.foret_dense, surface: "land", difficulty: 7 },
  { id: "marais", label: "Marais", geography: "marais", color: GEOGRAPHY_PRESET_COLORS.marais, surface: "land", difficulty: 7 },
  { id: "montagne", label: "Montagne", geography: "montagne", color: GEOGRAPHY_PRESET_COLORS.montagne, surface: "land", difficulty: 8 },
  { id: "desert", label: "Desert", geography: "desert", color: GEOGRAPHY_PRESET_COLORS.desert, surface: "land", difficulty: 6 },
  { id: "cote", label: "Cote", geography: "cote", color: GEOGRAPHY_PRESET_COLORS.cote, surface: "land", difficulty: 5 },
  { id: "toundra", label: "Toundra", geography: "toundra", color: GEOGRAPHY_PRESET_COLORS.toundra, surface: "land", difficulty: 6 },
  { id: "jungle", label: "Jungle", geography: "jungle", color: GEOGRAPHY_PRESET_COLORS.jungle, surface: "land", difficulty: 7 },
  { id: "urbain", label: "Urbain", geography: "urbain", color: GEOGRAPHY_PRESET_COLORS.urbain, surface: "land", difficulty: 4 },
  { id: "ocean", label: "Ocean", geography: "ocean", color: GEOGRAPHY_PRESET_COLORS.ocean, surface: "ocean", difficulty: 9 }
];

const TAG_PRESETS: Array<{ id: string; label: string; color: string }> = [
  { id: "maritime", label: "Maritime", color: TAG_PRESET_COLORS.maritime },
  { id: "commerce", label: "Commerce", color: TAG_PRESET_COLORS.commerce },
  { id: "dangereux", label: "Dangereux", color: TAG_PRESET_COLORS.dangereux },
  { id: "sacre", label: "Sacre", color: TAG_PRESET_COLORS.sacre },
  { id: "ruines", label: "Ruines", color: TAG_PRESET_COLORS.ruines },
  { id: "frontalier", label: "Frontalier", color: TAG_PRESET_COLORS.frontalier },
  { id: "agricole", label: "Agricole", color: TAG_PRESET_COLORS.agricole },
  { id: "minier", label: "Minier", color: TAG_PRESET_COLORS.minier },
  { id: "forestier", label: "Forestier", color: TAG_PRESET_COLORS.forestier },
  { id: "urbain", label: "Urbain", color: TAG_PRESET_COLORS.urbain }
];

const FIELD_STYLE: React.CSSProperties = editorFieldStyles.control;

const SUBSECTION_STYLE: React.CSSProperties = editorSurfaceStyles.subsection;

const RESPONSIVE_TWO_COLUMN_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 8
};

const RESPONSIVE_THREE_COLUMN_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 8
};

type EditorStepTabOption = {
  id: string;
  label: string;
};

function EditorStepTabs(props: {
  tabs: EditorStepTabOption[];
  activeTab: string;
  onChange: (tabId: string) => void;
}): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {props.tabs.map(tab => {
        const active = tab.id === props.activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => props.onChange(tab.id)}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: active ? "1px solid rgba(143,179,255,0.58)" : "1px solid rgba(124, 142, 168, 0.32)",
              background: active ? "rgba(79,125,242,0.22)" : "rgba(31, 38, 48, 0.72)",
              color: active ? "#eef3ff" : "#dce5f2",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

const DEFAULT_LABEL_APPEARANCE: MapLabelAppearanceSet = {
  geography: { fontSize: 14, opacity: 0.96, fontFamily: "Georgia, serif", underline: false },
  territory: { fontSize: 22, opacity: 1, fontFamily: "Georgia, serif", underline: false },
  region: { fontSize: 16, opacity: 1, fontFamily: "Georgia, serif", underline: false },
  geographicZone: { fontSize: 15, opacity: 1, fontFamily: "Georgia, serif", underline: false },
  city: { fontSize: 12, opacity: 1, fontFamily: "Georgia, serif", underline: false },
  road: { fontSize: 13, opacity: 1, fontFamily: "Georgia, serif", underline: false },
  river: { fontSize: 13, opacity: 1, fontFamily: "Georgia, serif", underline: false }
};

export function WorldMapEditorScreen(props: {
  initialLayout: WorldMapLayout;
  layoutStorageKey: string;
  onRefreshLayoutCatalog?: () => void;
  onCloseEditor: (layout: WorldMapLayout, layoutStorageKey?: string) => void;
  onLayoutSaved: (layout: WorldMapLayout, layoutStorageKey?: string) => void;
}): React.JSX.Element {
  const [terrainSelectionMode, setTerrainSelectionMode] = useState<"single" | "multi">("single");
  const [editorStore, dispatch] = useReducer(
    mapEditorReducer,
    undefined,
    () => createMapEditorHistoryState(createInitialMapEditorState(props.initialLayout, layoutToJson(props.initialLayout)))
  );
  const [zoneEditSession, setZoneEditSession] = useState<null | { kind: "territory" | "region" | "geographicZone"; id: string; originalCellKeys: string[] }>(null);
  const [footprintFeedback, setFootprintFeedback] = useState<string | null>(null);
  const [labelAppearance, setLabelAppearance] = useState<MapLabelAppearanceSet>(DEFAULT_LABEL_APPEARANCE);
  const [pendingFactionZoneSelections, setPendingFactionZoneSelections] = useState<{
    controlledZoneIds: string;
    influencedZoneIds: string;
    interestZoneIds: string;
    avoidedZoneIds: string;
  }>({
    controlledZoneIds: "",
    influencedZoneIds: "",
    interestZoneIds: "",
    avoidedZoneIds: ""
  });
  const [pendingObjectivePhase, setPendingObjectivePhase] = useState("");
  const [pendingObjectiveObstacle, setPendingObjectiveObstacle] = useState("");
  const [pendingObjectiveActionId, setPendingObjectiveActionId] = useState("");
  const [pendingObjectiveCustomActionId, setPendingObjectiveCustomActionId] = useState("");
  const [pendingObjectiveTag, setPendingObjectiveTag] = useState("");
  const [pendingObjectiveCustomTag, setPendingObjectiveCustomTag] = useState("");
  const [pendingFactionMethod, setPendingFactionMethod] = useState("");
  const [pendingFactionObjectiveHint, setPendingFactionObjectiveHint] = useState("");
  const [pendingFactionTag, setPendingFactionTag] = useState("");
  const [pendingFactionCustomTag, setPendingFactionCustomTag] = useState("");
  const [pendingMobileObjectiveId, setPendingMobileObjectiveId] = useState("");
  const [pendingMobileInteractionTag, setPendingMobileInteractionTag] = useState("");
  const [pendingMobileCustomInteractionTag, setPendingMobileCustomInteractionTag] = useState("");
  const [activeCityEditorTab, setActiveCityEditorTab] = useState<"identity" | "districts" | "references">("identity");
  const [activeFactionEditorTab, setActiveFactionEditorTab] = useState<"identity" | "territory" | "objectives" | "mobiles">("identity");
  const [activeCityCreateTab, setActiveCityCreateTab] = useState<"cell" | "identity" | "create">("cell");
  const [activeFactionCreateTab, setActiveFactionCreateTab] = useState<"identity" | "profile" | "create">("identity");
  const [activeObjectiveCreateTab, setActiveObjectiveCreateTab] = useState<"identity" | "category" | "create">("identity");
  const [activeMobileCreateTab, setActiveMobileCreateTab] = useState<"archetype" | "faction" | "mission" | "travel" | "validate">("archetype");
  const [activeSimulationWorkspace, setActiveSimulationWorkspace] = useState<"inspection" | "factions" | "objectives" | "mobiles">("inspection");
  const [activeFactionMode, setActiveFactionMode] = useState<"create" | "modify">("modify");
  const [activeObjectiveMode, setActiveObjectiveMode] = useState<"create" | "modify">("modify");
  const [activeMobileMode, setActiveMobileMode] = useState<"create" | "modify">("modify");
  const [draftObjectiveOwnerFactionId, setDraftObjectiveOwnerFactionId] = useState("");
  const [draftMobileOwnerFactionId, setDraftMobileOwnerFactionId] = useState("");
  const [mobileBrowseFactionId, setMobileBrowseFactionId] = useState("");
  const [showSelectionPanel, setShowSelectionPanel] = useState(true);
  const [showHexAnalysisPanel, setShowHexAnalysisPanel] = useState(true);
  const [pendingObjectiveConsequences, setPendingObjectiveConsequences] = useState<{
    onSuccess: { type: WorldMapSimulationConsequence["type"]; subtype: string; amount: string; tags: string[] };
    onFailure: { type: WorldMapSimulationConsequence["type"]; subtype: string; amount: string; tags: string[] };
  }>({
    onSuccess: { type: "create_tension", subtype: "criminal", amount: "20", tags: [] },
    onFailure: { type: "create_tension", subtype: "criminal", amount: "20", tags: [] }
  });
  const [territoryPropertiesEditActive, setTerritoryPropertiesEditActive] = useState(false);
  const [territoryPropertyDraft, setTerritoryPropertyDraft] = useState({
    id: "",
    wikiEntityId: "",
    color: "#6b5d90",
    capitalCityId: ""
  });
  const [regionPropertiesEditActive, setRegionPropertiesEditActive] = useState(false);
  const [regionPropertyDraft, setRegionPropertyDraft] = useState({
    id: "",
    wikiEntityId: "",
    color: "#6d8ca0",
    territoryId: "",
    principalCityId: ""
  });
  const [geographicZonePropertiesEditActive, setGeographicZonePropertiesEditActive] = useState(false);
  const [geographicZonePropertyDraft, setGeographicZonePropertyDraft] = useState({
    id: "",
    wikiEntityId: "",
    label: "",
    kind: "natural" as GeographicZoneKind,
    color: "#5d8f7b",
    borderColor: "#5d8f7b",
    borderWidth: "1.6",
    borderDashArray: "5 4"
  });
  const hexModalDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorState = editorStore.present;
  const {
    layout,
    layerVisibility,
    selectedCellKey,
    selectedRouteId,
    routeDrawActive,
    selectedAreaCellKeys,
    activeTool,
    jsonBuffer,
    jsonError,
    openPanels,
    selectedLoreCityId,
    selectedLoreLocationId,
    draftCityName,
    selectedGovernanceTerritoryId,
    selectedGovernanceRegionId,
    selectedGeographicZoneId,
    draftTerritoryId,
    draftTerritoryColor,
    draftRegionId,
    draftRegionColor,
    draftGovernanceId,
    draftGovernanceColor,
    draftGovernanceCapitalCityId,
    draftGeographicZoneId,
    draftGeographicZoneLabel,
    draftGeographicZoneColor,
    draftGeographicZoneBorderColor,
    draftGeographicZoneBorderWidth,
    draftGeographicZoneBorderDashArray,
    draftGeographicZoneKind,
    selectedGovernanceLoreId,
    selectedGeographicZoneLoreId,
    hexModalPosition,
    customGeographies,
    customTags,
    draftGeographyName,
    draftGeographyColor,
    draftGeographySurface,
    draftGeographyDifficulty,
    draftTagName,
    draftTagColor,
    selectedSimulationFactionId,
    draftSimulationFactionId,
    draftSimulationFactionLabel,
    draftSimulationFactionType,
    draftSimulationFactionColor,
    draftSimulationRelationTargetFactionId,
    draftSimulationRelationStatus,
    selectedSimulationObjectiveId,
    draftSimulationObjectiveId,
    draftSimulationObjectiveLabel,
    draftSimulationObjectiveCategory,
    selectedSimulationMobileActorId,
    draftSimulationMobileActorId,
    draftSimulationMobileActorLabel,
    draftSimulationMobileActorType,
    draftSimulationMobileActorArchetype,
    draftSimulationMobileActorColor,
    pendingGeographyId,
    pendingReliefElevation,
    pendingTagIds,
    persistenceState,
    lastSavedLayoutJson
  } = editorState;
  const { wikiEntriesById, wikiLoading, wikiError } = useWikiEntries(layout);
  const { wikiCatalog, wikiCatalogLoading, wikiCatalogError } = useWikiCatalog();

  const selectedCell = useMemo(() => {
    return layout.cells.find(cell => getWorldMapCellKey(cell.cell) === selectedCellKey) ?? null;
  }, [layout.cells, selectedCellKey]);

  const selectedCity = useMemo(() => getSelectedCity(layout, selectedCellKey), [layout, selectedCellKey]);
  const selectedCityWiki = selectedCity?.wikiEntityId ? wikiEntriesById[selectedCity.wikiEntityId] : null;
  const selectedGovernanceTerritory = useMemo(
    () => layout.governanceTerritories?.find(entry => entry.id === selectedGovernanceTerritoryId) ?? null,
    [layout.governanceTerritories, selectedGovernanceTerritoryId]
  );
  const selectedGovernanceRegion = useMemo(
    () => layout.governanceRegions?.find(entry => entry.id === selectedGovernanceRegionId) ?? null,
    [layout.governanceRegions, selectedGovernanceRegionId]
  );
  const selectedGeographicZone = useMemo(
    () => layout.geographicZones?.find(entry => entry.id === selectedGeographicZoneId) ?? null,
    [layout.geographicZones, selectedGeographicZoneId]
  );
  const selectedTerritoryWiki = selectedGovernanceTerritory?.wikiEntityId ? wikiEntriesById[selectedGovernanceTerritory.wikiEntityId] : null;
  const selectedRegionWiki = selectedGovernanceRegion?.wikiEntityId ? wikiEntriesById[selectedGovernanceRegion.wikiEntityId] : null;
  const selectedTerritoryGovernance = useMemo(
    () =>
      selectedGovernanceTerritory?.governanceId
        ? layout.governances?.find(entry => entry.id === selectedGovernanceTerritory.governanceId) ?? null
        : null,
    [layout.governances, selectedGovernanceTerritory]
  );
  const selectedTerritoryCapital = useMemo(
    () =>
      selectedTerritoryGovernance?.capitalCityId
        ? layout.cities.find(city => city.id === selectedTerritoryGovernance.capitalCityId) ?? null
        : null,
    [layout.cities, selectedTerritoryGovernance]
  );
  const selectedTerritoryRegions = useMemo(
    () => (layout.governanceRegions ?? []).filter(entry => entry.territoryId === selectedGovernanceTerritoryId),
    [layout.governanceRegions, selectedGovernanceTerritoryId]
  );
  const selectedTerritoryCellKeys = useMemo(
    () =>
      layout.cells
        .filter(cell => cell.governanceTerritoryId === selectedGovernanceTerritoryId)
        .map(cell => getWorldMapCellKey(cell.cell)),
    [layout.cells, selectedGovernanceTerritoryId]
  );
  const selectedRegionCellKeys = useMemo(
    () =>
      layout.cells
        .filter(cell => cell.governanceRegionId === selectedGovernanceRegionId)
        .map(cell => getWorldMapCellKey(cell.cell)),
    [layout.cells, selectedGovernanceRegionId]
  );
  const selectedRegionPrincipalCity = useMemo(
    () =>
      selectedGovernanceRegion?.principalCityId
        ? layout.cities.find(city => city.id === selectedGovernanceRegion.principalCityId) ?? null
        : null,
    [layout.cities, selectedGovernanceRegion]
  );
  const selectedGeographicZoneCellKeys = useMemo(
    () =>
      layout.cells
        .filter(cell => (cell.geographicZoneIds ?? []).includes(selectedGeographicZoneId))
        .map(cell => getWorldMapCellKey(cell.cell)),
    [layout.cells, selectedGeographicZoneId]
  );
  const selectedGeographicZones = useMemo(
    () =>
      (selectedCell?.geographicZoneIds ?? [])
        .map(zoneId => layout.geographicZones?.find(entry => entry.id === zoneId) ?? null)
        .filter((entry): entry is WorldMapGeographicZone => Boolean(entry)),
    [layout.geographicZones, selectedCell]
  );
  const selectedRoute = layout.paths.find(path => path.id === selectedRouteId) ?? null;
  const simulationFactions = layout.simulation?.factions ?? [];
  const simulationObjectives = layout.simulation?.specialObjectives ?? [];
  const simulationMobileActors = layout.simulation?.mobileActors ?? [];
  const simulationDistrictDefinitions = layout.simulation?.districts ?? [];
  const selectedSimulationFaction = useMemo(
    () => simulationFactions.find(faction => faction.id === selectedSimulationFactionId) ?? null,
    [selectedSimulationFactionId, simulationFactions]
  );
  const selectedCellSimulationFactions = useMemo(() => {
    if (!selectedCell) return [];
    const selectedKey = getWorldMapCellKey(selectedCell.cell);
    return simulationFactions
      .filter(faction => faction.presenceCells.some(cell => getWorldMapCellKey(cell) === selectedKey))
      .map(faction => faction.label);
  }, [selectedCell, simulationFactions]);
  const selectedSimulationFactionPresenceCellKeys = useMemo(
    () => selectedSimulationFaction?.presenceCells.map(cell => getWorldMapCellKey(cell)) ?? [],
    [selectedSimulationFaction]
  );
  const selectedSimulationObjective = useMemo(
    () => simulationObjectives.find(objective => objective.id === selectedSimulationObjectiveId) ?? null,
    [selectedSimulationObjectiveId, simulationObjectives]
  );
  const selectedSimulationMobileActor = useMemo(
    () => simulationMobileActors.find(actor => actor.id === selectedSimulationMobileActorId) ?? null,
    [selectedSimulationMobileActorId, simulationMobileActors]
  );
  const effectiveObjectiveOwnerFactionId = draftObjectiveOwnerFactionId || selectedSimulationFactionId || simulationFactions[0]?.id || "";
  const effectiveMobileOwnerFactionId = draftMobileOwnerFactionId || selectedSimulationFactionId || simulationFactions[0]?.id || "";
  const effectiveMobileBrowseFactionId = mobileBrowseFactionId || selectedSimulationFactionId || simulationFactions[0]?.id || "";
  const selectedObjectiveOwnerFaction = useMemo(
    () => simulationFactions.find(faction => faction.id === effectiveObjectiveOwnerFactionId) ?? null,
    [effectiveObjectiveOwnerFactionId, simulationFactions]
  );
  const selectedMobileOwnerFaction = useMemo(
    () => simulationFactions.find(faction => faction.id === effectiveMobileOwnerFactionId) ?? null,
    [effectiveMobileOwnerFactionId, simulationFactions]
  );
  const mobileBrowseFaction = useMemo(
    () => simulationFactions.find(faction => faction.id === effectiveMobileBrowseFactionId) ?? null,
    [effectiveMobileBrowseFactionId, simulationFactions]
  );
  const objectivesForSelectedOwnerFaction = useMemo(
    () => simulationObjectives.filter(objective => objective.ownerFactionId === effectiveObjectiveOwnerFactionId),
    [effectiveObjectiveOwnerFactionId, simulationObjectives]
  );
  const mobilesForBrowseFaction = useMemo(
    () => simulationMobileActors.filter(actor => actor.ownerFactionId === effectiveMobileBrowseFactionId),
    [effectiveMobileBrowseFactionId, simulationMobileActors]
  );
  const objectivePreviewSelectionCellKeys = useMemo(
    () => (selectedAreaCellKeys.length > 0 ? selectedAreaCellKeys : selectedCellKey ? [selectedCellKey] : []),
    [selectedAreaCellKeys, selectedCellKey]
  );
  const roadPaths = useMemo(() => getUniquePathsByKind(layout, "road"), [layout]);
  const riverPaths = useMemo(() => getUniquePathsByKind(layout, "river"), [layout]);
  const simulationPreflight = useMemo(() => runSimulationPreflight(layout), [layout]);
  const topPreflightIssues = useMemo(() => simulationPreflight.issues.slice(0, 12), [simulationPreflight]);
  const simulationDistricts = useMemo(
    () => Object.values(createWorldStateFromMapLayout(layout).districts),
    [layout]
  );
  const placeTargetOptions = useMemo(
    () => Array.from(
      new Map(
        layout.cells
          .flatMap(cell => cell.locationWikiIds ?? [])
          .filter(Boolean)
          .map(locationId => [locationId, wikiEntriesById[locationId]?.name ?? locationId])
      ).entries()
    ).map(([id, label]) => ({ id, label })),
    [layout.cells, wikiEntriesById]
  );
  const objectiveDistrictTargetOptions = useMemo(
    () =>
      simulationDistricts
        .map(district => ({ id: district.id, label: district.name }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [simulationDistricts]
  );
  const objectiveTargetOptions = useMemo(() => {
    return buildObjectiveTargetOptionsForKind(selectedSimulationObjective?.targetKind, {
      layout,
      simulationFactions,
      objectiveDistrictTargetOptions,
      placeTargetOptions,
      roadPaths,
      wikiEntriesById
    });
  }, [layout.cities, layout.governanceRegions, objectiveDistrictTargetOptions, placeTargetOptions, roadPaths, selectedSimulationObjective?.targetKind, simulationFactions, wikiEntriesById]);
  const objectiveCompatibleActionOptions = useMemo(
    () =>
      WORLD_ACTION_DEFINITIONS
        .filter(action => !selectedSimulationObjective || action.compatibleObjectives.includes(selectedSimulationObjective.category))
        .map(action => ({ id: action.id, label: `${action.label} (${action.id})` })),
    [selectedSimulationObjective]
  );
  const selectedObjectiveActionDefinitions = useMemo(
    () =>
      WORLD_ACTION_DEFINITIONS.filter(action => selectedSimulationObjective?.compatibleActionIds.includes(action.id)),
    [selectedSimulationObjective]
  );
  const availableAnchorTypeOptions = useMemo(
    () =>
      Array.from(
        new Set([
          "safehouse",
          "temple",
          "contact",
          "warehouse",
          "outpost",
          ...((selectedSimulationFaction?.localAnchors ?? []).map(anchor => anchor.type).filter(Boolean))
        ])
      ),
    [selectedSimulationFaction]
  );
  function getPhaseTargetOptions(kind: SimulationObjectiveTargetKind | undefined) {
    return buildObjectiveTargetOptionsForKind(kind, {
      layout,
      simulationFactions,
      objectiveDistrictTargetOptions,
      placeTargetOptions,
      roadPaths,
      wikiEntriesById
    });
  }
  const draftObjectivePreview = useMemo<ObjectivePreviewDraft | null>(() => {
    if (activeSimulationWorkspace !== "objectives" || activeObjectiveMode !== "create") return null;
    const ownerFaction = selectedObjectiveOwnerFaction;
    if (!ownerFaction && !draftSimulationObjectiveId.trim() && !draftSimulationObjectiveLabel.trim()) return null;
    const targetKind =
      selectedCity?.id
        ? "city"
        : selectedRoute?.kind === "road"
          ? "route"
          : selectedGovernanceRegionId
            ? "region"
            : undefined;
    const targetId =
      targetKind === "city"
        ? selectedCity?.id
        : targetKind === "route"
          ? selectedRoute?.id
          : targetKind === "region"
            ? selectedGovernanceRegionId
            : undefined;
    return {
      mode: "create" as const,
      ownerFaction,
      objective: null,
      label: draftSimulationObjectiveLabel.trim() || draftSimulationObjectiveId.trim() || "Objectif en creation",
      category: draftSimulationObjectiveCategory,
      targetKind,
      targetId,
      zoneIds: objectivePreviewSelectionCellKeys,
      anchorCell: selectedCell?.cell ? { ...selectedCell.cell } : undefined
    };
  }, [
    activeObjectiveMode,
    activeSimulationWorkspace,
    draftSimulationObjectiveCategory,
    draftSimulationObjectiveId,
    draftSimulationObjectiveLabel,
    objectivePreviewSelectionCellKeys,
    selectedCell,
    selectedCity,
    selectedGovernanceRegionId,
    selectedObjectiveOwnerFaction,
    selectedRoute
  ]);
  const selectedObjectivePreview = useMemo<ObjectivePreviewDraft | null>(() => {
    if (activeSimulationWorkspace !== "objectives" || activeObjectiveMode !== "modify" || !selectedSimulationObjective) return null;
    return {
      mode: "modify" as const,
      ownerFaction: selectedObjectiveOwnerFaction,
      objective: selectedSimulationObjective,
      label: selectedSimulationObjective.label,
      category: selectedSimulationObjective.category,
      targetKind: selectedSimulationObjective.targetKind,
      targetId: selectedSimulationObjective.targetId,
      zoneIds: selectedSimulationObjective.zoneIds,
      anchorCell: selectedSimulationObjective.anchorCell
    };
  }, [activeObjectiveMode, activeSimulationWorkspace, selectedObjectiveOwnerFaction, selectedSimulationObjective]);
  const objectiveMapPreview = useMemo<ObjectiveMapPreview | null>(() => {
    const preview = selectedObjectivePreview ?? draftObjectivePreview;
    if (!preview) return null;
    const ownerFaction = preview.ownerFaction;
    const ownerCellKeys = Array.from(
      new Set([
        ...(ownerFaction?.presenceCells.map(cell => getWorldMapCellKey(cell)) ?? []),
        ...(ownerFaction?.baseCell ? [getWorldMapCellKey(ownerFaction.baseCell)] : []),
        ...(ownerFaction?.homeCityId
          ? layout.cities
              .filter(city => city.id === ownerFaction.homeCityId)
              .map(city => getWorldMapCellKey(city.cell))
          : []),
        ...(ownerFaction?.homeRegionId
          ? layout.cells
              .filter(cell => cell.governanceRegionId === ownerFaction.homeRegionId)
              .map(cell => getWorldMapCellKey(cell.cell))
          : [])
      ])
    );
    const targetCellKeys = (() => {
      if (!preview.targetKind || !preview.targetId) return [];
      if (preview.targetKind === "city") {
        return layout.cities
          .filter(city => city.id === preview.targetId)
          .map(city => getWorldMapCellKey(city.cell));
      }
      if (preview.targetKind === "district") {
        return simulationDistrictDefinitions.find(district => district.id === preview.targetId)?.cellKeys ?? [];
      }
      if (preview.targetKind === "route") {
        return roadPaths
          .find(path => path.id === preview.targetId)
          ?.cells.map(cell => getWorldMapCellKey(cell)) ?? [];
      }
      if (preview.targetKind === "region") {
        return layout.cells
          .filter(cell => cell.governanceRegionId === preview.targetId)
          .map(cell => getWorldMapCellKey(cell.cell));
      }
      if (preview.targetKind === "faction") {
        const targetFaction = simulationFactions.find(faction => faction.id === preview.targetId);
        return Array.from(
          new Set([
            ...(targetFaction?.presenceCells.map(cell => getWorldMapCellKey(cell)) ?? []),
            ...(targetFaction?.baseCell ? [getWorldMapCellKey(targetFaction.baseCell)] : [])
          ])
        );
      }
      if (preview.targetKind === "place") {
        return layout.cells
          .filter(cell => (cell.locationWikiIds ?? []).includes(preview.targetId ?? ""))
          .map(cell => getWorldMapCellKey(cell.cell));
      }
      return [];
    })();
    const targetRoute = preview.targetKind === "route"
      ? roadPaths.find(path => path.id === preview.targetId) ?? null
      : null;
    const anchorCellKey = preview.anchorCell ? getWorldMapCellKey(preview.anchorCell) : null;
    const targetLabel =
      preview.targetKind && preview.targetId
        ? (
            preview.targetKind === "city"
              ? layout.cities.find(city => city.id === preview.targetId)
                ? (wikiEntriesById[layout.cities.find(city => city.id === preview.targetId)!.wikiEntityId]?.name ?? preview.targetId)
                : preview.targetId
              : preview.targetKind === "district"
                ? simulationDistricts.find(district => district.id === preview.targetId)?.name ?? preview.targetId
                : preview.targetKind === "route"
                  ? roadPaths.find(path => path.id === preview.targetId)?.label || preview.targetId
                  : preview.targetKind === "region"
                    ? (layout.governanceRegions ?? []).find(region => region.id === preview.targetId)
                      ? (wikiEntriesById[(layout.governanceRegions ?? []).find(region => region.id === preview.targetId)!.wikiEntityId]?.name ?? preview.targetId)
                      : preview.targetId
                    : preview.targetKind === "faction"
                      ? simulationFactions.find(faction => faction.id === preview.targetId)?.label ?? preview.targetId
                      : placeTargetOptions.find(option => option.id === preview.targetId)?.label ?? preview.targetId
          )
        : null;
    return {
      ...preview,
      ownerColor: ownerFaction?.color || "#7ac3ff",
      ownerLabel: ownerFaction?.label ?? "Aucune faction",
      ownerCellKeys,
      targetCellKeys,
      targetRoute,
      targetLabel,
      zoneCellKeys: preview.zoneIds,
      anchorCellKey
    };
  }, [draftObjectivePreview, layout.cells, layout.cities, layout.governanceRegions, placeTargetOptions, roadPaths, selectedObjectivePreview, simulationDistrictDefinitions, simulationDistricts, simulationFactions, wikiEntriesById]);
  const positionReferenceOptions = useMemo(() => {
    if (!selectedSimulationMobileActor) return [];
    if (selectedSimulationMobileActor.positionKind === "city") {
      return layout.cities.map(city => ({ id: city.id, label: wikiEntriesById[city.wikiEntityId]?.name ?? city.wikiEntityId ?? city.id }));
    }
    if (selectedSimulationMobileActor.positionKind === "route") {
      return roadPaths.map(path => ({ id: path.id, label: path.label || path.id }));
    }
    if (selectedSimulationMobileActor.positionKind === "region") {
      return (layout.governanceRegions ?? []).map(region => ({ id: region.id, label: wikiEntriesById[region.wikiEntityId]?.name ?? region.wikiEntityId ?? region.id }));
    }
    return [];
  }, [layout.cities, layout.governanceRegions, roadPaths, selectedSimulationMobileActor, wikiEntriesById]);
  const destinationReferenceOptions = useMemo(() => {
    if (!selectedSimulationMobileActor?.destinationKind) return [];
    if (selectedSimulationMobileActor.destinationKind === "city") {
      return layout.cities.map(city => ({ id: city.id, label: wikiEntriesById[city.wikiEntityId]?.name ?? city.wikiEntityId ?? city.id }));
    }
    if (selectedSimulationMobileActor.destinationKind === "route") {
      return roadPaths.map(path => ({ id: path.id, label: path.label || path.id }));
    }
    if (selectedSimulationMobileActor.destinationKind === "region") {
      return (layout.governanceRegions ?? []).map(region => ({ id: region.id, label: wikiEntriesById[region.wikiEntityId]?.name ?? region.wikiEntityId ?? region.id }));
    }
    return [];
  }, [layout.cities, layout.governanceRegions, roadPaths, selectedSimulationMobileActor, wikiEntriesById]);
  const selectedMobileItineraryRoutes = useMemo(
    () =>
      (selectedSimulationMobileActor?.itineraryRouteIds ?? [])
        .map(routeId => layout.paths.find(path => path.id === routeId && path.kind === "road") ?? null)
        .filter((path): path is NonNullable<typeof path> => Boolean(path)),
    [layout.paths, selectedSimulationMobileActor]
  );
  const logisticsPreview = useMemo(() => {
    const runtimeState = createWorldStateFromMapLayout(layout);
    reinitialiserRessourcesTransport(runtimeState);
    const pressureComputation = recomputePressuresDetailed(runtimeState);
    runtimeState.pressures = pressureComputation.pressures;
    const plans = buildFactionLogisticsPlans(runtimeState);
    return {
      runtimeState,
      plans,
      pressureTrace: pressureComputation.trace
    };
  }, [layout]);
  const selectedSimulationFactionRuntime = useMemo(
    () => (selectedSimulationFaction ? logisticsPreview.runtimeState.factions[`faction:map:${selectedSimulationFaction.id}`] ?? null : null),
    [logisticsPreview.runtimeState.factions, selectedSimulationFaction]
  );
  const selectedSimulationMobileActorRuntime = useMemo(
    () => (selectedSimulationMobileActor ? logisticsPreview.runtimeState.mobileActors[`mobile:map:${selectedSimulationMobileActor.id}`] ?? null : null),
    [logisticsPreview.runtimeState.mobileActors, selectedSimulationMobileActor]
  );
  const selectedSimulationMobileArchetypePreset = useMemo(
    () => getMobileArchetypePreset(selectedSimulationMobileActor?.archetype),
    [selectedSimulationMobileActor?.archetype]
  );
  const selectedSimulationFactionLogisticsPlan = useMemo(
    () => (selectedSimulationFaction ? logisticsPreview.plans.find(plan => plan.factionId === `faction:map:${selectedSimulationFaction.id}`) ?? null : null),
    [logisticsPreview.plans, selectedSimulationFaction]
  );
  const selectedObjectiveRuntime = useMemo(
    () => (selectedSimulationObjective ? logisticsPreview.runtimeState.specialObjectives[`objective:map:${selectedSimulationObjective.id}`] ?? null : null),
    [logisticsPreview.runtimeState.specialObjectives, selectedSimulationObjective]
  );
  const selectedObjectiveEditorActivePhase = useMemo(
    () => (selectedSimulationObjective?.phases ?? [])[selectedSimulationObjective?.currentPhaseIndex ?? 0] ?? null,
    [selectedSimulationObjective]
  );
  const selectedObjectiveRuntimeActivePhase = useMemo(
    () => (selectedObjectiveRuntime?.phases ?? [])[selectedObjectiveRuntime?.currentPhaseIndex ?? 0] ?? null,
    [selectedObjectiveRuntime]
  );
  const selectedObjectiveReadiness = useMemo(
    () => (selectedObjectiveRuntime ? evaluateObjectiveReadiness(logisticsPreview.runtimeState, selectedObjectiveRuntime) : null),
    [logisticsPreview.runtimeState, selectedObjectiveRuntime]
  );
  const selectedObjectiveLogisticsPlan = useMemo(
    () => (selectedObjectiveRuntime ? logisticsPreview.plans.find(plan => plan.objectifId === selectedObjectiveRuntime.id) ?? null : null),
    [logisticsPreview.plans, selectedObjectiveRuntime]
  );
  const selectedObjectiveLogisticsRoutes = useMemo(
    () =>
      (selectedObjectiveLogisticsPlan?.routeIds ?? [])
        .map(routeId => layout.paths.find(path => path.id === routeId && path.kind === "road") ?? null)
        .filter((path): path is NonNullable<typeof path> => Boolean(path)),
    [layout.paths, selectedObjectiveLogisticsPlan]
  );
  const selectedPressureTarget = useMemo(() => {
    if (selectedSimulationObjective?.targetKind === "district" && selectedSimulationObjective.targetId) {
      return { kind: "district" as const, id: selectedSimulationObjective.targetId, label: `Quartier · ${objectiveTargetOptions.find(option => option.id === selectedSimulationObjective.targetId)?.label ?? selectedSimulationObjective.targetId}` };
    }
    if (selectedCity?.id) {
      return { kind: "city" as const, id: selectedCity.id, label: `Ville · ${wikiEntriesById[selectedCity.wikiEntityId]?.name ?? selectedCity.wikiEntityId ?? selectedCity.id}` };
    }
    if (selectedRoute?.kind === "road") {
      return { kind: "route" as const, id: selectedRoute.id, label: `Route · ${selectedRoute.label || selectedRoute.id}` };
    }
    if (selectedGovernanceRegion?.id) {
      return { kind: "region" as const, id: selectedGovernanceRegion.id, label: `Region · ${wikiEntriesById[selectedGovernanceRegion.wikiEntityId]?.name ?? selectedGovernanceRegion.wikiEntityId ?? selectedGovernanceRegion.id}` };
    }
    return null;
  }, [objectiveTargetOptions, selectedCity, selectedGovernanceRegion, selectedRoute, selectedSimulationObjective, wikiEntriesById]);
  const selectedPressureEvaluations = useMemo(
    () => (selectedPressureTarget ? logisticsPreview.pressureTrace[selectedPressureTarget.kind]?.[selectedPressureTarget.id] ?? [] : []),
    [logisticsPreview.pressureTrace, selectedPressureTarget]
  );
  const pressureHotspots = useMemo(() => {
    const hotspots: Array<{ kind: "city" | "district" | "route" | "region"; id: string; total: number }> = [];
    (["city", "district", "route", "region"] as const).forEach(kind => {
      const byEntity = logisticsPreview.pressureTrace[kind] ?? {};
      Object.entries(byEntity).forEach(([id, evaluations]) => {
        const total = evaluations.reduce((sum, evaluation) => sum + evaluation.clampedValue, 0);
        hotspots.push({ kind, id, total });
      });
    });
    return hotspots.sort((left, right) => right.total - left.total).slice(0, 8);
  }, [logisticsPreview.pressureTrace]);
  const nextTickPreview = useMemo(() => {
    const previewState = structuredClone(logisticsPreview.runtimeState);
    const micro = runWorldTick(previewState, "micro");
    return {
      output: micro,
      stateAfter: previewState
    };
  }, [logisticsPreview.runtimeState]);
  const selectedSimulationFactionHomeCity = useMemo(
    () => (selectedSimulationFaction?.homeCityId ? layout.cities.find(city => city.id === selectedSimulationFaction.homeCityId) ?? null : null),
    [layout.cities, selectedSimulationFaction]
  );
  const selectedSimulationFactionEffectivePopulationProfile = selectedSimulationFactionRuntime?.populationProfile;
  const selectedSimulationFactionPopulationSource = selectedSimulationFaction?.populationProfile
    ? "Override faction"
    : selectedSimulationFactionHomeCity?.populationProfile
      ? `Ville d'ancrage: ${wikiEntriesById[selectedSimulationFactionHomeCity.wikiEntityId]?.name ?? selectedSimulationFactionHomeCity.wikiEntityId}`
      : "Aucune source";
  const selectedSimulationMobileOwnerFaction = useMemo(
    () => (selectedSimulationMobileActor?.ownerFactionId ? simulationFactions.find(faction => faction.id === selectedSimulationMobileActor.ownerFactionId) ?? null : null),
    [selectedSimulationMobileActor, simulationFactions]
  );
  const draftMobileArchetypePreset = useMemo(
    () => MOBILE_ARCHETYPE_PRESETS.find(preset => preset.id === draftSimulationMobileActorArchetype) ?? null,
    [draftSimulationMobileActorArchetype]
  );
  const draftMobileMissionSummary = useMemo(() => {
    if (selectedSimulationObjective?.label) return selectedSimulationObjective.label;
    return draftMobileArchetypePreset?.defaultMissionLabel ?? "Aucune mission explicite";
  }, [draftMobileArchetypePreset, selectedSimulationObjective]);
  const draftMobileMissionTargetSummary = useMemo(() => {
    if (selectedSimulationObjective?.targetId) {
      return objectiveTargetOptions.find(option => option.id === selectedSimulationObjective.targetId)?.label ?? selectedSimulationObjective.targetId;
    }
    if (selectedGovernanceRegion?.id) {
      return wikiEntriesById[selectedGovernanceRegion.wikiEntityId]?.name ?? selectedGovernanceRegion.wikiEntityId ?? selectedGovernanceRegion.id;
    }
    if (selectedRoute?.kind === "road") {
      return selectedRoute.label || selectedRoute.id;
    }
    if (selectedCell?.cell) {
      return `Cellule ${getCellLabel(selectedCell.cell)}`;
    }
    return "Aucune cible";
  }, [objectiveTargetOptions, selectedCell, selectedGovernanceRegion, selectedRoute, selectedSimulationObjective, wikiEntriesById]);
  const draftMobileDepartureSummary = useMemo(() => {
    if (selectedCity?.id) {
      return wikiEntriesById[selectedCity.wikiEntityId]?.name ?? selectedCity.wikiEntityId ?? selectedCity.id;
    }
    if (selectedRoute?.kind === "road") {
      return selectedRoute.label || selectedRoute.id;
    }
    if (selectedCell?.cell) {
      return `Cellule ${getCellLabel(selectedCell.cell)}`;
    }
    return "Aucun point de depart";
  }, [selectedCell, selectedCity, selectedRoute, wikiEntriesById]);
  const draftMobileCreationReady = Boolean(draftSimulationMobileActorId.trim() || draftSimulationMobileActorLabel.trim());
  const selectedSimulationMobileMissionSummary = useMemo(() => {
    if (!selectedSimulationMobileActor) return "Aucune mission explicite";
    if (selectedSimulationMobileActor.missionLabel) return selectedSimulationMobileActor.missionLabel;
    if (selectedSimulationMobileArchetypePreset?.defaultMissionLabel) return selectedSimulationMobileArchetypePreset.defaultMissionLabel;
    if (selectedSimulationMobileActor.objectiveIds.length > 0) {
      const objective = simulationObjectives.find(entry => entry.id === selectedSimulationMobileActor.objectiveIds[0]);
      if (objective) return objective.label;
    }
    return "Aucune mission explicite";
  }, [selectedSimulationMobileActor, selectedSimulationMobileArchetypePreset, simulationObjectives]);
  const selectedSimulationMobileMissionTargetSummary = useMemo(() => {
    if (!selectedSimulationMobileActor) return "Aucune cible";
    if (selectedSimulationMobileActor.missionTargetLabel) return selectedSimulationMobileActor.missionTargetLabel;
    if (selectedSimulationMobileActor.destinationKind === "city") {
      return destinationReferenceOptions.find(option => option.id === selectedSimulationMobileActor.destinationId)?.label ?? selectedSimulationMobileActor.destinationId ?? "Aucune cible";
    }
    if (selectedSimulationMobileActor.destinationKind === "route") {
      return destinationReferenceOptions.find(option => option.id === selectedSimulationMobileActor.destinationId)?.label ?? selectedSimulationMobileActor.destinationId ?? "Aucune cible";
    }
    if (selectedSimulationMobileActor.destinationKind === "region") {
      return destinationReferenceOptions.find(option => option.id === selectedSimulationMobileActor.destinationId)?.label ?? selectedSimulationMobileActor.destinationId ?? "Aucune cible";
    }
    if (selectedSimulationMobileActor.destinationKind === "cell" && selectedSimulationMobileActor.destinationCell) {
      return `Cellule ${getCellLabel(selectedSimulationMobileActor.destinationCell)}`;
    }
    return "Aucune cible";
  }, [destinationReferenceOptions, selectedSimulationMobileActor]);
  const selectedSimulationMobilePositionSummary = useMemo(() => {
    if (!selectedSimulationMobileActor) return "Position inconnue";
    if (selectedSimulationMobileActorRuntime) {
      const runtimeProgress = formatRuntimeMobileProgress(layout, logisticsPreview.runtimeState, selectedSimulationMobileActorRuntime);
      return runtimeProgress.routeLabel
        ? `${runtimeProgress.routeLabel} | ${runtimeProgress.progressLabel}`
        : runtimeProgress.progressLabel;
    }
    if (selectedSimulationMobileActor.positionKind === "cell" && selectedSimulationMobileActor.positionCell) {
      return `Cellule ${getCellLabel(selectedSimulationMobileActor.positionCell)}`;
    }
    return positionReferenceOptions.find(option => option.id === selectedSimulationMobileActor.positionId)?.label ?? selectedSimulationMobileActor.positionId ?? "Position inconnue";
  }, [layout, logisticsPreview.runtimeState, positionReferenceOptions, selectedSimulationMobileActor, selectedSimulationMobileActorRuntime]);
  const selectableMobileObjectiveOptions = useMemo(
    () =>
      simulationObjectives
        .filter(objective => !selectedSimulationMobileActor?.ownerFactionId || objective.ownerFactionId === selectedSimulationMobileActor.ownerFactionId)
        .map(objective => ({ id: objective.id, label: `${objective.label} (${objective.id})` })),
    [selectedSimulationMobileActor?.ownerFactionId, simulationObjectives]
  );
  const selectedObjectiveProjectedAction = useMemo(
    () => (selectedObjectiveRuntime ? nextTickPreview.output.trace?.selectedActions.find(action => action.objectiveId === selectedObjectiveRuntime.id) ?? null : null),
    [nextTickPreview.output.trace, selectedObjectiveRuntime]
  );
  const selectedObjectiveProjectedEvent = useMemo(
    () => (selectedObjectiveProjectedAction ? nextTickPreview.output.events.find(event => event.id === selectedObjectiveProjectedAction.eventId) ?? null : null),
    [nextTickPreview.output.events, selectedObjectiveProjectedAction]
  );
  const selectedObjectiveProjectedSignals = useMemo(
    () =>
      selectedObjectiveRuntime
        ? nextTickPreview.output.signals.filter(signal =>
            signal.payload.objectiveId === selectedObjectiveRuntime.id ||
            (selectedObjectiveProjectedAction
              ? signal.payload.actorId === selectedObjectiveProjectedAction.actorRef.id && signal.payload.actionId === selectedObjectiveProjectedAction.actionId
              : false)
          )
        : [],
    [nextTickPreview.output.signals, selectedObjectiveProjectedAction, selectedObjectiveRuntime]
  );
  const selectedObjectiveProjectedRumors = useMemo(
    () =>
      selectedObjectiveProjectedEvent
        ? nextTickPreview.output.rumors.filter(rumor => rumor.sourceEventId === selectedObjectiveProjectedEvent.id)
        : [],
    [nextTickPreview.output.rumors, selectedObjectiveProjectedEvent]
  );
  const selectedObjectiveProjectedOpportunities = useMemo(
    () =>
      selectedObjectiveRuntime
        ? nextTickPreview.output.opportunities.filter(opportunity => opportunity.id.includes(selectedObjectiveRuntime.id))
        : [],
    [nextTickPreview.output.opportunities, selectedObjectiveRuntime]
  );
  const selectedObjectiveProjectedDeltaGroups = useMemo(() => {
    const deltas = selectedObjectiveProjectedEvent?.deltas ?? [];
    const groups = new Map<string, { ref: { kind: string; id: string }; deltas: typeof deltas }>();
    deltas.forEach(delta => {
      const key = `${delta.target.kind}:${delta.target.id}`;
      const current = groups.get(key);
      if (current) {
        current.deltas.push(delta);
        return;
      }
      groups.set(key, { ref: delta.target, deltas: [delta] });
    });
    return Array.from(groups.values());
  }, [selectedObjectiveProjectedEvent]);
  const selectedObjectiveAssignedMobileRuntime = useMemo(
    () =>
      selectedObjectiveLogisticsPlan?.acteurAssigneId
        ? logisticsPreview.runtimeState.mobileActors[selectedObjectiveLogisticsPlan.acteurAssigneId] ?? null
        : null,
    [logisticsPreview.runtimeState.mobileActors, selectedObjectiveLogisticsPlan]
  );
  const selectedObjectiveAssignedMobileSummary = useMemo(
    () =>
      selectedObjectiveAssignedMobileRuntime
        ? formatRuntimeMobileProgress(layout, logisticsPreview.runtimeState, selectedObjectiveAssignedMobileRuntime)
        : null,
    [layout, logisticsPreview.runtimeState, selectedObjectiveAssignedMobileRuntime]
  );
  const selectedObjectiveExecutionPressureEvaluations = useMemo(() => {
    const executionRef = selectedObjectiveReadiness?.executionTargetRef ?? selectedObjectiveLogisticsPlan?.cibleExecutionRef;
    if (!executionRef) return [];
    if (
      executionRef.kind !== "city" &&
      executionRef.kind !== "district" &&
      executionRef.kind !== "route" &&
      executionRef.kind !== "region"
    ) {
      return [];
    }
    return logisticsPreview.pressureTrace[executionRef.kind]?.[executionRef.id] ?? [];
  }, [logisticsPreview.pressureTrace, selectedObjectiveLogisticsPlan?.cibleExecutionRef, selectedObjectiveReadiness?.executionTargetRef]);
  const selectedObjectiveDominantPressure = useMemo(
    () =>
      [...selectedObjectiveExecutionPressureEvaluations]
        .sort((left, right) => right.clampedValue - left.clampedValue)[0] ?? null,
    [selectedObjectiveExecutionPressureEvaluations]
  );
  const nextTickTopDeltaGroups = useMemo(() => {
    const groups = new Map<string, { ref: { kind: string; id: string }; deltas: typeof nextTickPreview.output.deltas }>();
    nextTickPreview.output.deltas.forEach(delta => {
      const key = `${delta.target.kind}:${delta.target.id}`;
      const current = groups.get(key);
      if (current) {
        current.deltas.push(delta);
        return;
      }
      groups.set(key, { ref: delta.target, deltas: [delta] });
    });
    return Array.from(groups.values())
      .sort((left, right) =>
        right.deltas.reduce((sum, delta) => sum + Math.abs(delta.amount ?? 0), 0) -
        left.deltas.reduce((sum, delta) => sum + Math.abs(delta.amount ?? 0), 0)
      )
      .slice(0, 4);
  }, [nextTickPreview.output.deltas]);

  useEffect(() => {
    setPendingObjectivePhase("");
    setPendingObjectiveObstacle("");
    setPendingObjectiveActionId("");
    setPendingObjectiveCustomActionId("");
    setPendingObjectiveTag("");
    setPendingObjectiveCustomTag("");
    setPendingObjectiveConsequences({
      onSuccess: { type: "create_tension", subtype: "criminal", amount: "20", tags: [] },
      onFailure: { type: "create_tension", subtype: "criminal", amount: "20", tags: [] }
    });
  }, [selectedSimulationObjectiveId]);

  useEffect(() => {
    setPendingFactionMethod("");
    setPendingFactionObjectiveHint("");
    setPendingFactionTag("");
    setPendingFactionCustomTag("");
  }, [selectedSimulationFactionId]);

  useEffect(() => {
    setPendingMobileObjectiveId("");
    setPendingMobileInteractionTag("");
    setPendingMobileCustomInteractionTag("");
  }, [selectedSimulationMobileActorId]);
  const selectedSimulationMobileOwnerCity = useMemo(
    () =>
      selectedSimulationMobileOwnerFaction?.homeCityId
        ? layout.cities.find(city => city.id === selectedSimulationMobileOwnerFaction.homeCityId) ?? null
        : null,
    [layout.cities, selectedSimulationMobileOwnerFaction]
  );
  const selectedSimulationMobilePopulationSource = selectedSimulationMobileActor?.populationProfile
    ? "Override mobile"
    : selectedSimulationMobileOwnerFaction?.populationProfile
      ? `Faction: ${selectedSimulationMobileOwnerFaction.label}`
      : selectedSimulationMobileOwnerCity?.populationProfile
        ? `Ville d'ancrage de faction: ${wikiEntriesById[selectedSimulationMobileOwnerCity.wikiEntityId]?.name ?? selectedSimulationMobileOwnerCity.wikiEntityId}`
        : "Aucune source";
  const selectedCityRuntimeDistricts = useMemo(
    () =>
      selectedCity
        ? Object.values(logisticsPreview.runtimeState.districts)
            .filter(district => district.cityId === selectedCity.id)
            .sort((left, right) => left.name.localeCompare(right.name))
        : [],
    [logisticsPreview.runtimeState.districts, selectedCity]
  );
  const selectedCityDistrictOverridesById = useMemo(
    () => new Map((layout.simulation?.districtOverrides ?? []).map(override => [override.id, override])),
    [layout.simulation?.districtOverrides]
  );
  const selectedCityNativeDistricts = useMemo(
    () =>
      selectedCity
        ? (layout.simulation?.districts ?? [])
            .filter(district => district.cityId === selectedCity.id)
            .sort((left, right) => left.name.localeCompare(right.name))
        : [],
    [layout.simulation?.districts, selectedCity]
  );
  const selectedCityDerivedOverridesCount = useMemo(
    () =>
      selectedCity
        ? (layout.simulation?.districtOverrides ?? []).filter(override => override.cityId === selectedCity.id).length
        : 0,
    [layout.simulation?.districtOverrides, selectedCity]
  );
  const selectedCityDistrictMode = selectedCityNativeDistricts.length > 0 ? "natif" : "derive";

  useEffect(() => {
    setActiveCityEditorTab("identity");
  }, [selectedCity?.id]);

  useEffect(() => {
    setActiveFactionEditorTab("identity");
  }, [selectedSimulationFaction?.id]);

  useEffect(() => {
    setActiveCityCreateTab("cell");
  }, [selectedCellKey]);

  useEffect(() => {
    setActiveFactionCreateTab("identity");
  }, [selectedSimulationFactionId]);

  useEffect(() => {
    setActiveObjectiveCreateTab("identity");
  }, [selectedSimulationObjectiveId, selectedSimulationFactionId]);

  useEffect(() => {
    setActiveMobileCreateTab("archetype");
  }, [selectedSimulationMobileActorId, selectedSimulationFactionId]);

  useEffect(() => {
    if (draftObjectiveOwnerFactionId && simulationFactions.some(faction => faction.id === draftObjectiveOwnerFactionId)) return;
    setDraftObjectiveOwnerFactionId(selectedSimulationFactionId || simulationFactions[0]?.id || "");
  }, [draftObjectiveOwnerFactionId, selectedSimulationFactionId, simulationFactions]);

  useEffect(() => {
    if (draftMobileOwnerFactionId && simulationFactions.some(faction => faction.id === draftMobileOwnerFactionId)) return;
    setDraftMobileOwnerFactionId(selectedSimulationFactionId || simulationFactions[0]?.id || "");
  }, [draftMobileOwnerFactionId, selectedSimulationFactionId, simulationFactions]);

  useEffect(() => {
    if (mobileBrowseFactionId && simulationFactions.some(faction => faction.id === mobileBrowseFactionId)) return;
    setMobileBrowseFactionId(selectedSimulationFactionId || simulationFactions[0]?.id || "");
  }, [mobileBrowseFactionId, selectedSimulationFactionId, simulationFactions]);

  const simulationZoneOptions = useMemo(() => {
    const options = new Map<string, string>();
    layout.cities.forEach(city => {
      options.set(city.id, `Ville · ${wikiEntriesById[city.wikiEntityId]?.name ?? city.wikiEntityId ?? city.id}`);
    });
    (layout.governanceRegions ?? []).forEach(region => {
      options.set(region.id, `Region · ${wikiEntriesById[region.wikiEntityId]?.name ?? region.wikiEntityId ?? region.id}`);
    });
    (layout.geographicZones ?? []).forEach(zone => {
      options.set(zone.id, `Zone geo · ${zone.label || zone.id}`);
    });
    roadPaths.forEach(path => {
      options.set(path.id, `Route · ${path.label || path.id}`);
    });
    Object.values(logisticsPreview.runtimeState.districts).forEach(district => {
      options.set(district.id, `Quartier · ${district.name}`);
    });
    simulationFactions.forEach(faction => {
      options.set(faction.id, `Faction · ${faction.label || faction.id}`);
    });
    return Array.from(options.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [layout.cities, layout.geographicZones, layout.governanceRegions, logisticsPreview.runtimeState.districts, roadPaths, simulationFactions, wikiEntriesById]);
  const cellFeatureIndex = useMemo(() => buildCellFeatureIndex(layout), [layout]);
  const selectedRiverWaterfallCount = useMemo(() => {
    if (!selectedRoute || selectedRoute.kind !== "river") return 0;
    let total = 0;
    for (let index = 1; index < selectedRoute.cells.length; index += 1) {
      const previous = selectedRoute.cells[index - 1];
      const current = selectedRoute.cells[index];
      const previousKey = getWorldMapCellKey(previous);
      const currentKey = getWorldMapCellKey(current);
      const currentCellRiver = cellFeatureIndex[currentKey]?.rivers.find(entry => entry.featureId === selectedRoute.id) ?? null;
      const previousCellRiver = cellFeatureIndex[previousKey]?.rivers.find(entry => entry.featureId === selectedRoute.id) ?? null;
      if (currentCellRiver?.cliffDrop || previousCellRiver?.cliffDrop) {
        total += 1;
      }
    }
    return total;
  }, [cellFeatureIndex, selectedRoute]);
  const routeEditorActive = activeTool === "routes" && routeDrawActive;
  const routeCandidateCellKeys = useMemo(
    () => (routeEditorActive ? getAllowedRouteAppendCells(layout, selectedRoute).map(cell => getWorldMapCellKey(cell)) : []),
    [layout, routeEditorActive, selectedRoute]
  );
  const invalidPathSegments = useMemo(() => collectInvalidPathSegments(layout), [layout]);
  const pathIssues = useMemo(() => validateLayoutPathRules(layout), [layout]);
  const persistedLayout = useMemo(() => withEditorPresets(layout, customGeographies, customTags), [customGeographies, customTags, layout]);
  const currentLayoutJson = useMemo(() => layoutToJson(persistedLayout), [persistedLayout]);
  const isDirty = currentLayoutJson !== lastSavedLayoutJson;
  const canUndo = editorStore.past.length > 0;
  const canRedo = editorStore.future.length > 0;
  const wikiCities = useMemo(
    () => wikiCatalog.filter(entry => String(entry.type).trim().toLowerCase() === "ville"),
    [wikiCatalog]
  );
  const wikiLocations = useMemo(
    () =>
      wikiCatalog.filter(entry => {
        const type = String(entry.type).trim().toLowerCase();
        return type === "batiment" || type === "quartier" || type === "lieu" || type === "site";
      }),
    [wikiCatalog]
  );
  const wikiTerritories = useMemo(
    () =>
      wikiCatalog.filter(entry => {
        const type = String(entry.type).trim().toLowerCase();
        return type === "royaume" || type === "territoire";
      }),
    [wikiCatalog]
  );
  const wikiRegions = useMemo(
    () => wikiCatalog.filter(entry => String(entry.type).trim().toLowerCase() === "region"),
    [wikiCatalog]
  );
  const wikiGovernances = useMemo(
    () =>
      wikiCatalog.filter(entry => {
        const type = String(entry.type).trim().toLowerCase();
        return type === "gouvernance" || entry.relativePath.includes("gouvernances/");
      }),
    [wikiCatalog]
  );
  const wikiGeoZones = useMemo(
    () => [] as typeof wikiCatalog,
    [wikiCatalog]
  );
  const selectedMobileItineraryOverlay = useMemo(() => {
    if (activeTool !== "simulation" || selectedMobileItineraryRoutes.length === 0) return null;
    return (
      <g>
        {selectedMobileItineraryRoutes.map((path, index) => (
          <g key={`sim-itinerary-${path.id}-${index}`}>
            <polyline
              points={buildPathPoints(layout, path.cells)}
              fill="none"
              stroke="rgba(110, 214, 255, 0.96)"
              strokeWidth={8}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.65}
            />
            {path.cells.length > 0 && (() => {
              const center = getCellCenter(layout, path.cells[Math.floor(path.cells.length / 2)]);
              return (
                <g transform={`translate(${center.x} ${center.y})`}>
                  <circle r={11} fill="rgba(11, 19, 31, 0.9)" stroke="rgba(110, 214, 255, 0.9)" strokeWidth={2} />
                  <text x={0} y={4} textAnchor="middle" fill="#eefbff" style={{ fontSize: 11, fontWeight: 800 }}>
                    {index + 1}
                  </text>
                </g>
              );
            })()}
          </g>
        ))}
      </g>
    );
  }, [activeTool, layout, selectedMobileItineraryRoutes]);
  const selectedMobilePositionRouteHint = useMemo(
    () => getCellRoutePlacementHint(layout, selectedSimulationMobileActor?.positionKind === "cell" ? selectedSimulationMobileActor.positionCell : undefined),
    [layout, selectedSimulationMobileActor]
  );
  const selectedMobileDestinationRouteHint = useMemo(
    () => getCellRoutePlacementHint(layout, selectedSimulationMobileActor?.destinationKind === "cell" ? selectedSimulationMobileActor.destinationCell : undefined),
    [layout, selectedSimulationMobileActor]
  );
  const simulationMobileMapMarkers = useMemo(() => {
    const markers = simulationMobileActors
      .map(actor => {
        const ownerFaction = actor.ownerFactionId ? simulationFactions.find(faction => faction.id === actor.ownerFactionId) ?? null : null;
        const markerColor = actor.color || ownerFaction?.color || "#7ad6ff";
        if (actor.positionKind === "cell" && actor.positionCell) {
          return {
            actor,
            center: getCellCenter(layout, actor.positionCell),
            bucketKey: `cell:${getWorldMapCellKey(actor.positionCell)}`,
            markerColor
          };
        }
        if (actor.positionKind === "city" && actor.positionId) {
          const city = layout.cities.find(entry => entry.id === actor.positionId);
          if (city) {
            return {
              actor,
              center: getCellCenter(layout, city.cell),
              bucketKey: `city:${city.id}`,
              markerColor
            };
          }
        }
        if (actor.positionKind === "route" && actor.positionId) {
          const path = roadPaths.find(entry => entry.id === actor.positionId);
          if (path?.cells.length) {
            return {
              actor,
              center: getCellCenter(layout, path.cells[Math.floor(path.cells.length / 2)]),
              bucketKey: `route:${path.id}`,
              markerColor
            };
          }
        }
        if (actor.positionKind === "region" && actor.positionId) {
          const regionCells = layout.cells.filter(cell => cell.governanceRegionId === actor.positionId);
          if (regionCells.length > 0) {
            return {
              actor,
              center: getCellCenter(layout, regionCells[Math.floor(regionCells.length / 2)].cell),
              bucketKey: `region:${actor.positionId}`,
              markerColor
            };
          }
        }
        return null;
      })
      .filter((marker): marker is NonNullable<typeof marker> => Boolean(marker));
    const grouped = new Map<string, typeof markers>();
    markers.forEach(marker => {
      const current = grouped.get(marker.bucketKey);
      if (current) current.push(marker);
      else grouped.set(marker.bucketKey, [marker]);
    });
    return markers.map(marker => {
      const siblings = grouped.get(marker.bucketKey) ?? [marker];
      const index = siblings.findIndex(entry => entry.actor.id === marker.actor.id);
      return {
        ...marker,
        offset: getMarkerStackOffset(index, siblings.length, 15),
        siblingCount: siblings.length
      };
    });
  }, [layout, roadPaths, simulationFactions, simulationMobileActors]);
  const simulationMobileActorsOverlay = useMemo(() => {
    if (activeTool !== "simulation" || simulationMobileMapMarkers.length === 0) return null;
    return (
      <g>
        {simulationMobileMapMarkers.map(marker => {
          const isSelected = marker.actor.id === selectedSimulationMobileActorId;
          const missionLabel = marker.actor.missionLabel || marker.actor.label;
          return (
            <g
              key={`mobile-marker-${marker.actor.id}`}
              transform={`translate(${marker.center.x + marker.offset.x} ${marker.center.y + marker.offset.y})`}
            >
              {marker.siblingCount > 1 && <circle r={isSelected ? 16 : 14} fill="rgba(255,255,255,0.12)" />}
              <circle
                r={isSelected ? 9 : 7}
                fill={marker.markerColor}
                stroke={isSelected ? "#fff3d4" : "#0b0b12"}
                strokeWidth={isSelected ? 2.4 : 1.8}
              />
              <circle r={isSelected ? 3.4 : 2.6} fill="rgba(8, 13, 22, 0.82)" />
              <text
                x={0}
                y={isSelected ? -16 : -13}
                textAnchor="middle"
                fill="#eef6ff"
                style={{ fontSize: 9, fontWeight: isSelected ? 800 : 700, paintOrder: "stroke", stroke: "rgba(8,11,17,0.86)", strokeWidth: 4 }}
              >
                {missionLabel.length > 14 ? `${missionLabel.slice(0, 14)}...` : missionLabel}
              </text>
            </g>
          );
        })}
      </g>
    );
  }, [activeTool, selectedSimulationMobileActorId, simulationMobileMapMarkers]);
  const selectedMobileRouteAnchorOverlay = useMemo(() => {
    if (activeTool !== "simulation" || !selectedSimulationMobileActor) return null;
    const markers = [
      {
        key: "position",
        cell: selectedSimulationMobileActor.positionKind === "cell" ? selectedSimulationMobileActor.positionCell : undefined,
        hint: selectedMobilePositionRouteHint,
        label: "Depart",
        stroke: "rgba(110, 214, 255, 0.96)",
        fill: "rgba(8, 20, 33, 0.96)",
        text: "#eefbff"
      },
      {
        key: "destination",
        cell: selectedSimulationMobileActor.destinationKind === "cell" ? selectedSimulationMobileActor.destinationCell : undefined,
        hint: selectedMobileDestinationRouteHint,
        label: "Arrivee",
        stroke: "rgba(244, 201, 103, 0.96)",
        fill: "rgba(24, 18, 7, 0.96)",
        text: "#fff2c9"
      }
    ].filter(entry => entry.cell && entry.hint?.isIntermediate);
    if (markers.length === 0) return null;
    return (
      <g>
        {markers.map(entry => {
          const center = getCellCenter(layout, entry.cell!);
          return (
            <g key={`mobile-route-anchor-${entry.key}`} transform={`translate(${center.x} ${center.y})`}>
              <circle r={15} fill={entry.fill} stroke={entry.stroke} strokeWidth={2.4} />
              <path d="M -6 0 L 0 -6 L 6 0 L 0 6 Z" fill={entry.stroke} opacity={0.9} />
              <text
                x={0}
                y={-20}
                textAnchor="middle"
                fill={entry.text}
                style={{ fontSize: 10, fontWeight: 800, paintOrder: "stroke", stroke: "rgba(8,11,17,0.86)", strokeWidth: 4 }}
              >
                {entry.label}
              </text>
              <text
                x={0}
                y={29}
                textAnchor="middle"
                fill={entry.text}
                style={{ fontSize: 10, fontWeight: 700, paintOrder: "stroke", stroke: "rgba(8,11,17,0.86)", strokeWidth: 4 }}
              >
                {entry.hint?.routeLabel}
              </text>
            </g>
          );
        })}
      </g>
    );
  }, [
    activeTool,
    layout,
    selectedMobileDestinationRouteHint,
    selectedMobilePositionRouteHint,
    selectedSimulationMobileActor
  ]);
  const selectedObjectiveLogisticsOverlay = useMemo(() => {
    if (activeTool !== "simulation" || selectedObjectiveLogisticsRoutes.length === 0) return null;
    return (
      <g>
        {selectedObjectiveLogisticsRoutes.map((path, index) => (
          <g key={`objective-logistics-${path.id}-${index}`}>
            <polyline
              points={buildPathPoints(layout, path.cells)}
              fill="none"
              stroke="rgba(244, 201, 103, 0.95)"
              strokeWidth={6}
              strokeDasharray="10 6"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.8}
            />
            {path.cells.length > 0 && (() => {
              const center = getCellCenter(layout, path.cells[Math.floor(path.cells.length / 2)]);
              return (
                <g transform={`translate(${center.x} ${center.y})`}>
                  <rect x={-10} y={-10} width={20} height={20} rx={6} fill="rgba(17, 15, 8, 0.92)" stroke="rgba(244, 201, 103, 0.92)" strokeWidth={2} />
                  <text x={0} y={4} textAnchor="middle" fill="#fff5da" style={{ fontSize: 11, fontWeight: 800 }}>
                    {index + 1}
                  </text>
                </g>
              );
            })()}
          </g>
        ))}
      </g>
    );
  }, [activeTool, layout, selectedObjectiveLogisticsRoutes]);
  const objectiveMapPreviewOverlay = useMemo(() => {
    if (activeTool !== "simulation" || !objectiveMapPreview) return null;
    const ownerFill = colorWithAlpha(objectiveMapPreview.ownerColor, 0.14, "rgba(122, 195, 255, 0.14)");
    const ownerStroke = colorWithAlpha(objectiveMapPreview.ownerColor, 0.72, "rgba(122, 195, 255, 0.72)");
    const targetFill = colorWithAlpha(objectiveMapPreview.ownerColor, 0.24, "rgba(244, 201, 103, 0.24)");
    const targetStroke = colorWithAlpha(objectiveMapPreview.ownerColor, 0.98, "rgba(244, 201, 103, 0.98)");
    const zoneStroke = colorWithAlpha(objectiveMapPreview.ownerColor, 0.5, "rgba(122, 195, 255, 0.5)");
    const targetCells = objectiveMapPreview.targetCellKeys
      .map(cellKey => layout.cells.find(cell => getWorldMapCellKey(cell.cell) === cellKey) ?? null)
      .filter((cell): cell is NonNullable<typeof cell> => Boolean(cell));
    const zoneCells = objectiveMapPreview.zoneCellKeys
      .filter((cellKey: string) => !objectiveMapPreview.targetCellKeys.includes(cellKey))
      .map((cellKey: string) => layout.cells.find(cell => getWorldMapCellKey(cell.cell) === cellKey) ?? null)
      .filter((cell): cell is (typeof layout.cells)[number] => Boolean(cell));
    const ownerCells = objectiveMapPreview.ownerCellKeys
      .filter((cellKey: string) => !objectiveMapPreview.targetCellKeys.includes(cellKey) && !objectiveMapPreview.zoneCellKeys.includes(cellKey))
      .map((cellKey: string) => layout.cells.find(cell => getWorldMapCellKey(cell.cell) === cellKey) ?? null)
      .filter((cell): cell is (typeof layout.cells)[number] => Boolean(cell))
      .slice(0, 36);
    const anchorCell = objectiveMapPreview.anchorCellKey
      ? layout.cells.find(cell => getWorldMapCellKey(cell.cell) === objectiveMapPreview.anchorCellKey) ?? null
      : null;
    return (
      <g>
        {ownerCells.map(cell => (
          <polygon
            key={`objective-owner-${getWorldMapCellKey(cell.cell)}`}
            points={getCellPolygon(layout, cell.cell)}
            fill={ownerFill}
            stroke={ownerStroke}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        ))}
        {zoneCells.map(cell => (
          <polygon
            key={`objective-zone-${getWorldMapCellKey(cell.cell)}`}
            points={getCellPolygon(layout, cell.cell)}
            fill="rgba(244, 201, 103, 0.1)"
            stroke={zoneStroke}
            strokeWidth={2}
            strokeDasharray="8 6"
          />
        ))}
        {targetCells.map(cell => (
          <polygon
            key={`objective-target-${getWorldMapCellKey(cell.cell)}`}
            points={getCellPolygon(layout, cell.cell)}
            fill={targetFill}
            stroke={targetStroke}
            strokeWidth={3}
          />
        ))}
        {objectiveMapPreview.targetRoute && (
          <polyline
            points={buildPathPoints(layout, objectiveMapPreview.targetRoute.cells)}
            fill="none"
            stroke={targetStroke}
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.92}
          />
        )}
        {anchorCell && (() => {
          const center = getCellCenter(layout, anchorCell.cell);
          return (
            <g transform={`translate(${center.x} ${center.y})`}>
              <circle r={16} fill="rgba(8, 14, 24, 0.88)" stroke={ownerStroke} strokeWidth={2.2} />
              <circle r={6} fill={targetStroke} />
              <text
                x={0}
                y={28}
                textAnchor="middle"
                fill="#eef6ff"
                style={{ fontSize: 10, fontWeight: 700, paintOrder: "stroke", stroke: "rgba(8,11,17,0.86)", strokeWidth: 4 }}
              >
                Ancrage
              </text>
            </g>
          );
        })()}
      </g>
    );
  }, [activeTool, layout, objectiveMapPreview]);
  const allGeographyPresets = useMemo(() => [...GEOGRAPHY_PRESETS, ...customGeographies], [customGeographies]);
  const allTagPresets = useMemo(() => [...TAG_PRESETS, ...customTags], [customTags]);
  const contextualHexSection =
    activeTool === "terrain"
      ? "terrain"
      : activeTool === "places"
        ? "places"
        : activeTool === "zones"
          ? "zones"
          : activeTool === "routes"
            ? "routes"
            : activeTool === "simulation"
              ? "simulation"
              : null;

  function buildTerritoryPropertyDraft(territoryId: string) {
    const territory = layout.governanceTerritories?.find(entry => entry.id === territoryId) ?? null;
    const governance = territory?.governanceId ? layout.governances?.find(entry => entry.id === territory.governanceId) ?? null : null;
    return {
      id: territory?.id ?? territoryId,
      wikiEntityId: territory?.wikiEntityId ?? "",
      color: territory?.color ?? "#6b5d90",
      capitalCityId: governance?.capitalCityId ?? ""
    };
  }

  function buildRegionPropertyDraft(regionId: string) {
    const region = layout.governanceRegions?.find(entry => entry.id === regionId) ?? null;
    return {
      id: region?.id ?? regionId,
      wikiEntityId: region?.wikiEntityId ?? "",
      color: region?.color ?? "#6d8ca0",
      territoryId: region?.territoryId ?? "",
      principalCityId: region?.principalCityId ?? ""
    };
  }

  function buildGeographicZonePropertyDraft(zoneId: string) {
    const zone = layout.geographicZones?.find(entry => entry.id === zoneId) ?? null;
    return {
      id: zone?.id ?? zoneId,
      wikiEntityId: zone?.wikiEntityId ?? "",
      label: zone?.label ?? "",
      kind: zone?.kind ?? ("natural" as GeographicZoneKind),
      color: zone?.color ?? "#5d8f7b",
      borderColor: zone?.borderColor ?? zone?.color ?? "#5d8f7b",
      borderWidth: String(zone?.borderWidth ?? 1.6),
      borderDashArray: zone?.borderDashArray ?? "5 4"
    };
  }

  function getTerritoryDisplayName(territoryId: string): string {
    const territory = layout.governanceTerritories?.find(entry => entry.id === territoryId) ?? null;
    if (!territory) return territoryId;
    const wikiName = territory.wikiEntityId ? wikiEntriesById[territory.wikiEntityId]?.name : "";
    return wikiName || territory.wikiEntityId || territory.id;
  }

  function getRegionDisplayName(regionId: string): string {
    const region = layout.governanceRegions?.find(entry => entry.id === regionId) ?? null;
    if (!region) return regionId;
    const wikiName = region.wikiEntityId ? wikiEntriesById[region.wikiEntityId]?.name : "";
    return wikiName || region.wikiEntityId || region.id;
  }

  function getGeographicZoneDisplayName(zoneId: string): string {
    const zone = layout.geographicZones?.find(entry => entry.id === zoneId) ?? null;
    if (!zone) return zoneId;
    const wikiName = zone.wikiEntityId ? wikiEntriesById[zone.wikiEntityId]?.name : "";
    return wikiName || zone.label || zone.wikiEntityId || zone.id;
  }

  function createSimulationFactionDefinition() {
    const normalizedId = slugifyDraft(draftSimulationFactionId || draftSimulationFactionLabel);
    if (!normalizedId) return;
    const nextFaction: WorldMapSimulationFaction = {
      id: normalizedId,
      label: draftSimulationFactionLabel.trim() || normalizedId,
      type: draftSimulationFactionType.trim() || "faction",
      color: draftSimulationFactionColor,
      description: "",
      agenda: "",
      methods: [],
      objectiveHints: [],
      tags: [],
      homeCityId: selectedCity?.id,
      homeRegionId: selectedGovernanceRegionId || undefined,
      baseCell: selectedCell?.cell ? { ...selectedCell.cell } : undefined,
      presenceCells: selectedCell?.cell ? [{ ...selectedCell.cell }] : [],
      controlledZoneIds: [],
      influencedZoneIds: [],
      interestZoneIds: [],
      avoidedZoneIds: [],
      localAnchors: [],
      influence: 40,
      power: 40,
      cohesion: 50,
      aggression: 35,
      secrecy: 30,
      resources: 45,
      relations: []
    };
    dispatch({ type: "createSimulationFaction", faction: nextFaction });
  }

  function createSimulationFactionRelationDefinition() {
    if (!selectedSimulationFaction || !draftSimulationRelationTargetFactionId || draftSimulationRelationTargetFactionId === selectedSimulationFaction.id) return;
    dispatch({
      type: "createSimulationFactionRelation",
      relation: {
        targetFactionId: draftSimulationRelationTargetFactionId,
        status: draftSimulationRelationStatus,
        trust: 50,
        hostility: draftSimulationRelationStatus === "ally" ? 10 : draftSimulationRelationStatus === "war" ? 85 : draftSimulationRelationStatus === "rival" ? 60 : 35,
        notes: ""
      }
    });
  }

  function applySelectedCellsToFactionPresence(mode: "replace" | "add" | "remove") {
    const targetKeys = selectedAreaCellKeys.length > 0 ? selectedAreaCellKeys : selectedCellKey ? [selectedCellKey] : [];
    if (!selectedSimulationFaction || targetKeys.length === 0) return;
    if (mode === "replace") {
      dispatch({ type: "replaceSelectedSimulationFactionPresence", cellKeys: targetKeys });
      return;
    }
    if (mode === "add") {
      dispatch({ type: "addSelectedSimulationFactionPresence", cellKeys: targetKeys });
      return;
    }
    dispatch({ type: "removeSelectedSimulationFactionPresence", cellKeys: targetKeys });
  }

  function createSimulationObjectiveDefinition() {
    const normalizedId = slugifyDraft(draftSimulationObjectiveId || draftSimulationObjectiveLabel);
    if (!normalizedId || !effectiveObjectiveOwnerFactionId) return;
    const zoneIds = selectedAreaCellKeys.length > 0 ? selectedAreaCellKeys : selectedCellKey ? [selectedCellKey] : [];
    const nextObjective: WorldMapSimulationObjective = {
      id: normalizedId,
      label: draftSimulationObjectiveLabel.trim() || normalizedId,
      category: draftSimulationObjectiveCategory,
      ownerFactionId: effectiveObjectiveOwnerFactionId,
      description: "",
      whyItMatters: "",
      targetKind: selectedCity?.id ? "city" : selectedGovernanceRegionId ? "region" : undefined,
      targetId: selectedCity?.id ?? selectedGovernanceRegionId ?? undefined,
      priority: 60,
      progress: 0,
      state: "planned",
      phases: [],
      currentPhaseIndex: 0,
      obstacleHints: [],
      compatibleActionIds: [],
      requiredAnchorId: undefined,
      requiredAnchorType: undefined,
      onSuccess: [],
      onFailure: [],
      tags: [],
      zoneIds,
      anchorCell: selectedCell?.cell ? { ...selectedCell.cell } : undefined
    };
    dispatch({ type: "createSimulationObjective", objective: nextObjective });
  }

  function replaceSelectedCellsAsObjectiveZones() {
    if (!selectedSimulationObjective) return;
    const zoneIds = selectedAreaCellKeys.length > 0 ? selectedAreaCellKeys : selectedCellKey ? [selectedCellKey] : [];
    if (zoneIds.length === 0) return;
    dispatch({
      type: "replaceSelectedSimulationObjectiveZones",
      zoneIds,
      anchorCellKey: selectedCellKey || undefined
    });
  }

  function createNativeDistrictForSelectedCity() {
    if (!selectedCity) return;
    const zoneIds = selectedAreaCellKeys.length > 0 ? selectedAreaCellKeys : selectedCellKey ? [selectedCellKey] : [];
    const nextIndex = selectedCityNativeDistricts.length + 1;
    const nextDistrict: WorldMapSimulationDistrict = {
      id: `${selectedCity.id}:native_${nextIndex}`,
      cityId: selectedCity.id,
      name: `Quartier ${nextIndex}`,
      tags: [],
      cellKeys: zoneIds,
      dominantActivities: [],
      importantPlaces: [],
      populationProfile: undefined
    };
    dispatch({ type: "createSimulationDistrict", district: nextDistrict });
  }

  function updateSelectedObjectiveListField(
    field: "obstacleHints" | "compatibleActionIds" | "tags",
    values: string[]
  ) {
    if (!selectedSimulationObjective) return;
    dispatch({
      type: "updateSelectedSimulationObjectiveField",
      field,
      value: values.join(", ")
    });
  }

  function addValueToSelectedObjectiveListField(
    field: "obstacleHints" | "compatibleActionIds" | "tags",
    value: string
  ) {
    if (!selectedSimulationObjective) return;
    const normalizedValue = normalizeListDraftValue(value);
    if (!normalizedValue) return;
    updateSelectedObjectiveListField(field, Array.from(new Set([...(selectedSimulationObjective[field] ?? []), normalizedValue])));
  }

  function removeValueFromSelectedObjectiveListField(
    field: "obstacleHints" | "compatibleActionIds" | "tags",
    value: string
  ) {
    if (!selectedSimulationObjective) return;
    updateSelectedObjectiveListField(
      field,
      (selectedSimulationObjective[field] ?? []).filter(entry => entry !== value)
    );
  }

  function updateSelectedObjectivePhases(phases: WorldMapSimulationObjectivePhase[]) {
    if (!selectedSimulationObjective) return;
    dispatch({
      type: "createSimulationObjective",
      objective: {
        ...selectedSimulationObjective,
        phases
      }
    });
  }

  function updateSelectedObjectiveRecord(patch: Partial<WorldMapSimulationObjective>) {
    if (!selectedSimulationObjective) return;
    dispatch({
      type: "createSimulationObjective",
      objective: {
        ...selectedSimulationObjective,
        ...patch
      }
    });
  }

  function updateSelectedObjectivePhase(
    phaseId: string,
    updater: (phase: WorldMapSimulationObjectivePhase, index: number) => WorldMapSimulationObjectivePhase
  ) {
    if (!selectedSimulationObjective) return;
    updateSelectedObjectivePhases(
      (selectedSimulationObjective.phases ?? []).map((phase, index) => (phase.id === phaseId ? updater(phase, index) : phase))
    );
  }

  function updateSelectedObjectivePhaseField<K extends keyof WorldMapSimulationObjectivePhase>(
    phaseId: string,
    field: K,
    value: WorldMapSimulationObjectivePhase[K]
  ) {
    updateSelectedObjectivePhase(phaseId, phase => ({ ...phase, [field]: value }));
  }

  function updateSelectedObjectivePhaseListField(
    phaseId: string,
    field: "zoneIds" | "compatibleActionIds" | "fatalFailureConditions" | "notes",
    values: string[]
  ) {
    updateSelectedObjectivePhaseField(phaseId, field, Array.from(new Set(values.map(entry => entry.trim()).filter(Boolean))));
  }

  function addValueToSelectedObjectivePhaseListField(
    phaseId: string,
    field: "zoneIds" | "compatibleActionIds" | "fatalFailureConditions" | "notes",
    value: string
  ) {
    const normalizedValue = normalizeListDraftValue(value);
    if (!normalizedValue || !selectedSimulationObjective) return;
    const phase = (selectedSimulationObjective.phases ?? []).find(entry => entry.id === phaseId);
    updateSelectedObjectivePhaseListField(phaseId, field, [...(phase?.[field] ?? []), normalizedValue]);
  }

  function removeValueFromSelectedObjectivePhaseListField(
    phaseId: string,
    field: "zoneIds" | "compatibleActionIds" | "fatalFailureConditions" | "notes",
    value: string
  ) {
    if (!selectedSimulationObjective) return;
    const phase = (selectedSimulationObjective.phases ?? []).find(entry => entry.id === phaseId);
    updateSelectedObjectivePhaseListField(phaseId, field, (phase?.[field] ?? []).filter(entry => entry !== value));
  }

  function addSelectedObjectivePhase(label: string) {
    if (!selectedSimulationObjective) return;
    const normalizedLabel = normalizeListDraftValue(label);
    if (!normalizedLabel) return;
    const phases = selectedSimulationObjective.phases ?? [];
    updateSelectedObjectivePhases([
      ...phases,
      createEditorObjectivePhase(normalizedLabel, phases.length, selectedSimulationObjective.compatibleActionIds)
    ]);
  }

  function removeSelectedObjectivePhase(phaseId: string) {
    if (!selectedSimulationObjective) return;
    updateSelectedObjectivePhases((selectedSimulationObjective.phases ?? []).filter(phase => phase.id !== phaseId));
  }

  function replaceSelectedObjectiveCompatibleActions(values: string[]) {
    updateSelectedObjectiveListField("compatibleActionIds", Array.from(new Set(values.map(value => value.trim()).filter(Boolean))));
  }

  function updateSelectedFactionListField(field: "methods" | "objectiveHints" | "tags", values: string[]) {
    if (!selectedSimulationFaction) return;
    dispatch({
      type: "updateSelectedSimulationFactionField",
      field,
      value: values.join(", ")
    });
  }

  function addValueToSelectedFactionListField(field: "methods" | "objectiveHints" | "tags", value: string) {
    if (!selectedSimulationFaction) return;
    const normalizedValue = normalizeListDraftValue(value);
    if (!normalizedValue) return;
    updateSelectedFactionListField(field, Array.from(new Set([...(selectedSimulationFaction[field] ?? []), normalizedValue])));
  }

  function removeValueFromSelectedFactionListField(field: "methods" | "objectiveHints" | "tags", value: string) {
    if (!selectedSimulationFaction) return;
    updateSelectedFactionListField(
      field,
      (selectedSimulationFaction[field] ?? []).filter(entry => entry !== value)
    );
  }

  function updateSelectedMobileListField(field: "objectiveIds" | "interactionTags", values: string[]) {
    if (!selectedSimulationMobileActor) return;
    dispatch({
      type: "updateSelectedSimulationMobileActorField",
      field,
      value: values.join(", ")
    });
  }

  function addValueToSelectedMobileListField(field: "objectiveIds" | "interactionTags", value: string) {
    if (!selectedSimulationMobileActor) return;
    const normalizedValue = normalizeListDraftValue(value);
    if (!normalizedValue) return;
    updateSelectedMobileListField(field, Array.from(new Set([...(selectedSimulationMobileActor[field] ?? []), normalizedValue])));
  }

  function removeValueFromSelectedMobileListField(field: "objectiveIds" | "interactionTags", value: string) {
    if (!selectedSimulationMobileActor) return;
    updateSelectedMobileListField(
      field,
      (selectedSimulationMobileActor[field] ?? []).filter(entry => entry !== value)
    );
  }

  function getMobileArchetypePreset(archetypeId: string | undefined): MobileArchetypePreset | null {
    if (!archetypeId) return null;
    return MOBILE_ARCHETYPE_PRESETS.find(preset => preset.id === archetypeId) ?? null;
  }

  function applyPresetToSelectedMobile(preset: MobileArchetypePreset) {
    if (!selectedSimulationMobileActor) return;
    dispatch({ type: "updateSelectedSimulationMobileActorField", field: "archetype", value: preset.id });
    dispatch({ type: "updateSelectedSimulationMobileActorField", field: "type", value: preset.internalType });
    dispatch({
      type: "updateSelectedSimulationMobileActorField",
      field: "missionLabel",
      value: selectedSimulationMobileActor.missionLabel ?? preset.defaultMissionLabel
    });
    dispatch({
      type: "updateSelectedSimulationMobileActorField",
      field: "missionPriority",
      value: selectedSimulationMobileActor.missionPriority ?? "standard"
    });
    dispatch({ type: "updateSelectedSimulationMobileActorField", field: "simulationLevel", value: preset.recommendedSimulationLevel });
    dispatch({ type: "updateSelectedSimulationMobileActorField", field: "speed", value: String(preset.stats.speed) });
    dispatch({ type: "updateSelectedSimulationMobileActorField", field: "security", value: String(preset.stats.security) });
    dispatch({ type: "updateSelectedSimulationMobileActorField", field: "fatigue", value: String(preset.stats.fatigue) });
    dispatch({ type: "updateSelectedSimulationMobileActorField", field: "cargo", value: String(preset.stats.cargo) });
    dispatch({ type: "updateSelectedSimulationMobileActorField", field: "headcount", value: String(preset.stats.headcount) });
    dispatch({ type: "updateSelectedSimulationMobileActorField", field: "resources", value: String(preset.stats.resources) });
    updateSelectedMobileListField(
      "interactionTags",
      Array.from(new Set([...(selectedSimulationMobileActor.interactionTags ?? []), ...preset.recommendedInteractionTags]))
    );
  }

  function updateSelectedObjectiveConsequences(
    field: "onSuccess" | "onFailure",
    consequences: WorldMapSimulationConsequence[]
  ) {
    if (!selectedSimulationObjective) return;
    dispatch({
      type: "updateSelectedSimulationObjectiveField",
      field,
      value: formatSimulationConsequences(consequences)
    });
  }

  function removeSelectedObjectiveConsequence(field: "onSuccess" | "onFailure", index: number) {
    if (!selectedSimulationObjective) return;
    const nextConsequences = (selectedSimulationObjective[field] ?? []).filter((_, entryIndex) => entryIndex !== index);
    updateSelectedObjectiveConsequences(field, nextConsequences);
  }

  function addSelectedObjectiveConsequence(field: "onSuccess" | "onFailure") {
    if (!selectedSimulationObjective) return;
    const draft = pendingObjectiveConsequences[field];
    const numericAmount = Number(draft.amount);
    if (!draft.subtype || !Number.isFinite(numericAmount)) return;
    const tags = draft.tags;
    let consequence: WorldMapSimulationConsequence;
    if (draft.type === "create_tension") {
      consequence = {
        type: "create_tension",
        tensionType: draft.subtype as Extract<WorldMapSimulationConsequence, { type: "create_tension" }>["tensionType"],
        severity: numericAmount,
        tags
      };
    } else if (draft.type === "open_opportunity") {
      consequence = {
        type: "open_opportunity",
        kind: draft.subtype as Extract<WorldMapSimulationConsequence, { type: "open_opportunity" }>["kind"],
        score: numericAmount,
        tags
      };
    } else {
      consequence = {
        type: "spawn_signal",
        signalKind: draft.subtype as Extract<WorldMapSimulationConsequence, { type: "spawn_signal" }>["signalKind"],
        intensity: numericAmount,
        tags
      };
    }
    updateSelectedObjectiveConsequences(field, [...(selectedSimulationObjective[field] ?? []), consequence]);
    setPendingObjectiveConsequences(current => ({
      ...current,
      [field]: {
        ...current[field],
        amount: current[field].type === "spawn_signal" ? "20" : current[field].amount,
        tags: []
      }
    }));
  }

  function createSimulationMobileActorDefinition() {
    const normalizedId = slugifyDraft(draftSimulationMobileActorId || draftSimulationMobileActorLabel);
    if (!normalizedId) return;
    const archetypePreset = getMobileArchetypePreset(draftSimulationMobileActorArchetype);
    const missionLabel = selectedSimulationObjective?.label ?? archetypePreset?.defaultMissionLabel;
    const missionTargetLabel =
      selectedSimulationObjective?.targetId
        ? objectiveTargetOptions.find(option => option.id === selectedSimulationObjective.targetId)?.label ?? selectedSimulationObjective.targetId
        : selectedGovernanceRegion?.id
          ? wikiEntriesById[selectedGovernanceRegion.wikiEntityId]?.name ?? selectedGovernanceRegion.wikiEntityId ?? selectedGovernanceRegion.id
          : selectedRoute?.kind === "road"
            ? selectedRoute.label || selectedRoute.id
            : selectedCell?.cell
              ? `Cellule ${getCellLabel(selectedCell.cell)}`
              : undefined;
    const nextActor: WorldMapSimulationMobileActor = {
      id: normalizedId,
      label: draftSimulationMobileActorLabel.trim() || normalizedId,
      type: draftSimulationMobileActorType.trim() || archetypePreset?.internalType || "caravan",
      archetype: draftSimulationMobileActorArchetype || undefined,
      color: draftSimulationMobileActorColor,
      ownerFactionId: effectiveMobileOwnerFactionId || undefined,
      missionLabel,
      missionTargetLabel,
      missionPriority: "standard",
      missionStatus: selectedGovernanceRegionId || selectedSimulationObjective ? "en_route" : "preparing",
      positionKind: selectedCity?.id ? "city" : selectedRouteId ? "route" : "cell",
      positionId: selectedCity?.id ?? selectedRouteId ?? undefined,
      positionCell: selectedCell?.cell ? { ...selectedCell.cell } : undefined,
      destinationKind: selectedGovernanceRegionId ? "region" : undefined,
      destinationId: selectedGovernanceRegionId || undefined,
      destinationCell: undefined,
      itineraryMode: "auto",
      itineraryRouteIds: selectedRouteId ? [selectedRouteId] : [],
      travelMode: "road",
      speed: archetypePreset?.stats.speed ?? 40,
      security: archetypePreset?.stats.security ?? 45,
      fatigue: archetypePreset?.stats.fatigue ?? 15,
      cargo: archetypePreset?.stats.cargo ?? 30,
      headcount: archetypePreset?.stats.headcount ?? 25,
      resources: archetypePreset?.stats.resources ?? 20,
      objectiveIds: selectedSimulationObjective ? [selectedSimulationObjective.id] : [],
      interactionTags: archetypePreset?.recommendedInteractionTags ?? [],
      simulationLevel: archetypePreset?.recommendedSimulationLevel ?? "active"
    };
    dispatch({ type: "createSimulationMobileActor", actor: nextActor });
  }

  function getCellLabel(cell?: MapCell | null): string {
    if (!cell) return "Aucune cellule";
    return `(${cell.x}, ${cell.y})`;
  }

  function getMobilityPresetLabel(speed: number): string {
    if (speed >= 70) return "Tres rapide";
    if (speed >= 50) return "Rapide";
    if (speed >= 30) return "Standard";
    return "Lente";
  }

  function getSelectionChipStyle(active: boolean, accentColor?: string) {
    return {
      padding: "8px 10px",
      borderRadius: 999,
      border: active ? "1px solid rgba(255,255,255,0.66)" : "1px solid rgba(255,255,255,0.14)",
      background: active ? accentColor ?? "rgba(79,125,242,0.26)" : "rgba(255,255,255,0.06)",
      color: "#f8fbff",
      cursor: "pointer",
      fontWeight: active ? 700 : 600,
      fontSize: 12,
      boxShadow: active ? "0 0 0 2px rgba(255,255,255,0.18) inset" : "none"
    } satisfies React.CSSProperties;
  }

  function renderSimulationSelectionChips(
    items: Array<{ id: string; label: string; accentColor?: string; helper?: string }>,
    selectedId: string,
    onSelect: (id: string) => void,
    emptyMessage: string
  ) {
    if (items.length === 0) {
      return <div style={editorTextStyles.helper}>{emptyMessage}</div>;
    }
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {items.map(item => {
          const active = item.id === selectedId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              style={getSelectionChipStyle(active, item.accentColor)}
              title={item.helper}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    );
  }

  function updateSelectedFactionZoneField(
    field: "controlledZoneIds" | "influencedZoneIds" | "interestZoneIds" | "avoidedZoneIds",
    zoneIds: string[]
  ) {
    if (!selectedSimulationFaction) return;
    dispatch({
      type: "updateSelectedSimulationFactionField",
      field,
      value: zoneIds.join(", ")
    });
  }

  function addZoneToSelectedFaction(
    field: "controlledZoneIds" | "influencedZoneIds" | "interestZoneIds" | "avoidedZoneIds",
    zoneId: string
  ) {
    if (!selectedSimulationFaction || !zoneId) return;
    updateSelectedFactionZoneField(field, Array.from(new Set([...(selectedSimulationFaction[field] ?? []), zoneId])));
    setPendingFactionZoneSelections(current => ({ ...current, [field]: "" }));
  }

  function removeZoneFromSelectedFaction(
    field: "controlledZoneIds" | "influencedZoneIds" | "interestZoneIds" | "avoidedZoneIds",
    zoneId: string
  ) {
    if (!selectedSimulationFaction || !zoneId) return;
    updateSelectedFactionZoneField(
      field,
      (selectedSimulationFaction[field] ?? []).filter(entry => entry !== zoneId)
    );
  }

  function getSimulationZoneLabel(zoneId: string): string {
    return simulationZoneOptions.find(option => option.id === zoneId)?.label ?? zoneId;
  }

  function getActiveZoneCandidatesForFaction() {
    const candidates: string[] = [];
    if (selectedCity?.id) candidates.push(selectedCity.id);
    if (selectedGovernanceRegionId) candidates.push(selectedGovernanceRegionId);
    if (selectedRoute?.kind === "road") candidates.push(selectedRoute.id);
    if (selectedGeographicZoneId) candidates.push(selectedGeographicZoneId);
    selectedCityRuntimeDistricts.forEach(district => candidates.push(district.id));
    return Array.from(new Set(candidates));
  }

  function getFactionAnchorTargetOptions(targetKind: SimulationAnchorTargetKind): Array<{ id: string; label: string }> {
    if (targetKind === "city") {
      return layout.cities.map(city => ({ id: city.id, label: wikiEntriesById[city.wikiEntityId]?.name ?? city.wikiEntityId ?? city.id }));
    }
    if (targetKind === "region") {
      return (layout.governanceRegions ?? []).map(region => ({
        id: region.id,
        label: wikiEntriesById[region.wikiEntityId]?.name ?? region.wikiEntityId ?? region.id
      }));
    }
    if (targetKind === "route") {
      return roadPaths.map(path => ({ id: path.id, label: path.label || path.id }));
    }
    if (targetKind === "place") {
      return placeTargetOptions;
    }
    if (targetKind === "district") {
      return Object.values(logisticsPreview.runtimeState.districts)
        .map(district => ({ id: district.id, label: district.name }))
        .sort((left, right) => left.label.localeCompare(right.label));
    }
    return [];
  }

  function createSimulationFactionAnchorDefinition() {
    if (!selectedSimulationFaction) return;
    const anchorIndex = (selectedSimulationFaction.localAnchors?.length ?? 0) + 1;
    const activeDistrict = selectedCityRuntimeDistricts[0];
    const targetKind: SimulationAnchorTargetKind = selectedCity?.id
      ? "city"
      : activeDistrict
        ? "district"
        : selectedGovernanceRegionId
          ? "region"
          : selectedRoute?.kind === "road"
            ? "route"
            : "cell";
    const targetId =
      targetKind === "city"
        ? selectedCity?.id
        : targetKind === "district"
          ? activeDistrict?.id
          : targetKind === "region"
            ? selectedGovernanceRegionId || undefined
            : targetKind === "route"
              ? selectedRoute?.id
              : undefined;
    const nextAnchor: WorldMapSimulationFactionAnchor = {
      id: `${selectedSimulationFaction.id}_anchor_${anchorIndex}`,
      label: `Ancrage ${anchorIndex}`,
      type: "safehouse",
      targetKind,
      targetId,
      cell: targetKind === "cell" ? (selectedCell?.cell ? { ...selectedCell.cell } : undefined) : undefined,
      level: 1,
      tags: [],
      notes: ""
    };
    dispatch({ type: "createSimulationFactionAnchor", anchor: nextAnchor });
  }

  function focusExistingCell(cell?: MapCell | null) {
    if (!cell) return;
    const cellKey = getWorldMapCellKey(cell);
    if (!layout.cells.some(entry => getWorldMapCellKey(entry.cell) === cellKey)) return;
    dispatch({ type: "setSelectedCell", cellKey });
  }

  function focusCityById(cityId: string): boolean {
    const city = layout.cities.find(entry => entry.id === cityId);
    if (!city) return false;
    dispatch({ type: "activateTool", toolId: "places" });
    focusExistingCell(city.cell);
    return true;
  }

  function focusRegionById(regionId: string): boolean {
    const region = (layout.governanceRegions ?? []).find(entry => entry.id === regionId);
    if (!region) return false;
    dispatch({ type: "activateTool", toolId: "zones" });
    dispatch({ type: "replaceLayout", nextState: { selectedGovernanceRegionId: regionId } });
    const principalCity = region.principalCityId ? layout.cities.find(city => city.id === region.principalCityId) ?? null : null;
    focusExistingCell(principalCity?.cell ?? region.labelCell);
    return true;
  }

  function focusZoneById(zoneId: string): boolean {
    const zone = (layout.geographicZones ?? []).find(entry => entry.id === zoneId);
    if (!zone) return false;
    dispatch({ type: "activateTool", toolId: "zones" });
    dispatch({ type: "replaceLayout", nextState: { selectedGeographicZoneId: zoneId } });
    focusExistingCell(zone.labelCell);
    return true;
  }

  function focusRouteById(routeId: string): boolean {
    const route = layout.paths.find(entry => entry.id === routeId);
    if (!route) return false;
    dispatch({ type: "activateTool", toolId: "routes" });
    dispatch({ type: "setSelectedRoute", routeId });
    focusExistingCell(route.cells[0]);
    return true;
  }

  function focusFactionById(factionId: string): boolean {
    const faction = simulationFactions.find(entry => entry.id === factionId);
    if (!faction) return false;
    dispatch({ type: "activateTool", toolId: "simulation" });
    dispatch({ type: "setSelectedSimulationFaction", factionId });
    focusExistingCell(faction.baseCell ?? faction.presenceCells[0] ?? null);
    if (!faction.baseCell && !faction.presenceCells.length && faction.homeCityId) {
      focusCityById(faction.homeCityId);
      dispatch({ type: "activateTool", toolId: "simulation" });
      dispatch({ type: "setSelectedSimulationFaction", factionId });
    }
    return true;
  }

  function focusObjectiveById(objectiveId: string): boolean {
    const objective = simulationObjectives.find(entry => entry.id === objectiveId);
    if (!objective) return false;
    dispatch({ type: "activateTool", toolId: "simulation" });
    if (objective.ownerFactionId) {
      dispatch({ type: "setSelectedSimulationFaction", factionId: objective.ownerFactionId });
    }
    dispatch({ type: "setSelectedSimulationObjective", objectiveId });
    focusExistingCell(objective.anchorCell ?? null);
    return true;
  }

  function focusMobileActorById(actorId: string): boolean {
    const actor = simulationMobileActors.find(entry => entry.id === actorId);
    if (!actor) return false;
    dispatch({ type: "activateTool", toolId: "simulation" });
    if (actor.ownerFactionId) {
      dispatch({ type: "setSelectedSimulationFaction", factionId: actor.ownerFactionId });
    }
    dispatch({ type: "setSelectedSimulationMobileActor", actorId });
    focusExistingCell(actor.positionCell ?? actor.destinationCell ?? null);
    if (!actor.positionCell && actor.positionKind === "city" && actor.positionId) {
      focusCityById(actor.positionId);
      dispatch({ type: "activateTool", toolId: "simulation" });
      dispatch({ type: "setSelectedSimulationMobileActor", actorId });
    }
    return true;
  }

  function focusDistrictById(districtId: string): boolean {
    const district = logisticsPreview.runtimeState.districts[districtId];
    if (!district) return false;
    return focusCityById(district.cityId);
  }

  function focusEntityRef(ref?: { kind: string; id: string } | null): boolean {
    if (!ref?.id) return false;
    if (ref.kind === "city") return focusCityById(ref.id);
    if (ref.kind === "region") return focusRegionById(ref.id);
    if (ref.kind === "route") return focusRouteById(ref.id);
    if (ref.kind === "faction") return focusFactionById(ref.id);
    if (ref.kind === "specialObjective") return focusObjectiveById(ref.id);
    if (ref.kind === "mobileActor") return focusMobileActorById(ref.id);
    if (ref.kind === "district") return focusDistrictById(ref.id);
    return false;
  }

  function handlePreflightIssueClick(issue: SimulationPreflightIssue): boolean {
    const entityId = issue.entityId?.trim();
    if (!entityId) return false;

    if (issue.scope === "faction") return focusFactionById(entityId);
    if (issue.scope === "objective") return focusObjectiveById(entityId);
    if (issue.scope === "mobileActor") return focusMobileActorById(entityId);
    if (issue.scope === "district") return focusDistrictById(entityId);

    if (layout.cities.some(entry => entry.id === entityId)) return focusCityById(entityId);
    if ((layout.governanceRegions ?? []).some(entry => entry.id === entityId)) return focusRegionById(entityId);
    if ((layout.geographicZones ?? []).some(entry => entry.id === entityId)) return focusZoneById(entityId);
    if (layout.paths.some(entry => entry.id === entityId)) return focusRouteById(entityId);
    if (simulationFactions.some(entry => entry.id === entityId)) return focusFactionById(entityId);
    if (simulationObjectives.some(entry => entry.id === entityId)) return focusObjectiveById(entityId);
    if (simulationMobileActors.some(entry => entry.id === entityId)) return focusMobileActorById(entityId);
    if (entityId in logisticsPreview.runtimeState.districts) return focusDistrictById(entityId);

    return false;
  }

  function applySelectedCellToMobile(field: "positionCell" | "destinationCell") {
    if (!selectedCell?.cell) return;
    dispatch({
      type: "setSelectedSimulationMobileActorCellField",
      field,
      cell: { ...selectedCell.cell }
    });
  }

  function clearMobileCell(field: "positionCell" | "destinationCell") {
    dispatch({
      type: "setSelectedSimulationMobileActorCellField",
      field,
      cell: undefined
    });
  }

  function autoComputeSelectedMobileItinerary() {
    if (!selectedSimulationMobileActor) return;
    const runtimeState = createWorldStateFromMapLayout(layout);
    const runtimeActor = runtimeState.mobileActors[`mobile:map:${selectedSimulationMobileActor.id}`];
    if (!runtimeActor || !runtimeActor.destination) return;
    const itinerary = findShortestRouteItinerary(runtimeState, runtimeActor);
    dispatch({
      type: "updateSelectedSimulationMobileActorField",
      field: "itineraryMode",
      value: "auto"
    });
    dispatch({
      type: "updateSelectedSimulationMobileActorField",
      field: "itineraryRouteIds",
      value: itinerary.join(", ")
    });
  }

  function setSelectedMobileItinerary(routeIds: string[]) {
    dispatch({
      type: "updateSelectedSimulationMobileActorField",
      field: "itineraryMode",
      value: "locked"
    });
    dispatch({
      type: "updateSelectedSimulationMobileActorField",
      field: "itineraryRouteIds",
      value: routeIds.join(", ")
    });
  }

  function replaceSelectedMobileItineraryWithRoute() {
    if (!selectedSimulationMobileActor || !selectedRoute || selectedRoute.kind !== "road") return;
    setSelectedMobileItinerary([selectedRoute.id]);
  }

  function appendSelectedRouteToMobileItinerary() {
    if (!selectedSimulationMobileActor || !selectedRoute || selectedRoute.kind !== "road") return;
    setSelectedMobileItinerary(
      Array.from(new Set([...(selectedSimulationMobileActor.itineraryRouteIds ?? []), selectedRoute.id]))
    );
  }

  function removeSelectedRouteFromMobileItinerary() {
    if (!selectedSimulationMobileActor || !selectedRoute || selectedRoute.kind !== "road") return;
    setSelectedMobileItinerary(
      (selectedSimulationMobileActor.itineraryRouteIds ?? []).filter(routeId => routeId !== selectedRoute.id)
    );
  }

  function popSelectedMobileItineraryRoute() {
    if (!selectedSimulationMobileActor) return;
    setSelectedMobileItinerary((selectedSimulationMobileActor.itineraryRouteIds ?? []).slice(0, -1));
  }

  useEffect(() => {
    if (!selectedGovernanceTerritoryId) {
      setTerritoryPropertiesEditActive(false);
      setTerritoryPropertyDraft({ id: "", wikiEntityId: "", color: "#6b5d90", capitalCityId: "" });
      return;
    }
    if (!territoryPropertiesEditActive) {
      setTerritoryPropertyDraft(buildTerritoryPropertyDraft(selectedGovernanceTerritoryId));
    }
  }, [layout.governanceTerritories, layout.governances, selectedGovernanceTerritoryId, territoryPropertiesEditActive]);

  useEffect(() => {
    if (!selectedGovernanceRegionId) {
      setRegionPropertiesEditActive(false);
      setRegionPropertyDraft({ id: "", wikiEntityId: "", color: "#6d8ca0", territoryId: "", principalCityId: "" });
      return;
    }
    if (!regionPropertiesEditActive) {
      setRegionPropertyDraft(buildRegionPropertyDraft(selectedGovernanceRegionId));
    }
  }, [layout.governanceRegions, selectedGovernanceRegionId, regionPropertiesEditActive]);

  useEffect(() => {
    if (!selectedGeographicZoneId) {
      setGeographicZonePropertiesEditActive(false);
      setGeographicZonePropertyDraft({
        id: "",
        wikiEntityId: "",
        label: "",
        kind: "natural",
        color: "#5d8f7b",
        borderColor: "#5d8f7b",
        borderWidth: "1.6",
        borderDashArray: "5 4"
      });
      return;
    }
    if (!geographicZonePropertiesEditActive) {
      setGeographicZonePropertyDraft(buildGeographicZonePropertyDraft(selectedGeographicZoneId));
    }
  }, [layout.geographicZones, selectedGeographicZoneId, geographicZonePropertiesEditActive]);

  useEffect(() => {
    if (!footprintFeedback) return;
    const timer = window.setTimeout(() => setFootprintFeedback(null), 2200);
    return () => window.clearTimeout(timer);
  }, [footprintFeedback]);
  useEffect(() => {
    updateJsonBuffer(layoutToJson(persistedLayout));
  }, [persistedLayout]);

  function activateTool(toolId: EditorToolId): void {
    if (toolId !== "zones" && zoneEditSession) {
      setZoneEditSession(null);
    }
    if (toolId !== "terrain" && toolId !== "zones") {
      dispatch({ type: "clearAreaSelection" });
    }
    dispatch({ type: "activateTool", toolId });
  }

  const activeToolLabel = useMemo(() => {
    switch (activeTool) {
      case "terrain":
        return "Terrain";
      case "places":
        return "Lieux";
      case "zones":
        return "Organisation";
      case "routes":
        return "Trace";
      case "simulation":
        return "Simulation";
      default:
        return "Main";
    }
  }, [activeTool]);

  const activeToolHint = useMemo(() => {
    switch (activeTool) {
      case "terrain":
        return "Clic simple: remplace la selection par cette case. Shift+clic: ajoute ou retire des cases.";
      case "places":
        return "Clique un hex ou une ville pour preparer les liaisons de lieux.";
      case "zones":
        return zoneEditSession ? "Mode emprise actif: clique pour ajouter ou retirer des cases, puis valide ou annule." : "Selectionne un element dans la bibliotheque, puis utilise `Editer l'emprise` pour charger sa zone.";
      case "routes":
        return "Clique un hex ajoute un point au trace actif.";
      case "simulation":
        return "Selectionne une faction, puis utilise la selection de cases pour definir sa presence et ses ancrages.";
      default:
        return "Clique un hex pour inspecter. Maintiens Espace puis glisse pour deplacer la carte.";
    }
  }, [activeTool, zoneEditSession]);

  const persistenceMeta = useMemo(() => {
    if (persistenceState === "saving") {
      return { label: "Sauvegarde en cours", color: "#8fb3ff" };
    }
    if (isDirty) {
      return { label: "Modifications non sauvegardees", color: "#f4c967" };
    }
    if (persistenceState === "error") {
      return { label: "Erreur de sauvegarde", color: "#ff9d76" };
    }
    if (persistenceState === "saved") {
      return { label: "Sauvegarde serveur OK", color: "#8dd6a5" };
    }
    return { label: "Carte a jour", color: "#c8d0de" };
  }, [isDirty, persistenceState]);

  function updateJsonBuffer(value: string): void {
    dispatch({ type: "setJsonBuffer", value });
  }

  function updateJsonError(value: string | null): void {
    dispatch({ type: "setJsonError", value });
  }

  function updateLoreField(
    field:
      | "selectedLoreCityId"
      | "selectedLoreLocationId"
      | "selectedGovernanceLoreId"
      | "selectedGeographicZoneLoreId",
    value: string
  ): void {
    dispatch({ type: "setLoreField", field, value });
  }

  function updateDraftField(
    field:
      | "draftCityName"
      | "draftTerritoryId"
      | "draftTerritoryColor"
      | "draftRegionId"
      | "draftRegionColor"
      | "draftGovernanceId"
      | "draftGovernanceColor"
      | "draftGovernanceCapitalCityId"
      | "selectedGovernanceTerritoryId"
      | "selectedGovernanceRegionId"
      | "selectedGeographicZoneId"
      | "draftGeographicZoneId"
      | "draftGeographicZoneLabel"
      | "draftGeographicZoneColor"
      | "draftGeographicZoneBorderColor"
      | "draftGeographicZoneBorderWidth"
      | "draftGeographicZoneBorderDashArray"
      | "draftGeographicZoneKind"
      | "draftGeographyName"
      | "draftGeographyColor"
      | "draftGeographySurface"
      | "draftGeographyDifficulty"
      | "draftTagName"
      | "draftTagColor",
    value: string | "land" | "ocean" | GeographicZoneKind
  ): void {
    dispatch({ type: "setDraftField", field, value });
  }

  function updateHexModalPosition(position: { x: number; y: number }): void {
    dispatch({ type: "setHexModalPosition", position });
  }

  function updatePersistenceState(value: "idle" | "saving" | "saved" | "error"): void {
    dispatch({ type: "setPersistenceState", value });
  }

  function updateLastSavedLayoutJson(value: string): void {
    dispatch({ type: "setLastSavedLayoutJson", value });
  }

  function updateLabelAppearance<K extends keyof MapLabelAppearanceSet>(
    family: K,
    field: keyof MapLabelAppearanceSet[K],
    value: string | number | boolean
  ): void {
    setLabelAppearance(current => ({
      ...current,
      [family]: {
        ...current[family],
        [field]: value
      }
    }));
  }

  function selectGovernanceTerritoryFromLibrary(territoryId: string): void {
    updateDraftField("selectedGovernanceTerritoryId", territoryId);
    setTerritoryPropertiesEditActive(false);
    setTerritoryPropertyDraft(buildTerritoryPropertyDraft(territoryId));
    if (zoneEditSession) {
      setZoneEditSession(null);
    }
    dispatch({ type: "clearAreaSelection" });
  }

  function activateGovernanceTerritorySelection(territoryId: string): void {
    selectGovernanceTerritoryFromLibrary(territoryId);
  }

  function selectGovernanceRegionFromLibrary(regionId: string): void {
    updateDraftField("selectedGovernanceRegionId", regionId);
    setRegionPropertiesEditActive(false);
    setRegionPropertyDraft(buildRegionPropertyDraft(regionId));
  }

  function activateGovernanceRegionSelection(regionId: string): void {
    selectGovernanceRegionFromLibrary(regionId);
    if (zoneEditSession) {
      setZoneEditSession(null);
    }
    dispatch({ type: "clearAreaSelection" });
  }

  function selectGeographicZoneFromLibrary(zoneId: string): void {
    updateDraftField("selectedGeographicZoneId", zoneId);
    setGeographicZonePropertiesEditActive(false);
    setGeographicZonePropertyDraft(buildGeographicZonePropertyDraft(zoneId));
  }

  function activateGeographicZoneSelection(zoneId: string): void {
    selectGeographicZoneFromLibrary(zoneId);
    if (zoneEditSession) {
      setZoneEditSession(null);
    }
    dispatch({ type: "clearAreaSelection" });
  }

  function replaceLayoutState(nextLayout: WorldMapLayout, resetHistory = false): void {
    const nextLayoutWithPresets = withEditorPresets(nextLayout, customGeographies, customTags);
    dispatch({
      type: "replaceLayout",
      resetHistory,
      nextState: {
        layout: cloneLayout(nextLayoutWithPresets),
        layerVisibility: { ...nextLayoutWithPresets.defaultLayers },
        selectedRouteId: nextLayoutWithPresets.paths[0]?.id ?? "",
        selectedAreaCellKeys: [],
        customGeographies: [...(nextLayout.editorPresets?.customGeographies ?? [])],
        customTags: [...(nextLayout.editorPresets?.customTags ?? [])],
        jsonBuffer: layoutToJson(nextLayoutWithPresets),
        jsonError: null
      }
    });
  }

  useEffect(() => {
    function handleMouseMove(event: MouseEvent): void {
      const drag = hexModalDragRef.current;
      if (!drag) return;
      updateHexModalPosition({
        x: Math.max(16, drag.originX + (event.clientX - drag.startX)),
        y: Math.max(16, drag.originY + (event.clientY - drag.startY))
      });
    }

    function handleMouseUp(): void {
      hexModalDragRef.current = null;
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (!(event.ctrlKey || event.metaKey)) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tagName = target.tagName.toLowerCase();
        if (target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select") {
          return;
        }
      }

      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
        return;
      }

      if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function togglePanel(panelId: PanelId): void {
    dispatch({ type: "togglePanel", panelId });
  }

  function toggleTagPreset(tagId: string): void {
    dispatch({
      type: "setPendingTags",
      value: pendingTagIds.includes(tagId) ? pendingTagIds.filter(item => item !== tagId) : [...pendingTagIds, tagId]
    });
  }

  function selectPendingReliefElevation(value: "" | ReliefElevationLevel): void {
    dispatch({ type: "setPendingReliefElevation", value });
  }

  function applyPendingGeographySelection(): void {
    dispatch({ type: "applyPendingTerrain", allGeographyPresets });
  }

  function saveCustomGeography(): void {
    const slug = slugifyDraft(draftGeographyName);
    if (!slug) return;
    dispatch({
      type: "setCustomGeographies",
      value: customGeographies.some(item => item.id === slug)
        ? customGeographies
        : [...customGeographies, { id: slug, label: draftGeographyName.trim(), geography: slug, color: draftGeographyColor, surface: draftGeographySurface, difficulty: Math.max(1, Number(draftGeographyDifficulty) || 1) }]
    });
    dispatch({ type: "setPendingGeography", value: slug });
    updateDraftField("draftGeographyName", "");
  }

  function saveCustomTag(): void {
    const slug = slugifyDraft(draftTagName);
    if (!slug) return;
    dispatch({
      type: "setCustomTags",
      value: customTags.some(item => item.id === slug)
        ? customTags
        : [...customTags, { id: slug, label: draftTagName.trim(), color: draftTagColor }]
    });
    dispatch({ type: "setPendingTags", value: pendingTagIds.includes(slug) ? pendingTagIds : [...pendingTagIds, slug] });
    updateDraftField("draftTagName", "");
  }

  function applyJson(): void {
    try {
      const parsed = JSON.parse(jsonBuffer) as unknown;
      const source = sanitizeLayoutSource(parsed);
      if (!source) throw new Error("Structure JSON invalide.");
      const nextLayout = createRuntimeWorldMapLayout(source);
      replaceLayoutState(nextLayout);
      const nextPathIssues = validateLayoutPathRules(nextLayout);
      updateJsonError(nextPathIssues.length > 0 ? nextPathIssues[0].message : null);
    } catch (error) {
      updateJsonError(error instanceof Error ? error.message : "JSON invalide.");
    }
  }

  function downloadJson(): void {
    const blob = new Blob([layoutToJson(persistedLayout)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "worldMapLayout.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function addRoutePoint(cell: MapCell): void {
    if (selectedRoute) {
      const validation = validateRouteAppend(layout, selectedRoute, cell);
      if (!validation.ok) {
        setFootprintFeedback(validation.reason);
        return;
      }
    }
    dispatch({ type: "appendRoutePoint", cell });
  }

  function createLinearFeature(kind: "road" | "river"): void {
    const uniquePart =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const id = `${kind}-${uniquePart}`;
    dispatch({ type: "createRoute", routeId: id, kind });
    activateTool("routes");
  }

  async function persistLayoutToServer(): Promise<void> {
    try {
      if (pathIssues.length > 0) {
        throw new Error(pathIssues[0].message);
      }
      updatePersistenceState("saving");
      const nextLayout = await saveWorldMapLayout(persistedLayout, props.layoutStorageKey);
      replaceLayoutState(nextLayout, true);
      updateJsonError(null);
      updateLastSavedLayoutJson(layoutToJson(withEditorPresets(nextLayout, nextLayout.editorPresets?.customGeographies ?? [], nextLayout.editorPresets?.customTags ?? [])));
      updatePersistenceState("saved");
      props.onLayoutSaved(nextLayout, props.layoutStorageKey);
    } catch (error) {
      updatePersistenceState("error");
      updateJsonError(error instanceof Error ? error.message : "Sauvegarde serveur impossible.");
    }
  }

  async function reloadLayoutFromServer(): Promise<void> {
    try {
      updatePersistenceState("saving");
      const nextLayout = await fetchWorldMapLayout(props.layoutStorageKey);
      replaceLayoutState(nextLayout, true);
      updateJsonError(null);
      updateLastSavedLayoutJson(layoutToJson(nextLayout));
      updatePersistenceState("saved");
      props.onLayoutSaved(nextLayout, props.layoutStorageKey);
    } catch (error) {
      updatePersistenceState("error");
      updateJsonError(error instanceof Error ? error.message : "Rechargement serveur impossible.");
    }
  }

  async function saveLayoutAsNewMap(): Promise<void> {
    const draft = window.prompt("Nom technique de la nouvelle carte (ex: valmorin_nord)", layout.id || layout.title || "nouvelle_carte");
    if (!draft) return;
    const nextLayoutKey = slugifyDraft(draft);
    if (!nextLayoutKey) {
      updatePersistenceState("error");
      updateJsonError("Nom de carte invalide pour 'sauver sous'.");
      return;
    }
    try {
      if (pathIssues.length > 0) {
        throw new Error(pathIssues[0].message);
      }
      updatePersistenceState("saving");
      const nextLayout = await saveWorldMapLayout(persistedLayout, nextLayoutKey);
      replaceLayoutState(nextLayout, true);
      updateJsonError(null);
      updateLastSavedLayoutJson(layoutToJson(withEditorPresets(nextLayout, nextLayout.editorPresets?.customGeographies ?? [], nextLayout.editorPresets?.customTags ?? [])));
      updatePersistenceState("saved");
      props.onRefreshLayoutCatalog?.();
      props.onLayoutSaved(nextLayout, nextLayoutKey);
    } catch (error) {
      updatePersistenceState("error");
      updateJsonError(error instanceof Error ? error.message : "Sauvegarde sous un nouveau layout impossible.");
    }
  }

  function updateCityField(field: "wikiEntityId" | "kind" | "markerColor" | "populationProfile", value: string): void {
    dispatch({ type: "updateSelectedCityField", field, value });
  }

  function applyLoreCityToCell(wikiEntityId: string): void {
    dispatch({ type: "attachLoreCityToSelectedCell", wikiEntityId });
  }

  function createDraftCity(): void {
    const wikiEntityId = slugifyDraft(draftCityName);
    dispatch({ type: "createDraftCityOnSelectedCell", wikiEntityId });
  }

  function addLoreLocationToCell(wikiEntityId: string): void {
    dispatch({ type: "addLoreLocationToSelectedCell", wikiEntityId });
  }

  function createGovernanceTerritoryDefinitionOnly(): void {
    const territoryId = draftTerritoryId.trim();
    const wikiEntityId = territoryId;
    const governanceId = draftGovernanceId.trim() || selectedGovernanceLoreId.trim();
    const capitalCityId = draftGovernanceCapitalCityId.trim();
    if (!territoryId) return;
    dispatch({
      type: "createGovernanceTerritoryDefinition",
      territoryId,
      wikiEntityId,
      governanceId,
      color: draftTerritoryColor,
      capitalCityId
    });
    updateDraftField("selectedGovernanceTerritoryId", territoryId);
    startFootprintEdit("territory", territoryId);
  }

  function openTerritoryPropertiesEditor(): void {
    if (!selectedGovernanceTerritoryId) return;
    setTerritoryPropertyDraft(buildTerritoryPropertyDraft(selectedGovernanceTerritoryId));
    setTerritoryPropertiesEditActive(true);
  }

  function cancelTerritoryPropertiesEditor(): void {
    if (!selectedGovernanceTerritoryId) {
      setTerritoryPropertiesEditActive(false);
      return;
    }
    setTerritoryPropertyDraft(buildTerritoryPropertyDraft(selectedGovernanceTerritoryId));
    setTerritoryPropertiesEditActive(false);
  }

  function saveTerritoryProperties(): void {
    if (!selectedGovernanceTerritory) return;
    const nextTerritoryId = territoryPropertyDraft.id.trim();
    if (!nextTerritoryId) {
      updateJsonError("L'id technique du territoire est obligatoire.");
      return;
    }
    if (
      nextTerritoryId !== selectedGovernanceTerritory.id &&
      (layout.governanceTerritories ?? []).some(entry => entry.id === nextTerritoryId)
    ) {
      updateJsonError("Cet id de territoire existe deja.");
      return;
    }
    const capitalCityId = territoryPropertyDraft.capitalCityId.trim();
    if (capitalCityId) {
      const capitalCity = layout.cities.find(city => city.id === capitalCityId) ?? null;
      const capitalKey = capitalCity ? getWorldMapCellKey(capitalCity.cell) : "";
      if (!capitalKey || !selectedTerritoryCellKeys.includes(capitalKey)) {
        updateJsonError("La capitale choisie doit se trouver dans l'emprise actuelle du territoire.");
        return;
      }
    }
    dispatch({ type: "updateSelectedGovernanceTerritoryField", field: "id", value: nextTerritoryId });
    dispatch({ type: "updateSelectedGovernanceTerritoryField", field: "wikiEntityId", value: territoryPropertyDraft.wikiEntityId.trim() || selectedGovernanceTerritory.id });
    dispatch({ type: "updateSelectedGovernanceTerritoryField", field: "color", value: territoryPropertyDraft.color });
    dispatch({ type: "updateSelectedGovernanceTerritoryField", field: "capitalCityId", value: capitalCityId });
    updateJsonError(null);
    setTerritoryPropertiesEditActive(false);
  }

  function createGovernanceRegionDefinitionOnly(): void {
    const regionId = draftRegionId.trim();
    const wikiEntityId = regionId;
    const territoryId = selectedGovernanceTerritoryId.trim() || selectedCell?.governanceTerritoryId || draftTerritoryId.trim();
    const governanceId = draftGovernanceId.trim() || selectedGovernanceLoreId.trim();
    const principalCityId = selectedCity?.id ?? "";
    if (!regionId) return;
    dispatch({
      type: "createGovernanceRegionDefinition",
      regionId,
      wikiEntityId,
      territoryId,
      governanceId,
      principalCityId,
      color: draftRegionColor
    });
    updateDraftField("selectedGovernanceRegionId", regionId);
    startFootprintEdit("region", regionId);
  }

  function openRegionPropertiesEditor(): void {
    if (!selectedGovernanceRegionId) return;
    setRegionPropertyDraft(buildRegionPropertyDraft(selectedGovernanceRegionId));
    setRegionPropertiesEditActive(true);
  }

  function cancelRegionPropertiesEditor(): void {
    if (!selectedGovernanceRegionId) {
      setRegionPropertiesEditActive(false);
      return;
    }
    setRegionPropertyDraft(buildRegionPropertyDraft(selectedGovernanceRegionId));
    setRegionPropertiesEditActive(false);
  }

  function saveRegionProperties(): void {
    if (!selectedGovernanceRegion) return;
    const nextRegionId = regionPropertyDraft.id.trim();
    if (!nextRegionId) {
      updateJsonError("L'id technique de la region est obligatoire.");
      return;
    }
    if (
      nextRegionId !== selectedGovernanceRegion.id &&
      (layout.governanceRegions ?? []).some(entry => entry.id === nextRegionId)
    ) {
      updateJsonError("Cet id de region existe deja.");
      return;
    }
    dispatch({ type: "updateSelectedGovernanceRegionField", field: "id", value: nextRegionId });
    dispatch({ type: "updateSelectedGovernanceRegionField", field: "wikiEntityId", value: regionPropertyDraft.wikiEntityId.trim() || selectedGovernanceRegion.id });
    dispatch({ type: "updateSelectedGovernanceRegionField", field: "color", value: regionPropertyDraft.color });
    dispatch({ type: "updateSelectedGovernanceRegionField", field: "territoryId", value: regionPropertyDraft.territoryId.trim() });
    dispatch({ type: "updateSelectedGovernanceRegionField", field: "principalCityId", value: regionPropertyDraft.principalCityId.trim() });
    updateJsonError(null);
    setRegionPropertiesEditActive(false);
  }

  function createGeographicZoneDefinitionOnly(): void {
    const zoneId = draftGeographicZoneId.trim() || selectedGeographicZoneLoreId.trim();
    const wikiEntityId = selectedGeographicZoneLoreId.trim() || undefined;
    const label =
      draftGeographicZoneLabel.trim() ||
      wikiCatalog.find(entry => entry.id === selectedGeographicZoneLoreId)?.name ||
      zoneId;
    if (!zoneId || !label) return;
    dispatch({
      type: "createGeographicZoneDefinition",
      zoneId,
      wikiEntityId,
      label,
      kind: draftGeographicZoneKind,
      color: draftGeographicZoneColor,
      borderColor: draftGeographicZoneBorderColor,
      borderWidth: Number(draftGeographicZoneBorderWidth) || 1.6,
      borderDashArray: draftGeographicZoneBorderDashArray
    });
    updateDraftField("selectedGeographicZoneId", zoneId);
    startFootprintEdit("geographicZone", zoneId);
  }

  function openGeographicZonePropertiesEditor(): void {
    if (!selectedGeographicZoneId) return;
    setGeographicZonePropertyDraft(buildGeographicZonePropertyDraft(selectedGeographicZoneId));
    setGeographicZonePropertiesEditActive(true);
  }

  function cancelGeographicZonePropertiesEditor(): void {
    if (!selectedGeographicZoneId) {
      setGeographicZonePropertiesEditActive(false);
      return;
    }
    setGeographicZonePropertyDraft(buildGeographicZonePropertyDraft(selectedGeographicZoneId));
    setGeographicZonePropertiesEditActive(false);
  }

  function saveGeographicZoneProperties(): void {
    if (!selectedGeographicZone) return;
    const nextZoneId = geographicZonePropertyDraft.id.trim();
    if (!nextZoneId) {
      updateJsonError("L'id technique de la zone est obligatoire.");
      return;
    }
    if (
      nextZoneId !== selectedGeographicZone.id &&
      (layout.geographicZones ?? []).some(entry => entry.id === nextZoneId)
    ) {
      updateJsonError("Cet id de zone existe deja.");
      return;
    }
    dispatch({ type: "updateSelectedGeographicZoneField", field: "id", value: nextZoneId });
    dispatch({ type: "updateSelectedGeographicZoneField", field: "wikiEntityId", value: geographicZonePropertyDraft.wikiEntityId.trim() });
    dispatch({ type: "updateSelectedGeographicZoneField", field: "label", value: geographicZonePropertyDraft.label.trim() || selectedGeographicZone.label });
    dispatch({ type: "updateSelectedGeographicZoneField", field: "kind", value: geographicZonePropertyDraft.kind });
    dispatch({ type: "updateSelectedGeographicZoneField", field: "color", value: geographicZonePropertyDraft.color });
    dispatch({ type: "updateSelectedGeographicZoneField", field: "borderColor", value: geographicZonePropertyDraft.borderColor });
    dispatch({ type: "updateSelectedGeographicZoneField", field: "borderWidth", value: geographicZonePropertyDraft.borderWidth });
    dispatch({ type: "updateSelectedGeographicZoneField", field: "borderDashArray", value: geographicZonePropertyDraft.borderDashArray });
    updateJsonError(null);
    setGeographicZonePropertiesEditActive(false);
  }

  function startFootprintEdit(kind: "territory" | "region" | "geographicZone", id: string): void {
    const originalCellKeys = layout.cells
      .filter(cell => {
        if (kind === "territory") return cell.governanceTerritoryId === id;
        if (kind === "region") return cell.governanceRegionId === id;
        return (cell.geographicZoneIds ?? []).includes(id);
      })
      .map(cell => getWorldMapCellKey(cell.cell));
    if (kind === "territory") {
      setTerritoryPropertiesEditActive(false);
    }
    setZoneEditSession({ kind, id, originalCellKeys });
    dispatch({ type: "setAreaSelection", cellKeys: originalCellKeys });
    activateTool("zones");
  }

  function cancelFootprintEdit(): void {
    if (!zoneEditSession) return;
    dispatch({ type: "clearAreaSelection" });
    setZoneEditSession(null);
    setFootprintFeedback(null);
  }

  function validateFootprintEdit(): void {
    if (!zoneEditSession) return;
    const feedbackKind = zoneEditSession.kind;
    const cellKeys = selectedAreaCellKeys;
    if (zoneEditSession.kind === "territory") {
      const territory = layout.governanceTerritories?.find(entry => entry.id === zoneEditSession.id) ?? null;
      const governance = territory?.governanceId ? layout.governances?.find(entry => entry.id === territory.governanceId) ?? null : null;
      const capitalCityId = governance?.capitalCityId ?? "";
      if (capitalCityId) {
        const capitalCity = layout.cities.find(city => city.id === capitalCityId) ?? null;
        const capitalKey = capitalCity ? getWorldMapCellKey(capitalCity.cell) : "";
        if (!capitalKey || !cellKeys.includes(capitalKey)) {
          updateJsonError("La capitale choisie doit se trouver dans l'emprise du territoire.");
          return;
        }
      }
      dispatch({ type: "replaceGovernanceTerritorySelection", territoryId: zoneEditSession.id, cellKeys });
    } else if (zoneEditSession.kind === "region") {
      dispatch({
        type: "replaceGovernanceRegionSelection",
        regionId: zoneEditSession.id,
        territoryId: selectedGovernanceRegion?.territoryId,
        cellKeys
      });
    } else {
      dispatch({ type: "replaceGeographicZoneSelection", zoneId: zoneEditSession.id, cellKeys });
    }
    dispatch({ type: "clearAreaSelection" });
    setZoneEditSession(null);
    setFootprintFeedback(
      feedbackKind === "territory"
        ? "Emprise du territoire mise a jour."
        : feedbackKind === "region"
          ? "Emprise de la region mise a jour."
          : "Emprise de la zone mise a jour."
    );
  }

  function handleEditorCellClick(cell: MapCell, meta?: { shiftKey: boolean }): void {
    const key = getWorldMapCellKey(cell);
    dispatch({ type: "setSelectedCell", cellKey: key });

    if (routeEditorActive) {
      addRoutePoint(cell);
      return;
    }

    if (activeTool === "terrain") {
      if (terrainSelectionMode === "multi") {
        dispatch({ type: "toggleAreaCell", cellKey: key });
      } else {
        dispatch({ type: "setAreaSelection", cellKeys: [key] });
      }
      return;
    }

    if (activeTool === "zones") {
      if (!zoneEditSession) {
        return;
      }
      dispatch({ type: "toggleAreaCell", cellKey: key });
      return;
    }

    dispatch({ type: "clearAreaSelection" });
  }

  const terrainPair = useMemo(
    () =>
      selectedAreaCellKeys.length === 2
        ? selectedAreaCellKeys.map(cellKey => {
            const [x, y] = cellKey.split(",").map(Number);
            return { cell: { x, y } };
          })
        : [],
    [selectedAreaCellKeys]
  );
  const terrainCellsAdjacent = terrainPair.length === 2 ? Boolean(getSharedHexEdge(layout, terrainPair[0].cell, terrainPair[1].cell)) : false;
  const activeCliffSegment = useMemo(() => {
    if (terrainPair.length !== 2) return null;
    const pairKeys = [getWorldMapCellKey(terrainPair[0].cell), getWorldMapCellKey(terrainPair[1].cell)].sort();
    return layout.cliffSegments.find(segment => {
      const segmentKeys = [getWorldMapCellKey(segment.a), getWorldMapCellKey(segment.b)].sort();
      return segmentKeys[0] === pairKeys[0] && segmentKeys[1] === pairKeys[1];
    }) ?? null;
  }, [layout.cliffSegments, terrainPair]);
  const invalidPathOverlay = useMemo(
    () => (
      <>
        {invalidPathSegments.map((segment, index) => {
          const fromCenter = getCellCenter(layout, segment.from);
          const toCenter = getCellCenter(layout, segment.to);
          const midX = (fromCenter.x + toCenter.x) / 2;
          const midY = (fromCenter.y + toCenter.y) / 2;
          return (
            <g key={`${segment.pathId}-${index}`}>
              <line
                x1={fromCenter.x}
                y1={fromCenter.y}
                x2={toCenter.x}
                y2={toCenter.y}
                stroke="rgba(255,96,96,0.95)"
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray="10 7"
                opacity={0.95}
                pointerEvents="none"
              />
              <g transform={`translate(${midX} ${midY})`} pointerEvents="none">
                <circle r={10} fill="rgba(126,18,18,0.92)" stroke="rgba(255,218,218,0.94)" strokeWidth="1.4" />
                <text x={0} y={4} textAnchor="middle" fill="#fff5f5" style={{ fontSize: 12, fontWeight: 900 }}>
                  !
                </text>
              </g>
            </g>
          );
        })}
      </>
    ),
    [invalidPathSegments, layout]
  );

  const overlay = (
    <>
      <MapEditorToolbar
        panelLabels={PANEL_LABELS}
        panelIds={UTILITY_PANEL_IDS}
        openPanels={openPanels}
        extraPanelToggles={[
          { id: "selection", label: "Selection", checked: showSelectionPanel, onToggle: () => setShowSelectionPanel(current => !current) },
          { id: "hex-analysis", label: "Analyse hex", checked: showHexAnalysisPanel, onToggle: () => setShowHexAnalysisPanel(current => !current) }
        ]}
        activeTool={activeTool}
        canUndo={canUndo}
        canRedo={canRedo}
        onCloseEditor={() => props.onCloseEditor(layout, props.layoutStorageKey)}
        onTogglePanel={togglePanel}
        onSelectTool={activateTool}
        onUndo={() => dispatch({ type: "undo" })}
        onRedo={() => dispatch({ type: "redo" })}
      />

      <MapEditorSidebar>
        {openPanels.legend && (
          <LegendPanel>
            <div style={{ display: "grid", gap: 12 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "72px 1fr",
                  gap: 12,
                  alignItems: "center",
                  padding: 10,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.04)"
                }}
              >
                <svg width="72" height="64" viewBox="0 0 72 64" aria-hidden="true">
                  <polygon
                    points="18,4 54,4 68,32 54,60 18,60 4,32"
                    fill="rgba(79,125,242,0.16)"
                    stroke="rgba(143,179,255,0.9)"
                    strokeWidth="2"
                  />
                  <line x1="4" y1="32" x2="68" y2="32" stroke="rgba(143,179,255,0.65)" strokeWidth="2" strokeDasharray="4 4" />
                  <circle cx="36" cy="32" r="3" fill="#8fb3ff" />
                </svg>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#eef3ff" }}>Reference d'echelle</div>
                  <div style={{ fontSize: 12, color: "#c9d3e2", lineHeight: 1.5 }}>
                    Un hexagone mesure 10 km d'un cote a l'autre en passant par le centre.
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 8, padding: 10, borderRadius: 12, background: "rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#eef3ff" }}>Reference de deplacement</div>
                <div style={{ fontSize: 12, color: "#c9d3e2", lineHeight: 1.5 }}>
                  Un humain normal traverse un hex en 2 h a rythme de marche normal sur un terrain de difficulte 5.
                </div>
                <div style={{ fontSize: 12, color: "#8fb3ff", lineHeight: 1.45 }}>
                  Cette valeur sert de base pour lire les temps de trajet.
                </div>
              </div>
            </div>
          </LegendPanel>
        )}

        {openPanels.layers && (
          <LayerPanel>
            <div style={RESPONSIVE_TWO_COLUMN_GRID}>
              {(Object.keys(layerVisibility) as MapLayerId[]).map(layerId => (
                <label key={layerId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#dce5f2" }}>
                  <input
                    type="checkbox"
                    checked={layerVisibility[layerId]}
                    onChange={() =>
                      dispatch({
                        type: "setLayerVisibility",
                        layerVisibility: { ...layerVisibility, [layerId]: !layerVisibility[layerId] }
                      })
                    }
                  />
                  {layerId}
                </label>
                ))}
            </div>
          </LayerPanel>
        )}

        <div style={{ marginBottom: 12 }}>
          <CollapsibleSection title="Textes" defaultOpen={false}>
            <div style={{ display: "grid", gap: 10 }}>
              {([
                ["geography", "Types de geographie"],
                ["territory", "Territoires"],
                ["region", "Regions"],
                ["geographicZone", "Zones geographiques"],
                ["city", "Villes"],
                ["road", "Routes"],
                ["river", "Cours d'eau"]
              ] as const).map(([family, label]) => (
                <div key={family} style={{ ...SUBSECTION_STYLE, gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>{label}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                      Taille
                      <input
                        type="number"
                        min={8}
                        max={48}
                        value={labelAppearance[family].fontSize}
                        onChange={event => updateLabelAppearance(family, "fontSize", Number(event.target.value) || 12)}
                        style={FIELD_STYLE}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                      Transparence
                      <input
                        type="number"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={labelAppearance[family].opacity}
                        onChange={event => updateLabelAppearance(family, "opacity", Math.max(0.1, Math.min(1, Number(event.target.value) || 1)))}
                        style={FIELD_STYLE}
                      />
                    </label>
                  </div>
                  <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                    Police
                    <select
                      value={labelAppearance[family].fontFamily}
                      onChange={event => updateLabelAppearance(family, "fontFamily", event.target.value)}
                      style={FIELD_STYLE}
                    >
                      <option value="Georgia, serif">Georgia</option>
                      <option value="Times New Roman, serif">Times New Roman</option>
                      <option value="Garamond, serif">Garamond</option>
                      <option value="Trebuchet MS, sans-serif">Trebuchet MS</option>
                      <option value="Verdana, sans-serif">Verdana</option>
                    </select>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#dce5f2" }}>
                    <input
                      type="checkbox"
                      checked={labelAppearance[family].underline}
                      onChange={event => updateLabelAppearance(family, "underline", event.target.checked)}
                    />
                    Soulignage
                  </label>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        </div>

        <HexTerrainPanel
            title={
              contextualHexSection === "terrain"
                ? "Terrain"
                : contextualHexSection === "places"
                  ? "Lieux"
                : contextualHexSection === "zones"
                    ? "Zones"
                  : contextualHexSection === "routes"
                      ? "Trace"
                    : "Selection"
            }
            selectionLabel={selectedCellKey ?? "Aucune selection"}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: "#c9d3e2", textAlign: "right" }}>
                {selectedAreaCellKeys.length > 0 ? `${selectedAreaCellKeys.length} cases selectionnees` : "1 case active"}
              </div>
            </div>

            {!contextualHexSection && showSelectionPanel && (
              <div style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", fontSize: 12, color: "#c9d3e2", lineHeight: 1.5 }}>
                Choisis un outil d'edition pour afficher ses options ici. `Main` sert surtout a inspecter la carte et la selection.
              </div>
            )}

            {contextualHexSection === "terrain" && (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={SUBSECTION_STYLE}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Bibliotheque de geographies</div>
                  <div style={{ fontSize: 12, color: "#c9d3e2", lineHeight: 1.45 }}>
                    Choisis un type de terrain, puis applique-le directement a ta selection d'hex. Les proprietes derivees seront mises a jour automatiquement.
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {allGeographyPresets.map(preset => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => dispatch({ type: "setPendingGeography", value: preset.id })}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 999,
                          border: pendingGeographyId === preset.id ? "1px solid rgba(255,255,255,0.66)" : "1px solid rgba(255,255,255,0.14)",
                          background: preset.color,
                          color: "#f8fbff",
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 12,
                          boxShadow: pendingGeographyId === preset.id ? "0 0 0 2px rgba(255,255,255,0.18) inset" : "none"
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Relief et jonctions</div>
                    <div style={{ fontSize: 12, color: "#c9d3e2", lineHeight: 1.45 }}>
                      La hauteur reste portee par la case. Les falaises sont maintenant definies entre 2 cases adjacentes, avec un cote haut et un cote bas.
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontSize: 12, color: "#dce5f2" }}>Hauteur de la case</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {([
                          { id: "", label: "Ne pas changer" },
                          { id: "none", label: "Standard" },
                          { id: "low_mountain", label: "Basse montagne" },
                          { id: "high_mountain", label: "Haute montagne" }
                        ] as Array<{ id: "" | ReliefElevationLevel; label: string }>).map(option => {
                          const active = pendingReliefElevation === option.id;
                          return (
                            <button
                              key={option.label}
                              type="button"
                              onClick={() => selectPendingReliefElevation(option.id)}
                              style={{
                                padding: "8px 10px",
                                borderRadius: 999,
                                border: active ? "1px solid rgba(255,255,255,0.66)" : "1px solid rgba(255,255,255,0.14)",
                                background:
                                  option.id === "high_mountain"
                                    ? "rgba(214,223,236,0.24)"
                                    : option.id === "low_mountain"
                                      ? "rgba(173,191,212,0.18)"
                                      : option.id === "none"
                                        ? "rgba(79,125,242,0.18)"
                                        : "rgba(255,255,255,0.06)",
                                color: "#f8fbff",
                                cursor: "pointer",
                                fontWeight: 700,
                                fontSize: 12,
                                boxShadow: active ? "0 0 0 2px rgba(255,255,255,0.18) inset" : "none"
                              }}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <CollapsibleSection title="Creer un type de geographie">
                    <input
                      value={draftGeographyName}
                      placeholder="Nom du type"
                      onChange={event => updateDraftField("draftGeographyName", event.target.value)}
                      style={FIELD_STYLE}
                    />
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input type="color" value={draftGeographyColor} onChange={event => updateDraftField("draftGeographyColor", event.target.value)} />
                      <input
                        value={draftGeographyColor}
                        onChange={event => updateDraftField("draftGeographyColor", event.target.value)}
                        style={{ ...FIELD_STYLE, maxWidth: 120 }}
                      />
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#dce5f2" }}>
                        Type
                        <select value={draftGeographySurface} onChange={event => updateDraftField("draftGeographySurface", event.target.value === "ocean" ? "ocean" : "land")} style={{ ...FIELD_STYLE, width: 110, padding: "6px 8px" }}>
                          <option value="land">terre</option>
                          <option value="ocean">ocean</option>
                        </select>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#dce5f2" }}>
                        Difficulte
                        <input
                          type="number"
                          min={1}
                          value={draftGeographyDifficulty}
                          onChange={event => updateDraftField("draftGeographyDifficulty", event.target.value)}
                          style={{ ...FIELD_STYLE, width: 90, padding: "6px 8px" }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={saveCustomGeography}
                        disabled={!slugifyDraft(draftGeographyName)}
                        style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: slugifyDraft(draftGeographyName) ? "pointer" : "not-allowed", opacity: slugifyDraft(draftGeographyName) ? 1 : 0.55 }}
                      >
                        Sauvegarder type
                      </button>
                    </div>
                  </CollapsibleSection>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Tags proposes</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {allTagPresets.map(tag => {
                        const active = pendingTagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggleTagPreset(tag.id)}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 999,
                              border: active ? "1px solid rgba(255,255,255,0.6)" : "1px solid rgba(255,255,255,0.14)",
                              background: tag.color,
                              color: "#f8fbff",
                              cursor: "pointer",
                              fontWeight: 700,
                              fontSize: 12,
                              boxShadow: active ? "0 0 0 2px rgba(255,255,255,0.18) inset" : "none"
                            }}
                          >
                            {tag.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <CollapsibleSection title="Creer un tag">
                    <input
                      value={draftTagName}
                      placeholder="Nom du tag"
                      onChange={event => updateDraftField("draftTagName", event.target.value)}
                      style={FIELD_STYLE}
                    />
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input type="color" value={draftTagColor} onChange={event => updateDraftField("draftTagColor", event.target.value)} />
                      <input value={draftTagColor} onChange={event => updateDraftField("draftTagColor", event.target.value)} style={{ ...FIELD_STYLE, maxWidth: 120 }} />
                      <button
                        type="button"
                        onClick={saveCustomTag}
                        disabled={!slugifyDraft(draftTagName)}
                        style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: slugifyDraft(draftTagName) ? "pointer" : "not-allowed", opacity: slugifyDraft(draftTagName) ? 1 : 0.55 }}
                      >
                        Sauvegarder tag
                      </button>
                    </div>
                  </CollapsibleSection>
                </div>

                <div style={SUBSECTION_STYLE}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Preparation avant application</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "clearAreaSelection" })}
                      style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: "pointer" }}
                    >
                      Vider selection
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: "#c9d3e2" }}>
                    Mode de selection: {terrainSelectionMode === "multi" ? "multi cases" : "unitaire"}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setTerrainSelectionMode("single");
                        if (selectedCellKey) {
                          dispatch({ type: "setAreaSelection", cellKeys: [selectedCellKey] });
                        }
                      }}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: terrainSelectionMode === "single" ? "1px solid rgba(143,179,255,0.56)" : "1px solid rgba(255,255,255,0.12)",
                        background: terrainSelectionMode === "single" ? "rgba(79,125,242,0.18)" : "rgba(255,255,255,0.06)",
                        color: "#eef3ff",
                        cursor: "pointer",
                        fontWeight: terrainSelectionMode === "single" ? 700 : 500
                      }}
                    >
                      Unitaire
                    </button>
                    <button
                      type="button"
                      onClick={() => setTerrainSelectionMode("multi")}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: terrainSelectionMode === "multi" ? "1px solid rgba(143,179,255,0.56)" : "1px solid rgba(255,255,255,0.12)",
                        background: terrainSelectionMode === "multi" ? "rgba(79,125,242,0.18)" : "rgba(255,255,255,0.06)",
                        color: "#eef3ff",
                        cursor: "pointer",
                        fontWeight: terrainSelectionMode === "multi" ? 700 : 500
                      }}
                    >
                      Multi cases
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: "#c9d3e2" }}>
                    Selection a modifier: {selectedAreaCellKeys.length > 0 ? selectedAreaCellKeys.join(" | ") : selectedCellKey ?? "aucune"}
                  </div>
                  <div style={{ fontSize: 12, color: "#c9d3e2" }}>
                    Geographie choisie: {allGeographyPresets.find(item => item.id === pendingGeographyId)?.label ?? "aucune"}
                  </div>
                  <div style={{ fontSize: 12, color: "#c9d3e2" }}>
                    Difficulte derivee: {allGeographyPresets.find(item => item.id === pendingGeographyId)?.difficulty ?? "-"}
                  </div>
                  <div style={{ fontSize: 12, color: "#c9d3e2" }}>
                    Hauteur choisie: {pendingReliefElevation === "high_mountain" ? "haute montagne" : pendingReliefElevation === "low_mountain" ? "basse montagne" : pendingReliefElevation === "none" ? "standard" : "inchangee"}
                  </div>
                  <div style={{ fontSize: 12, color: "#c9d3e2" }}>
                    Tags choisis: {pendingTagIds.length > 0 ? pendingTagIds.join(", ") : "aucun"}
                  </div>
                  <button
                    type="button"
                    onClick={applyPendingGeographySelection}
                    disabled={!pendingGeographyId && !pendingReliefElevation && pendingTagIds.length === 0}
                    style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(79,125,242,0.22)", color: "#eef3ff", cursor: pendingGeographyId || pendingReliefElevation || pendingTagIds.length > 0 ? "pointer" : "not-allowed", fontWeight: 700, opacity: pendingGeographyId || pendingReliefElevation || pendingTagIds.length > 0 ? 1 : 0.55 }}
                  >
                    Appliquer a la selection
                  </button>
                </div>
              </div>
            )}

            {contextualHexSection === "places" && (
              <HexPlacesPanel>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={SUBSECTION_STYLE}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Element actif</div>
                    {selectedCity ? (
                      <>
                        <div style={editorTextStyles.helper}>
                          Edition ville simplifiee: suis les etapes `Identite`, `Quartiers`, puis `References` au lieu de faire defiler toute la fiche.
                        </div>
                        <EditorStepTabs
                          tabs={[
                            { id: "identity", label: "Identite" },
                            { id: "districts", label: "Quartiers" },
                            { id: "references", label: "References" }
                          ]}
                          activeTab={activeCityEditorTab}
                          onChange={tabId => setActiveCityEditorTab(tabId as "identity" | "districts" | "references")}
                        />
                        {activeCityEditorTab === "identity" && (
                          <>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Wiki entity id
                              <input value={selectedCity.wikiEntityId} onChange={event => updateCityField("wikiEntityId", event.target.value)} style={FIELD_STYLE} />
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Type
                              <select value={selectedCity.kind} onChange={event => updateCityField("kind", event.target.value)} style={FIELD_STYLE}>
                                <option value="capital">capital</option>
                                <option value="secondary">secondary</option>
                              </select>
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Couleur
                              <input value={selectedCity.markerColor ?? ""} onChange={event => updateCityField("markerColor", event.target.value)} style={FIELD_STYLE} />
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Population / races
                              <PopulationProfileField
                                profile={selectedCity.populationProfile}
                                effectiveProfile={selectedCity.populationProfile}
                                effectiveSource="ville"
                                inheritanceHint="Aucun profil explicite defini pour cette ville."
                                onChange={value => updateCityField("populationProfile", value)}
                              />
                            </label>
                            <div style={{ ...SUBSECTION_STYLE, gap: 6 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <div style={editorTextStyles.sectionTitle}>Mode quartiers simulation</div>
                                <div style={{ ...editorSurfaceStyles.badge, background: selectedCityDistrictMode === "natif" ? "rgba(114,197,143,0.18)" : "rgba(79,125,242,0.18)" }}>
                                  {selectedCityDistrictMode === "natif" ? "Mode natif" : "Mode derive"}
                                </div>
                              </div>
                              <div style={{ display: "grid", gap: 8 }}>
                                <div
                                  style={{
                                    ...SUBSECTION_STYLE,
                                    gap: 6,
                                    border: selectedCityDistrictMode === "derive" ? "1px solid rgba(79,125,242,0.42)" : "1px solid rgba(196,210,232,0.12)",
                                    background: selectedCityDistrictMode === "derive" ? "rgba(79,125,242,0.12)" : "rgba(255,255,255,0.03)"
                                  }}
                                >
                                  <div style={{ ...editorTextStyles.sectionTitle, color: selectedCityDistrictMode === "derive" ? "#b7d1ff" : editorTextStyles.sectionTitle.color }}>Mode derive</div>
                                  <div style={editorTextStyles.helper}>
                                    La ville utilise les quartiers detectes automatiquement sur la carte. Tu peux seulement les ajuster via des overrides.
                                  </div>
                                </div>
                                <div
                                  style={{
                                    ...SUBSECTION_STYLE,
                                    gap: 6,
                                    border: selectedCityDistrictMode === "natif" ? "1px solid rgba(114,197,143,0.42)" : "1px solid rgba(196,210,232,0.12)",
                                    background: selectedCityDistrictMode === "natif" ? "rgba(114,197,143,0.12)" : "rgba(255,255,255,0.03)"
                                  }}
                                >
                                  <div style={{ ...editorTextStyles.sectionTitle, color: selectedCityDistrictMode === "natif" ? "#b9f1c7" : editorTextStyles.sectionTitle.color }}>Mode natif</div>
                                  <div style={editorTextStyles.helper}>
                                    La ville utilise ses quartiers definis manuellement. Des qu'au moins un quartier natif existe, ce mode devient prioritaire pour la simulation locale.
                                  </div>
                                </div>
                              </div>
                              <div style={editorTextStyles.helper}>
                                Etat actif: {selectedCityDistrictMode === "natif"
                                  ? `${selectedCityNativeDistricts.length} quartier(s) natif(s) utilisent la definition manuelle`
                                  : `${selectedCityRuntimeDistricts.length} quartier(s) detecte(s) utilisent la carte`}
                                {selectedCityDerivedOverridesCount > 0 ? ` · ${selectedCityDerivedOverridesCount} override(s) derive(s) disponibles` : ""}.
                              </div>
                              {selectedCityNativeDistricts.length > 0 && selectedCityDerivedOverridesCount > 0 && (
                                <div style={editorTextStyles.helper}>
                                  Attention: les overrides derives restent stockes, mais ils deviennent secondaires tant que la ville reste en mode natif.
                                </div>
                              )}
                            </div>
                          </>
                        )}
                        {activeCityEditorTab === "districts" && (
                          <>
                            <CollapsibleSection title="Quartiers natifs" defaultOpen={selectedCityNativeDistricts.length > 0}>
                          <div style={{ display: "grid", gap: 8 }}>
                          <div style={editorTextStyles.sectionTitle}>Quartiers natifs pour la simulation</div>
                          <div style={editorTextStyles.helper}>
                            Un quartier natif est une entite explicite du runtime. Il remplace le derive automatique pour cette ville quand il existe, avec sa propre emprise locale via des cellules.
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={createNativeDistrictForSelectedCity}
                              style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}
                            >
                              Creer quartier natif
                            </button>
                            <div style={editorTextStyles.helper}>
                              Selection courante: {(selectedAreaCellKeys.length > 0 ? selectedAreaCellKeys : selectedCellKey ? [selectedCellKey] : []).length} cellule(s)
                            </div>
                          </div>
                          {selectedCityNativeDistricts.length > 0 ? (
                            <div style={{ display: "grid", gap: 8 }}>
                              {selectedCityNativeDistricts.map(district => (
                                <div key={district.id} style={{ ...SUBSECTION_STYLE, gap: 8 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                                    <div>
                                      <div style={{ fontSize: 12, fontWeight: 700 }}>{district.name}</div>
                                      <div style={editorTextStyles.helper}>{district.id}</div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => dispatch({ type: "deleteSimulationDistrict", districtId: district.id })}
                                      style={{ ...createEditorButtonStyle({ danger: true, compact: true }), borderRadius: 8 }}
                                    >
                                      Supprimer
                                    </button>
                                  </div>
                                  <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                                    Nom
                                    <input
                                      value={district.name}
                                      onChange={event => dispatch({ type: "updateSimulationDistrictField", districtId: district.id, field: "name", value: event.target.value })}
                                      style={FIELD_STYLE}
                                    />
                                  </label>
                                  <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                                    Tags
                                    <StringListField
                                      values={district.tags}
                                      onChange={value => dispatch({ type: "updateSimulationDistrictField", districtId: district.id, field: "tags", value })}
                                      placeholder="Ajouter un tag"
                                      emptyHint="Aucun tag defini pour ce quartier natif."
                                    />
                                  </label>
                                  <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                                    Activites dominantes
                                    <StringListField
                                      values={district.dominantActivities}
                                      onChange={value => dispatch({ type: "updateSimulationDistrictField", districtId: district.id, field: "dominantActivities", value })}
                                      placeholder="Ajouter une activite"
                                      emptyHint="Aucune activite dominante definie."
                                    />
                                  </label>
                                  <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                                    Lieux importants
                                    <StringListField
                                      values={district.importantPlaces}
                                      onChange={value => dispatch({ type: "updateSimulationDistrictField", districtId: district.id, field: "importantPlaces", value })}
                                      placeholder="Ajouter un lieu"
                                      emptyHint="Aucun lieu important defini."
                                    />
                                  </label>
                                  <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                                    Population / races
                                    <PopulationProfileField
                                      profile={district.populationProfile}
                                      effectiveProfile={district.populationProfile ?? selectedCity.populationProfile}
                                      effectiveSource={district.populationProfile?.groups?.length ? "quartier natif" : "ville"}
                                      inheritanceHint="Aucun override defini. Le quartier natif herite alors de la ville."
                                      onChange={value => dispatch({ type: "updateSimulationDistrictField", districtId: district.id, field: "populationProfile", value })}
                                    />
                                  </label>
                                  <div style={{ display: "grid", gap: 4 }}>
                                    <div style={editorTextStyles.helper}>
                                      Emprise locale: {district.cellKeys.length} cellule(s)
                                    </div>
                                    <div style={editorTextStyles.helper}>
                                      {district.cellKeys.length > 0 ? district.cellKeys.join(", ") : "Aucune cellule attribuee"}
                                    </div>
                                  </div>
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        dispatch({
                                          type: "updateSimulationDistrictField",
                                          districtId: district.id,
                                          field: "cellKeys",
                                          value: (selectedAreaCellKeys.length > 0 ? selectedAreaCellKeys : selectedCellKey ? [selectedCellKey] : []).join(", ")
                                        })
                                      }
                                      style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}
                                    >
                                      Remplacer emprise par selection
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => dispatch({ type: "updateSimulationDistrictField", districtId: district.id, field: "cellKeys", value: "" })}
                                      style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}
                                    >
                                      Vider emprise
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={editorTextStyles.helper}>
                              Aucun quartier natif defini pour cette ville. Dans ce cas, la simulation continue d'utiliser les quartiers derives.
                            </div>
                          )}
                          </div>
                        </CollapsibleSection>
                            {selectedCityNativeDistricts.length === 0 && selectedCityRuntimeDistricts.length > 0 && (
                              <CollapsibleSection title="Quartiers derives et overrides" defaultOpen={false}>
                            <div style={{ display: "grid", gap: 8 }}>
                            <div style={editorTextStyles.sectionTitle}>Quartiers derives pour la simulation</div>
                            <div style={editorTextStyles.helper}>
                              Cette ville n'a pas encore de quartiers natifs. La simulation utilise donc les quartiers derives automatiquement depuis la carte, avec les overrides ci-dessous.
                            </div>
                            {selectedCityRuntimeDistricts.map(district => {
                              const districtOverride = selectedCityDistrictOverridesById.get(district.id);
                              return (
                                <div key={district.id} style={{ ...SUBSECTION_STYLE, gap: 8 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                                    <div>
                                      <div style={{ fontSize: 12, fontWeight: 700 }}>{district.name}</div>
                                      <div style={editorTextStyles.helper}>{district.id}</div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => dispatch({ type: "deleteSimulationDistrictOverride", districtId: district.id })}
                                      disabled={!districtOverride}
                                      style={{
                                        ...createEditorButtonStyle({ compact: true }),
                                        borderRadius: 8,
                                        opacity: districtOverride ? 1 : 0.6
                                      }}
                                    >
                                      Supprimer override
                                    </button>
                                  </div>
                                  <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                                    Nom du quartier
                                    <input
                                      value={districtOverride?.name ?? district.name}
                                      onChange={event =>
                                        dispatch({
                                          type: "updateSimulationDistrictOverrideField",
                                          districtId: district.id,
                                          cityId: selectedCity.id,
                                          field: "name",
                                          value: event.target.value
                                        })
                                      }
                                      style={FIELD_STYLE}
                                    />
                                  </label>
                                  <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                                    Tags
                                    <StringListField
                                      values={districtOverride?.tags ?? district.tags}
                                      onChange={value =>
                                        dispatch({
                                          type: "updateSimulationDistrictOverrideField",
                                          districtId: district.id,
                                          cityId: selectedCity.id,
                                          field: "tags",
                                          value
                                        })
                                      }
                                      placeholder="Ajouter un tag"
                                      emptyHint="Aucun tag defini pour ce quartier derive."
                                    />
                                  </label>
                                  <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                                    Activites dominantes
                                    <StringListField
                                      values={districtOverride?.dominantActivities ?? district.dominantActivities}
                                      onChange={value =>
                                        dispatch({
                                          type: "updateSimulationDistrictOverrideField",
                                          districtId: district.id,
                                          cityId: selectedCity.id,
                                          field: "dominantActivities",
                                          value
                                        })
                                      }
                                      placeholder="Ajouter une activite"
                                      emptyHint="Aucune activite dominante definie pour ce quartier derive."
                                    />
                                  </label>
                                  <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                                    Lieux importants
                                    <StringListField
                                      values={districtOverride?.importantPlaces ?? district.importantPlaces}
                                      onChange={value =>
                                        dispatch({
                                          type: "updateSimulationDistrictOverrideField",
                                          districtId: district.id,
                                          cityId: selectedCity.id,
                                          field: "importantPlaces",
                                          value
                                        })
                                      }
                                      placeholder="Ajouter un lieu"
                                      emptyHint="Aucun lieu important defini pour ce quartier derive."
                                    />
                                  </label>
                                  <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                                    Population / races
                                    <PopulationProfileField
                                      profile={districtOverride?.populationProfile}
                                      effectiveProfile={district.populationProfile}
                                      effectiveSource={districtOverride?.populationProfile?.groups?.length ? "override quartier derive" : "quartier derive"}
                                      inheritanceHint="Aucun override defini. Le quartier derive conserve son profil calcule."
                                      onChange={value =>
                                        dispatch({
                                          type: "updateSimulationDistrictOverrideField",
                                          districtId: district.id,
                                          cityId: selectedCity.id,
                                          field: "populationProfile",
                                          value
                                        })
                                      }
                                    />
                                  </label>
                                </div>
                              );
                            })}
                            </div>
                              </CollapsibleSection>
                            )}
                          </>
                        )}
                        {activeCityEditorTab === "references" && (
                          <>
                            <CollapsibleSection title="Resume lore" defaultOpen={Boolean(selectedCityWiki)}>
                              <div style={{ fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
                                <div style={{ fontWeight: 700, marginBottom: 4 }}>{selectedCityWiki?.name ?? "Aucun lien lore"}</div>
                                <div>{selectedCityWiki?.snippet || "Pas de resume."}</div>
                              </div>
                            </CollapsibleSection>
                            <div style={{ ...SUBSECTION_STYLE, gap: 8 }}>
                              <div style={editorTextStyles.sectionTitle}>References editoriales</div>
                              <div style={editorTextStyles.helper}>
                                Cette etape sert a lier ou comparer la ville editee avec les fiches lore disponibles.
                              </div>
                              <div style={editorTextStyles.helper}>
                                Wiki entity active: {selectedCity.wikiEntityId || "aucune"}
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: "#c9d3e2", lineHeight: 1.45 }}>
                        Selectionne une ville ou associe-en une a la case active pour l'editer ici.
                      </div>
                    )}
                  </div>

                  <div style={SUBSECTION_STYLE}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Creation rapide ville</div>
                    <div style={editorTextStyles.helper}>
                      Creation en 3 etapes: choisis la case, saisis le nom, puis valide le brouillon.
                    </div>
                    <EditorStepTabs
                      tabs={[
                        { id: "cell", label: "1. Case" },
                        { id: "identity", label: "2. Nom" },
                        { id: "create", label: "3. Creation" }
                      ]}
                      activeTab={activeCityCreateTab}
                      onChange={tabId => setActiveCityCreateTab(tabId as "cell" | "identity" | "create")}
                    />
                    {activeCityCreateTab === "cell" && (
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={editorTextStyles.helper}>
                          Case cible: {selectedCellKey ?? "aucune"}
                        </div>
                        <div style={editorTextStyles.helper}>
                          Selectionne d'abord la case de la future ville sur la carte.
                        </div>
                      </div>
                    )}
                    {activeCityCreateTab === "identity" && (
                      <div style={{ display: "grid", gap: 8 }}>
                        <input
                          value={draftCityName}
                          placeholder="Nom ou slug de la ville"
                          onChange={event => updateDraftField("draftCityName", event.target.value)}
                          style={FIELD_STYLE}
                        />
                        <div style={editorTextStyles.helper}>
                          Id previsible: {slugifyDraft(draftCityName) || "aucun"}
                        </div>
                      </div>
                    )}
                    {activeCityCreateTab === "create" && (
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={editorTextStyles.helper}>
                          Resume: {draftCityName.trim() || "Nom manquant"} · case {selectedCellKey ?? "non selectionnee"}
                        </div>
                        <button
                          type="button"
                          onClick={createDraftCity}
                          disabled={!slugifyDraft(draftCityName)}
                          style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: slugifyDraft(draftCityName) ? "pointer" : "not-allowed", fontWeight: 700, opacity: slugifyDraft(draftCityName) ? 1 : 0.55 }}
                        >
                          Creer ville brouillon
                        </button>
                      </div>
                    )}
                  </div>

                  <CollapsibleSection title="Bibliotheque et references" defaultOpen={false}>
                    <div style={{ display: "grid", gap: 8 }}>
                    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                      Ville du lore
                      <select value={selectedLoreCityId} onChange={event => updateLoreField("selectedLoreCityId", event.target.value)} style={FIELD_STYLE}>
                        <option value="">Choisir une ville existante</option>
                        {wikiCities.map(entry => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name} ({entry.id})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                      Lieu du lore
                      <select value={selectedLoreLocationId} onChange={event => updateLoreField("selectedLoreLocationId", event.target.value)} style={FIELD_STYLE}>
                        <option value="">Choisir un lieu existant</option>
                        {wikiLocations.map(entry => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name} ({entry.id})
                          </option>
                        ))}
                      </select>
                    </label>
                    </div>
                  </CollapsibleSection>

                  <div style={SUBSECTION_STYLE}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Application a la case active</div>
                    <div style={{ fontSize: 12, color: "#c9d3e2" }}>
                      Case cible: {selectedCellKey ?? "aucune"}
                    </div>
                    <button
                      type="button"
                      onClick={() => applyLoreCityToCell(selectedLoreCityId)}
                      disabled={!selectedLoreCityId}
                      style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: selectedLoreCityId ? "pointer" : "not-allowed", fontWeight: 700, opacity: selectedLoreCityId ? 1 : 0.55 }}
                    >
                      Appliquer ville du lore
                    </button>
                    <button
                      type="button"
                      onClick={() => addLoreLocationToCell(selectedLoreLocationId)}
                      disabled={!selectedLoreLocationId}
                      style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: selectedLoreLocationId ? "pointer" : "not-allowed", fontWeight: 700, opacity: selectedLoreLocationId ? 1 : 0.55 }}
                    >
                      Ajouter lieu a la case
                    </button>
                  </div>
                </div>
              </HexPlacesPanel>
            )}

            {contextualHexSection === "zones" && (
              <HexZonesPanel>
                <div style={{ display: "grid", gap: 8 }}>
                  {footprintFeedback && (
                    <div
                      style={{
                        padding: "9px 12px",
                        borderRadius: 10,
                        border: "1px solid rgba(141,214,165,0.32)",
                        background: "rgba(141,214,165,0.12)",
                        color: "#dff7e6",
                        fontSize: 12,
                        fontWeight: 700
                      }}
                    >
                      {footprintFeedback}
                    </div>
                  )}
                  <CollapsibleSection title="Territoire politique" defaultOpen>
                    <div style={{ fontSize: 12, color: "#c9d3e2", lineHeight: 1.45 }}>
                      Un seul territoire politique par case. La pastille selectionne un territoire. L'emprise ne se charge qu'en cliquant sur `Editer l'emprise`.
                    </div>
                    <div style={{ fontSize: 12, color: "#dce5f2" }}>Bibliotheque</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(layout.governanceTerritories ?? []).map(entry => {
                        const active = selectedGovernanceTerritoryId === entry.id;
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => activateGovernanceTerritorySelection(entry.id)}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 999,
                              border: active ? "1px solid rgba(255,255,255,0.66)" : "1px solid rgba(255,255,255,0.14)",
                              background: entry.color,
                              color: "#f8fbff",
                              cursor: "pointer",
                              fontWeight: 700,
                              fontSize: 12,
                              boxShadow: active ? "0 0 0 2px rgba(255,255,255,0.18) inset" : "none"
                            }}
                            title="Selectionner ce territoire"
                          >
                            {getTerritoryDisplayName(entry.id)}
                          </button>
                        );
                      })}
                    </div>
                    {selectedGovernanceTerritory && (
                      <div style={{ ...SUBSECTION_STYLE, border: "1px solid rgba(143,179,255,0.38)", boxShadow: "0 0 0 1px rgba(143,179,255,0.14) inset" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Territoire selectionne: {getTerritoryDisplayName(selectedGovernanceTerritory.id)}</div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>
                          Wiki entity id: {selectedTerritoryWiki?.name ?? selectedGovernanceTerritory.wikiEntityId}
                        </div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>
                          Gouvernance associee: {selectedTerritoryGovernance?.label ?? selectedTerritoryGovernance?.id ?? selectedGovernanceTerritory.governanceId ?? "aucune"}
                        </div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>
                          Capitale: {selectedTerritoryCapital?.wikiEntityId ?? selectedTerritoryCapital?.id ?? "aucune"}
                        </div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>
                          Regions associees: {selectedTerritoryRegions.length > 0 ? selectedTerritoryRegions.map(entry => entry.id).join(", ") : "aucune"}
                        </div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>
                          Emprise actuelle: {selectedTerritoryCellKeys.length} case{selectedTerritoryCellKeys.length > 1 ? "s" : ""}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => selectedGovernanceTerritoryId && startFootprintEdit("territory", selectedGovernanceTerritoryId)}
                            disabled={zoneEditSession?.kind === "territory" && zoneEditSession.id === selectedGovernanceTerritoryId}
                            style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: selectedGovernanceTerritoryId ? 1 : 0.45 }}
                          >
                            Editer l'emprise
                          </button>
                          <button
                            type="button"
                            onClick={openTerritoryPropertiesEditor}
                            disabled={territoryPropertiesEditActive}
                            style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: territoryPropertiesEditActive ? 0.6 : 1 }}
                          >
                            Editer les proprietes
                          </button>
                          <button
                            type="button"
                            onClick={() => dispatch({ type: "deleteSelectedGovernanceTerritory" })}
                            style={{ ...createEditorButtonStyle({ compact: true, danger: true }), borderRadius: 8 }}
                          >
                            Supprimer l'element
                          </button>
                        </div>
                        {zoneEditSession?.kind === "territory" && zoneEditSession.id === selectedGovernanceTerritoryId && (
                          <div style={{ display: "grid", gap: 8, marginTop: 8, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                            <div style={{ fontSize: 12, color: "#dce5f2" }}>
                              Edition d'emprise en cours: {selectedAreaCellKeys.length} case{selectedAreaCellKeys.length > 1 ? "s" : ""} selectionnee{selectedAreaCellKeys.length > 1 ? "s" : ""}
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button type="button" onClick={validateFootprintEdit} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                                Valider
                              </button>
                              <button type="button" onClick={cancelFootprintEdit} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}
                        {territoryPropertiesEditActive && (
                          <div style={{ display: "grid", gap: 8, marginTop: 8, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Id technique
                              <input
                                value={territoryPropertyDraft.id}
                                onChange={event => setTerritoryPropertyDraft(current => ({ ...current, id: event.target.value }))}
                                style={FIELD_STYLE}
                              />
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Wiki entity id
                              <input
                                value={territoryPropertyDraft.wikiEntityId}
                                onChange={event => setTerritoryPropertyDraft(current => ({ ...current, wikiEntityId: event.target.value }))}
                                style={FIELD_STYLE}
                              />
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Capitale
                              <select
                                value={territoryPropertyDraft.capitalCityId}
                                onChange={event => setTerritoryPropertyDraft(current => ({ ...current, capitalCityId: event.target.value }))}
                                style={FIELD_STYLE}
                              >
                                <option value="">Aucune</option>
                                {layout.cities.map(city => (
                                  <option key={city.id} value={city.id}>
                                    {city.wikiEntityId} ({city.id})
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Couleur
                              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, alignItems: "center" }}>
                                <input
                                  type="color"
                                  value={territoryPropertyDraft.color}
                                  onChange={event => setTerritoryPropertyDraft(current => ({ ...current, color: event.target.value }))}
                                />
                                <input
                                  value={territoryPropertyDraft.color}
                                  onChange={event => setTerritoryPropertyDraft(current => ({ ...current, color: event.target.value }))}
                                  style={FIELD_STYLE}
                                />
                              </div>
                            </label>
                            <div style={{ fontSize: 12, color: "#8fa0b7" }}>
                              Les regions associees restent gerees depuis le sous-onglet `Region administrative`.
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button type="button" onClick={saveTerritoryProperties} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                                Enregistrer
                              </button>
                              <button type="button" onClick={cancelTerritoryPropertiesEditor} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {!selectedGovernanceTerritory && (
                      <div style={{ fontSize: 12, color: "#8fa0b7" }}>Selectionne une pastille pour afficher les details d'un territoire existant.</div>
                    )}
                    <CollapsibleSection title="Creer territoire">
                      <input value={draftTerritoryId} placeholder="slug_territoire" onChange={event => updateDraftField("draftTerritoryId", event.target.value)} style={FIELD_STYLE} />
                      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                        Gouvernance du lore
                        <select value={selectedGovernanceLoreId} onChange={event => updateLoreField("selectedGovernanceLoreId", event.target.value)} style={FIELD_STYLE}>
                          <option value="">Choisir une gouvernance</option>
                          {wikiGovernances.map(entry => (
                            <option key={entry.id} value={entry.id}>
                              {entry.name} ({entry.id})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                        Id gouvernance custom
                        <input value={draftGovernanceId} placeholder="slug_gouvernance" onChange={event => updateDraftField("draftGovernanceId", event.target.value)} style={FIELD_STYLE} />
                      </label>
                      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, alignItems: "center" }}>
                        <input type="color" value={draftTerritoryColor} onChange={event => updateDraftField("draftTerritoryColor", event.target.value)} />
                        <input value={draftTerritoryColor} onChange={event => updateDraftField("draftTerritoryColor", event.target.value)} style={FIELD_STYLE} />
                      </div>
                      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                        Capitale du territoire
                        <select value={draftGovernanceCapitalCityId} onChange={event => updateDraftField("draftGovernanceCapitalCityId", event.target.value)} style={FIELD_STYLE}>
                          <option value="">Aucune</option>
                          {layout.cities.map(city => (
                            <option key={city.id} value={city.id}>
                              {city.wikiEntityId} ({city.id})
                            </option>
                          ))}
                        </select>
                      </label>
                      <div style={{ fontSize: 11, color: "#8fa0b7", lineHeight: 1.45 }}>
                        La creation definit le territoire et ses proprietes. L'emprise se modifie ensuite via `Editer l'emprise`.
                      </div>
                      <button
                        type="button"
                        onClick={createGovernanceTerritoryDefinitionOnly}
                        disabled={!draftTerritoryId.trim()}
                        style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: draftTerritoryId.trim() ? "pointer" : "not-allowed", fontWeight: 700, opacity: draftTerritoryId.trim() ? 1 : 0.55 }}
                      >
                        Creer territoire
                      </button>
                    </CollapsibleSection>
                  </CollapsibleSection>

                  <CollapsibleSection title="Region administrative">
                    <div style={{ fontSize: 12, color: "#c9d3e2", lineHeight: 1.45 }}>
                      Une region administrative peut etre rattachee a un territoire et a une ville principale. La pastille selectionne la region sans charger son emprise.
                    </div>
                    <div style={{ fontSize: 12, color: "#dce5f2" }}>Bibliotheque</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(layout.governanceRegions ?? []).map(entry => {
                        const active = selectedGovernanceRegionId === entry.id;
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => activateGovernanceRegionSelection(entry.id)}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 999,
                              border: active ? "1px solid rgba(255,255,255,0.66)" : "1px solid rgba(255,255,255,0.14)",
                              background: entry.color,
                              color: "#f8fbff",
                              cursor: "pointer",
                              fontWeight: 700,
                              fontSize: 12,
                              boxShadow: active ? "0 0 0 2px rgba(255,255,255,0.18) inset" : "none"
                            }}
                            title="Selectionner cette region"
                          >
                            {getRegionDisplayName(entry.id)}
                          </button>
                        );
                      })}
                    </div>
                    {selectedGovernanceRegion && (
                      <div style={{ ...SUBSECTION_STYLE, border: "1px solid rgba(143,179,255,0.38)", boxShadow: "0 0 0 1px rgba(143,179,255,0.14) inset" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Region selectionnee: {getRegionDisplayName(selectedGovernanceRegion.id)}</div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>Wiki entity id: {selectedRegionWiki?.name ?? selectedGovernanceRegion.wikiEntityId}</div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>Territoire parent: {selectedGovernanceRegion.territoryId ?? "aucun"}</div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>Ville principale: {selectedRegionPrincipalCity?.wikiEntityId ?? selectedRegionPrincipalCity?.id ?? "aucune"}</div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>Emprise actuelle: {selectedRegionCellKeys.length} case{selectedRegionCellKeys.length > 1 ? "s" : ""}</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" onClick={() => selectedGovernanceRegionId && startFootprintEdit("region", selectedGovernanceRegionId)} disabled={zoneEditSession?.kind === "region" && zoneEditSession.id === selectedGovernanceRegionId} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: selectedGovernanceRegionId ? 1 : 0.45 }}>
                            Editer l'emprise
                          </button>
                          <button type="button" onClick={openRegionPropertiesEditor} disabled={regionPropertiesEditActive} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: regionPropertiesEditActive ? 0.6 : 1 }}>
                            Editer les proprietes
                          </button>
                          <button type="button" onClick={() => dispatch({ type: "deleteSelectedGovernanceRegion" })} style={{ ...createEditorButtonStyle({ compact: true, danger: true }), borderRadius: 8 }}>
                            Supprimer l'element
                          </button>
                        </div>
                        {zoneEditSession?.kind === "region" && zoneEditSession.id === selectedGovernanceRegionId && (
                          <div style={{ display: "grid", gap: 8, marginTop: 8, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                            <div style={{ fontSize: 12, color: "#dce5f2" }}>Edition d'emprise en cours: {selectedAreaCellKeys.length} case{selectedAreaCellKeys.length > 1 ? "s" : ""} selectionnee{selectedAreaCellKeys.length > 1 ? "s" : ""}</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button type="button" onClick={validateFootprintEdit} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                                Valider
                              </button>
                              <button type="button" onClick={cancelFootprintEdit} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}
                        {regionPropertiesEditActive && (
                          <div style={{ display: "grid", gap: 8, marginTop: 8, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Id technique
                              <input value={regionPropertyDraft.id} onChange={event => setRegionPropertyDraft(current => ({ ...current, id: event.target.value }))} style={FIELD_STYLE} />
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Wiki entity id
                              <input value={regionPropertyDraft.wikiEntityId} onChange={event => setRegionPropertyDraft(current => ({ ...current, wikiEntityId: event.target.value }))} style={FIELD_STYLE} />
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Territoire parent
                              <select value={regionPropertyDraft.territoryId} onChange={event => setRegionPropertyDraft(current => ({ ...current, territoryId: event.target.value }))} style={FIELD_STYLE}>
                                <option value="">Aucun</option>
                                {(layout.governanceTerritories ?? []).map(entry => (
                                  <option key={entry.id} value={entry.id}>
                                    {entry.id}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Ville principale
                              <select value={regionPropertyDraft.principalCityId} onChange={event => setRegionPropertyDraft(current => ({ ...current, principalCityId: event.target.value }))} style={FIELD_STYLE}>
                                <option value="">Aucune</option>
                                {layout.cities.map(city => (
                                  <option key={city.id} value={city.id}>
                                    {city.wikiEntityId} ({city.id})
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Couleur
                              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, alignItems: "center" }}>
                                <input type="color" value={regionPropertyDraft.color} onChange={event => setRegionPropertyDraft(current => ({ ...current, color: event.target.value }))} />
                                <input value={regionPropertyDraft.color} onChange={event => setRegionPropertyDraft(current => ({ ...current, color: event.target.value }))} style={FIELD_STYLE} />
                              </div>
                            </label>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button type="button" onClick={saveRegionProperties} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                                Enregistrer
                              </button>
                              <button type="button" onClick={cancelRegionPropertiesEditor} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {!selectedGovernanceRegion && <div style={{ fontSize: 12, color: "#8fa0b7" }}>Selectionne une pastille pour afficher les details d'une region existante.</div>}
                    <CollapsibleSection title="Creer region">
                      <input value={draftRegionId} placeholder="slug_region" onChange={event => updateDraftField("draftRegionId", event.target.value)} style={FIELD_STYLE} />
                      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, alignItems: "center" }}>
                        <input type="color" value={draftRegionColor} onChange={event => updateDraftField("draftRegionColor", event.target.value)} />
                        <input value={draftRegionColor} onChange={event => updateDraftField("draftRegionColor", event.target.value)} style={FIELD_STYLE} />
                      </div>
                      <button type="button" onClick={createGovernanceRegionDefinitionOnly} disabled={!draftRegionId.trim()} style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: draftRegionId.trim() ? "pointer" : "not-allowed", fontWeight: 700, opacity: draftRegionId.trim() ? 1 : 0.55 }}>
                        Creer region
                      </button>
                    </CollapsibleSection>
                  </CollapsibleSection>

                  <CollapsibleSection title="Zones geographiques">
                    <div style={{ fontSize: 12, color: "#c9d3e2", lineHeight: 1.45 }}>
                      Une case peut appartenir a plusieurs zones geographiques. La pastille selectionne une zone sans charger son emprise.
                    </div>
                    <div style={{ fontSize: 12, color: "#dce5f2" }}>Bibliotheque</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(layout.geographicZones ?? []).map(entry => {
                        const active = selectedGeographicZoneId === entry.id;
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => activateGeographicZoneSelection(entry.id)}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 999,
                              border: active ? "1px solid rgba(255,255,255,0.66)" : "1px solid rgba(255,255,255,0.14)",
                              background: entry.color,
                              color: "#f8fbff",
                              cursor: "pointer",
                              fontWeight: 700,
                              fontSize: 12,
                              boxShadow: active ? "0 0 0 2px rgba(255,255,255,0.18) inset" : "none"
                            }}
                            title="Selectionner cette zone"
                          >
                            {getGeographicZoneDisplayName(entry.id)}
                          </button>
                        );
                      })}
                    </div>
                    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                      Zone du lore
                      <select value={selectedGeographicZoneLoreId} onChange={event => updateLoreField("selectedGeographicZoneLoreId", event.target.value)} style={FIELD_STYLE}>
                        <option value="">Aucune entree de lore</option>
                        {wikiGeoZones.map(entry => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name} ({entry.id})
                          </option>
                        ))}
                      </select>
                    </label>
                    {selectedGeographicZone && (
                      <div style={{ ...SUBSECTION_STYLE, border: "1px solid rgba(143,179,255,0.38)", boxShadow: "0 0 0 1px rgba(143,179,255,0.14) inset" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Zone selectionnee: {getGeographicZoneDisplayName(selectedGeographicZone.id)}</div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>Wiki entity id: {selectedGeographicZone.wikiEntityId ?? "aucun"}</div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>Type: {selectedGeographicZone.kind}</div>
                        <div style={{ fontSize: 12, color: "#dce5f2" }}>Emprise actuelle: {selectedGeographicZoneCellKeys.length} case{selectedGeographicZoneCellKeys.length > 1 ? "s" : ""}</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" onClick={() => selectedGeographicZoneId && startFootprintEdit("geographicZone", selectedGeographicZoneId)} disabled={zoneEditSession?.kind === "geographicZone" && zoneEditSession.id === selectedGeographicZoneId} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: selectedGeographicZoneId ? 1 : 0.45 }}>
                            Editer l'emprise
                          </button>
                          <button type="button" onClick={openGeographicZonePropertiesEditor} disabled={geographicZonePropertiesEditActive} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: geographicZonePropertiesEditActive ? 0.6 : 1 }}>
                            Editer les proprietes
                          </button>
                          <button type="button" onClick={() => dispatch({ type: "deleteSelectedGeographicZone" })} style={{ ...createEditorButtonStyle({ compact: true, danger: true }), borderRadius: 8 }}>
                            Supprimer l'element
                          </button>
                        </div>
                        {zoneEditSession?.kind === "geographicZone" && zoneEditSession.id === selectedGeographicZoneId && (
                          <div style={{ display: "grid", gap: 8, marginTop: 8, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                            <div style={{ fontSize: 12, color: "#dce5f2" }}>Edition d'emprise en cours: {selectedAreaCellKeys.length} case{selectedAreaCellKeys.length > 1 ? "s" : ""} selectionnee{selectedAreaCellKeys.length > 1 ? "s" : ""}</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button type="button" onClick={validateFootprintEdit} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                                Valider
                              </button>
                              <button type="button" onClick={cancelFootprintEdit} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}
                        {geographicZonePropertiesEditActive && (
                          <div style={{ display: "grid", gap: 8, marginTop: 8, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Id technique
                              <input value={geographicZonePropertyDraft.id} onChange={event => setGeographicZonePropertyDraft(current => ({ ...current, id: event.target.value }))} style={FIELD_STYLE} />
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Wiki entity id
                              <input value={geographicZonePropertyDraft.wikiEntityId} onChange={event => setGeographicZonePropertyDraft(current => ({ ...current, wikiEntityId: event.target.value }))} style={FIELD_STYLE} />
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Libelle
                              <input value={geographicZonePropertyDraft.label} onChange={event => setGeographicZonePropertyDraft(current => ({ ...current, label: event.target.value }))} style={FIELD_STYLE} />
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              Type
                              <select value={geographicZonePropertyDraft.kind} onChange={event => setGeographicZonePropertyDraft(current => ({ ...current, kind: event.target.value as GeographicZoneKind }))} style={FIELD_STYLE}>
                                <option value="natural">Naturelle</option>
                                <option value="cultural">Culturelle</option>
                                <option value="historical">Historique</option>
                                <option value="religious">Religieuse</option>
                                <option value="strategic">Strategique</option>
                                <option value="custom">Personnalisee</option>
                              </select>
                            </label>
                            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto 1fr", gap: 8, alignItems: "center" }}>
                              <input type="color" value={geographicZonePropertyDraft.color} onChange={event => setGeographicZonePropertyDraft(current => ({ ...current, color: event.target.value }))} />
                              <input value={geographicZonePropertyDraft.color} onChange={event => setGeographicZonePropertyDraft(current => ({ ...current, color: event.target.value }))} style={FIELD_STYLE} />
                              <input type="color" value={geographicZonePropertyDraft.borderColor} onChange={event => setGeographicZonePropertyDraft(current => ({ ...current, borderColor: event.target.value }))} />
                              <input value={geographicZonePropertyDraft.borderColor} onChange={event => setGeographicZonePropertyDraft(current => ({ ...current, borderColor: event.target.value }))} style={FIELD_STYLE} />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              <input type="number" min={1} step={0.2} value={geographicZonePropertyDraft.borderWidth} onChange={event => setGeographicZonePropertyDraft(current => ({ ...current, borderWidth: event.target.value }))} style={FIELD_STYLE} />
                              <input value={geographicZonePropertyDraft.borderDashArray} onChange={event => setGeographicZonePropertyDraft(current => ({ ...current, borderDashArray: event.target.value }))} style={FIELD_STYLE} />
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button type="button" onClick={saveGeographicZoneProperties} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                                Enregistrer
                              </button>
                              <button type="button" onClick={cancelGeographicZonePropertiesEditor} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {!selectedGeographicZone && <div style={{ fontSize: 12, color: "#8fa0b7" }}>Selectionne une pastille pour afficher les details d'une zone existante.</div>}
                    <CollapsibleSection title="Creer zone geographique">
                      <input value={draftGeographicZoneId} placeholder="slug_zone_geo" onChange={event => updateDraftField("draftGeographicZoneId", event.target.value)} style={FIELD_STYLE} />
                      <input value={draftGeographicZoneLabel} placeholder="Zone geographique" onChange={event => updateDraftField("draftGeographicZoneLabel", event.target.value)} style={FIELD_STYLE} />
                      <select value={draftGeographicZoneKind} onChange={event => updateDraftField("draftGeographicZoneKind", event.target.value as GeographicZoneKind)} style={FIELD_STYLE}>
                        <option value="natural">Naturelle</option>
                        <option value="cultural">Culturelle</option>
                        <option value="historical">Historique</option>
                        <option value="religious">Religieuse</option>
                        <option value="strategic">Strategique</option>
                        <option value="custom">Personnalisee</option>
                      </select>
                      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto 1fr", gap: 8, alignItems: "center" }}>
                        <input type="color" value={draftGeographicZoneColor} onChange={event => updateDraftField("draftGeographicZoneColor", event.target.value)} />
                        <input value={draftGeographicZoneColor} onChange={event => updateDraftField("draftGeographicZoneColor", event.target.value)} style={FIELD_STYLE} />
                        <input type="color" value={draftGeographicZoneBorderColor} onChange={event => updateDraftField("draftGeographicZoneBorderColor", event.target.value)} />
                        <input value={draftGeographicZoneBorderColor} onChange={event => updateDraftField("draftGeographicZoneBorderColor", event.target.value)} style={FIELD_STYLE} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        <input type="number" min={1} step={0.2} value={draftGeographicZoneBorderWidth} onChange={event => updateDraftField("draftGeographicZoneBorderWidth", event.target.value)} style={FIELD_STYLE} />
                        <input value={draftGeographicZoneBorderDashArray} onChange={event => updateDraftField("draftGeographicZoneBorderDashArray", event.target.value)} style={FIELD_STYLE} />
                        <div style={{ fontSize: 12, color: "#8fa0b7", alignSelf: "center" }}>Contour</div>
                      </div>
                      <button type="button" onClick={createGeographicZoneDefinitionOnly} disabled={!(draftGeographicZoneId.trim() || selectedGeographicZoneLoreId.trim())} style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: draftGeographicZoneId.trim() || selectedGeographicZoneLoreId.trim() ? "pointer" : "not-allowed", fontWeight: 700, opacity: draftGeographicZoneId.trim() || selectedGeographicZoneLoreId.trim() ? 1 : 0.55 }}>
                        Creer zone
                      </button>
                    </CollapsibleSection>
                  </CollapsibleSection>
                </div>
              </HexZonesPanel>
            )}

            {contextualHexSection === "routes" && (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>
                      {selectedRoute?.kind === "river" ? "Cours d'eau actif" : "Route active"}
                    </div>
                    {selectedRoute && (
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "deleteSelectedRoute" })}
                        title={selectedRoute.kind === "river" ? "Supprimer ce cours d'eau" : "Supprimer cette route"}
                        aria-label={selectedRoute.kind === "river" ? "Supprimer ce cours d'eau" : "Supprimer cette route"}
                        style={{
                          ...createEditorButtonStyle({ danger: true, compact: true }),
                          width: 32,
                          height: 32,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 8,
                          padding: 0
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M4 7H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <path d="M9 4H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <path d="M7 7L8 19C8.1 20.1 8.9 21 10 21H14C15.1 21 15.9 20.1 16 19L17 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M10 11V17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <path d="M14 11V17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div style={{ ...editorTextStyles.helper, color: routeDrawActive ? "#8dd6a5" : editorTextStyles.helper.color, fontWeight: 700 }}>
                    {routeDrawActive ? "Trace en cours" : "Trace en pause"}
                  </div>
                </div>
                <div style={{ ...SUBSECTION_STYLE, gap: 10 }}>
                  <div style={editorTextStyles.sectionTitle}>Creation et selection</div>
                  {pathIssues.length > 0 && (
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,120,120,0.34)",
                        background: "rgba(126,18,18,0.18)",
                        color: "#ffe1e1",
                        fontSize: 12,
                        lineHeight: 1.45
                      }}
                    >
                      {pathIssues.length} probleme(s) de trace detecte(s). Les segments invalides sont affiches en rouge sur la carte et la sauvegarde reste bloquee tant qu'ils existent.
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => createLinearFeature("road")}
                      style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}
                    >
                      Nouvelle route
                    </button>
                    <button
                      type="button"
                      onClick={() => createLinearFeature("river")}
                      style={{ ...createEditorButtonStyle({ active: true, compact: true }), borderRadius: 8, border: "1px solid rgba(110,201,255,0.26)" }}
                    >
                      Nouveau cours d'eau
                    </button>
                  </div>
                  <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                    Routes terrestres
                    <select
                      value={selectedRoute?.kind === "road" ? selectedRouteId : ""}
                      onChange={event => {
                        if (event.target.value) dispatch({ type: "setSelectedRoute", routeId: event.target.value });
                      }}
                      style={FIELD_STYLE}
                    >
                      <option value="">Choisir une route</option>
                      {roadPaths.map(path => (
                        <option key={path.id} value={path.id}>
                          {path.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                    Cours d'eau
                    <select
                      value={selectedRoute?.kind === "river" ? selectedRouteId : ""}
                      onChange={event => {
                        if (event.target.value) dispatch({ type: "setSelectedRoute", routeId: event.target.value });
                      }}
                      style={FIELD_STYLE}
                    >
                      <option value="">Choisir un cours d'eau</option>
                      {riverPaths.map(path => (
                        <option key={path.id} value={path.id}>
                          {path.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {selectedRoute && (
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ ...SUBSECTION_STYLE, gap: 6 }}>
                      <div style={editorTextStyles.sectionTitle}>Element actif</div>
                      <div style={{ ...editorTextStyles.helper, color: EDITOR_THEME.colors.text }}>
                        {selectedRoute.kind === "road" ? "Route terrestre" : "Cours d'eau"}
                      </div>
                    </div>
                    <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                      Label
                      <input
                        value={selectedRoute.label}
                        onChange={event => dispatch({ type: "updateSelectedRouteField", field: "label", value: event.target.value })}
                        style={FIELD_STYLE}
                      />
                    </label>
                    {selectedRoute.kind === "road" && (
                      <div style={SUBSECTION_STYLE}>
                        <div style={editorTextStyles.sectionTitle}>Parametres de route</div>
                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                          Type de route
                          <select
                            value={selectedRoute.roadType ?? "road"}
                            onChange={event => dispatch({ type: "updateSelectedRouteField", field: "roadType", value: event.target.value })}
                            style={FIELD_STYLE}
                          >
                            <option value="track">Piste</option>
                            <option value="road">Route</option>
                            <option value="major_road">Grande route</option>
                          </select>
                        </label>
                        <div style={editorTextStyles.helper}>
                          {routeDrawActive
                            ? `Clique point par point sur des hex voisins. ${routeCandidateCellKeys.length} case(s) de prolongation sont actuellement autorisees. Une route reste sur terre et ne peut pas traverser une falaise.`
                            : "Active le trace pour poser de nouveaux segments sur la carte."}
                        </div>
                        <button
                          type="button"
                          onClick={() => dispatch({ type: "updateSelectedRouteField", field: "kind", value: "river" })}
                          style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}
                        >
                          Convertir en cours d'eau
                        </button>
                      </div>
                    )}
                    {selectedRoute.kind === "river" && (
                      <div style={SUBSECTION_STYLE}>
                        <div style={editorTextStyles.sectionTitle}>Parametres du cours d'eau</div>
                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                          Debit de depart
                          <input
                            type="number"
                            min={1}
                            step={0.5}
                            value={selectedRoute.sourceFlow ?? 1}
                            onChange={event => dispatch({ type: "updateSelectedRouteField", field: "sourceFlow", value: event.target.value })}
                            style={FIELD_STYLE}
                          />
                        </label>
                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                          Origine
                          <select
                            value={selectedRoute.sourceType ?? "source"}
                            onChange={event => dispatch({ type: "updateSelectedRouteField", field: "sourceType", value: event.target.value })}
                            style={FIELD_STYLE}
                          >
                            <option value="source">Source</option>
                            <option value="tributary">Affluent</option>
                            <option value="main">Cours principal</option>
                          </select>
                        </label>
                        <div style={{ display: "grid", gap: 4, ...editorTextStyles.helper }}>
                          <div>
                            Type actuel: {getRiverFlowCategoryLabel(getRiverFlowValue(selectedRoute))}
                          </div>
                          <div>
                            Debit derive: {getRiverFlowValue(selectedRoute)}
                          </div>
                          <div>
                            Sens: source vers aval, selon l'ordre des cases
                          </div>
                          <div>
                            Origine actuelle: {getRiverSourceTypeLabel(selectedRoute.sourceType ?? "source")}
                          </div>
                          <div>
                            Passages de falaise: {selectedRiverWaterfallCount}
                          </div>
                        </div>
                        <div style={editorTextStyles.helper}>
                          {routeDrawActive
                            ? `Clique point par point sur des hex voisins. ${routeCandidateCellKeys.length} case(s) de prolongation sont actuellement autorisees. Le cours d'eau commence sur terre, suit l'ordre du trace, puis se termine en mer.`
                            : "Active le trace pour prolonger le cours d'eau sur la carte."}
                        </div>
                        <button
                          type="button"
                          onClick={() => dispatch({ type: "updateSelectedRouteField", field: "kind", value: "road" })}
                          style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}
                        >
                          Convertir en route terrestre
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "setRouteDrawActive", value: !routeDrawActive })}
                      style={{ ...createEditorButtonStyle({ active: routeDrawActive, compact: true }), borderRadius: 8, border: routeDrawActive ? "1px solid rgba(141,214,165,0.28)" : "1px solid rgba(196,210,232,0.18)" }}
                    >
                      {routeDrawActive ? "Valider le trace" : "Commencer le trace"}
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "reverseSelectedRoute" })}
                      style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}
                    >
                      Inverser le sens
                    </button>
                    {selectedCellKey && cellFeatureIndex[selectedCellKey] && (
                      <div style={editorTextStyles.helper}>
                        Case active: {cellFeatureIndex[selectedCellKey].roads.length > 0 ? `${cellFeatureIndex[selectedCellKey].roads.length} route(s)` : "aucune route"} |{" "}
                        {cellFeatureIndex[selectedCellKey].rivers.length > 0 ? `${cellFeatureIndex[selectedCellKey].rivers.length} cours d'eau` : "aucun cours d'eau"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {contextualHexSection === "simulation" && (
              <SimulationPanel
                title="World Simulation"
                selectionLabel={
                  activeSimulationWorkspace === "inspection"
                    ? (selectedCellKey || "Aucune case selectionnee")
                    : activeSimulationWorkspace === "factions"
                      ? (selectedSimulationFaction?.label ?? "Aucune faction selectionnee")
                      : activeSimulationWorkspace === "objectives"
                        ? (selectedSimulationObjective?.label ?? "Aucun objectif selectionne")
                        : (selectedSimulationMobileActor?.label ?? "Aucun mobile selectionne")
                }
              >
                <div style={{ display: "grid", gap: 10 }}>
                  <EditorStepTabs
                    tabs={[
                      { id: "inspection", label: "Inspection" },
                      { id: "factions", label: "Factions" },
                      { id: "objectives", label: "Objectifs" },
                      { id: "mobiles", label: "Mobiles" }
                    ]}
                    activeTab={activeSimulationWorkspace}
                    onChange={tabId => setActiveSimulationWorkspace(tabId as "inspection" | "factions" | "objectives" | "mobiles")}
                  />
                  {activeSimulationWorkspace === "inspection" && (
                  <div style={SUBSECTION_STYLE}>
                    <div style={editorTextStyles.sectionTitle}>Cible inspectee</div>
                    <div style={editorTextStyles.helper}>
                      L'inspection suit toujours la case selectionnee sur la carte et reste independante des cibles d'edition.
                    </div>
                    <div style={{ display: "grid", gap: 6, fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
                      <div>Case: {selectedCellKey || "Aucune"}</div>
                      <div>Ville: {selectedCityWiki?.name ?? selectedCity?.id ?? "Aucune"}</div>
                      <div>Region: {selectedRegionWiki?.name ?? (selectedGovernanceRegionId || "Aucune")}</div>
                      <div>Route active: {selectedRoute?.label || selectedRoute?.id || "Aucune"}</div>
                      <div>Factions simulation locales: {selectedCellSimulationFactions.length > 0 ? selectedCellSimulationFactions.join(", ") : "Aucune"}</div>
                      <div>Lieux: {selectedCell?.locationWikiIds?.length ? selectedCell.locationWikiIds.join(", ") : "Aucun"}</div>
                    </div>
                  </div>
                  )}

                  {activeSimulationWorkspace === "inspection" && (
                  <div style={SUBSECTION_STYLE}>
                    <div style={editorTextStyles.sectionTitle}>Preflight simulation</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <div style={{ ...editorSurfaceStyles.badge, background: simulationPreflight.errorCount > 0 ? "rgba(190, 74, 74, 0.24)" : "rgba(66, 153, 110, 0.24)", border: simulationPreflight.errorCount > 0 ? "1px solid rgba(214, 103, 103, 0.55)" : "1px solid rgba(88, 179, 131, 0.55)" }}>
                        {simulationPreflight.errorCount} erreur(s)
                      </div>
                      <div style={{ ...editorSurfaceStyles.badge, background: simulationPreflight.warningCount > 0 ? "rgba(201, 148, 58, 0.2)" : "rgba(80, 96, 118, 0.34)", border: simulationPreflight.warningCount > 0 ? "1px solid rgba(221, 173, 86, 0.45)" : "1px solid rgba(111, 129, 154, 0.32)" }}>
                        {simulationPreflight.warningCount} warning(s)
                      </div>
                    </div>
                    {simulationPreflight.issues.length === 0 ? (
                      <div style={editorTextStyles.helper}>Aucune incoherence structurelle detectee pour la simulation.</div>
                    ) : (
                        <div style={{ display: "grid", gap: 8 }}>
                          {topPreflightIssues.map((issue, index) => (
                            <button
                              type="button"
                              key={`${issue.code}-${issue.entityId ?? "layout"}-${index}`}
                              onClick={() => {
                                handlePreflightIssueClick(issue);
                              }}
                              style={{
                                ...SUBSECTION_STYLE,
                                gap: 4,
                                width: "100%",
                                textAlign: "left",
                                border: issue.severity === "error"
                                  ? "1px solid rgba(214, 103, 103, 0.45)"
                                  : "1px solid rgba(221, 173, 86, 0.35)",
                                background: issue.severity === "error"
                                  ? "rgba(94, 43, 43, 0.26)"
                                  : "rgba(88, 67, 24, 0.2)",
                                color: "#eef3ff",
                                cursor: issue.entityId ? "pointer" : "default"
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
                                  {issue.severity} · {issue.scope}{issue.entityId ? ` · ${issue.entityId}` : ""}
                                </div>
                                <div style={{ fontSize: 11, opacity: 0.75 }}>{issue.code}</div>
                              </div>
                              <div style={{ fontSize: 12, lineHeight: 1.45 }}>{issue.message}</div>
                              {issue.entityId && (
                                <div style={{ ...editorTextStyles.helper, color: "#d8e5ff" }}>
                                  Cliquer pour ouvrir l'entite concernee dans l'editeur.
                                </div>
                              )}
                            </button>
                          ))}
                        {simulationPreflight.issues.length > topPreflightIssues.length && (
                          <div style={editorTextStyles.helper}>
                            {simulationPreflight.issues.length - topPreflightIssues.length} issue(s) supplementaire(s) masquees pour garder ce panneau lisible.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  )}

                  {activeSimulationWorkspace === "inspection" && (
                  <div style={SUBSECTION_STYLE}>
                    <div style={editorTextStyles.sectionTitle}>Projection du prochain tick</div>
                    <div style={editorTextStyles.helper}>
                      Cette vue lance un tick micro sur un clone de l'etat courant pour previsualiser les sorties probables sans modifier la carte.
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                      <div style={editorSurfaceStyles.badge}>{nextTickPreview.output.events.length} evenement(s)</div>
                      <div style={editorSurfaceStyles.badge}>{nextTickPreview.output.signals.length} signal(aux)</div>
                      <div style={editorSurfaceStyles.badge}>{nextTickPreview.output.rumors.length} rumeur(s)</div>
                      <div style={editorSurfaceStyles.badge}>{nextTickPreview.output.opportunities.length} opportunite(s)</div>
                    </div>
                    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                      {nextTickPreview.output.events.slice(0, 4).map(event => (
                        <button
                          type="button"
                          key={event.id}
                          onClick={() => focusEntityRef(event.target ?? event.actor)}
                          style={{
                            ...getProjectionCardStyle(event.success ? "success" : "warning"),
                            width: "100%",
                            textAlign: "left",
                            cursor: isClickableEntityRef(event.target ?? event.actor) ? "pointer" : "default"
                          }}
                        >
                          <div style={getProjectionSectionTitleStyle()}>
                            {event.type} · {event.success ? "succes" : "echec"}
                          </div>
                          <div style={editorTextStyles.helper}>
                            Acteur: {formatEntityRefSummary(event.actor)} · Cible: {formatEntityRefSummary(event.target)} · Objectif: {event.objectiveId ?? "aucun"}
                          </div>
                        </button>
                      ))}
                      {nextTickPreview.output.events.length === 0 && (
                        <div style={editorTextStyles.helper}>
                          Aucun evenement projete sur le prochain tick micro.
                        </div>
                      )}
                    </div>
                    <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#dce5f2" }}>Deltas d'etat les plus marquants</div>
                      {nextTickTopDeltaGroups.length > 0 ? nextTickTopDeltaGroups.map(group => (
                        <button
                          type="button"
                          key={`${group.ref.kind}:${group.ref.id}`}
                          onClick={() => focusEntityRef(group.ref)}
                          style={{
                            ...getProjectionCardStyle("default"),
                            width: "100%",
                            textAlign: "left",
                            cursor: isClickableEntityRef(group.ref) ? "pointer" : "default"
                          }}
                        >
                          <div style={getProjectionSectionTitleStyle()}>
                            {formatEntityRefSummary(group.ref)}
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {group.deltas.map((delta, index) => (
                              <div
                                key={`${group.ref.kind}:${group.ref.id}:${delta.key}:${index}`}
                                style={{
                                  ...getDeltaVisualStyle(delta.amount),
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 8,
                                  padding: "6px 10px",
                                  borderRadius: 999,
                                  fontSize: 12,
                                  fontWeight: 700
                                }}
                              >
                                <span>{formatDeltaLabel(delta.key)}</span>
                                <span>{delta.before ?? "?"} → {delta.after ?? "?"}</span>
                                <span>{(delta.amount ?? 0) > 0 ? "+" : ""}{delta.amount ?? 0}</span>
                              </div>
                            ))}
                          </div>
                        </button>
                      )) : (
                        <div style={editorTextStyles.helper}>Aucun delta d'etat notable sur le tick projete.</div>
                      )}
                    </div>
                  </div>
                  )}

                  {activeSimulationWorkspace === "inspection" && (
                  <div style={SUBSECTION_STYLE}>
                    <div style={editorTextStyles.sectionTitle}>Inspection des pressions</div>
                    <div style={editorTextStyles.helper}>
                      Cette vue lit les traces de calcul du runtime pour expliquer quelles donnees de carte alimentent les pressions attendues avant de lancer la simulation.
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ ...SUBSECTION_STYLE, gap: 8 }}>
                        <div style={editorTextStyles.sectionTitle}>Hotspots attendus</div>
                        {pressureHotspots.length === 0 ? (
                          <div style={editorTextStyles.helper}>Aucun hotspot calcule pour le layout courant.</div>
                        ) : (
                          <div style={{ display: "grid", gap: 6 }}>
                            {pressureHotspots.map(hotspot => (
                              <button
                                key={`${hotspot.kind}:${hotspot.id}`}
                                type="button"
                                onClick={() => handlePreflightIssueClick({ severity: "warning", code: "pressure_hotspot", scope: "layout", entityId: hotspot.id, message: hotspot.id })}
                                style={{ ...SUBSECTION_STYLE, gap: 4, width: "100%", textAlign: "left", color: "#eef3ff", cursor: "pointer" }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                  <div style={{ fontSize: 12, fontWeight: 700 }}>{hotspot.kind}:{hotspot.id}</div>
                                  <div style={{ fontSize: 12, color: "#ffd58f" }}>{Math.round(hotspot.total)}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ ...SUBSECTION_STYLE, gap: 8 }}>
                        <div style={editorTextStyles.sectionTitle}>Entite active</div>
                        <div style={editorTextStyles.helper}>
                          {selectedPressureTarget ? selectedPressureTarget.label : "Selectionne une ville, une route, une region ou un objectif cible sur quartier pour afficher le detail."}
                        </div>
                        {selectedPressureEvaluations.length > 0 ? (
                          <div style={{ display: "grid", gap: 8 }}>
                            {selectedPressureEvaluations.map(evaluation => (
                              <div key={`${evaluation.definitionId}-${evaluation.pressureType}`} style={{ ...SUBSECTION_STYLE, gap: 6 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                  <div style={{ fontSize: 12, fontWeight: 700 }}>
                                    {evaluation.pressureType} · {Math.round(evaluation.clampedValue)}
                                  </div>
                                  <div style={editorTextStyles.helper}>{evaluation.definitionId}</div>
                                </div>
                                <div style={{ display: "grid", gap: 4 }}>
                                  {evaluation.terms.map((term, index) => (
                                    <div key={`${evaluation.definitionId}-${index}`} style={{ fontSize: 12, color: "#dce5f2", lineHeight: 1.4 }}>
                                      {term.source}: brut {Math.round(term.rawValue)}, ajuste {Math.round(term.adjustedValue)}, poids {term.weight}, contribution {Math.round(term.contribution)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={editorTextStyles.helper}>Aucune trace de pression lisible pour l'entite active.</div>
                        )}
                      </div>
                    </div>
                  </div>
                  )}

                  {activeSimulationWorkspace === "factions" && (
                    <EditorStepTabs
                      tabs={[
                        { id: "create", label: "Creer" },
                        { id: "modify", label: "Modifier" }
                      ]}
                      activeTab={activeFactionMode}
                      onChange={tabId => setActiveFactionMode(tabId as "create" | "modify")}
                    />
                  )}

                  {activeSimulationWorkspace === "factions" && activeFactionMode === "create" && (
                  <div style={SUBSECTION_STYLE}>
                    <div style={editorTextStyles.sectionTitle}>Creer une faction</div>
                    <div style={editorTextStyles.helper}>
                      Cree une nouvelle faction depuis cet assistant. La modification des factions existantes reste dans l'onglet `Modifier`.
                    </div>
                    <EditorStepTabs
                      tabs={[
                        { id: "identity", label: "1. Identite" },
                        { id: "profile", label: "2. Profil" },
                        { id: "create", label: "3. Creation" }
                      ]}
                      activeTab={activeFactionCreateTab}
                      onChange={tabId => setActiveFactionCreateTab(tabId as "identity" | "profile" | "create")}
                    />
                    {activeFactionCreateTab === "identity" && (
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ ...SUBSECTION_STYLE, gap: 6 }}>
                          <div>Nom du brouillon: {draftSimulationFactionLabel.trim() || "Aucun nom saisi"}</div>
                          <div style={editorTextStyles.helper}>
                            Saisis directement le nom et l'id de la nouvelle faction ici. Rien n'est lie a une liste de factions existantes dans ce flux.
                          </div>
                        </div>
                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                          Id
                          <input
                            value={draftSimulationFactionId}
                            onChange={event => dispatch({ type: "setDraftField", field: "draftSimulationFactionId", value: event.target.value })}
                            style={FIELD_STYLE}
                            placeholder="ordre_des_cendres"
                          />
                        </label>
                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                          Label
                          <input
                            value={draftSimulationFactionLabel}
                            onChange={event => dispatch({ type: "setDraftField", field: "draftSimulationFactionLabel", value: event.target.value })}
                            style={FIELD_STYLE}
                            placeholder="Ordre des Cendres"
                          />
                        </label>
                      </div>
                    )}
                    {activeFactionCreateTab === "profile" && (
                      <div style={{ display: "grid", gap: 6 }}>
                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                          Type
                          <input
                            value={draftSimulationFactionType}
                            onChange={event => dispatch({ type: "setDraftField", field: "draftSimulationFactionType", value: event.target.value })}
                            style={FIELD_STYLE}
                            placeholder="milice, culte, guilde..."
                          />
                        </label>
                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                          Couleur
                          <input
                            value={draftSimulationFactionColor}
                            onChange={event => dispatch({ type: "setDraftField", field: "draftSimulationFactionColor", value: event.target.value })}
                            style={FIELD_STYLE}
                          />
                        </label>
                      </div>
                    )}
                    {activeFactionCreateTab === "create" && (
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={editorTextStyles.helper}>
                          Resume: {draftSimulationFactionLabel.trim() || draftSimulationFactionId.trim() || "Faction sans nom"} · {draftSimulationFactionType.trim() || "type libre"} · {draftSimulationFactionColor.trim() || "couleur par defaut"}
                        </div>
                        <button
                          type="button"
                          onClick={createSimulationFactionDefinition}
                          disabled={!(draftSimulationFactionId.trim() || draftSimulationFactionLabel.trim())}
                          style={{ ...createEditorButtonStyle({ active: true, compact: true }), borderRadius: 8, cursor: draftSimulationFactionId.trim() || draftSimulationFactionLabel.trim() ? "pointer" : "not-allowed", opacity: draftSimulationFactionId.trim() || draftSimulationFactionLabel.trim() ? 1 : 0.6 }}
                        >
                          Creer faction
                        </button>
                      </div>
                    )}
                  </div>
                  )}

                  {activeSimulationWorkspace === "factions" && activeFactionMode === "modify" && selectedSimulationFaction && (
                    <CollapsibleSection title="Lecture systeme" defaultOpen={false}>
                      <div style={{ ...SUBSECTION_STYLE, gap: 8 }}>
                        <div style={editorTextStyles.sectionTitle}>Vue logistique</div>
                        <div style={editorTextStyles.helper}>
                          Previsualisation calculee depuis le layout courant, sans lancer de tick. Cette vue montre ce que le runtime retient deja pour l'objectif principal de la faction selectionnee.
                        </div>
                        <SimulationLogisticsPanel
                          runtimeFaction={selectedSimulationFactionRuntime}
                          logisticsPlan={selectedSimulationFactionLogisticsPlan}
                        />
                      </div>
                    </CollapsibleSection>
                  )}

                  {(activeSimulationWorkspace === "factions" || activeSimulationWorkspace === "objectives" || activeSimulationWorkspace === "mobiles") && (
                    <>
                      {activeSimulationWorkspace === "factions" && activeFactionMode === "modify" && (
                        <>
                          <EditorStepTabs
                            tabs={[
                              { id: "identity", label: "Identite" },
                              { id: "territory", label: "Territoire" }
                            ]}
                            activeTab={activeFactionEditorTab}
                            onChange={tabId => setActiveFactionEditorTab(tabId as "identity" | "territory")}
                          />

                          <div style={{ ...SUBSECTION_STYLE, gap: 8 }}>
                            <div style={editorTextStyles.sectionTitle}>Liste des factions</div>
                            <div style={editorTextStyles.helper}>
                              Clique une pastille pour ouvrir directement la fiche de la faction.
                            </div>
                            {renderSimulationSelectionChips(
                              simulationFactions.map(faction => ({
                                id: faction.id,
                                label: faction.label,
                                accentColor: faction.color || "rgba(79,125,242,0.26)",
                                helper: faction.id
                              })),
                              selectedSimulationFactionId,
                              factionId => dispatch({ type: "setSelectedSimulationFaction", factionId }),
                              "Aucune faction disponible."
                            )}
                          </div>
                        </>
                      )}

                      {activeSimulationWorkspace === "factions" && activeFactionMode === "modify" && activeFactionEditorTab === "identity" && selectedSimulationFaction && (
                        <>
                      <CollapsibleSection title="Identite et intention" defaultOpen>
                      <div style={SUBSECTION_STYLE}>
                        <div style={editorTextStyles.sectionTitle}>Identite et intention</div>
                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                          Nom
                          <input
                            value={selectedSimulationFaction.label}
                            onChange={event => dispatch({ type: "updateSelectedSimulationFactionField", field: "label", value: event.target.value })}
                            style={FIELD_STYLE}
                          />
                        </label>
                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                          Type
                          <input
                            value={selectedSimulationFaction.type}
                            onChange={event => dispatch({ type: "updateSelectedSimulationFactionField", field: "type", value: event.target.value })}
                            style={FIELD_STYLE}
                          />
                        </label>
                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                          Description
                          <textarea
                            value={selectedSimulationFaction.description}
                            onChange={event => dispatch({ type: "updateSelectedSimulationFactionField", field: "description", value: event.target.value })}
                            style={editorFieldStyles.textarea}
                          />
                        </label>
                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                          Agenda
                          <textarea
                            value={selectedSimulationFaction.agenda}
                            onChange={event => dispatch({ type: "updateSelectedSimulationFactionField", field: "agenda", value: event.target.value })}
                            style={editorFieldStyles.textarea}
                          />
                        </label>
                      </div>
                      </CollapsibleSection>

                      <CollapsibleSection title="Profil et listes" defaultOpen={false}>
                      <div style={SUBSECTION_STYLE}>
                        <div style={editorTextStyles.sectionTitle}>Qui, quoi, comment, pourquoi</div>
                        <div style={{ ...SUBSECTION_STYLE, gap: 8 }}>
                          <div style={editorTextStyles.sectionTitle}>Edition guidee faction</div>
                          <div style={editorTextStyles.helper}>
                            Les methodes, objectifs suggeres et tags se gerent ici via des listes structurees.
                          </div>
                          <div style={{ display: "grid", gap: 8 }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {selectedSimulationFaction.methods.length > 0 ? selectedSimulationFaction.methods.map(method => (
                                <div key={method} style={{ ...editorSurfaceStyles.badge, display: "inline-flex", alignItems: "center", gap: 6 }}>
                                  <span>Methode: {method}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeValueFromSelectedFactionListField("methods", method)}
                                    style={{ border: "none", background: "transparent", color: "#dce5f2", cursor: "pointer", padding: 0, fontWeight: 700 }}
                                  >
                                    ×
                                  </button>
                                </div>
                              )) : <div style={editorTextStyles.helper}>Aucune methode declaree.</div>}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8 }}>
                              <input
                                value={pendingFactionMethod}
                                onChange={event => setPendingFactionMethod(event.target.value)}
                                style={FIELD_STYLE}
                                placeholder="Ajouter une methode"
                              />
                              <div style={editorTextStyles.helper}>
                                Archetype: {MOBILE_ARCHETYPE_PRESETS.find(preset => preset.id === draftSimulationMobileActorArchetype)?.label ?? "Archetype libre"} | Mission initiale: {MOBILE_ARCHETYPE_PRESETS.find(preset => preset.id === draftSimulationMobileActorArchetype)?.defaultMissionLabel ?? "Aucune"}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  addValueToSelectedFactionListField("methods", pendingFactionMethod);
                                  setPendingFactionMethod("");
                                }}
                                disabled={!normalizeListDraftValue(pendingFactionMethod)}
                                style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: normalizeListDraftValue(pendingFactionMethod) ? 1 : 0.6 }}
                              >
                                Ajouter
                              </button>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {SIMULATION_FACTION_METHOD_SUGGESTIONS
                                .filter(method => !selectedSimulationFaction.methods.includes(method))
                                .map(method => (
                                  <button
                                    key={method}
                                    type="button"
                                    onClick={() => addValueToSelectedFactionListField("methods", method)}
                                    style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 999 }}
                                  >
                                    {method}
                                  </button>
                                ))}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {selectedSimulationFaction.objectiveHints.length > 0 ? selectedSimulationFaction.objectiveHints.map(category => (
                                <div key={category} style={{ ...editorSurfaceStyles.badge, display: "inline-flex", alignItems: "center", gap: 6 }}>
                                  <span>Objectif: {SIMULATION_OBJECTIVE_CATEGORY_OPTIONS.find(option => option.value === category)?.label ?? category}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeValueFromSelectedFactionListField("objectiveHints", category)}
                                    style={{ border: "none", background: "transparent", color: "#dce5f2", cursor: "pointer", padding: 0, fontWeight: 700 }}
                                  >
                                    ×
                                  </button>
                                </div>
                              )) : <div style={editorTextStyles.helper}>Aucun objectif suggere.</div>}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8 }}>
                              <select
                                value={pendingFactionObjectiveHint}
                                onChange={event => setPendingFactionObjectiveHint(event.target.value)}
                                style={FIELD_STYLE}
                              >
                                <option value="">Ajouter un objectif suggere</option>
                                {SIMULATION_OBJECTIVE_CATEGORY_OPTIONS
                                  .filter(option => !selectedSimulationFaction.objectiveHints.includes(option.value))
                                  .map(option => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  addValueToSelectedFactionListField("objectiveHints", pendingFactionObjectiveHint);
                                  setPendingFactionObjectiveHint("");
                                }}
                                disabled={!pendingFactionObjectiveHint}
                                style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: pendingFactionObjectiveHint ? 1 : 0.6 }}
                              >
                                Ajouter
                              </button>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {selectedSimulationFaction.tags.length > 0 ? selectedSimulationFaction.tags.map(tag => (
                                <div key={tag} style={{ ...editorSurfaceStyles.badge, display: "inline-flex", alignItems: "center", gap: 6 }}>
                                  <span>Tag: {tag}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeValueFromSelectedFactionListField("tags", tag)}
                                    style={{ border: "none", background: "transparent", color: "#dce5f2", cursor: "pointer", padding: 0, fontWeight: 700 }}
                                  >
                                    ×
                                  </button>
                                </div>
                              )) : <div style={editorTextStyles.helper}>Aucun tag defini.</div>}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8 }}>
                              <select
                                value={pendingFactionTag}
                                onChange={event => setPendingFactionTag(event.target.value)}
                                style={FIELD_STYLE}
                              >
                                <option value="">Choisir un tag connu</option>
                                {TAG_PRESETS.filter(tag => !selectedSimulationFaction.tags.includes(tag.id)).map(tag => (
                                  <option key={tag.id} value={tag.id}>
                                    {tag.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  addValueToSelectedFactionListField("tags", pendingFactionTag);
                                  setPendingFactionTag("");
                                }}
                                disabled={!pendingFactionTag}
                                style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: pendingFactionTag ? 1 : 0.6 }}
                              >
                                Ajouter
                              </button>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8 }}>
                              <input
                                value={pendingFactionCustomTag}
                                onChange={event => setPendingFactionCustomTag(event.target.value)}
                                style={FIELD_STYLE}
                                placeholder="Ajouter un tag libre"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  addValueToSelectedFactionListField("tags", pendingFactionCustomTag);
                                  setPendingFactionCustomTag("");
                                }}
                                disabled={!normalizeListDraftValue(pendingFactionCustomTag)}
                                style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: normalizeListDraftValue(pendingFactionCustomTag) ? 1 : 0.6 }}
                              >
                                Ajouter manuel
                              </button>
                            </div>
                          </div>
                        </div>
                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                          Population / races
                          <PopulationProfileField
                            profile={selectedSimulationFaction.populationProfile}
                            effectiveProfile={selectedSimulationFactionEffectivePopulationProfile}
                            effectiveSource={selectedSimulationFactionPopulationSource}
                            inheritanceHint="Aucun override defini. La faction peut encore heriter de sa ville d'ancrage."
                            emptyAddLabel="Ajouter"
                            onChange={value => dispatch({ type: "updateSelectedSimulationFactionField", field: "populationProfile", value })}
                          />
                        </label>
                        <div style={editorTextStyles.helper}>
                          Laisse vide pour heriter plus tard de la ville d'ancrage quand c'est pertinent.
                        </div>
                      </div>
                      </CollapsibleSection>
                        </>
                      )}

                      {activeSimulationWorkspace === "factions" && activeFactionMode === "modify" && activeFactionEditorTab === "territory" && selectedSimulationFaction && (
                        <>
                      <CollapsibleSection title="Ancrage et zones" defaultOpen={false}>
                      <div style={SUBSECTION_STYLE}>
                        <div style={editorTextStyles.sectionTitle}>Ancrage carte</div>
                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                          Ville d'ancrage
                          <select
                            value={selectedSimulationFaction.homeCityId ?? ""}
                            onChange={event => dispatch({ type: "updateSelectedSimulationFactionField", field: "homeCityId", value: event.target.value })}
                            style={FIELD_STYLE}
                          >
                            <option value="">Aucune</option>
                            {layout.cities.map(city => (
                              <option key={city.id} value={city.id}>
                                {wikiEntriesById[city.wikiEntityId]?.name ?? city.wikiEntityId}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                          Region d'ancrage
                          <select
                            value={selectedSimulationFaction.homeRegionId ?? ""}
                            onChange={event => dispatch({ type: "updateSelectedSimulationFactionField", field: "homeRegionId", value: event.target.value })}
                            style={FIELD_STYLE}
                          >
                            <option value="">Aucune</option>
                            {(layout.governanceRegions ?? []).map(region => (
                              <option key={region.id} value={region.id}>
                                {wikiEntriesById[region.wikiEntityId]?.name ?? region.wikiEntityId}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div style={editorTextStyles.helper}>
                          Mode nomade possible: laisse la ville d'ancrage vide si besoin, mais garde au moins une region d'ancrage ou une presence sur la carte pour eviter une faction sans point d'appui.
                        </div>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div style={editorTextStyles.helper}>
                            Presence definie: {selectedSimulationFaction.presenceCells.length} case(s)
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button type="button" onClick={() => applySelectedCellsToFactionPresence("replace")} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                              Remplacer presence
                            </button>
                            <button type="button" onClick={() => applySelectedCellsToFactionPresence("add")} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                              Ajouter selection
                            </button>
                            <button type="button" onClick={() => applySelectedCellsToFactionPresence("remove")} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                              Retirer selection
                            </button>
                          </div>
                        </div>
                      </div>

                      <div style={SUBSECTION_STYLE}>
                        <div style={editorTextStyles.sectionTitle}>Zones d'action</div>
                        <div style={editorTextStyles.helper}>
                          Ces listes definissent ou la faction agit, projette son influence, surveille ou evite d'intervenir. Les zones peuvent etre des villes, regions, routes, zones geographiques, quartiers derives ou memes d'autres factions.
                        </div>
                        {(
                          [
                            ["controlledZoneIds", "Zones controlees"],
                            ["influencedZoneIds", "Zones influencees"],
                            ["interestZoneIds", "Zones d'interet"],
                            ["avoidedZoneIds", "Zones evitees"]
                          ] as const
                        ).map(([field, label]) => {
                          const zoneIds = selectedSimulationFaction[field] ?? [];
                          const activeCandidates = getActiveZoneCandidatesForFaction();
                          return (
                            <div key={field} style={{ ...SUBSECTION_STYLE, gap: 8 }}>
                              <div style={{ fontSize: 12, fontWeight: 700 }}>{label}</div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                <select
                                  value={pendingFactionZoneSelections[field]}
                                  onChange={event =>
                                    setPendingFactionZoneSelections(current => ({
                                      ...current,
                                      [field]: event.target.value
                                    }))
                                  }
                                  style={{ ...FIELD_STYLE, flex: "1 1 240px" }}
                                >
                                  <option value="">Choisir une zone</option>
                                  {simulationZoneOptions.map(option => (
                                    <option key={`${field}-${option.id}`} value={option.id}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => addZoneToSelectedFaction(field, pendingFactionZoneSelections[field])}
                                  disabled={!pendingFactionZoneSelections[field]}
                                  style={{
                                    ...createEditorButtonStyle({ compact: true }),
                                    borderRadius: 8,
                                    opacity: pendingFactionZoneSelections[field] ? 1 : 0.6
                                  }}
                                >
                                  Ajouter
                                </button>
                              </div>
                              {activeCandidates.length > 0 && (
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  {activeCandidates.map(zoneId => (
                                    <button
                                      key={`${field}-active-${zoneId}`}
                                      type="button"
                                      onClick={() => addZoneToSelectedFaction(field, zoneId)}
                                      style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}
                                    >
                                      Ajouter zone active: {getSimulationZoneLabel(zoneId)}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {zoneIds.length === 0 ? (
                                <div style={editorTextStyles.helper}>Aucune zone definie.</div>
                              ) : (
                                <div style={{ display: "grid", gap: 6 }}>
                                  {zoneIds.map(zoneId => (
                                    <div key={`${field}-${zoneId}`} style={{ ...SUBSECTION_STYLE, gap: 6 }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                                        <div style={{ fontSize: 12, fontWeight: 700 }}>{getSimulationZoneLabel(zoneId)}</div>
                                        <button
                                          type="button"
                                          onClick={() => removeZoneFromSelectedFaction(field, zoneId)}
                                          style={{ ...createEditorButtonStyle({ danger: true, compact: true }), borderRadius: 8 }}
                                        >
                                          Retirer
                                        </button>
                                      </div>
                                      <div style={editorTextStyles.helper}>{zoneId}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      </CollapsibleSection>

                      <div style={SUBSECTION_STYLE}>
                        <div style={editorTextStyles.sectionTitle}>Ancrages locaux</div>
                        <div style={editorTextStyles.helper}>
                          Un ancrage local represente un point d'appui concret de la faction : repaire, temple, contact, entrepot, poste de garde, lieu de rendez-vous. Il peut viser une entite spatiale ou une cellule precise.
                        </div>
                        <button
                          type="button"
                          onClick={createSimulationFactionAnchorDefinition}
                          style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}
                        >
                          Creer un ancrage local
                        </button>
                        {selectedSimulationFaction.localAnchors && selectedSimulationFaction.localAnchors.length > 0 ? (
                          <div style={{ display: "grid", gap: 8 }}>
                            {selectedSimulationFaction.localAnchors.map(anchor => {
                              const targetOptions = getFactionAnchorTargetOptions(anchor.targetKind);
                              return (
                                <div key={anchor.id} style={{ ...SUBSECTION_STYLE, gap: 8 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                                    <div>
                                      <div style={{ fontSize: 12, fontWeight: 700 }}>{anchor.label || anchor.id}</div>
                                      <div style={editorTextStyles.helper}>{anchor.id}</div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => dispatch({ type: "deleteSelectedSimulationFactionAnchor", anchorId: anchor.id })}
                                      style={{ ...createEditorButtonStyle({ danger: true, compact: true }), borderRadius: 8 }}
                                    >
                                      Supprimer
                                    </button>
                                  </div>
                                  <div style={RESPONSIVE_TWO_COLUMN_GRID}>
                                    <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                      Label
                                      <input
                                        value={anchor.label}
                                        onChange={event => dispatch({ type: "updateSelectedSimulationFactionAnchorField", anchorId: anchor.id, field: "label", value: event.target.value })}
                                        style={FIELD_STYLE}
                                      />
                                    </label>
                                    <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                      Type
                                      <select
                                        value={anchor.type}
                                        onChange={event => dispatch({ type: "updateSelectedSimulationFactionAnchorField", anchorId: anchor.id, field: "type", value: event.target.value })}
                                        style={FIELD_STYLE}
                                      >
                                        <option value="safehouse">Safehouse</option>
                                        <option value="temple">Temple</option>
                                        <option value="contact">Contact</option>
                                        <option value="warehouse">Entrepot</option>
                                        <option value="outpost">Poste</option>
                                        <option value="meeting_point">Rendez-vous</option>
                                      </select>
                                    </label>
                                    <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                      Cible
                                      <select
                                        value={anchor.targetKind}
                                        onChange={event => dispatch({ type: "updateSelectedSimulationFactionAnchorField", anchorId: anchor.id, field: "targetKind", value: event.target.value })}
                                        style={FIELD_STYLE}
                                      >
                                        <option value="city">Ville</option>
                                        <option value="district">Quartier</option>
                                        <option value="route">Route</option>
                                        <option value="region">Region</option>
                                        <option value="place">Lieu</option>
                                        <option value="cell">Cellule</option>
                                      </select>
                                    </label>
                                    <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                      Niveau
                                      <input
                                        type="number"
                                        min={1}
                                        max={5}
                                        value={anchor.level}
                                        onChange={event => dispatch({ type: "updateSelectedSimulationFactionAnchorField", anchorId: anchor.id, field: "level", value: event.target.value })}
                                        style={FIELD_STYLE}
                                      />
                                    </label>
                                  </div>
                                  {anchor.targetKind === "cell" ? (
                                    <div style={{ display: "grid", gap: 6 }}>
                                      <div style={editorTextStyles.helper}>Cellule cible: {getCellLabel(anchor.cell)}</div>
                                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            dispatch({
                                              type: "setSelectedSimulationFactionAnchorCell",
                                              anchorId: anchor.id,
                                              cell: selectedCell?.cell ? { ...selectedCell.cell } : undefined
                                            })
                                          }
                                          disabled={!selectedCell?.cell}
                                          style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: selectedCell?.cell ? 1 : 0.6 }}
                                        >
                                          Utiliser cellule active
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => dispatch({ type: "setSelectedSimulationFactionAnchorCell", anchorId: anchor.id, cell: undefined })}
                                          style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}
                                        >
                                          Effacer cellule
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                      Entite cible
                                      <select
                                        value={anchor.targetId ?? ""}
                                        onChange={event => dispatch({ type: "updateSelectedSimulationFactionAnchorField", anchorId: anchor.id, field: "targetId", value: event.target.value })}
                                        style={FIELD_STYLE}
                                      >
                                        <option value="">Choisir une cible</option>
                                        {targetOptions.map(option => (
                                          <option key={`${anchor.id}-${option.id}`} value={option.id}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                  )}
                                  <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                    Tags
                                    <StringListField
                                      values={anchor.tags}
                                      onChange={value => dispatch({ type: "updateSelectedSimulationFactionAnchorField", anchorId: anchor.id, field: "tags", value })}
                                      placeholder="Ajouter un tag"
                                      emptyHint="Aucun tag defini pour cet ancrage."
                                      presetOptions={["secret", "relais", "logistique", "infiltration", "commerce"]}
                                    />
                                  </label>
                                  <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                    Notes
                                    <textarea
                                      value={anchor.notes}
                                      onChange={event => dispatch({ type: "updateSelectedSimulationFactionAnchorField", anchorId: anchor.id, field: "notes", value: event.target.value })}
                                      style={{ ...editorFieldStyles.textarea, minHeight: 80 }}
                                    />
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={editorTextStyles.helper}>Aucun ancrage local defini.</div>
                        )}
                      </div>

                      <div style={SUBSECTION_STYLE}>
                        <div style={editorTextStyles.sectionTitle}>Capacites</div>
                        {([
                          ["influence", "Influence"],
                          ["power", "Puissance"],
                          ["cohesion", "Cohesion"],
                          ["aggression", "Agressivite"],
                          ["secrecy", "Discretion"],
                          ["resources", "Ressources"]
                        ] as const).map(([field, label]) => (
                          <label key={field} style={{ display: "grid", gap: 4, fontSize: 12 }}>
                            {label}
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={selectedSimulationFaction[field]}
                              onChange={event => dispatch({ type: "updateSelectedSimulationFactionField", field, value: event.target.value })}
                              style={FIELD_STYLE}
                            />
                          </label>
                        ))}
                      </div>

                      <div style={SUBSECTION_STYLE}>
                        <div style={editorTextStyles.sectionTitle}>Relations</div>
                        <div style={{ display: "grid", gap: 6 }}>
                          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                            Faction cible
                            <select
                              value={draftSimulationRelationTargetFactionId}
                              onChange={event => dispatch({ type: "setDraftField", field: "draftSimulationRelationTargetFactionId", value: event.target.value })}
                              style={FIELD_STYLE}
                            >
                              <option value="">Choisir une faction</option>
                              {simulationFactions
                                .filter(faction => faction.id !== selectedSimulationFaction.id)
                                .map(faction => (
                                  <option key={faction.id} value={faction.id}>
                                    {faction.label}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                            Statut
                            <select
                              value={draftSimulationRelationStatus}
                              onChange={event => dispatch({ type: "setDraftField", field: "draftSimulationRelationStatus", value: event.target.value as SimulationFactionRelationStatus })}
                              style={FIELD_STYLE}
                            >
                              <option value="ally">Allie</option>
                              <option value="neutral">Neutre</option>
                              <option value="rival">Rival</option>
                              <option value="war">Guerre</option>
                            </select>
                          </label>
                          <button
                            type="button"
                            onClick={createSimulationFactionRelationDefinition}
                            disabled={!draftSimulationRelationTargetFactionId}
                            style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, cursor: draftSimulationRelationTargetFactionId ? "pointer" : "not-allowed", opacity: draftSimulationRelationTargetFactionId ? 1 : 0.6 }}
                          >
                            Ajouter relation
                          </button>
                        </div>
                        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                          {selectedSimulationFaction.relations.length === 0 ? (
                            <div style={editorTextStyles.helper}>Aucune relation definie.</div>
                          ) : (
                            selectedSimulationFaction.relations.map(relation => {
                              const targetFaction = simulationFactions.find(faction => faction.id === relation.targetFactionId);
                              return (
                                <div key={relation.targetFactionId} style={{ ...SUBSECTION_STYLE, gap: 6 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                                    <div style={{ fontSize: 13, fontWeight: 700 }}>{targetFaction?.label ?? relation.targetFactionId}</div>
                                    <button
                                      type="button"
                                      onClick={() => dispatch({ type: "deleteSelectedSimulationFactionRelation", targetFactionId: relation.targetFactionId })}
                                      style={{ ...createEditorButtonStyle({ danger: true, compact: true }), borderRadius: 8 }}
                                    >
                                      Supprimer
                                    </button>
                                  </div>
                                  <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                    Statut
                                    <select
                                      value={relation.status}
                                      onChange={event => dispatch({ type: "updateSelectedSimulationFactionRelationField", targetFactionId: relation.targetFactionId, field: "status", value: event.target.value })}
                                      style={FIELD_STYLE}
                                    >
                                      <option value="ally">Allie</option>
                                      <option value="neutral">Neutre</option>
                                      <option value="rival">Rival</option>
                                      <option value="war">Guerre</option>
                                    </select>
                                  </label>
                                  <div style={RESPONSIVE_TWO_COLUMN_GRID}>
                                    <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                      Confiance
                                      <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={relation.trust}
                                        onChange={event => dispatch({ type: "updateSelectedSimulationFactionRelationField", targetFactionId: relation.targetFactionId, field: "trust", value: event.target.value })}
                                        style={FIELD_STYLE}
                                      />
                                    </label>
                                    <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                      Hostilite
                                      <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={relation.hostility}
                                        onChange={event => dispatch({ type: "updateSelectedSimulationFactionRelationField", targetFactionId: relation.targetFactionId, field: "hostility", value: event.target.value })}
                                        style={FIELD_STYLE}
                                      />
                                    </label>
                                  </div>
                                  <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                    Notes
                                    <textarea
                                      value={relation.notes}
                                      onChange={event => dispatch({ type: "updateSelectedSimulationFactionRelationField", targetFactionId: relation.targetFactionId, field: "notes", value: event.target.value })}
                                      style={editorFieldStyles.textarea}
                                    />
                                  </label>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                        </>
                      )}

                      {activeSimulationWorkspace === "factions" && activeFactionMode === "modify" && selectedSimulationFaction && (
                        <button
                          type="button"
                          onClick={() => dispatch({ type: "deleteSelectedSimulationFaction" })}
                          style={{ ...createEditorButtonStyle({ danger: true, compact: true }), borderRadius: 8 }}
                        >
                          Supprimer faction
                        </button>
                      )}

                      {activeSimulationWorkspace === "objectives" && (
                        <EditorStepTabs
                          tabs={[
                            { id: "create", label: "Creer" },
                            { id: "modify", label: "Modifier" }
                          ]}
                          activeTab={activeObjectiveMode}
                          onChange={tabId => setActiveObjectiveMode(tabId as "create" | "modify")}
                        />
                      )}

                      {activeSimulationWorkspace === "objectives" && activeObjectiveMode === "create" && (
                      <CollapsibleSection title="Objectifs" defaultOpen>
                        <div style={SUBSECTION_STYLE}>
                          <div style={editorTextStyles.helper}>
                            Choisis d'abord la faction porteuse, puis passe par un assistant court pour creer un nouvel objectif.
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={editorTextStyles.sectionTitle}>Faction porteuse</div>
                            {renderSimulationSelectionChips(
                              simulationFactions.map(faction => ({
                                id: faction.id,
                                label: faction.label,
                                accentColor: faction.color || "rgba(79,125,242,0.26)",
                                helper: faction.id
                              })),
                              effectiveObjectiveOwnerFactionId,
                              factionId => {
                                setDraftObjectiveOwnerFactionId(factionId);
                                dispatch({ type: "setSelectedSimulationFaction", factionId });
                              },
                              "Aucune faction disponible."
                            )}
                            <div style={editorTextStyles.helper}>
                              Faction retenue: {selectedObjectiveOwnerFaction?.label ?? "Aucune faction selectionnee"}
                            </div>
                          </div>
                          <EditorStepTabs
                            tabs={[
                              { id: "identity", label: "1. Identite" },
                              { id: "category", label: "2. Categorie" },
                              { id: "create", label: "3. Creation" }
                            ]}
                            activeTab={activeObjectiveCreateTab}
                            onChange={tabId => setActiveObjectiveCreateTab(tabId as "identity" | "category" | "create")}
                          />
                          {activeObjectiveCreateTab === "identity" && (
                            <div style={{ display: "grid", gap: 6 }}>
                              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                Id
                                <input
                                  value={draftSimulationObjectiveId}
                                  onChange={event => dispatch({ type: "setDraftField", field: "draftSimulationObjectiveId", value: event.target.value })}
                                  style={FIELD_STYLE}
                                  placeholder="retrouver_relique"
                                />
                              </label>
                              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                Label
                                <input
                                  value={draftSimulationObjectiveLabel}
                                  onChange={event => dispatch({ type: "setDraftField", field: "draftSimulationObjectiveLabel", value: event.target.value })}
                                  style={FIELD_STYLE}
                                  placeholder="Retrouver la relique"
                                />
                              </label>
                            </div>
                          )}
                          {activeObjectiveCreateTab === "category" && (
                            <div style={{ display: "grid", gap: 6 }}>
                              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                Categorie
                                <select
                                  value={draftSimulationObjectiveCategory}
                                  onChange={event => dispatch({ type: "setDraftField", field: "draftSimulationObjectiveCategory", value: event.target.value as SimulationObjectiveCategory })}
                                  style={FIELD_STYLE}
                                >
                                  <option value="search_object">Recherche d'objet</option>
                                  <option value="take_control_place">Prise de controle</option>
                                  <option value="weaken_rival">Affaiblir un rival</option>
                                  <option value="extend_influence">Etendre l'influence</option>
                                  <option value="protect_secret">Proteger un secret</option>
                                  <option value="recruit_agents">Recruter</option>
                                  <option value="acquire_resource">Acquerir une ressource</option>
                                  <option value="open_route">Ouvrir une route</option>
                                  <option value="eliminate_threat">Eliminer une menace</option>
                                  <option value="recover_person">Recuperer une personne</option>
                                </select>
                              </label>
                            </div>
                          )}
                          {activeObjectiveCreateTab === "create" && (
                            <div style={{ display: "grid", gap: 8 }}>
                              <div style={editorTextStyles.helper}>
                                Resume: {draftSimulationObjectiveLabel.trim() || draftSimulationObjectiveId.trim() || "Objectif sans nom"} · {draftSimulationObjectiveCategory}
                              </div>
                              <div style={editorTextStyles.helper}>
                                Faction porteuse: {selectedObjectiveOwnerFaction?.label ?? "Aucune"}
                              </div>
                              <button
                                type="button"
                                onClick={createSimulationObjectiveDefinition}
                                disabled={!(draftSimulationObjectiveId.trim() || draftSimulationObjectiveLabel.trim()) || !effectiveObjectiveOwnerFactionId}
                                style={{ ...createEditorButtonStyle({ active: true, compact: true }), borderRadius: 8, cursor: (Boolean(draftSimulationObjectiveId.trim() || draftSimulationObjectiveLabel.trim()) && Boolean(effectiveObjectiveOwnerFactionId)) ? "pointer" : "not-allowed", opacity: (Boolean(draftSimulationObjectiveId.trim() || draftSimulationObjectiveLabel.trim()) && Boolean(effectiveObjectiveOwnerFactionId)) ? 1 : 0.6 }}
                              >
                                Creer objectif
                              </button>
                            </div>
                          )}
                          {objectiveMapPreview?.mode === "create" && (
                            <div style={{ ...SUBSECTION_STYLE, gap: 6 }}>
                              <div style={editorTextStyles.sectionTitle}>Qui / Quoi / Ou</div>
                              <div style={editorTextStyles.helper}>La carte previsualise deja cet objectif en cours de creation.</div>
                              <div style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                                <div>Qui: {objectiveMapPreview.ownerLabel}</div>
                                <div>Quoi: {objectiveMapPreview.targetLabel ? `${formatObjectiveTargetKindLabel(objectiveMapPreview.targetKind)} · ${objectiveMapPreview.targetLabel}` : "cible principale non definie"}</div>
                                <div>Ou: {objectiveMapPreview.zoneCellKeys.length > 0 ? `${objectiveMapPreview.zoneCellKeys.length} case(s) de zone d'action` : "aucune zone d'action selectionnee"}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </CollapsibleSection>
                      )}

                      {activeSimulationWorkspace === "objectives" && activeObjectiveMode === "modify" && (
                        <div style={{ ...SUBSECTION_STYLE, gap: 8 }}>
                          <div style={editorTextStyles.sectionTitle}>Liste des objectifs</div>
                          <div style={editorTextStyles.helper}>
                            Choisis une faction, puis un objectif existant a modifier.
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={editorTextStyles.sectionTitle}>Faction</div>
                            {renderSimulationSelectionChips(
                              simulationFactions.map(faction => ({
                                id: faction.id,
                                label: faction.label,
                                accentColor: faction.color || "rgba(79,125,242,0.26)",
                                helper: faction.id
                              })),
                              effectiveObjectiveOwnerFactionId,
                              factionId => {
                                setDraftObjectiveOwnerFactionId(factionId);
                                dispatch({ type: "setSelectedSimulationFaction", factionId });
                              },
                              "Aucune faction disponible."
                            )}
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={editorTextStyles.sectionTitle}>Objectifs</div>
                            {renderSimulationSelectionChips(
                              objectivesForSelectedOwnerFaction.map(objective => ({
                                id: objective.id,
                                label: objective.label,
                                accentColor: selectedObjectiveOwnerFaction?.color || "rgba(79,125,242,0.26)",
                                helper: objective.id
                              })),
                              selectedSimulationObjectiveId,
                              objectiveId => dispatch({ type: "setSelectedSimulationObjective", objectiveId }),
                              "Aucun objectif pour cette faction."
                            )}
                          </div>
                          <div style={{ ...SUBSECTION_STYLE, gap: 6 }}>
                            <div style={editorTextStyles.sectionTitle}>Cible active</div>
                            <div style={editorTextStyles.helper}>
                              Faction: {selectedObjectiveOwnerFaction?.label ?? "Aucune"} ({objectivesForSelectedOwnerFaction.length} objectif(s))
                            </div>
                            <div style={editorTextStyles.helper}>
                              Objectif: {selectedSimulationObjective?.label ?? "Aucun objectif selectionne"}
                            </div>
                            {objectiveMapPreview?.mode === "modify" && (
                              <div style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                                <div>Qui: {objectiveMapPreview.ownerLabel}</div>
                                <div>Quoi: {objectiveMapPreview.targetLabel ? `${formatObjectiveTargetKindLabel(objectiveMapPreview.targetKind)} · ${objectiveMapPreview.targetLabel}` : "cible principale non definie"}</div>
                                <div>Ou: {objectiveMapPreview.zoneCellKeys.length > 0 ? `${objectiveMapPreview.zoneCellKeys.length} case(s) de zone d'action` : "aucune zone d'action liee"}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {activeSimulationWorkspace === "objectives" && activeObjectiveMode === "modify" && selectedSimulationObjective && selectedSimulationObjective.ownerFactionId === effectiveObjectiveOwnerFactionId && (
                        <CollapsibleSection title="Objectif selectionne" defaultOpen={false}>
                          <div style={SUBSECTION_STYLE}>
                          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                            Nom
                            <input
                              value={selectedSimulationObjective.label}
                              onChange={event => dispatch({ type: "updateSelectedSimulationObjectiveField", field: "label", value: event.target.value })}
                              style={FIELD_STYLE}
                            />
                          </label>
                          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                            Description
                            <textarea
                              value={selectedSimulationObjective.description}
                              onChange={event => dispatch({ type: "updateSelectedSimulationObjectiveField", field: "description", value: event.target.value })}
                              style={editorFieldStyles.textarea}
                            />
                          </label>
                          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                            Pourquoi c'est important
                            <textarea
                              value={selectedSimulationObjective.whyItMatters}
                              onChange={event => dispatch({ type: "updateSelectedSimulationObjectiveField", field: "whyItMatters", value: event.target.value })}
                              style={editorFieldStyles.textarea}
                            />
                          </label>
                          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                            Categorie
                            <select
                              value={selectedSimulationObjective.category}
                              onChange={event => dispatch({ type: "updateSelectedSimulationObjectiveField", field: "category", value: event.target.value })}
                              style={FIELD_STYLE}
                            >
                              <option value="search_object">Recherche d'objet</option>
                              <option value="take_control_place">Prise de controle</option>
                              <option value="weaken_rival">Affaiblir un rival</option>
                              <option value="extend_influence">Etendre l'influence</option>
                              <option value="protect_secret">Proteger un secret</option>
                              <option value="recruit_agents">Recruter</option>
                              <option value="acquire_resource">Acquerir une ressource</option>
                              <option value="open_route">Ouvrir une route</option>
                              <option value="eliminate_threat">Eliminer une menace</option>
                              <option value="recover_person">Recuperer une personne</option>
                            </select>
                          </label>
                          <div style={RESPONSIVE_TWO_COLUMN_GRID}>
                            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                              Etat
                              <select
                                value={selectedSimulationObjective.state}
                                onChange={event => dispatch({ type: "updateSelectedSimulationObjectiveField", field: "state", value: event.target.value })}
                                style={FIELD_STYLE}
                              >
                                <option value="planned">Planifie</option>
                                <option value="active">Actif</option>
                                <option value="blocked">Bloque</option>
                                <option value="completed">Accompli</option>
                                <option value="failed">Echoue</option>
                              </select>
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                              Priorite
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={selectedSimulationObjective.priority}
                                onChange={event => dispatch({ type: "updateSelectedSimulationObjectiveField", field: "priority", value: event.target.value })}
                                style={FIELD_STYLE}
                              />
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                              Progression
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={selectedSimulationObjective.progress}
                                onChange={event => dispatch({ type: "updateSelectedSimulationObjectiveField", field: "progress", value: event.target.value })}
                                style={FIELD_STYLE}
                              />
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                              Type de cible
                              <select
                                value={selectedSimulationObjective.targetKind ?? ""}
                                onChange={event => dispatch({ type: "updateSelectedSimulationObjectiveField", field: "targetKind", value: event.target.value })}
                                style={FIELD_STYLE}
                              >
                                <option value="">Aucune</option>
                                <option value="city">Ville</option>
                                <option value="district">Quartier</option>
                                <option value="route">Route</option>
                                <option value="region">Region</option>
                                <option value="faction">Faction</option>
                                <option value="place">Lieu</option>
                              </select>
                            </label>
                          </div>
                          {selectedSimulationObjective.targetKind ? (
                            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                              Cible
                              <select
                                value={selectedSimulationObjective.targetId ?? ""}
                                onChange={event => dispatch({ type: "updateSelectedSimulationObjectiveField", field: "targetId", value: event.target.value })}
                                style={FIELD_STYLE}
                              >
                                <option value="">Choisir une cible</option>
                                {objectiveTargetOptions.map(option => (
                                  <option key={option.id} value={option.id}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : (
                            <div style={editorTextStyles.helper}>Choisis d'abord un type de cible pour activer un selecteur guide.</div>
                          )}
                          <div style={{ ...SUBSECTION_STYLE, gap: 8 }}>
                            <div style={editorTextStyles.sectionTitle}>Phases</div>
                            <div style={editorTextStyles.helper}>
                              Definis les etapes de l'objectif dans l'ordre. La phase courante peut ensuite etre pointee directement sur l'une d'elles.
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {(selectedSimulationObjective.phases ?? []).length > 0 ? (
                                (selectedSimulationObjective.phases ?? []).map((phase, index) => {
                                  const isActivePhase = index === (selectedSimulationObjective.currentPhaseIndex ?? 0);
                                  return (
                                    <div
                                      key={`${phase.id}-${index}`}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        padding: "6px 10px",
                                        borderRadius: 999,
                                        border: isActivePhase ? "1px solid rgba(114,197,143,0.55)" : "1px solid rgba(124, 142, 168, 0.32)",
                                        background: isActivePhase ? "rgba(114,197,143,0.14)" : "rgba(31, 38, 48, 0.72)",
                                        color: isActivePhase ? "#b9f1c7" : "#dce5f2",
                                        fontSize: 12
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => dispatch({ type: "updateSelectedSimulationObjectiveField", field: "currentPhaseIndex", value: String(index) })}
                                        style={{
                                          border: "none",
                                          background: "transparent",
                                          color: "inherit",
                                          fontWeight: 700,
                                          cursor: "pointer",
                                          padding: 0
                                        }}
                                        title="Definir cette phase comme phase courante"
                                      >
                                        {index + 1}. {phase.label}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeSelectedObjectivePhase(phase.id)}
                                        style={{
                                          border: "none",
                                          background: "transparent",
                                          color: "#ffb0b0",
                                          cursor: "pointer",
                                          padding: 0,
                                          fontWeight: 700
                                        }}
                                        title="Retirer cette phase"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  );
                                })
                              ) : (
                                <div style={editorTextStyles.helper}>Aucune phase definie.</div>
                              )}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8 }}>
                              <input
                                value={pendingObjectivePhase}
                                onChange={event => setPendingObjectivePhase(event.target.value)}
                                style={FIELD_STYLE}
                                placeholder="collecter_indices"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  addSelectedObjectivePhase(pendingObjectivePhase);
                                  setPendingObjectivePhase("");
                                }}
                                disabled={!normalizeListDraftValue(pendingObjectivePhase)}
                                style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: normalizeListDraftValue(pendingObjectivePhase) ? 1 : 0.6 }}
                              >
                                Ajouter
                              </button>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {getSuggestedObjectivePhases(selectedSimulationObjective.category)
                                .filter(phase => !(selectedSimulationObjective.phases ?? []).some(entry => entry.label === phase))
                                .map(phase => (
                                  <button
                                    key={phase}
                                    type="button"
                                    onClick={() => addSelectedObjectivePhase(phase)}
                                    style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 999 }}
                                  >
                                    Ajouter suggestion: {phase}
                                  </button>
                                ))}
                              <button
                                type="button"
                                onClick={() => updateSelectedObjectiveRecord({ phases: createObjectivePhasePreset(selectedSimulationObjective.category, selectedSimulationObjective.compatibleActionIds), currentPhaseIndex: 0 })}
                                style={{ ...createEditorButtonStyle({ compact: true, active: true }), borderRadius: 999 }}
                              >
                                Appliquer preset runtime
                              </button>
                            </div>
                            {(selectedSimulationObjective.phases ?? []).length > 0 ? (
                              <div style={{ display: "grid", gap: 10 }}>
                                {(selectedSimulationObjective.phases ?? []).map((phase, index) => {
                                  const isActivePhase = index === (selectedSimulationObjective.currentPhaseIndex ?? 0);
                                  const runtimePhase = selectedObjectiveRuntime?.phases?.[index];
                                  const localTargetOptions = getPhaseTargetOptions(phase.localTargetKind);
                                  const presenceTargetOptions = getPhaseTargetOptions(phase.requiredPresenceTargetKind);
                                  const targetKindOptions: Array<{ value: WorldMapSimulationObjectivePhase["localTargetKind"] | ""; label: string }> = [
                                    { value: "", label: "Aucune cible locale" },
                                    { value: "city", label: "Ville" },
                                    { value: "district", label: "Quartier" },
                                    { value: "route", label: "Route" },
                                    { value: "region", label: "Region" },
                                    { value: "faction", label: "Faction" },
                                    { value: "place", label: "Lieu / district" }
                                  ];
                                  return (
                                    <div
                                      key={`phase-structured:${phase.id}`}
                                      style={{
                                        display: "grid",
                                        gap: 8,
                                        padding: 12,
                                        borderRadius: 12,
                                        border: isActivePhase ? "1px solid rgba(114,197,143,0.45)" : "1px solid rgba(124, 142, 168, 0.24)",
                                        background: isActivePhase ? "rgba(17, 43, 28, 0.28)" : "rgba(17, 24, 39, 0.22)"
                                      }}
                                    >
                                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                        <div style={{ display: "grid", gap: 2 }}>
                                          <div style={{ fontSize: 12, fontWeight: 700, color: isActivePhase ? "#b9f1c7" : "#dce5f2" }}>
                                            Phase {index + 1} · {phase.label}
                                          </div>
                                          <div style={editorTextStyles.helper}>
                                            Etat editeur: {phase.state ?? (isActivePhase ? "active" : index < (selectedSimulationObjective.currentPhaseIndex ?? 0) ? "completed" : "planned")}
                                            {" · "}Etat runtime: {runtimePhase?.state ?? "n/a"}
                                          </div>
                                        </div>
                                        <div style={editorTextStyles.helper}>
                                          Progression {runtimePhase?.progress ?? phase.progress ?? 0}/{phase.completionThreshold} · Echec {runtimePhase?.failureScore ?? phase.failureScore ?? 0}/{phase.maxFailureScore ?? 100}
                                        </div>
                                      </div>
                                      <div style={RESPONSIVE_TWO_COLUMN_GRID}>
                                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                          Label
                                          <input
                                            value={phase.label}
                                            onChange={event => updateSelectedObjectivePhaseField(phase.id, "label", event.target.value)}
                                            style={FIELD_STYLE}
                                          />
                                        </label>
                                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                          Etat
                                          <select
                                            value={phase.state ?? (isActivePhase ? "active" : "planned")}
                                            onChange={event => updateSelectedObjectivePhaseField(phase.id, "state", event.target.value as WorldMapSimulationObjectivePhase["state"])}
                                            style={FIELD_STYLE}
                                          >
                                            <option value="planned">planned</option>
                                            <option value="active">active</option>
                                            <option value="blocked">blocked</option>
                                            <option value="completed">completed</option>
                                            <option value="failed">failed</option>
                                          </select>
                                        </label>
                                      </div>
                                      <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                        Description
                                        <textarea
                                          value={phase.description ?? ""}
                                          onChange={event => updateSelectedObjectivePhaseField(phase.id, "description", event.target.value)}
                                          style={{ ...editorFieldStyles.textarea, minHeight: 72 }}
                                        />
                                      </label>
                                      <div style={RESPONSIVE_THREE_COLUMN_GRID}>
                                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                          Completion
                                          <select
                                            value={phase.completionMode}
                                            onChange={event => updateSelectedObjectivePhaseField(phase.id, "completionMode", event.target.value as WorldMapSimulationObjectivePhase["completionMode"])}
                                            style={FIELD_STYLE}
                                          >
                                            <option value="progress_threshold">progress_threshold</option>
                                            <option value="action_count">action_count</option>
                                            <option value="presence">presence</option>
                                            <option value="anchor_established">anchor_established</option>
                                          </select>
                                        </label>
                                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                          Seuil completion
                                          <input
                                            type="number"
                                            min={0}
                                            value={phase.completionThreshold}
                                            onChange={event => updateSelectedObjectivePhaseField(phase.id, "completionThreshold", Math.max(0, Number(event.target.value) || 0))}
                                            style={FIELD_STYLE}
                                          />
                                        </label>
                                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                          Poids progression
                                          <input
                                            type="number"
                                            min={0}
                                            step={0.1}
                                            value={phase.progressWeight ?? 1}
                                            onChange={event => updateSelectedObjectivePhaseField(phase.id, "progressWeight", Math.max(0, Number(event.target.value) || 0))}
                                            style={FIELD_STYLE}
                                          />
                                        </label>
                                      </div>
                                      <div style={RESPONSIVE_THREE_COLUMN_GRID}>
                                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                          Type cible locale
                                          <select
                                            value={phase.localTargetKind ?? ""}
                                            onChange={event => updateSelectedObjectivePhaseField(phase.id, "localTargetKind", (event.target.value || undefined) as WorldMapSimulationObjectivePhase["localTargetKind"])}
                                            style={FIELD_STYLE}
                                          >
                                            {targetKindOptions.map(option => (
                                              <option key={option.value || "none"} value={option.value}>
                                                {option.label}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                          Id cible locale
                                          {phase.localTargetKind ? (
                                            <select
                                              value={phase.localTargetId ?? ""}
                                              onChange={event => updateSelectedObjectivePhaseField(phase.id, "localTargetId", event.target.value || undefined)}
                                              style={FIELD_STYLE}
                                            >
                                              <option value="">Choisir une cible locale</option>
                                              {localTargetOptions.map(option => (
                                                <option key={`${phase.id}:local:${option.id}`} value={option.id}>
                                                  {option.label}
                                                </option>
                                              ))}
                                            </select>
                                          ) : (
                                            <input value="" readOnly style={{ ...FIELD_STYLE, opacity: 0.65 }} placeholder="Choisis d'abord un type de cible" />
                                          )}
                                        </label>
                                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                          Presence requise
                                          {phase.requiredPresenceTargetKind ? (
                                            <select
                                              value={phase.requiredPresenceTargetId ?? ""}
                                              onChange={event => updateSelectedObjectivePhaseField(phase.id, "requiredPresenceTargetId", event.target.value || undefined)}
                                              style={FIELD_STYLE}
                                            >
                                              <option value="">Choisir une presence requise</option>
                                              {presenceTargetOptions.map(option => (
                                                <option key={`${phase.id}:presence:${option.id}`} value={option.id}>
                                                  {option.label}
                                                </option>
                                              ))}
                                            </select>
                                          ) : (
                                            <input value="" readOnly style={{ ...FIELD_STYLE, opacity: 0.65 }} placeholder="Choisis d'abord un type de presence" />
                                          )}
                                        </label>
                                      </div>
                                      <div style={RESPONSIVE_THREE_COLUMN_GRID}>
                                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                          Type presence requise
                                          <select
                                            value={phase.requiredPresenceTargetKind ?? ""}
                                            onChange={event => updateSelectedObjectivePhaseField(phase.id, "requiredPresenceTargetKind", (event.target.value || undefined) as WorldMapSimulationObjectivePhase["requiredPresenceTargetKind"])}
                                            style={FIELD_STYLE}
                                          >
                                            {targetKindOptions.map(option => (
                                              <option key={`presence-${option.value || "none"}`} value={option.value}>
                                                {option.value ? option.label : "Aucune presence requise"}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                          Ancrage requis
                                          <select
                                            value={phase.requiredAnchorId ?? ""}
                                            onChange={event => updateSelectedObjectivePhaseField(phase.id, "requiredAnchorId", event.target.value || undefined)}
                                            style={FIELD_STYLE}
                                          >
                                            <option value="">Aucun ancrage specifique</option>
                                            {(selectedObjectiveOwnerFaction?.localAnchors ?? []).map(anchor => (
                                              <option key={`${phase.id}:${anchor.id}`} value={anchor.id}>
                                                {anchor.label || anchor.id} ({anchor.type})
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                          Type ancrage
                                          <select
                                            value={phase.requiredAnchorType ?? ""}
                                            onChange={event => updateSelectedObjectivePhaseField(phase.id, "requiredAnchorType", event.target.value || undefined)}
                                            style={FIELD_STYLE}
                                          >
                                            <option value="">Aucun type specifique</option>
                                            {availableAnchorTypeOptions.map(anchorType => (
                                              <option key={`${phase.id}:${anchorType}`} value={anchorType}>
                                                {anchorType}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                      </div>
                                      <div style={RESPONSIVE_THREE_COLUMN_GRID}>
                                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                          Failure mode
                                          <select
                                            value={phase.failureMode ?? "score_threshold"}
                                            onChange={event => updateSelectedObjectivePhaseField(phase.id, "failureMode", event.target.value as WorldMapSimulationObjectivePhase["failureMode"])}
                                            style={FIELD_STYLE}
                                          >
                                            <option value="score_threshold">score_threshold</option>
                                            <option value="fatal_condition">fatal_condition</option>
                                          </select>
                                        </label>
                                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                          Score echec
                                          <input
                                            type="number"
                                            min={0}
                                            value={phase.failureScore ?? 0}
                                            onChange={event => updateSelectedObjectivePhaseField(phase.id, "failureScore", Math.max(0, Number(event.target.value) || 0))}
                                            style={FIELD_STYLE}
                                          />
                                        </label>
                                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                          Seuil echec
                                          <input
                                            type="number"
                                            min={0}
                                            value={phase.maxFailureScore ?? 100}
                                            onChange={event => updateSelectedObjectivePhaseField(phase.id, "maxFailureScore", Math.max(0, Number(event.target.value) || 0))}
                                            style={FIELD_STYLE}
                                          />
                                        </label>
                                      </div>
                                      <div style={{ display: "grid", gap: 6 }}>
                                        <div style={editorTextStyles.helper}>Actions autorisees</div>
                                        {(phase.compatibleActionIds ?? []).length > 0 ? (
                                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                            {(phase.compatibleActionIds ?? []).map(actionId => (
                                              <button
                                                key={`${phase.id}:${actionId}`}
                                                type="button"
                                                onClick={() => removeValueFromSelectedObjectivePhaseListField(phase.id, "compatibleActionIds", actionId)}
                                                style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 999 }}
                                              >
                                                {actionId} x
                                              </button>
                                            ))}
                                          </div>
                                        ) : (
                                          <div style={editorTextStyles.helper}>Si vide, le runtime retombera sur les actions globales de l'objectif.</div>
                                        )}
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                          {WORLD_ACTION_DEFINITIONS
                                            .filter(action => !(phase.compatibleActionIds ?? []).includes(action.id))
                                            .map(action => (
                                              <button
                                                key={`${phase.id}:add-action:${action.id}`}
                                                type="button"
                                                onClick={() => addValueToSelectedObjectivePhaseListField(phase.id, "compatibleActionIds", action.id)}
                                                style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 999 }}
                                              >
                                                + {action.id}
                                              </button>
                                            ))}
                                        </div>
                                      </div>
                                      <div style={{ display: "grid", gap: 6 }}>
                                        <div style={editorTextStyles.helper}>Zones de phase</div>
                                        {(phase.zoneIds ?? []).length > 0 ? (
                                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                            {(phase.zoneIds ?? []).map(zoneId => (
                                              <button
                                                key={`${phase.id}:zone:${zoneId}`}
                                                type="button"
                                                onClick={() => removeValueFromSelectedObjectivePhaseListField(phase.id, "zoneIds", zoneId)}
                                                style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 999 }}
                                              >
                                                {zoneId} x
                                              </button>
                                            ))}
                                          </div>
                                        ) : (
                                          <div style={editorTextStyles.helper}>Aucune zone specifique: la phase herite de la zone globale de l'objectif.</div>
                                        )}
                                        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8 }}>
                                          <input
                                            value={phase.zoneIds?.join(", ") ?? ""}
                                            onChange={event => updateSelectedObjectivePhaseListField(phase.id, "zoneIds", parseStringListInput(event.target.value))}
                                            style={FIELD_STYLE}
                                            placeholder="route_id, district_id, region_id"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => updateSelectedObjectivePhaseListField(phase.id, "zoneIds", selectedSimulationObjective.zoneIds ?? [])}
                                            style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}
                                          >
                                            Copier zone objectif
                                          </button>
                                        </div>
                                      </div>
                                      <div style={RESPONSIVE_TWO_COLUMN_GRID}>
                                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                          Conditions fatales
                                          <input
                                            value={(phase.fatalFailureConditions ?? []).join(", ")}
                                            onChange={event => updateSelectedObjectivePhaseListField(phase.id, "fatalFailureConditions", parseStringListInput(event.target.value))}
                                            style={FIELD_STYLE}
                                            placeholder="phase_failure_threshold, missing_required_anchor"
                                          />
                                        </label>
                                        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                          Notes runtime
                                          <input
                                            value={(phase.notes ?? []).join(", ")}
                                            onChange={event => updateSelectedObjectivePhaseListField(phase.id, "notes", parseStringListInput(event.target.value))}
                                            style={FIELD_STYLE}
                                            placeholder="scouting, corridor_est, convoy_first"
                                          />
                                        </label>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                            Phase courante
                            <input
                              type="number"
                              min={0}
                              max={Math.max(0, (selectedSimulationObjective.phases ?? []).length - 1)}
                              value={selectedSimulationObjective.currentPhaseIndex ?? 0}
                              onChange={event => dispatch({ type: "updateSelectedSimulationObjectiveField", field: "currentPhaseIndex", value: event.target.value })}
                              style={FIELD_STYLE}
                            />
                          </label>
                          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                            Ancrage requis
                            <select
                              value={selectedSimulationObjective.requiredAnchorId ?? ""}
                              onChange={event => dispatch({ type: "updateSelectedSimulationObjectiveField", field: "requiredAnchorId", value: event.target.value })}
                              style={FIELD_STYLE}
                            >
                              <option value="">Aucun ancrage specifique</option>
                              {(selectedObjectiveOwnerFaction?.localAnchors ?? []).map(anchor => (
                                <option key={anchor.id} value={anchor.id}>
                                  {anchor.label || anchor.id} ({anchor.type})
                                </option>
                              ))}
                            </select>
                          </label>
                          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                            Type d'ancrage requis
                            <select
                              value={selectedSimulationObjective.requiredAnchorType ?? ""}
                              onChange={event => dispatch({ type: "updateSelectedSimulationObjectiveField", field: "requiredAnchorType", value: event.target.value })}
                              style={FIELD_STYLE}
                            >
                              <option value="">Aucun type specifique</option>
                              {availableAnchorTypeOptions.map(anchorType => (
                                <option key={anchorType} value={anchorType}>
                                  {anchorType}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div style={editorTextStyles.helper}>
                            Tu peux demander soit un ancrage precis, soit un type d'ancrage. Les deux servent de contrainte locale pour l'objectif.
                          </div>
                          <div style={editorTextStyles.helper}>
                            Phase active: {selectedObjectiveEditorActivePhase?.label ?? "aucune"}.
                          </div>
                          <div style={editorTextStyles.helper}>
                            Dependance locale: {selectedSimulationObjective.requiredAnchorId
                              ? (selectedObjectiveOwnerFaction?.localAnchors ?? []).some(anchor => anchor.id === selectedSimulationObjective.requiredAnchorId)
                                ? `ancrage resolu (${selectedSimulationObjective.requiredAnchorId})`
                                : `ancrage introuvable (${selectedSimulationObjective.requiredAnchorId})`
                              : selectedSimulationObjective.requiredAnchorType
                                ? (selectedObjectiveOwnerFaction?.localAnchors ?? []).some(anchor => anchor.type === selectedSimulationObjective.requiredAnchorType)
                                  ? `type disponible (${selectedSimulationObjective.requiredAnchorType})`
                                  : `type absent (${selectedSimulationObjective.requiredAnchorType})`
                                : "aucune contrainte locale"}
                            .
                          </div>
                          {selectedObjectiveRuntime && selectedObjectiveRuntimeActivePhase ? (
                            <div style={{ ...SUBSECTION_STYLE, gap: 8 }}>
                              <div style={editorTextStyles.sectionTitle}>Lecture runtime de la phase active</div>
                              <div style={{ display: "grid", gap: 3, fontSize: 12, color: "#dce5f2" }}>
                                <div>Etat runtime: {selectedObjectiveRuntime.state} · phase {selectedObjectiveRuntime.currentPhaseIndex + 1} / {selectedObjectiveRuntime.phases.length}</div>
                                <div>Phase active: {selectedObjectiveRuntimeActivePhase.label} · {selectedObjectiveRuntimeActivePhase.state}</div>
                                <div>Progression locale: {selectedObjectiveRuntimeActivePhase.progress}/{selectedObjectiveRuntimeActivePhase.completionThreshold}</div>
                                <div>Score d'echec local: {selectedObjectiveRuntimeActivePhase.failureScore}/{selectedObjectiveRuntimeActivePhase.maxFailureScore}</div>
                                <div>Poids vers progression globale: {selectedObjectiveRuntimeActivePhase.progressWeight}</div>
                                <div>Actions runtime: {(selectedObjectiveRuntimeActivePhase.compatibleActionIds ?? []).length > 0 ? selectedObjectiveRuntimeActivePhase.compatibleActionIds.join(", ") : "fallback objectif global"}</div>
                                <div>Cible globale: {selectedSimulationObjective.targetKind && selectedSimulationObjective.targetId ? `${selectedSimulationObjective.targetKind}:${selectedSimulationObjective.targetId}` : "aucune"}</div>
                                <div>Cible locale de phase: {formatSimulationTargetRef(selectedObjectiveReadiness?.localTargetRef ?? selectedObjectiveRuntimeActivePhase.localTarget)}</div>
                                <div>Cible d'execution runtime: {formatSimulationTargetRef(selectedObjectiveReadiness?.executionTargetRef)}</div>
                                <div>Readiness: {selectedObjectiveReadiness ? (selectedObjectiveReadiness.ready ? "ready" : "blocked") : "non evaluee"}</div>
                              </div>
                              {selectedObjectiveReadiness?.reasons.length ? (
                                <div style={{ display: "grid", gap: 3, fontSize: 12, color: "#ffd7d7" }}>
                                  {selectedObjectiveReadiness.reasons.map(reason => (
                                    <div key={`objective-runtime-reason:${reason}`}>- {formatObjectiveReadinessReason(reason)}</div>
                                  ))}
                                </div>
                              ) : null}
                              {selectedObjectiveRuntime.phaseHistory.length > 0 ? (
                                <div style={{ display: "grid", gap: 4, fontSize: 12, color: "#c8d0de" }}>
                                  <div style={editorTextStyles.sectionTitle}>Historique recent</div>
                                  {[...selectedObjectiveRuntime.phaseHistory].reverse().slice(0, 5).map((entry, index) => (
                                    <div key={`objective-history:${entry.phaseId}:${entry.enteredAtTick}:${index}`}>
                                      {entry.phaseId} · entree {entry.enteredAtTick}
                                      {typeof entry.exitedAtTick === "number" ? ` · sortie ${entry.exitedAtTick}` : " · ouverte"}
                                      {" · "}issue {entry.outcome ?? "en cours"}
                                      {" · "}raisons {(entry.reasons ?? []).join(", ") || "aucune"}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          <div style={{ ...SUBSECTION_STYLE, gap: 8 }}>
                            <div style={editorTextStyles.sectionTitle}>Obstacles</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {selectedSimulationObjective.obstacleHints.length > 0 ? (
                                selectedSimulationObjective.obstacleHints.map(obstacle => (
                                  <div
                                    key={obstacle}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 6,
                                      padding: "6px 10px",
                                      borderRadius: 999,
                                      border: "1px solid rgba(221,173,86,0.35)",
                                      background: "rgba(88,67,24,0.2)",
                                      color: "#ffe0a3",
                                      fontSize: 12
                                    }}
                                  >
                                    <span>{obstacle}</span>
                                    <button
                                      type="button"
                                      onClick={() => removeValueFromSelectedObjectiveListField("obstacleHints", obstacle)}
                                      style={{ border: "none", background: "transparent", color: "#ffe0a3", cursor: "pointer", padding: 0, fontWeight: 700 }}
                                      title="Retirer cet obstacle"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <div style={editorTextStyles.helper}>Aucun obstacle declare.</div>
                              )}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8 }}>
                              <input
                                value={pendingObjectiveObstacle}
                                onChange={event => setPendingObjectiveObstacle(event.target.value)}
                                style={FIELD_STYLE}
                                placeholder="garde, rival, manque d'indices"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  addValueToSelectedObjectiveListField("obstacleHints", pendingObjectiveObstacle);
                                  setPendingObjectiveObstacle("");
                                }}
                                disabled={!normalizeListDraftValue(pendingObjectiveObstacle)}
                                style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: normalizeListDraftValue(pendingObjectiveObstacle) ? 1 : 0.6 }}
                              >
                                Ajouter
                              </button>
                            </div>
                          </div>
                          <div style={{ ...SUBSECTION_STYLE, gap: 8 }}>
                            <div style={editorTextStyles.sectionTitle}>Actions compatibles</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                onClick={() => replaceSelectedObjectiveCompatibleActions(getSuggestedActionIdsForObjectiveCategory(selectedSimulationObjective.category))}
                                style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}
                              >
                                Restaurer recommandations de categorie
                              </button>
                              <button
                                type="button"
                                onClick={() => replaceSelectedObjectiveCompatibleActions([])}
                                style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}
                              >
                                Vider la liste
                              </button>
                            </div>
                            <div style={editorTextStyles.helper}>
                              Le moteur n'executera maintenant que les actions declarees ici et compatibles avec la categorie de l'objectif.
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {selectedSimulationObjective.compatibleActionIds.length > 0 ? (
                                selectedSimulationObjective.compatibleActionIds.map(actionId => (
                                  <div
                                    key={actionId}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 6,
                                      padding: "6px 10px",
                                      borderRadius: 999,
                                      border: "1px solid rgba(103, 139, 214, 0.35)",
                                      background: "rgba(44, 61, 92, 0.28)",
                                      color: "#cfe1ff",
                                      fontSize: 12
                                    }}
                                  >
                                    <span>{objectiveCompatibleActionOptions.find(option => option.id === actionId)?.label ?? actionId}</span>
                                    <button
                                      type="button"
                                      onClick={() => removeValueFromSelectedObjectiveListField("compatibleActionIds", actionId)}
                                      style={{ border: "none", background: "transparent", color: "#cfe1ff", cursor: "pointer", padding: 0, fontWeight: 700 }}
                                      title="Retirer cette action"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <div style={editorTextStyles.helper}>Aucune action compatible definie.</div>
                              )}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8 }}>
                              <select
                                value={pendingObjectiveActionId}
                                onChange={event => setPendingObjectiveActionId(event.target.value)}
                                style={FIELD_STYLE}
                              >
                                <option value="">Choisir une action connue</option>
                                {objectiveCompatibleActionOptions.map(option => (
                                  <option key={option.id} value={option.id}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  addValueToSelectedObjectiveListField("compatibleActionIds", pendingObjectiveActionId);
                                  setPendingObjectiveActionId("");
                                }}
                                disabled={!pendingObjectiveActionId}
                                style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: pendingObjectiveActionId ? 1 : 0.6 }}
                              >
                                Ajouter
                              </button>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8 }}>
                              <input
                                value={pendingObjectiveCustomActionId}
                                onChange={event => setPendingObjectiveCustomActionId(event.target.value)}
                                style={FIELD_STYLE}
                                placeholder="action_personnalisee"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  addValueToSelectedObjectiveListField("compatibleActionIds", pendingObjectiveCustomActionId);
                                  setPendingObjectiveCustomActionId("");
                                }}
                                disabled={!normalizeListDraftValue(pendingObjectiveCustomActionId)}
                                style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: normalizeListDraftValue(pendingObjectiveCustomActionId) ? 1 : 0.6 }}
                              >
                                Ajouter manuel
                              </button>
                            </div>
                            {selectedObjectiveActionDefinitions.length > 0 && (
                              <div style={{ display: "grid", gap: 8 }}>
                                <div style={editorTextStyles.helper}>
                                  Lecture rapide: les fiches ci-dessous reprennent conditions, effets et diffusion des actions actuellement autorisees pour cet objectif.
                                </div>
                                {selectedObjectiveActionDefinitions.map(action => (
                                  <div key={`action-card:${action.id}`} style={{ ...SUBSECTION_STYLE, gap: 6 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                      <div style={{ fontSize: 12, fontWeight: 700, color: "#dce5f2" }}>
                                        {action.label} · {action.id}
                                      </div>
                                      <div style={editorTextStyles.helper}>
                                        Priorite {action.basePriority} · Cooldown {action.cooldown}
                                      </div>
                                    </div>
                                    <div style={editorTextStyles.helper}>
                                      Cibles: {action.targetKinds.join(", ")} · Acteurs: {action.actorKinds.join(", ")}
                                    </div>
                                    <div style={editorTextStyles.helper}>
                                      Conditions: {action.preconditions.length > 0 ? action.preconditions.map(formatActionConditionSummary).join(" ; ") : "aucune"}
                                    </div>
                                    <div style={editorTextStyles.helper}>
                                      Succes: {action.successEffects.length > 0 ? action.successEffects.map(formatActionDeltaSummary).join(" ; ") : "aucun effet"}
                                    </div>
                                    <div style={editorTextStyles.helper}>
                                      Echec: {action.failureEffects.length > 0 ? action.failureEffects.map(formatActionDeltaSummary).join(" ; ") : "aucun effet"}
                                    </div>
                                    <div style={editorTextStyles.helper}>
                                      Diffusion: signal {action.diffusion.signalKind} ({action.diffusion.signalIntensity}) · rumeurs {action.diffusion.rumorTags.join(", ") || "aucune"}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          {(["onSuccess", "onFailure"] as const).map(field => {
                            const draft = pendingObjectiveConsequences[field];
                            const consequenceTypeOptions =
                              draft.type === "create_tension"
                                ? SIMULATION_TENSION_TYPE_OPTIONS
                                : draft.type === "open_opportunity"
                                  ? SIMULATION_OPPORTUNITY_KIND_OPTIONS
                                  : SIMULATION_SIGNAL_KIND_OPTIONS;
                            const numericLabel =
                              draft.type === "create_tension" ? "Severite" : draft.type === "open_opportunity" ? "Score" : "Intensite";
                            const consequences = selectedSimulationObjective[field] ?? [];
                            const consequencePresets = getObjectiveConsequencePresets(selectedSimulationObjective.category, field);
                            return (
                              <div key={field} style={{ ...SUBSECTION_STYLE, gap: 8 }}>
                                <div style={editorTextStyles.sectionTitle}>
                                  {field === "onSuccess" ? "Consequences en cas de succes" : "Consequences en cas d'echec"}
                                </div>
                                <div style={{ display: "grid", gap: 8 }}>
                                  {consequences.length > 0 ? (
                                    consequences.map((consequence, index) => (
                                      <div
                                        key={`${field}-${index}`}
                                        style={{
                                          display: "grid",
                                          gap: 4,
                                          padding: 10,
                                          borderRadius: 10,
                                          border: "1px solid rgba(124, 142, 168, 0.24)",
                                          background: "rgba(31, 38, 48, 0.72)"
                                        }}
                                      >
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                          <div style={{ fontSize: 12, fontWeight: 700, color: "#dce5f2" }}>{formatObjectiveConsequenceSummary(consequence)}</div>
                                          <button
                                            type="button"
                                            onClick={() => removeSelectedObjectiveConsequence(field, index)}
                                            style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}
                                          >
                                            Retirer
                                          </button>
                                        </div>
                                        <div style={editorTextStyles.helper}>
                                          Tags: {consequence.tags.length > 0 ? consequence.tags.join(", ") : "aucun"}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div style={editorTextStyles.helper}>Aucune consequence definie.</div>
                                  )}
                                </div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  {consequencePresets.map(preset => (
                                    <button
                                      key={`${field}:${preset.label}`}
                                      type="button"
                                      onClick={() =>
                                        setPendingObjectiveConsequences(current => ({
                                          ...current,
                                          [field]: { ...preset.draft }
                                        }))
                                      }
                                      style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 999 }}
                                    >
                                      Preset: {preset.label}
                                    </button>
                                  ))}
                                </div>
                                <div style={RESPONSIVE_TWO_COLUMN_GRID}>
                                  <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                    Type
                                    <select
                                      value={draft.type}
                                      onChange={event => {
                                        const nextType = event.target.value as WorldMapSimulationConsequence["type"];
                                        const nextSubtype =
                                          nextType === "create_tension"
                                            ? SIMULATION_TENSION_TYPE_OPTIONS[0]?.value ?? "criminal"
                                            : nextType === "open_opportunity"
                                              ? SIMULATION_OPPORTUNITY_KIND_OPTIONS[0]?.value ?? "escort_needed"
                                              : SIMULATION_SIGNAL_KIND_OPTIONS[0]?.value ?? "visual";
                                        setPendingObjectiveConsequences(current => ({
                                          ...current,
                                          [field]: {
                                            ...current[field],
                                            type: nextType,
                                            subtype: nextSubtype
                                          }
                                        }));
                                      }}
                                      style={FIELD_STYLE}
                                    >
                                      <option value="create_tension">Creer tension</option>
                                      <option value="open_opportunity">Ouvrir opportunite</option>
                                      <option value="spawn_signal">Generer signal</option>
                                    </select>
                                  </label>
                                  <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                    Variante
                                    <select
                                      value={draft.subtype}
                                      onChange={event =>
                                        setPendingObjectiveConsequences(current => ({
                                          ...current,
                                          [field]: { ...current[field], subtype: event.target.value }
                                        }))
                                      }
                                      style={FIELD_STYLE}
                                    >
                                      {consequenceTypeOptions.map(option => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                    {numericLabel}
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={draft.amount}
                                      onChange={event =>
                                        setPendingObjectiveConsequences(current => ({
                                          ...current,
                                          [field]: { ...current[field], amount: event.target.value }
                                        }))
                                      }
                                      style={FIELD_STYLE}
                                    />
                                  </label>
                                  <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                    Tags
                                    <StringListField
                                      values={draft.tags}
                                      onChange={value =>
                                        setPendingObjectiveConsequences(current => ({
                                          ...current,
                                          [field]: { ...current[field], tags: parseStringListInput(value) }
                                        }))
                                      }
                                      placeholder="Ajouter un tag"
                                      emptyHint="Aucun tag sur cette consequence."
                                      presetOptions={["elite", "crise", "rumeur", "alerte", "discret"]}
                                    />
                                  </label>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => addSelectedObjectiveConsequence(field)}
                                  disabled={!draft.subtype || !draft.amount.trim()}
                                  style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, width: "fit-content", opacity: draft.subtype && draft.amount.trim() ? 1 : 0.6 }}
                                >
                                  Ajouter consequence
                                </button>
                              </div>
                            );
                          })}
                          <div style={{ ...SUBSECTION_STYLE, gap: 8 }}>
                            <div style={editorTextStyles.sectionTitle}>Tags</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {selectedSimulationObjective.tags.length > 0 ? (
                                selectedSimulationObjective.tags.map(tag => (
                                  <div key={tag} style={{ ...editorSurfaceStyles.badge, display: "inline-flex", alignItems: "center", gap: 6 }}>
                                    <span>{tag}</span>
                                    <button
                                      type="button"
                                      onClick={() => removeValueFromSelectedObjectiveListField("tags", tag)}
                                      style={{ border: "none", background: "transparent", color: "#dce5f2", cursor: "pointer", padding: 0, fontWeight: 700 }}
                                      title="Retirer ce tag"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <div style={editorTextStyles.helper}>Aucun tag defini.</div>
                              )}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8 }}>
                              <select
                                value={pendingObjectiveTag}
                                onChange={event => setPendingObjectiveTag(event.target.value)}
                                style={FIELD_STYLE}
                              >
                                <option value="">Choisir un tag connu</option>
                                {TAG_PRESETS
                                  .filter(tag => !selectedSimulationObjective.tags.includes(tag.id))
                                  .map(tag => (
                                    <option key={tag.id} value={tag.id}>
                                      {tag.label}
                                    </option>
                                  ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  addValueToSelectedObjectiveListField("tags", pendingObjectiveTag);
                                  setPendingObjectiveTag("");
                                }}
                                disabled={!pendingObjectiveTag}
                                style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: pendingObjectiveTag ? 1 : 0.6 }}
                              >
                                Ajouter
                              </button>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8 }}>
                              <input
                                value={pendingObjectiveCustomTag}
                                onChange={event => setPendingObjectiveCustomTag(event.target.value)}
                                style={FIELD_STYLE}
                                placeholder="tag_personnalise"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  addValueToSelectedObjectiveListField("tags", pendingObjectiveCustomTag);
                                  setPendingObjectiveCustomTag("");
                                }}
                                disabled={!normalizeListDraftValue(pendingObjectiveCustomTag)}
                                style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: normalizeListDraftValue(pendingObjectiveCustomTag) ? 1 : 0.6 }}
                              >
                                Ajouter manuel
                              </button>
                            </div>
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={editorTextStyles.helper}>
                              Zones liees: {selectedSimulationObjective.zoneIds.length} entree(s)
                            </div>
                            <button
                              type="button"
                              onClick={replaceSelectedCellsAsObjectiveZones}
                              style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}
                            >
                              Remplacer zones par la selection
                            </button>
                          </div>
                          <div style={{ ...SUBSECTION_STYLE, gap: 8 }}>
                            <div style={editorTextStyles.sectionTitle}>Lecture des dependances</div>
                            <div style={editorTextStyles.helper}>
                              Cette vue relie l'objectif a son ancrage local, a sa zone et a sa projection logistique telle que le runtime la comprend deja.
                            </div>
                            <div style={{ display: "grid", gap: 4, fontSize: 12, color: "#dce5f2" }}>
                              <div>Etat runtime: {selectedObjectiveRuntime?.state ?? "indisponible"}</div>
                              <div>Cible globale: {selectedSimulationObjective.targetKind && selectedSimulationObjective.targetId ? `${selectedSimulationObjective.targetKind}:${selectedSimulationObjective.targetId}` : "aucune"}</div>
                              <div>Cible locale de phase: {formatSimulationTargetRef(selectedObjectiveReadiness?.localTargetRef ?? selectedObjectiveRuntimeActivePhase?.localTarget)}</div>
                              <div>Cible d'execution: {formatSimulationTargetRef(selectedObjectiveReadiness?.executionTargetRef)}</div>
                              <div>Ancrage resolu: {selectedObjectiveReadiness?.matchedAnchorId ? `${selectedObjectiveReadiness.matchedAnchorId} (${selectedObjectiveReadiness.matchedAnchorType ?? "type inconnu"})` : "aucun"}</div>
                              <div>Zones liees: {selectedSimulationObjective.zoneIds.length > 0 ? selectedSimulationObjective.zoneIds.join(", ") : "aucune"}</div>
                              <div>Projection logistique: {selectedObjectiveLogisticsPlan ? (selectedObjectiveLogisticsPlan.faisable ? "faisable" : "bloquee") : "aucun plan retenu"}</div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                              <div style={getProjectionCardStyle(selectedObjectiveReadiness?.ready ? "success" : "warning")}>
                                <div style={getProjectionSectionTitleStyle()}>Diagnostic prerequis</div>
                                <div>{selectedObjectiveReadiness?.ready ? "Objectif pret a etre projete" : "Blocage local avant projection"}</div>
                                <div style={editorTextStyles.helper}>
                                  {selectedObjectiveReadiness?.reasons.length
                                    ? selectedObjectiveReadiness.reasons.map(formatObjectiveReadinessReason).join(" | ")
                                    : "Aucun prerequis manquant detecte."}
                                </div>
                              </div>
                              <div style={getProjectionCardStyle(selectedObjectiveLogisticsPlan?.faisable ? "success" : "warning")}>
                                <div style={getProjectionSectionTitleStyle()}>Diagnostic projection</div>
                                <div>
                                  {selectedObjectiveLogisticsPlan
                                    ? selectedObjectiveLogisticsPlan.faisable
                                      ? "La faction sait projeter cet objectif"
                                      : "La faction ne sait pas encore projeter cet objectif"
                                    : "Aucun plan logistique retenu"}
                                </div>
                                <div style={editorTextStyles.helper}>
                                  {selectedObjectiveLogisticsPlan?.modeRetenu
                                    ? `Mode ${selectedObjectiveLogisticsPlan.modeRetenu} · ${selectedObjectiveLogisticsPlan.ticksEstimes ?? "n/a"} tick(s) · risque ${selectedObjectiveLogisticsPlan.scoreRisque ?? "n/a"}`
                                    : "Pas de mode de projection retenu."}
                                </div>
                              </div>
                              <div style={getProjectionCardStyle(selectedObjectiveDominantPressure ? "accent" : "default")}>
                                <div style={getProjectionSectionTitleStyle()}>Pression dominante a la cible</div>
                                {selectedObjectiveDominantPressure ? (
                                  <>
                                    <div>
                                      {selectedObjectiveDominantPressure.pressureType} · score {Math.round(selectedObjectiveDominantPressure.clampedValue)}
                                    </div>
                                    <div style={editorTextStyles.helper}>
                                      Cause principale: {selectedObjectiveDominantPressure.terms[0]?.source ?? "non detaillee"}
                                    </div>
                                  </>
                                ) : (
                                  <div style={editorTextStyles.helper}>Aucune pression dominante exploitable sur la cible d'execution.</div>
                                )}
                              </div>
                              <div style={getProjectionCardStyle(selectedObjectiveAssignedMobileRuntime ? "accent" : "default")}>
                                <div style={getProjectionSectionTitleStyle()}>Mobile engage</div>
                                {selectedObjectiveAssignedMobileRuntime ? (
                                  <>
                                    <div>{selectedObjectiveAssignedMobileRuntime.id}</div>
                                    <div style={editorTextStyles.helper}>
                                      {selectedObjectiveAssignedMobileSummary?.routeLabel
                                        ? `${selectedObjectiveAssignedMobileSummary.routeLabel} · ${selectedObjectiveAssignedMobileSummary.progressLabel}`
                                        : "Mobile hors route pour l'instant."}
                                    </div>
                                    <div style={editorTextStyles.helper}>
                                      {selectedObjectiveAssignedMobileSummary?.stopLabel ?? `Cap vers ${selectedObjectiveAssignedMobileSummary?.targetLabel ?? "aucune cible"}`}
                                    </div>
                                  </>
                                ) : (
                                  <div style={editorTextStyles.helper}>Aucun mobile assigne a cette projection.</div>
                                )}
                              </div>
                            </div>
                            {selectedObjectiveReadiness && selectedObjectiveReadiness.reasons.length > 0 ? (
                              <div
                                style={{
                                  display: "grid",
                                  gap: 4,
                                  padding: 10,
                                  borderRadius: 10,
                                  border: "1px solid rgba(200,92,92,0.28)",
                                  background: "rgba(200,92,92,0.12)",
                                  color: "#ffd7d7"
                                }}
                              >
                                <div style={{ fontWeight: 700 }}>Pre requis manquants</div>
                                {selectedObjectiveReadiness.reasons.map(reason => (
                                  <div key={reason}>- {formatObjectiveReadinessReason(reason)}</div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ ...editorTextStyles.helper, color: "#9fe0b2" }}>Pre requis locaux satisfaits.</div>
                            )}
                            {selectedObjectiveLogisticsPlan?.raisonsBlocage.length ? (
                              <div
                                style={{
                                  display: "grid",
                                  gap: 4,
                                  padding: 10,
                                  borderRadius: 10,
                                  border: "1px solid rgba(221,173,86,0.28)",
                                  background: "rgba(88,67,24,0.2)",
                                  color: "#ffe0a3"
                                }}
                              >
                                <div style={{ fontWeight: 700 }}>Blocages logistiques</div>
                                {selectedObjectiveLogisticsPlan.raisonsBlocage.map(reason => (
                                  <div key={reason}>- {reason}</div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <div style={{ ...SUBSECTION_STYLE, gap: 8 }}>
                            <div style={editorTextStyles.sectionTitle}>Lecture logistique objectif</div>
                            {selectedObjectiveLogisticsPlan ? (
                              <div style={{ display: "grid", gap: 6, fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
                                <div
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "6px 10px",
                                    borderRadius: 999,
                                    width: "fit-content",
                                    border: `1px solid ${selectedObjectiveLogisticsPlan.faisable ? "rgba(114,197,143,0.34)" : "rgba(200,92,92,0.34)"}`,
                                    background: selectedObjectiveLogisticsPlan.faisable ? "rgba(114,197,143,0.12)" : "rgba(200,92,92,0.12)",
                                    color: selectedObjectiveLogisticsPlan.faisable ? "#72c58f" : "#ffb0b0",
                                    fontWeight: 800
                                  }}
                                >
                                  {selectedObjectiveLogisticsPlan.faisable ? "Projection faisable" : "Projection bloquee"}
                                </div>
                                <div>Mode retenu: {selectedObjectiveLogisticsPlan.modeRetenu ?? "aucun"}</div>
                                <div>Acteur assigne: {selectedObjectiveLogisticsPlan.acteurAssigneId ?? "aucun"}</div>
                                <div>Cible d'execution: {selectedObjectiveLogisticsPlan.cibleExecutionRef ? `${selectedObjectiveLogisticsPlan.cibleExecutionRef.kind}:${selectedObjectiveLogisticsPlan.cibleExecutionRef.id}` : "aucune"}</div>
                                <div>Temps estime: {selectedObjectiveLogisticsPlan.ticksEstimes ?? "n/a"} tick(s)</div>
                                <div>Cout estime: {selectedObjectiveLogisticsPlan.coutEstime ?? "n/a"}</div>
                                <div>Risque estime: {selectedObjectiveLogisticsPlan.scoreRisque ?? "n/a"}</div>
                                <div>Itineraire retenu: {selectedObjectiveLogisticsPlan.routeIds.length > 0 ? selectedObjectiveLogisticsPlan.routeIds.join(" -> ") : "aucun"}</div>
                                {selectedObjectiveLogisticsRoutes.length > 0 && (
                                  <div style={editorTextStyles.helper}>
                                    Le trajet logistique retenu est surligne sur la carte en pointilles or tant que cet objectif reste selectionne.
                                  </div>
                                )}
                                {selectedObjectiveLogisticsPlan.notes.length > 0 && (
                                  <div style={{ display: "grid", gap: 4 }}>
                                    <div style={{ fontWeight: 700 }}>Notes runtime</div>
                                    {selectedObjectiveLogisticsPlan.notes.map(note => (
                                      <div key={note}>- {note}</div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={editorTextStyles.helper}>
                                Aucun plan logistique n'est retenu pour cet objectif. Soit il n'est pas prioritaire pour la faction, soit ses prerequis locaux le bloquent avant projection.
                              </div>
                            )}
                          </div>
                          <div style={{ ...SUBSECTION_STYLE, gap: 8 }}>
                            <div style={editorTextStyles.sectionTitle}>Projection metier avant tick</div>
                            <div style={editorTextStyles.helper}>
                              Cette vue rapproche l'objectif selectionne du tick micro projete a blanc. Elle montre l'action retenue, l'evenement attendu et les sorties perceptibles associees.
                            </div>
                            {selectedObjectiveProjectedAction ? (
                              <div style={{ display: "grid", gap: 8, fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
                                <div>Action projetee: {selectedObjectiveProjectedAction.actionId}</div>
                                <div>Acteur: {formatEntityRefSummary(selectedObjectiveProjectedAction.actorRef)}</div>
                                <div>Cible: {formatEntityRefSummary(selectedObjectiveProjectedAction.targetRef)}</div>
                                <div>Score retenu: {Math.round(selectedObjectiveProjectedAction.score)}</div>
                                <div>Resultat projete: {selectedObjectiveProjectedAction.success ? "succes" : "echec"}</div>
                                {selectedObjectiveProjectedEvent && (
                                  <button
                                    type="button"
                                    onClick={() => focusEntityRef(selectedObjectiveProjectedEvent.target ?? selectedObjectiveProjectedEvent.actor)}
                                    style={{
                                      ...getProjectionCardStyle(selectedObjectiveProjectedAction.success ? "success" : "warning"),
                                      width: "100%",
                                      textAlign: "left",
                                      cursor: isClickableEntityRef(selectedObjectiveProjectedEvent.target ?? selectedObjectiveProjectedEvent.actor) ? "pointer" : "default"
                                    }}
                                  >
                                    <div style={getProjectionSectionTitleStyle()}>Evenement attendu</div>
                                    <div>{selectedObjectiveProjectedEvent.type}</div>
                                    <div style={editorTextStyles.helper}>
                                      Deltas: {selectedObjectiveProjectedEvent.deltas.length} · Tags: {selectedObjectiveProjectedEvent.tags.join(", ") || "aucun"}
                                    </div>
                                  </button>
                                )}
                                <div style={{ display: "grid", gap: 6 }}>
                                  <div style={getProjectionSectionTitleStyle()}>Deltas d'etat attendus</div>
                                  {selectedObjectiveProjectedDeltaGroups.length > 0 ? selectedObjectiveProjectedDeltaGroups.map(group => (
                                    <button
                                      type="button"
                                      key={`${group.ref.kind}:${group.ref.id}`}
                                      onClick={() => focusEntityRef(group.ref)}
                                      style={{
                                        ...getProjectionCardStyle("default"),
                                        width: "100%",
                                        textAlign: "left",
                                        cursor: isClickableEntityRef(group.ref) ? "pointer" : "default"
                                      }}
                                    >
                                      <div style={getProjectionSectionTitleStyle()}>{formatEntityRefSummary(group.ref)}</div>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                        {group.deltas.map((delta, index) => (
                                          <div
                                            key={`${group.ref.kind}:${group.ref.id}:${delta.key}:${index}`}
                                            style={{
                                              ...getDeltaVisualStyle(delta.amount),
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: 8,
                                              padding: "6px 10px",
                                              borderRadius: 999,
                                              fontSize: 12,
                                              fontWeight: 700
                                            }}
                                          >
                                            <span>{formatDeltaLabel(delta.key)}</span>
                                            <span>{delta.before ?? "?"} → {delta.after ?? "?"}</span>
                                            <span>{(delta.amount ?? 0) > 0 ? "+" : ""}{delta.amount ?? 0}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </button>
                                  )) : <div style={editorTextStyles.helper}>Aucun delta d'etat detaille pour cet objectif sur le tick projete.</div>}
                                </div>
                                <div style={{ display: "grid", gap: 6 }}>
                                  <div style={getProjectionSectionTitleStyle()}>Signaux projetes</div>
                                  {selectedObjectiveProjectedSignals.length > 0 ? selectedObjectiveProjectedSignals.map(signal => (
                                    <button
                                      type="button"
                                      key={signal.id}
                                      onClick={() => focusEntityRef(signal.location)}
                                      style={{
                                        ...getProjectionCardStyle("accent"),
                                        width: "100%",
                                        textAlign: "left",
                                        cursor: isClickableEntityRef(signal.location) ? "pointer" : "default"
                                      }}
                                    >
                                      <div>{signal.kind} · intensite {signal.intensity}</div>
                                      <div style={editorTextStyles.helper}>
                                        Lieu: {formatEntityRefSummary(signal.location)} · Tags: {signal.tags.join(", ") || "aucun"}
                                      </div>
                                    </button>
                                  )) : <div style={editorTextStyles.helper}>Aucun signal projete pour cet objectif.</div>}
                                </div>
                                <div style={{ display: "grid", gap: 6 }}>
                                  <div style={getProjectionSectionTitleStyle()}>Rumeurs projetees</div>
                                  {selectedObjectiveProjectedRumors.length > 0 ? selectedObjectiveProjectedRumors.map(rumor => (
                                    <button
                                      type="button"
                                      key={rumor.id}
                                      onClick={() => focusEntityRef(rumor.origin)}
                                      style={{
                                        ...getProjectionCardStyle("warning"),
                                        width: "100%",
                                        textAlign: "left",
                                        cursor: isClickableEntityRef(rumor.origin) ? "pointer" : "default"
                                      }}
                                    >
                                      <div>Credibilite {rumor.credibility}</div>
                                      <div style={editorTextStyles.helper}>
                                        Origine: {formatEntityRefSummary(rumor.origin)} · Tags: {rumor.tags.join(", ") || "aucun"}
                                      </div>
                                    </button>
                                  )) : <div style={editorTextStyles.helper}>Aucune rumeur projetee pour cet objectif.</div>}
                                </div>
                                <div style={{ display: "grid", gap: 6 }}>
                                  <div style={getProjectionSectionTitleStyle()}>Opportunites projetees</div>
                                  {selectedObjectiveProjectedOpportunities.length > 0 ? selectedObjectiveProjectedOpportunities.map(opportunity => (
                                    <button
                                      type="button"
                                      key={opportunity.id}
                                      onClick={() => focusEntityRef(opportunity.location)}
                                      style={{
                                        ...getProjectionCardStyle("success"),
                                        width: "100%",
                                        textAlign: "left",
                                        cursor: isClickableEntityRef(opportunity.location) ? "pointer" : "default"
                                      }}
                                    >
                                      <div>{opportunity.kind} · score {opportunity.score}</div>
                                      <div style={editorTextStyles.helper}>
                                        Lieu: {formatEntityRefSummary(opportunity.location)} · Tags: {opportunity.tags.join(", ") || "aucun"}
                                      </div>
                                    </button>
                                  )) : <div style={editorTextStyles.helper}>Aucune opportunite projetee pour cet objectif.</div>}
                                </div>
                                <div style={{ display: "grid", gap: 6 }}>
                                  <div style={getProjectionSectionTitleStyle()}>Consequences configurees sur l'objectif</div>
                                  <div style={editorTextStyles.helper}>
                                    Succes: {(selectedSimulationObjective.onSuccess ?? []).length} · Echec: {(selectedSimulationObjective.onFailure ?? []).length}
                                  </div>
                                  {(selectedSimulationObjective.onSuccess ?? []).length > 0 && (
                                    <div style={{ display: "grid", gap: 4 }}>
                                      {(selectedSimulationObjective.onSuccess ?? []).map((consequence, index) => (
                                        <div key={`success-${index}`} style={getProjectionCardStyle("success")}>
                                          <div>{formatObjectiveConsequenceSummary(consequence)}</div>
                                          <div style={editorTextStyles.helper}>Branche: succes</div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {(selectedSimulationObjective.onFailure ?? []).length > 0 && (
                                    <div style={{ display: "grid", gap: 4 }}>
                                      {(selectedSimulationObjective.onFailure ?? []).map((consequence, index) => (
                                        <div key={`failure-${index}`} style={getProjectionCardStyle("warning")}>
                                          <div>{formatObjectiveConsequenceSummary(consequence)}</div>
                                          <div style={editorTextStyles.helper}>Branche: echec</div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div style={editorTextStyles.helper}>
                                Aucune action n'est actuellement projetee pour cet objectif au prochain tick micro. Il peut etre bloque, non prioritaire, ou laisser la main a un autre objectif.
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => dispatch({ type: "deleteSelectedSimulationObjective" })}
                            style={{ ...createEditorButtonStyle({ danger: true, compact: true }), borderRadius: 8 }}
                          >
                            Supprimer objectif
                          </button>
                          </div>
                        </CollapsibleSection>
                      )}

                      {activeSimulationWorkspace === "mobiles" && (
                      <EditorStepTabs
                        tabs={[
                          { id: "create", label: "Creer" },
                          { id: "modify", label: "Modifier" }
                        ]}
                        activeTab={activeMobileMode}
                        onChange={tabId => setActiveMobileMode(tabId as "create" | "modify")}
                      />
                      )}

                      {activeSimulationWorkspace === "mobiles" && activeMobileMode === "create" && (
                      <CollapsibleSection title="Mobiles" defaultOpen={false}>
                        <div style={SUBSECTION_STYLE}>
                          <div style={editorTextStyles.helper}>
                            Cree un nouveau mobile depuis ce wizard. La modification des mobiles existants reste dans l'onglet `Modifier`.
                          </div>
                          <EditorStepTabs
                            tabs={[
                              { id: "archetype", label: "1. Archetype" },
                              { id: "faction", label: "2. Faction" },
                              { id: "mission", label: "3. Mission" },
                              { id: "travel", label: "4. Trajet" },
                              { id: "validate", label: "5. Validation" }
                            ]}
                            activeTab={activeMobileCreateTab}
                            onChange={tabId => setActiveMobileCreateTab(tabId as "archetype" | "faction" | "mission" | "travel" | "validate")}
                          />
                          {activeMobileCreateTab === "archetype" && (
                            <div style={{ display: "grid", gap: 6 }}>
                              <div style={{ ...SUBSECTION_STYLE, gap: 6 }}>
                                <div>Nom du brouillon: {draftSimulationMobileActorLabel.trim() || "Aucun nom saisi"}</div>
                                <div style={editorTextStyles.helper}>
                                  Saisis directement le nom et l'id du nouveau mobile ici. Rien n'est lie a une liste de mobiles existants dans ce flux.
                                </div>
                              </div>
                              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                Archetype
                                <select
                                  value={draftSimulationMobileActorArchetype}
                                  onChange={event => dispatch({ type: "setDraftField", field: "draftSimulationMobileActorArchetype", value: event.target.value })}
                                  style={FIELD_STYLE}
                                >
                                  {MOBILE_ARCHETYPE_PRESETS.map(preset => (
                                    <option key={preset.id} value={preset.id}>
                                      {preset.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <div style={editorTextStyles.helper}>
                                Mission type: {draftMobileArchetypePreset?.defaultMissionLabel ?? "Aucune"} | Niveau recommande: {draftMobileArchetypePreset ? SIMULATION_LEVEL_PRODUCT_LABELS[draftMobileArchetypePreset.recommendedSimulationLevel] : "Aucun"}
                              </div>
                              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                Nom du mobile
                                <input
                                  value={draftSimulationMobileActorLabel}
                                  onChange={event => dispatch({ type: "setDraftField", field: "draftSimulationMobileActorLabel", value: event.target.value })}
                                  style={FIELD_STYLE}
                                  placeholder="Patrouille de la Porte Est"
                                />
                              </label>
                              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                Id technique
                                <input
                                  value={draftSimulationMobileActorId}
                                  onChange={event => dispatch({ type: "setDraftField", field: "draftSimulationMobileActorId", value: event.target.value })}
                                  style={FIELD_STYLE}
                                  placeholder="patrouille_porte_est"
                                />
                              </label>
                            </div>
                          )}
                          {activeMobileCreateTab === "faction" && (
                            <div style={{ display: "grid", gap: 6 }}>
                              <div style={{ ...SUBSECTION_STYLE, gap: 6 }}>
                                <div>Faction retenue: {selectedMobileOwnerFaction?.label ?? "Aucune faction selectionnee"}</div>
                                <div style={editorTextStyles.helper}>Le mobile sera rattache a la faction choisie dans cette etape.</div>
                              </div>
                              {renderSimulationSelectionChips(
                                simulationFactions.map(faction => ({
                                  id: faction.id,
                                  label: faction.label,
                                  accentColor: faction.color || "rgba(79,125,242,0.26)",
                                  helper: faction.id
                                })),
                                effectiveMobileOwnerFactionId,
                                factionId => {
                                  setDraftMobileOwnerFactionId(factionId);
                                  dispatch({ type: "setSelectedSimulationFaction", factionId });
                                },
                                "Aucune faction disponible."
                              )}
                              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                Type interne
                                <input
                                  value={draftSimulationMobileActorType}
                                  onChange={event => dispatch({ type: "setDraftField", field: "draftSimulationMobileActorType", value: event.target.value })}
                                  style={FIELD_STYLE}
                                  placeholder="caravan, army, pilgrims"
                                />
                              </label>
                              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                Couleur
                                <input
                                  value={draftSimulationMobileActorColor}
                                  onChange={event => dispatch({ type: "setDraftField", field: "draftSimulationMobileActorColor", value: event.target.value })}
                                  style={FIELD_STYLE}
                                />
                              </label>
                            </div>
                          )}
                          {activeMobileCreateTab === "mission" && (
                            <div style={{ display: "grid", gap: 8 }}>
                              <div style={{ ...SUBSECTION_STYLE, gap: 6 }}>
                                <div>Mission principale: {draftMobileMissionSummary}</div>
                                <div>Cible de mission: {draftMobileMissionTargetSummary}</div>
                                <div style={editorTextStyles.helper}>La mission est derivee de l'objectif selectionne, sinon de l'archetype.</div>
                              </div>
                              <div style={{ ...SUBSECTION_STYLE, gap: 6 }}>
                                <div>Objectif selectionne: {selectedSimulationObjective?.label ?? "Aucun"}</div>
                                <div style={editorTextStyles.helper}>Change l'objectif courant dans l'editeur si tu veux une autre mission liee.</div>
                              </div>
                            </div>
                          )}
                          {activeMobileCreateTab === "travel" && (
                            <div style={{ display: "grid", gap: 8 }}>
                              <div style={{ ...SUBSECTION_STYLE, gap: 6 }}>
                                <div>Depart: {draftMobileDepartureSummary}</div>
                                <div>Destination: {draftMobileMissionTargetSummary}</div>
                                <div>Mode: trajet automatique par defaut</div>
                                <div style={editorTextStyles.helper}>L'itineraire detaille reste disponible apres creation dans la fiche mobile.</div>
                              </div>
                            </div>
                          )}
                          {activeMobileCreateTab === "validate" && (
                            <div style={{ display: "grid", gap: 8 }}>
                              <div style={editorTextStyles.helper}>
                                Resume: {draftSimulationMobileActorLabel.trim() || draftSimulationMobileActorId.trim() || "Mobile sans nom"} · {draftSimulationMobileActorType.trim() || "type libre"} · {draftSimulationMobileActorColor.trim() || "couleur par defaut"}
                              </div>
                              <div style={editorTextStyles.helper}>
                                Trajet: {draftMobileDepartureSummary} {"->"} {draftMobileMissionTargetSummary}
                              </div>
                              <div style={editorTextStyles.helper}>
                                Faction: {selectedMobileOwnerFaction?.label ?? "Sans faction"} | Mission: {draftMobileMissionSummary}
                              </div>
                              <button
                                type="button"
                                onClick={createSimulationMobileActorDefinition}
                                disabled={!draftMobileCreationReady || !effectiveMobileOwnerFactionId}
                                style={{ ...createEditorButtonStyle({ active: true, compact: true }), borderRadius: 8, cursor: draftMobileCreationReady && Boolean(effectiveMobileOwnerFactionId) ? "pointer" : "not-allowed", opacity: draftMobileCreationReady && Boolean(effectiveMobileOwnerFactionId) ? 1 : 0.6 }}
                              >
                                Creer acteur mobile
                              </button>
                            </div>
                          )}
                        </div>
                      </CollapsibleSection>
                      )}

                      {activeSimulationWorkspace === "mobiles" && activeMobileMode === "modify" && (
                        <div style={{ ...SUBSECTION_STYLE, gap: 8 }}>
                          <div style={editorTextStyles.sectionTitle}>Liste des mobiles</div>
                          <div style={editorTextStyles.helper}>
                            Choisis une faction, puis un mobile appartenant a cette faction.
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={editorTextStyles.sectionTitle}>Faction</div>
                            {renderSimulationSelectionChips(
                              simulationFactions.map(faction => ({
                                id: faction.id,
                                label: faction.label,
                                accentColor: faction.color || "rgba(79,125,242,0.26)",
                                helper: faction.id
                              })),
                              effectiveMobileBrowseFactionId,
                              factionId => {
                                setMobileBrowseFactionId(factionId);
                                dispatch({ type: "setSelectedSimulationFaction", factionId });
                              },
                              "Aucune faction disponible."
                            )}
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={editorTextStyles.sectionTitle}>Mobiles</div>
                            {renderSimulationSelectionChips(
                              mobilesForBrowseFaction.map(actor => ({
                                id: actor.id,
                                label: actor.label,
                                accentColor: mobileBrowseFaction?.color || "rgba(79,125,242,0.26)",
                                helper: actor.id
                              })),
                              selectedSimulationMobileActorId,
                              actorId => dispatch({ type: "setSelectedSimulationMobileActor", actorId }),
                              "Aucun mobile pour cette faction."
                            )}
                          </div>
                          <div style={{ ...SUBSECTION_STYLE, gap: 6 }}>
                            <div style={editorTextStyles.sectionTitle}>Cible active</div>
                            <div style={editorTextStyles.helper}>
                              Faction: {mobileBrowseFaction?.label ?? "Aucune"} ({mobilesForBrowseFaction.length} mobile(s))
                            </div>
                            <div style={editorTextStyles.helper}>
                              Mobile: {selectedSimulationMobileActor?.label ?? "Aucun mobile selectionne"}
                            </div>
                          </div>
                        </div>
                      )}

                      {activeSimulationWorkspace === "mobiles" && activeMobileMode === "modify" && selectedSimulationMobileActor && selectedSimulationMobileActor.ownerFactionId === effectiveMobileBrowseFactionId && (
                        <CollapsibleSection title="Mobile selectionne" defaultOpen={false}>
                          <div style={SUBSECTION_STYLE}>
                          <CollapsibleSection title="Resume" defaultOpen>
                          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                            Nom
                            <input
                              value={selectedSimulationMobileActor.label}
                              onChange={event => dispatch({ type: "updateSelectedSimulationMobileActorField", field: "label", value: event.target.value })}
                              style={FIELD_STYLE}
                            />
                          </label>
                          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                            Faction porteuse
                            <select
                              value={selectedSimulationMobileActor.ownerFactionId ?? ""}
                              onChange={event => dispatch({ type: "updateSelectedSimulationMobileActorField", field: "ownerFactionId", value: event.target.value })}
                              style={FIELD_STYLE}
                            >
                              <option value="">Aucune</option>
                              {simulationFactions.map(faction => (
                                <option key={faction.id} value={faction.id}>
                                  {faction.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div style={{ ...SUBSECTION_STYLE, gap: 6 }}>
                            <div style={editorTextStyles.sectionTitle}>Resume mission</div>
                            <div style={editorTextStyles.helper}>Archetype: {selectedSimulationMobileArchetypePreset?.label ?? selectedSimulationMobileActor.archetype ?? "Non defini"}</div>
                            <div style={editorTextStyles.helper}>Mission: {selectedSimulationMobileMissionSummary}</div>
                            <div style={editorTextStyles.helper}>Statut: {selectedSimulationMobileActor.missionStatus ? MOBILE_MISSION_STATUS_LABELS[selectedSimulationMobileActor.missionStatus] : "Non defini"}</div>
                            <div style={editorTextStyles.helper}>Position: {selectedSimulationMobilePositionSummary}</div>
                            <div style={editorTextStyles.helper}>Cible: {selectedSimulationMobileMissionTargetSummary}</div>
                            <div style={editorTextStyles.helper}>Niveau produit: {SIMULATION_LEVEL_PRODUCT_LABELS[selectedSimulationMobileActor.simulationLevel]}</div>
                            <div style={editorTextStyles.helper}>Itineraire: {MOBILE_ITINERARY_MODE_LABELS[selectedSimulationMobileActor.itineraryMode ?? "auto"]}</div>
                          </div>
                          </CollapsibleSection>
                          <CollapsibleSection title="Mission" defaultOpen>
                          <div style={RESPONSIVE_TWO_COLUMN_GRID}>
                            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                              Archetype
                              <select
                                value={selectedSimulationMobileActor.archetype ?? ""}
                                onChange={event => dispatch({ type: "updateSelectedSimulationMobileActorField", field: "archetype", value: event.target.value })}
                                style={FIELD_STYLE}
                              >
                                <option value="">Aucun</option>
                                {MOBILE_ARCHETYPE_PRESETS.map(preset => (
                                  <option key={preset.id} value={preset.id}>
                                    {preset.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div style={{ display: "grid", alignContent: "end" }}>
                              <button
                                type="button"
                                onClick={() => selectedSimulationMobileArchetypePreset && applyPresetToSelectedMobile(selectedSimulationMobileArchetypePreset)}
                                disabled={!selectedSimulationMobileArchetypePreset}
                                style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: selectedSimulationMobileArchetypePreset ? 1 : 0.6 }}
                              >
                                Appliquer preset
                              </button>
                            </div>
                          </div>
                          <div style={RESPONSIVE_TWO_COLUMN_GRID}>
                            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                              Mission principale
                              <input
                                value={selectedSimulationMobileActor.missionLabel ?? ""}
                                onChange={event => dispatch({ type: "updateSelectedSimulationMobileActorField", field: "missionLabel", value: event.target.value })}
                                style={FIELD_STYLE}
                                placeholder="Securiser la route de l'Ambre"
                              />
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                              Cible de mission
                              <input
                                value={selectedSimulationMobileActor.missionTargetLabel ?? ""}
                                onChange={event => dispatch({ type: "updateSelectedSimulationMobileActorField", field: "missionTargetLabel", value: event.target.value })}
                                style={FIELD_STYLE}
                                placeholder="Porte Est"
                              />
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                              Priorite mission
                              <select
                                value={selectedSimulationMobileActor.missionPriority ?? "standard"}
                                onChange={event => dispatch({ type: "updateSelectedSimulationMobileActorField", field: "missionPriority", value: event.target.value })}
                                style={FIELD_STYLE}
                              >
                                {Object.entries(MOBILE_MISSION_PRIORITY_LABELS).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                              Statut mission
                              <select
                                value={selectedSimulationMobileActor.missionStatus ?? ""}
                                onChange={event => dispatch({ type: "updateSelectedSimulationMobileActorField", field: "missionStatus", value: event.target.value })}
                                style={FIELD_STYLE}
                              >
                                <option value="">Non defini</option>
                                {Object.entries(MOBILE_MISSION_STATUS_LABELS).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          </CollapsibleSection>
                          <CollapsibleSection title="Deplacement" defaultOpen>
                          <div style={RESPONSIVE_TWO_COLUMN_GRID}>
                            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                              Mode d'itineraire
                              <select
                                value={selectedSimulationMobileActor.itineraryMode ?? "auto"}
                                onChange={event => dispatch({ type: "updateSelectedSimulationMobileActorField", field: "itineraryMode", value: event.target.value })}
                                style={FIELD_STYLE}
                              >
                                <option value="auto">{MOBILE_ITINERARY_MODE_LABELS.auto}</option>
                                <option value="locked">{MOBILE_ITINERARY_MODE_LABELS.locked}</option>
                              </select>
                            </label>
                            <div style={editorTextStyles.helper}>
                              Auto laisse le runtime recalculer le trajet si besoin. Verrouille preserve l'itineraire manuel tant qu'il reste praticable.
                            </div>
                          </div>
                          <div style={RESPONSIVE_TWO_COLUMN_GRID}>
                            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                              Position
                              <select
                                value={selectedSimulationMobileActor.positionKind}
                                onChange={event => dispatch({ type: "updateSelectedSimulationMobileActorField", field: "positionKind", value: event.target.value as SimulationActorPositionKind })}
                                style={FIELD_STYLE}
                              >
                                <option value="city">Ville</option>
                                <option value="route">Route</option>
                                <option value="region">Region</option>
                                <option value="cell">Cellule</option>
                              </select>
                            </label>
                            {selectedSimulationMobileActor.positionKind === "cell" ? (
                              <div style={{ display: "grid", gap: 6 }}>
                                <div style={editorTextStyles.helper}>Cellule de position: {getCellLabel(selectedSimulationMobileActor.positionCell)}</div>
                                {selectedMobilePositionRouteHint ? (
                                  <div style={editorTextStyles.helper}>
                                    {selectedMobilePositionRouteHint.isIntermediate
                                      ? `Cette cellule place le mobile sur le troncon ${selectedMobilePositionRouteHint.routeLabel}, a l'interieur de la route.`
                                      : `Cette cellule tombe sur le point d'ancrage de la route ${selectedMobilePositionRouteHint.routeLabel}.`}
                                  </div>
                                ) : null}
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <button
                                    type="button"
                                    onClick={() => applySelectedCellToMobile("positionCell")}
                                    disabled={!selectedCell?.cell}
                                    style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: selectedCell?.cell ? 1 : 0.6 }}
                                  >
                                    Utiliser case selectionnee
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => clearMobileCell("positionCell")}
                                    style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}
                                  >
                                    Effacer cellule
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                Reference position
                                <select
                                  value={selectedSimulationMobileActor.positionId ?? ""}
                                  onChange={event => dispatch({ type: "updateSelectedSimulationMobileActorField", field: "positionId", value: event.target.value })}
                                  style={FIELD_STYLE}
                                >
                                  <option value="">Choisir une reference</option>
                                  {positionReferenceOptions.map(option => (
                                    <option key={option.id} value={option.id}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            )}
                            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                              Destination
                              <select
                                value={selectedSimulationMobileActor.destinationKind ?? ""}
                                onChange={event => dispatch({ type: "updateSelectedSimulationMobileActorField", field: "destinationKind", value: event.target.value as SimulationActorPositionKind })}
                                style={FIELD_STYLE}
                              >
                                <option value="">Aucune</option>
                                <option value="city">Ville</option>
                                <option value="route">Route</option>
                                <option value="region">Region</option>
                                <option value="cell">Cellule</option>
                              </select>
                            </label>
                            {selectedSimulationMobileActor.destinationKind === "cell" ? (
                              <div style={{ display: "grid", gap: 6 }}>
                                <div style={editorTextStyles.helper}>Cellule de destination: {getCellLabel(selectedSimulationMobileActor.destinationCell)}</div>
                                {selectedMobileDestinationRouteHint ? (
                                  <div style={editorTextStyles.helper}>
                                    {selectedMobileDestinationRouteHint.isIntermediate
                                      ? `Cette destination arretera le mobile a l'interieur du troncon ${selectedMobileDestinationRouteHint.routeLabel}.`
                                      : `Cette cellule de destination correspond au point d'ancrage de la route ${selectedMobileDestinationRouteHint.routeLabel}.`}
                                  </div>
                                ) : null}
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <button
                                    type="button"
                                    onClick={() => applySelectedCellToMobile("destinationCell")}
                                    disabled={!selectedCell?.cell}
                                    style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: selectedCell?.cell ? 1 : 0.6 }}
                                  >
                                    Utiliser case selectionnee
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => clearMobileCell("destinationCell")}
                                    style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}
                                  >
                                    Effacer cellule
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                Reference destination
                                <select
                                  value={selectedSimulationMobileActor.destinationId ?? ""}
                                  onChange={event => dispatch({ type: "updateSelectedSimulationMobileActorField", field: "destinationId", value: event.target.value })}
                                  style={FIELD_STYLE}
                                >
                                  <option value="">Choisir une reference</option>
                                  {destinationReferenceOptions.map(option => (
                                    <option key={option.id} value={option.id}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            )}
                          </div>
                          <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
                            <div>Itineraire routes</div>
                            <div style={editorTextStyles.helper}>
                              L'itineraire se construit avec les actions guidees ci-dessous et reste visible sur la carte.
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={replaceSelectedMobileItineraryWithRoute}
                              disabled={!selectedRoute || selectedRoute.kind !== "road"}
                              style={{
                                ...createEditorButtonStyle({ compact: true }),
                                borderRadius: 8,
                                opacity: selectedRoute?.kind === "road" ? 1 : 0.6
                              }}
                            >
                              Remplacer par route active
                            </button>
                            <button
                              type="button"
                              onClick={appendSelectedRouteToMobileItinerary}
                              disabled={!selectedRoute || selectedRoute.kind !== "road"}
                              style={{
                                ...createEditorButtonStyle({ compact: true }),
                                borderRadius: 8,
                                opacity: selectedRoute?.kind === "road" ? 1 : 0.6
                              }}
                            >
                              Ajouter route active
                            </button>
                            <button
                              type="button"
                              onClick={removeSelectedRouteFromMobileItinerary}
                              disabled={!selectedRoute || selectedRoute.kind !== "road"}
                              style={{
                                ...createEditorButtonStyle({ compact: true }),
                                borderRadius: 8,
                                opacity: selectedRoute?.kind === "road" ? 1 : 0.6
                              }}
                            >
                              Retirer route active
                            </button>
                            <button
                              type="button"
                              onClick={popSelectedMobileItineraryRoute}
                              disabled={selectedSimulationMobileActor.itineraryRouteIds.length === 0}
                              style={{
                                ...createEditorButtonStyle({ compact: true }),
                                borderRadius: 8,
                                opacity: selectedSimulationMobileActor.itineraryRouteIds.length > 0 ? 1 : 0.6
                              }}
                            >
                              Retirer derniere route
                            </button>
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={editorTextStyles.helper}>
                              Itineraire visible sur la carte: {selectedMobileItineraryRoutes.length} route(s).
                            </div>
                            {selectedMobileItineraryRoutes.length > 0 ? (
                              <div style={{ display: "grid", gap: 6 }}>
                                {selectedMobileItineraryRoutes.map((path, index) => (
                                  <div key={`${path.id}-${index}`} style={{ ...SUBSECTION_STYLE, gap: 4 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700 }}>
                                      {index + 1}. {path.label || path.id}
                                    </div>
                                    <div style={editorTextStyles.helper}>
                                      {path.id} · {path.cells.length} case(s) · {path.roadType ?? "road"}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={editorTextStyles.helper}>
                                Aucun trajet detaille defini. Utilise la route active ou le bouton auto-itineraire.
                              </div>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={autoComputeSelectedMobileItinerary}
                              disabled={!selectedSimulationMobileActor.destinationKind}
                              style={{
                                ...createEditorButtonStyle({ compact: true }),
                                borderRadius: 8,
                                opacity: selectedSimulationMobileActor.destinationKind ? 1 : 0.6
                              }}
                            >
                              Auto-itineraire
                            </button>
                            <button
                              type="button"
                              onClick={() => dispatch({ type: "updateSelectedSimulationMobileActorField", field: "itineraryRouteIds", value: "" })}
                              style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}
                            >
                              Vider itineraire
                            </button>
                          </div>
                          </CollapsibleSection>
                          <CollapsibleSection title="Capacites" defaultOpen>
                          <div style={RESPONSIVE_TWO_COLUMN_GRID}>
                            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                              Deplacement
                              <select
                                value={selectedSimulationMobileActor.travelMode}
                                onChange={event => dispatch({ type: "updateSelectedSimulationMobileActorField", field: "travelMode", value: event.target.value as SimulationTravelMode })}
                                style={FIELD_STYLE}
                              >
                                <option value="road">Route</option>
                                <option value="river">Riviere</option>
                                <option value="sea">Mer</option>
                                <option value="foot">A pied</option>
                              </select>
                            </label>
                            <div style={editorTextStyles.helper}>
                              Mobilite produit: {getMobilityPresetLabel(selectedSimulationMobileActor.speed)}. Les valeurs ci-dessous restent des reglages avances pour le moteur.
                            </div>
                          </div>
                          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                            Population / races
                            <PopulationProfileField
                              profile={selectedSimulationMobileActor.populationProfile}
                              effectiveProfile={selectedSimulationMobileActorRuntime?.populationProfile}
                              effectiveSource={selectedSimulationMobilePopulationSource}
                              inheritanceHint="Aucun override defini. Le mobile herite alors de la faction porteuse ou de la ville."
                              emptyAddLabel="Ajouter"
                              onChange={value => dispatch({ type: "updateSelectedSimulationMobileActorField", field: "populationProfile", value })}
                            />
                          </label>
                          <div style={editorTextStyles.helper}>
                            Si ce champ est vide, le runtime herite du profil de la faction porteuse quand il existe.
                          </div>
                          <div style={RESPONSIVE_THREE_COLUMN_GRID}>
                            {([
                              ["speed", "Vitesse"],
                              ["security", "Securite"],
                              ["fatigue", "Fatigue"],
                              ["cargo", "Charge"],
                              ["headcount", "Effectif"],
                              ["resources", "Ressources"]
                            ] as const).map(([field, label]) => (
                              <label key={field} style={{ display: "grid", gap: 4, fontSize: 12 }}>
                                {label}
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={selectedSimulationMobileActor[field]}
                                  onChange={event => dispatch({ type: "updateSelectedSimulationMobileActorField", field, value: event.target.value })}
                                  style={FIELD_STYLE}
                                />
                              </label>
                            ))}
                          </div>
                          </CollapsibleSection>
                          <CollapsibleSection title="Avance" defaultOpen={false}>
                          <div style={RESPONSIVE_TWO_COLUMN_GRID}>
                            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                              Type interne
                              <input
                                value={selectedSimulationMobileActor.type}
                                onChange={event => dispatch({ type: "updateSelectedSimulationMobileActorField", field: "type", value: event.target.value })}
                                style={FIELD_STYLE}
                              />
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                              Niveau simulation
                              <select
                                value={selectedSimulationMobileActor.simulationLevel}
                                onChange={event => dispatch({ type: "updateSelectedSimulationMobileActorField", field: "simulationLevel", value: event.target.value as SimulationActorLevel })}
                                style={FIELD_STYLE}
                              >
                                <option value="active">{SIMULATION_LEVEL_PRODUCT_LABELS.active}</option>
                                <option value="summary">{SIMULATION_LEVEL_PRODUCT_LABELS.summary}</option>
                                <option value="abstract">{SIMULATION_LEVEL_PRODUCT_LABELS.abstract}</option>
                              </select>
                            </label>
                          </div>
                          <div style={{ ...SUBSECTION_STYLE, gap: 8 }}>
                            <div style={editorTextStyles.sectionTitle}>Edition guidee mobile</div>
                            {selectedSimulationMobileActor.simulationLevel === "abstract" ? (
                              <div style={editorTextStyles.helper}>
                                Ce mobile est abstrait: evite les positions en cellule et les itineraires tres detailles si tu ne veux pas suggerer une precision runtime trompeuse.
                              </div>
                            ) : null}
                            <div style={editorTextStyles.helper}>
                              Les objectifs lies et tags d'interaction se gerent ici via des selections guidees.
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {selectedSimulationMobileActor.objectiveIds.length > 0 ? selectedSimulationMobileActor.objectiveIds.map(objectiveId => (
                                <div key={objectiveId} style={{ ...editorSurfaceStyles.badge, display: "inline-flex", alignItems: "center", gap: 6 }}>
                                  <span>{selectableMobileObjectiveOptions.find(option => option.id === objectiveId)?.label ?? objectiveId}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeValueFromSelectedMobileListField("objectiveIds", objectiveId)}
                                    style={{ border: "none", background: "transparent", color: "#dce5f2", cursor: "pointer", padding: 0, fontWeight: 700 }}
                                  >
                                    ×
                                  </button>
                                </div>
                              )) : <div style={editorTextStyles.helper}>Aucun objectif lie.</div>}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8 }}>
                              <select
                                value={pendingMobileObjectiveId}
                                onChange={event => setPendingMobileObjectiveId(event.target.value)}
                                style={FIELD_STYLE}
                              >
                                <option value="">Ajouter un objectif lie</option>
                                {selectableMobileObjectiveOptions
                                  .filter(option => !selectedSimulationMobileActor.objectiveIds.includes(option.id))
                                  .map(option => (
                                    <option key={option.id} value={option.id}>
                                      {option.label}
                                    </option>
                                  ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  addValueToSelectedMobileListField("objectiveIds", pendingMobileObjectiveId);
                                  setPendingMobileObjectiveId("");
                                }}
                                disabled={!pendingMobileObjectiveId}
                                style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: pendingMobileObjectiveId ? 1 : 0.6 }}
                              >
                                Ajouter
                              </button>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {selectedSimulationMobileActor.interactionTags.length > 0 ? selectedSimulationMobileActor.interactionTags.map(tag => (
                                <div key={tag} style={{ ...editorSurfaceStyles.badge, display: "inline-flex", alignItems: "center", gap: 6 }}>
                                  <span>{tag}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeValueFromSelectedMobileListField("interactionTags", tag)}
                                    style={{ border: "none", background: "transparent", color: "#dce5f2", cursor: "pointer", padding: 0, fontWeight: 700 }}
                                  >
                                    ×
                                  </button>
                                </div>
                              )) : <div style={editorTextStyles.helper}>Aucun tag d'interaction.</div>}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8 }}>
                              <select
                                value={pendingMobileInteractionTag}
                                onChange={event => setPendingMobileInteractionTag(event.target.value)}
                                style={FIELD_STYLE}
                              >
                                <option value="">Choisir un tag d'interaction</option>
                                {SIMULATION_MOBILE_INTERACTION_TAG_SUGGESTIONS
                                  .filter(tag => !selectedSimulationMobileActor.interactionTags.includes(tag))
                                  .map(tag => (
                                    <option key={tag} value={tag}>
                                      {tag}
                                    </option>
                                  ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  addValueToSelectedMobileListField("interactionTags", pendingMobileInteractionTag);
                                  setPendingMobileInteractionTag("");
                                }}
                                disabled={!pendingMobileInteractionTag}
                                style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: pendingMobileInteractionTag ? 1 : 0.6 }}
                              >
                                Ajouter
                              </button>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8 }}>
                              <input
                                value={pendingMobileCustomInteractionTag}
                                onChange={event => setPendingMobileCustomInteractionTag(event.target.value)}
                                style={FIELD_STYLE}
                                placeholder="Ajouter un tag libre"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  addValueToSelectedMobileListField("interactionTags", pendingMobileCustomInteractionTag);
                                  setPendingMobileCustomInteractionTag("");
                                }}
                                disabled={!normalizeListDraftValue(pendingMobileCustomInteractionTag)}
                                style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, opacity: normalizeListDraftValue(pendingMobileCustomInteractionTag) ? 1 : 0.6 }}
                              >
                                Ajouter manuel
                              </button>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => dispatch({ type: "deleteSelectedSimulationMobileActor" })}
                            style={{ ...createEditorButtonStyle({ danger: true, compact: true }), borderRadius: 8 }}
                          >
                            Supprimer acteur mobile
                          </button>
                          </CollapsibleSection>
                          </div>
                        </CollapsibleSection>
                      )}
                    </>
                  )}
                </div>
              </SimulationPanel>
            )}

            <div style={{ marginTop: 12, ...editorTextStyles.helper }}>
              {(wikiCatalogLoading || wikiCatalogError) && (
                <div>Catalogue lore: {wikiCatalogLoading ? "chargement..." : `erreur ${wikiCatalogError}`}</div>
              )}
            </div>
          </HexTerrainPanel>

        {openPanels.json && (
          <DataPanel>
            <textarea
              value={jsonBuffer}
              onChange={event => updateJsonBuffer(event.target.value)}
              spellCheck={false}
              style={editorFieldStyles.textarea}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <button type="button" onClick={applyJson} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                Appliquer JSON
              </button>
              <button type="button" onClick={() => updateJsonBuffer(layoutToJson(persistedLayout))} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                Regenerer JSON
              </button>
              <button type="button" onClick={downloadJson} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                Telecharger JSON
              </button>
              <button type="button" onClick={() => void persistLayoutToServer()} disabled={persistenceState === "saving"} style={{ ...createEditorButtonStyle({ active: true, compact: true }), borderRadius: 8, cursor: persistenceState === "saving" ? "wait" : "pointer", opacity: persistenceState === "saving" ? 0.7 : 1 }}>
                Sauver serveur
              </button>
              <button type="button" onClick={() => void saveLayoutAsNewMap()} disabled={persistenceState === "saving"} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, cursor: persistenceState === "saving" ? "wait" : "pointer", opacity: persistenceState === "saving" ? 0.7 : 1 }}>
                Sauver sous
              </button>
              <button type="button" onClick={() => void reloadLayoutFromServer()} disabled={persistenceState === "saving"} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8, cursor: persistenceState === "saving" ? "wait" : "pointer" }}>
                Recharger serveur
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} style={{ ...createEditorButtonStyle({ compact: true }), borderRadius: 8 }}>
                Charger fichier
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={async event => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  updateJsonBuffer(await file.text());
                  event.currentTarget.value = "";
                }}
              />
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: persistenceMeta.color, fontFamily: EDITOR_THEME.fontFamily }}>
              {persistenceMeta.label}
            </div>
            {jsonError && <div style={{ marginTop: 8, fontSize: 12, color: "#ff9d76", fontFamily: EDITOR_THEME.fontFamily }}>{jsonError}</div>}
          </DataPanel>
        )}
      </MapEditorSidebar>
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", minHeight: "100%" }}>
      <MapEditorTopbar
        title={layout.title}
        activeToolLabel={activeToolLabel}
        activeToolHint={activeToolHint}
        persistenceLabel={persistenceMeta.label}
        persistenceColor={persistenceMeta.color}
      />

      <MapCanvas
        layout={layout}
        layerVisibility={layerVisibility}
        selectedCellKey={selectedCellKey}
        highlightedCellKeys={
          activeTool === "simulation"
            ? objectiveMapPreview
              ? Array.from(new Set([
                  ...selectedAreaCellKeys,
                  ...objectiveMapPreview.zoneCellKeys,
                  ...objectiveMapPreview.targetCellKeys
                ]))
              : Array.from(new Set([...selectedSimulationFactionPresenceCellKeys, ...selectedAreaCellKeys]))
            : selectedAreaCellKeys
        }
        routeCandidateCellKeys={routeCandidateCellKeys}
        selectedCityId={selectedCity?.id ?? null}
        selectedRouteId={selectedRouteId}
        routeEditorActive={routeEditorActive}
        terrainOverlayActive={activeTool === "terrain"}
        organizationOverlayActive={activeTool === "zones"}
        labelAppearance={labelAppearance}
        cliffEditPair={terrainCellsAdjacent ? { first: terrainPair[0].cell, second: terrainPair[1].cell } : null}
        onSetCliffHighCell={cell => {
          if (!terrainCellsAdjacent || terrainPair.length !== 2) return;
          const firstKey = getWorldMapCellKey(terrainPair[0].cell);
          const secondKey = getWorldMapCellKey(terrainPair[1].cell);
          const highCellKey = getWorldMapCellKey(cell);
          const lowCellKey = highCellKey === firstKey ? secondKey : firstKey;
          dispatch({ type: "setCliffBetweenCells", highCellKey, lowCellKey });
        }}
        onRemoveCliffPair={() => {
          if (!terrainCellsAdjacent || terrainPair.length !== 2) return;
          dispatch({
            type: "removeCliffBetweenCells",
            firstCellKey: getWorldMapCellKey(terrainPair[0].cell),
            secondCellKey: getWorldMapCellKey(terrainPair[1].cell)
          });
        }}
        wikiEntriesById={wikiEntriesById}
        onCellClick={handleEditorCellClick}
        onCityClick={cityId => {
          const city = layout.cities.find(entry => entry.id === cityId);
          if (!city) return;
          dispatch({ type: "setSelectedCell", cellKey: getWorldMapCellKey(city.cell) });
        }}
        minHeight="calc(100vh - 180px)"
        svgOverlay={
          <>
            {invalidPathOverlay}
            {simulationMobileActorsOverlay}
            {selectedMobileItineraryOverlay}
            {selectedMobileRouteAnchorOverlay}
            {objectiveMapPreviewOverlay}
            {selectedObjectiveLogisticsOverlay}
          </>
        }
        overlay={
          <>
            {overlay}
            {objectiveMapPreview && (
              <div
                style={{
                  position: "absolute",
                  right: 16,
                  bottom: 16,
                  zIndex: 4,
                  display: "grid",
                  gap: 6,
                  minWidth: 220,
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(9,13,20,0.88)",
                  color: "#eef6ff",
                  fontFamily: EDITOR_THEME.fontFamily,
                  fontSize: 12
                }}
              >
                <div style={{ fontWeight: 800 }}>Preview objectif</div>
                <div>Qui: accent discret faction porteuse</div>
                <div>Quoi: cible globale en halo fin, cible locale de phase en accent fort</div>
                <div>Ou: zone d'action en pointille</div>
              </div>
            )}
            <MapSelectionSummary
              visible={showHexAnalysisPanel}
              position={hexModalPosition}
              selectedCellKey={selectedCellKey}
              selectedCell={selectedCell}
              selectedCity={selectedCity}
              selectedCityWikiName={selectedCityWiki?.name ?? null}
              selectedTerritoryName={selectedTerritoryWiki?.name ?? null}
              selectedRegionName={selectedRegionWiki?.name ?? null}
              selectedZoneNames={selectedGeographicZones.map(zone => zone.label)}
              selectedCityFactions={!wikiLoading && !wikiError && selectedCityWiki ? getFrontMatterList(selectedCityWiki.frontMatter, "factions_presentes") : []}
              selectedSimulationFactions={selectedCellSimulationFactions}
              onMouseDown={event => {
                hexModalDragRef.current = {
                  startX: event.clientX,
                  startY: event.clientY,
                  originX: hexModalPosition.x,
                  originY: hexModalPosition.y
                };
              }}
              onDeleteCity={() => {
                dispatch({ type: "removeSelectedCity" });
              }}
            />
          </>
        }
      />
    </div>
  );
}
