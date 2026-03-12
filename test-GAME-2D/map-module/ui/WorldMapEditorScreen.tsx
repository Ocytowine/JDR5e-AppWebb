import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  WORLD_MAP_LAYOUT,
  getWorldMapCellKey,
  type MapCell,
  type MapLayerId,
  type MapPath,
  type WorldMapCity,
  type WorldMapLayout,
  type WorldMapLayoutSource
} from "../data/worldMapLayout";
import {
  GEOGRAPHY_PRESET_COLORS,
  MapCanvas,
  TAG_PRESET_COLORS,
  cloneLayout,
  createCityId,
  ensureCell,
  getFrontMatterList,
  useWikiCatalog,
  useWikiEntries
} from "./mapShared";

type PanelId = "layers" | "hex" | "routes" | "json";
type HexTabId = "geography" | "places" | "areas";

const PANEL_LABELS: Record<PanelId, string> = {
  layers: "Couches",
  hex: "Hex",
  routes: "Routes",
  json: "JSON"
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
    !Array.isArray(candidate.territories) ||
    !Array.isArray(candidate.regions) ||
    !Array.isArray(candidate.cities) ||
    !Array.isArray(candidate.paths) ||
    !Array.isArray(candidate.cells)
  ) {
    return null;
  }
  return candidate as WorldMapLayoutSource;
}

function layoutToJson(layout: WorldMapLayout): string {
  const { backgroundImageUrl: _backgroundImageUrl, ...source } = layout;
  return JSON.stringify(source, null, 2);
}

function buildRuntimeLayout(source: WorldMapLayoutSource): WorldMapLayout {
  return {
    ...source,
    backgroundImageUrl: WORLD_MAP_LAYOUT.backgroundImageUrl
  };
}

function getSelectedCity(layout: WorldMapLayout, selectedCellKey: string | null): WorldMapCity | null {
  if (!selectedCellKey) return null;
  return layout.cities.find(city => getWorldMapCellKey(city.cell) === selectedCellKey) ?? null;
}

function slugifyDraft(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const GEOGRAPHY_PRESETS: Array<{ id: string; label: string; geography: string; color: string; surface: "land" | "ocean" }> = [
  { id: "terre", label: "Terre", geography: "terre", color: "#8c7a58", surface: "land" },
  { id: "plaine", label: "Plaine", geography: "plaine", color: GEOGRAPHY_PRESET_COLORS.plaine, surface: "land" },
  { id: "colline", label: "Colline", geography: "colline", color: GEOGRAPHY_PRESET_COLORS.colline, surface: "land" },
  { id: "foret_claire", label: "Foret claire", geography: "foret_claire", color: GEOGRAPHY_PRESET_COLORS.foret_claire, surface: "land" },
  { id: "foret_dense", label: "Foret dense", geography: "foret_dense", color: GEOGRAPHY_PRESET_COLORS.foret_dense, surface: "land" },
  { id: "marais", label: "Marais", geography: "marais", color: GEOGRAPHY_PRESET_COLORS.marais, surface: "land" },
  { id: "montagne", label: "Montagne", geography: "montagne", color: GEOGRAPHY_PRESET_COLORS.montagne, surface: "land" },
  { id: "desert", label: "Desert", geography: "desert", color: GEOGRAPHY_PRESET_COLORS.desert, surface: "land" },
  { id: "cote", label: "Cote", geography: "cote", color: GEOGRAPHY_PRESET_COLORS.cote, surface: "land" },
  { id: "toundra", label: "Toundra", geography: "toundra", color: GEOGRAPHY_PRESET_COLORS.toundra, surface: "land" },
  { id: "jungle", label: "Jungle", geography: "jungle", color: GEOGRAPHY_PRESET_COLORS.jungle, surface: "land" },
  { id: "urbain", label: "Urbain", geography: "urbain", color: GEOGRAPHY_PRESET_COLORS.urbain, surface: "land" },
  { id: "ocean", label: "Ocean", geography: "ocean", color: GEOGRAPHY_PRESET_COLORS.ocean, surface: "ocean" }
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

const FIELD_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#eef3ff",
  boxSizing: "border-box"
};

export function WorldMapEditorScreen(props: {
  onCloseEditor: () => void;
}): React.JSX.Element {
  const [layout, setLayout] = useState<WorldMapLayout>(() => cloneLayout(WORLD_MAP_LAYOUT));
  const [layerVisibility, setLayerVisibility] = useState<Record<MapLayerId, boolean>>(() => ({
    ...WORLD_MAP_LAYOUT.defaultLayers
  }));
  const [selectedCellKey, setSelectedCellKey] = useState<string>(getWorldMapCellKey({ x: 13, y: 11 }));
  const [selectedRouteId, setSelectedRouteId] = useState<string>(WORLD_MAP_LAYOUT.paths[0]?.id ?? "");
  const [selectedAreaCellKeys, setSelectedAreaCellKeys] = useState<string[]>([]);
  const [areaSelectionMode, setAreaSelectionMode] = useState<boolean>(false);
  const [activeHexTab, setActiveHexTab] = useState<HexTabId>("geography");
  const [jsonBuffer, setJsonBuffer] = useState<string>(() => layoutToJson(WORLD_MAP_LAYOUT));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [routeEditorActive, setRouteEditorActive] = useState<boolean>(false);
  const [openPanels, setOpenPanels] = useState<Record<PanelId, boolean>>({
    layers: true,
    hex: true,
    routes: false,
    json: false
  });
  const [selectedLoreCityId, setSelectedLoreCityId] = useState<string>("");
  const [selectedLoreLocationId, setSelectedLoreLocationId] = useState<string>("");
  const [draftCityName, setDraftCityName] = useState<string>("");
  const [draftTerritoryId, setDraftTerritoryId] = useState<string>("");
  const [draftTerritoryColor, setDraftTerritoryColor] = useState<string>("#d7b56d");
  const [draftRegionId, setDraftRegionId] = useState<string>("");
  const [draftRegionColor, setDraftRegionColor] = useState<string>("#5a7d8f");
  const [selectedTerritoryLoreId, setSelectedTerritoryLoreId] = useState<string>("");
  const [selectedRegionLoreId, setSelectedRegionLoreId] = useState<string>("");
  const [hexModalPosition, setHexModalPosition] = useState<{ x: number; y: number }>({ x: 420, y: 20 });
  const [customGeographies, setCustomGeographies] = useState<Array<{ id: string; label: string; geography: string; color: string; surface: "land" | "ocean" }>>([]);
  const [customTags, setCustomTags] = useState<Array<{ id: string; label: string; color: string }>>([]);
  const [draftGeographyName, setDraftGeographyName] = useState<string>("");
  const [draftGeographyColor, setDraftGeographyColor] = useState<string>("#5a7d8f");
  const [draftGeographySurface, setDraftGeographySurface] = useState<"land" | "ocean">("land");
  const [draftTagName, setDraftTagName] = useState<string>("");
  const [draftTagColor, setDraftTagColor] = useState<string>("#5fa8d3");
  const [pendingGeographyId, setPendingGeographyId] = useState<string>("");
  const [pendingTagIds, setPendingTagIds] = useState<string[]>([]);
  const hexModalDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { wikiEntriesById, wikiLoading, wikiError } = useWikiEntries(layout);
  const { wikiCatalog, wikiCatalogLoading, wikiCatalogError } = useWikiCatalog();

  const selectedCell = useMemo(() => {
    return layout.cells.find(cell => getWorldMapCellKey(cell.cell) === selectedCellKey) ?? null;
  }, [layout.cells, selectedCellKey]);

  const selectedCity = useMemo(() => getSelectedCity(layout, selectedCellKey), [layout, selectedCellKey]);
  const selectedCityWiki = selectedCity?.wikiEntityId ? wikiEntriesById[selectedCity.wikiEntityId] : null;
  const selectedTerritoryWiki = selectedCell?.territoryWikiId ? wikiEntriesById[selectedCell.territoryWikiId] : null;
  const selectedRegionWiki = selectedCell?.regionWikiId ? wikiEntriesById[selectedCell.regionWikiId] : null;
  const selectedRoute = layout.paths.find(path => path.id === selectedRouteId) ?? null;
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
  const allGeographyPresets = useMemo(() => [...GEOGRAPHY_PRESETS, ...customGeographies], [customGeographies]);
  const allTagPresets = useMemo(() => [...TAG_PRESETS, ...customTags], [customTags]);

  useEffect(() => {
    setJsonBuffer(layoutToJson(layout));
  }, [layout]);

  useEffect(() => {
    if (!selectedCell) return;
    setSelectedTerritoryLoreId(selectedCell.territoryWikiId ?? "");
    setSelectedRegionLoreId(selectedCell.regionWikiId ?? "");
  }, [selectedCellKey, selectedCell]);

  useEffect(() => {
    function handleMouseMove(event: MouseEvent): void {
      const drag = hexModalDragRef.current;
      if (!drag) return;
      setHexModalPosition({
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

  function togglePanel(panelId: PanelId): void {
    setOpenPanels(current => ({ ...current, [panelId]: !current[panelId] }));
  }

  function patchLayout(mutator: (draft: WorldMapLayout) => void): void {
    setLayout(current => {
      const next = cloneLayout(current);
      mutator(next);
      return next;
    });
  }

  function updateSelectedCell(
    field: "surface" | "geography" | "terrainDifficulty" | "riskLevel" | "territoryWikiId" | "regionWikiId" | "cityWikiId" | "tags",
    value: string
  ): void {
    if (!selectedCellKey) return;
    patchLayout(next => {
      const [x, y] = selectedCellKey.split(",").map(Number);
      const cell = ensureCell(next, { x, y });
      if (field === "terrainDifficulty" || field === "riskLevel") {
        cell[field] = Math.max(0, Number(value) || 0);
        return;
      }
      if (field === "tags") {
        cell.tags = value
          .split(",")
          .map(item => item.trim())
          .filter(Boolean);
        return;
      }
      if (field === "territoryWikiId" || field === "regionWikiId" || field === "cityWikiId") {
        cell[field] = value.trim() || undefined;
        return;
      }
      cell[field] = value as never;
    });
  }

  function getTargetCellKeys(): string[] {
    if (selectedAreaCellKeys.length > 0) return selectedAreaCellKeys;
    return selectedCellKey ? [selectedCellKey] : [];
  }

  function applyGeographyPreset(geography: string): void {
    const targetKeys = getTargetCellKeys();
    if (targetKeys.length === 0) return;
    patchLayout(next => {
      targetKeys.forEach(cellKey => {
        const [x, y] = cellKey.split(",").map(Number);
        const cell = ensureCell(next, { x, y });
        cell.surface = geography === "ocean" ? "ocean" : "land";
        cell.geography = geography;
      });
    });
  }

  function toggleTagPreset(tagId: string): void {
    setPendingTagIds(current => (current.includes(tagId) ? current.filter(item => item !== tagId) : [...current, tagId]));
  }

  function applyPendingGeographySelection(): void {
    const targetKeys = getTargetCellKeys();
    if (targetKeys.length === 0) return;
    patchLayout(next => {
      targetKeys.forEach(cellKey => {
        const [x, y] = cellKey.split(",").map(Number);
        const cell = ensureCell(next, { x, y });
        if (pendingGeographyId) {
          const preset = allGeographyPresets.find(item => item.id === pendingGeographyId);
          if (preset) {
            cell.surface = preset.surface;
            cell.geography = preset.geography;
          }
        }
        if (pendingTagIds.length > 0) {
          cell.tags = Array.from(new Set([...(cell.tags ?? []), ...pendingTagIds]));
        }
      });
    });
  }

  function saveCustomGeography(): void {
    const slug = slugifyDraft(draftGeographyName);
    if (!slug) return;
    setCustomGeographies(current =>
      current.some(item => item.id === slug)
        ? current
        : [...current, { id: slug, label: draftGeographyName.trim(), geography: slug, color: draftGeographyColor, surface: draftGeographySurface }]
    );
    setPendingGeographyId(slug);
    setDraftGeographyName("");
  }

  function saveCustomTag(): void {
    const slug = slugifyDraft(draftTagName);
    if (!slug) return;
    setCustomTags(current =>
      current.some(item => item.id === slug)
        ? current
        : [...current, { id: slug, label: draftTagName.trim(), color: draftTagColor }]
    );
    setPendingTagIds(current => (current.includes(slug) ? current : [...current, slug]));
    setDraftTagName("");
  }

  function applyJson(): void {
    try {
      const parsed = JSON.parse(jsonBuffer) as unknown;
      const source = sanitizeLayoutSource(parsed);
      if (!source) throw new Error("Structure JSON invalide.");
      setLayout(buildRuntimeLayout(source));
      setLayerVisibility({ ...source.defaultLayers });
      setJsonError(null);
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : "JSON invalide.");
    }
  }

  function downloadJson(): void {
    const blob = new Blob([jsonBuffer], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "worldMapLayout.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function addRoutePoint(cell: MapCell): void {
    if (!selectedRouteId) return;
    patchLayout(next => {
      const route = next.paths.find(path => path.id === selectedRouteId);
      if (!route) return;
      const key = getWorldMapCellKey(cell);
      const lastKey = route.cells.length ? getWorldMapCellKey(route.cells[route.cells.length - 1]) : null;
      if (key !== lastKey) route.cells.push(cell);
    });
  }

  function updateCityField(field: "wikiEntityId" | "kind" | "markerColor", value: string): void {
    if (!selectedCity) return;
    patchLayout(next => {
      const city = next.cities.find(entry => entry.id === selectedCity.id);
      if (!city) return;
      if (field === "kind") {
        city.kind = value === "capital" ? "capital" : "secondary";
        return;
      }
      city[field] = value;
    });
  }

  function applyLoreCityToCell(wikiEntityId: string): void {
    if (!selectedCell || !wikiEntityId) return;
    patchLayout(next => {
      const cell = ensureCell(next, selectedCell.cell);
      const existing = next.cities.find(city => city.wikiEntityId === wikiEntityId);
      cell.cityWikiId = wikiEntityId;
      if (existing) {
        existing.cell = { ...cell.cell };
        existing.regionWikiId = cell.regionWikiId ?? existing.regionWikiId;
        existing.territoryWikiId = cell.territoryWikiId ?? existing.territoryWikiId;
        return;
      }
      next.cities.push({
        id: createCityId(wikiEntityId),
        wikiEntityId,
        regionWikiId: cell.regionWikiId ?? "",
        territoryWikiId: cell.territoryWikiId ?? "",
        kind: "secondary",
        cell: { ...cell.cell },
        markerColor: "#f4c967"
      });
    });
  }

  function createDraftCity(): void {
    if (!selectedCell) return;
    const wikiEntityId = slugifyDraft(draftCityName);
    if (!wikiEntityId) return;
    patchLayout(next => {
      const cell = ensureCell(next, selectedCell.cell);
      cell.cityWikiId = wikiEntityId;
      const existing = next.cities.find(city => city.wikiEntityId === wikiEntityId);
      if (existing) {
        existing.cell = { ...cell.cell };
        return;
      }
      next.cities.push({
        id: createCityId(wikiEntityId),
        wikiEntityId,
        regionWikiId: cell.regionWikiId ?? "",
        territoryWikiId: cell.territoryWikiId ?? "",
        kind: "secondary",
        cell: { ...cell.cell },
        markerColor: "#f4c967"
      });
      cell.tags = Array.from(new Set([...(cell.tags ?? []), "ville-brouillon"]));
    });
  }

  function addLoreLocationToCell(wikiEntityId: string): void {
    if (!selectedCell || !wikiEntityId) return;
    patchLayout(next => {
      const cell = ensureCell(next, selectedCell.cell);
      cell.locationWikiIds = Array.from(new Set([...(cell.locationWikiIds ?? []), wikiEntityId]));
    });
  }

  function createTerritoryOnCell(): void {
    if (!selectedCell && selectedAreaCellKeys.length === 0) return;
    const wikiEntityId = draftTerritoryId.trim() || selectedTerritoryLoreId.trim();
    if (!wikiEntityId) return;
    patchLayout(next => {
      const targetKeys = selectedAreaCellKeys.length > 0 ? selectedAreaCellKeys : selectedCellKey ? [selectedCellKey] : [];
      targetKeys.forEach(cellKey => {
        const [x, y] = cellKey.split(",").map(Number);
        const cell = ensureCell(next, { x, y });
        cell.territoryWikiId = wikiEntityId;
      });
      const existing = next.territories.find(entry => entry.wikiEntityId === wikiEntityId);
      const anchorKey = targetKeys[0];
      const anchor = anchorKey ? next.cells.find(cell => getWorldMapCellKey(cell.cell) === anchorKey) ?? null : null;
      if (!existing && anchor) {
        next.territories.push({
          wikiEntityId,
          labelCell: { ...anchor.cell },
          color: draftTerritoryColor
        });
      }
    });
  }

  function createRegionOnCell(): void {
    if (!selectedCell && selectedAreaCellKeys.length === 0) return;
    const wikiEntityId = draftRegionId.trim() || selectedRegionLoreId.trim();
    const territoryWikiId = selectedCell?.territoryWikiId ?? selectedTerritoryLoreId.trim();
    if (!wikiEntityId) return;
    patchLayout(next => {
      const targetKeys = selectedAreaCellKeys.length > 0 ? selectedAreaCellKeys : selectedCellKey ? [selectedCellKey] : [];
      targetKeys.forEach(cellKey => {
        const [x, y] = cellKey.split(",").map(Number);
        const cell = ensureCell(next, { x, y });
        if (territoryWikiId) cell.territoryWikiId = territoryWikiId;
        cell.regionWikiId = wikiEntityId;
      });
      const existing = next.regions.find(entry => entry.wikiEntityId === wikiEntityId);
      const anchorKey = targetKeys[0];
      const anchor = anchorKey ? next.cells.find(cell => getWorldMapCellKey(cell.cell) === anchorKey) ?? null : null;
      if (!existing && anchor) {
        next.regions.push({
          wikiEntityId,
          territoryWikiId: territoryWikiId ?? "",
          labelCell: { ...anchor.cell },
          color: draftRegionColor
        });
      }
    });
  }

  const overlay = (
    <>
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 5,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "flex-end"
        }}
      >
        <button
          type="button"
          onClick={props.onCloseEditor}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(9,13,20,0.88)",
            color: "#eef3ff",
            cursor: "pointer",
            fontWeight: 700
          }}
        >
          Retour carte
        </button>
        {(["layers", "hex", "routes", "json"] as PanelId[]).map(panelId => (
          <button
            key={panelId}
            type="button"
            onClick={() => togglePanel(panelId)}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: openPanels[panelId] ? "rgba(79,125,242,0.22)" : "rgba(9,13,20,0.88)",
              color: "#eef3ff",
              cursor: "pointer",
              fontWeight: 700
            }}
          >
            {PANEL_LABELS[panelId]}
          </button>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          left: 16,
          top: 16,
          zIndex: 5,
          display: "grid",
          gap: 12,
          width: "min(360px, calc(100vw - 32px))",
          maxHeight: "calc(100% - 32px)",
          overflowY: "auto",
          paddingRight: 4
        }}
      >
        {openPanels.layers && (
          <section style={{ padding: 14, borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(10,14,22,0.9)", backdropFilter: "blur(10px)" }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.8, color: "#8fb3ff", marginBottom: 10 }}>Couches</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              {(Object.keys(layerVisibility) as MapLayerId[]).map(layerId => (
                <label key={layerId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#dce5f2" }}>
                  <input
                    type="checkbox"
                    checked={layerVisibility[layerId]}
                    onChange={() => setLayerVisibility(current => ({ ...current, [layerId]: !current[layerId] }))}
                  />
                  {layerId}
                </label>
              ))}
            </div>
          </section>
        )}

        {openPanels.hex && (
          <section style={{ padding: 14, borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(10,14,22,0.9)", backdropFilter: "blur(10px)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#f4c967" }}>Edition hex</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{selectedCellKey ?? "Aucune selection"}</div>
              </div>
              <div style={{ fontSize: 12, color: "#c9d3e2", textAlign: "right" }}>
                {selectedAreaCellKeys.length > 0 ? `${selectedAreaCellKeys.length} cases selectionnees` : "1 case active"}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {([
                { id: "geography", label: "Geographie" },
                { id: "places", label: "Ville / lieu" },
                { id: "areas", label: "Territoire / region" }
              ] as Array<{ id: HexTabId; label: string }>).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveHexTab(tab.id)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: activeHexTab === tab.id ? "rgba(79,125,242,0.22)" : "rgba(255,255,255,0.06)",
                    color: "#eef3ff",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 12
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeHexTab === "geography" && (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", fontSize: 12, color: "#c9d3e2", lineHeight: 1.45 }}>
                  <div style={{ fontWeight: 800, color: "#8fb3ff", marginBottom: 6 }}>Legende</div>
                  <div>`Surface` : nature globale de la case (`land` ou `ocean`).</div>
                  <div>`Geographie` : description libre du terrain.</div>
                  <div>`Difficulte` : cout de traversee.</div>
                  <div>`Risque` : danger de la case.</div>
                  <div>`Tags` : mots-cles libres.</div>
                  <div style={{ marginTop: 6 }}>
                    Astuce : la selection multi-cases peut aussi servir ici pour appliquer un biome ou des tags sur plusieurs hex.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setAreaSelectionMode(value => !value)}
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: areaSelectionMode ? "rgba(79,125,242,0.22)" : "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: "pointer", fontWeight: 700 }}
                  >
                    Selection multi-cases
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAreaCellKeys([])}
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: "pointer" }}
                  >
                    Vider selection
                  </button>
                </div>
                <div style={{ fontSize: 12, color: "#c9d3e2" }}>
                  Cases ciblees: {selectedAreaCellKeys.length > 0 ? selectedAreaCellKeys.join(" | ") : selectedCellKey ?? "aucune"}
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Types de geographie</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {allGeographyPresets.map(preset => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setPendingGeographyId(preset.id)}
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
                </div>
                <div style={{ display: "grid", gap: 8, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Creer un type de geographie</div>
                  <input
                    value={draftGeographyName}
                    placeholder="Nom du type"
                    onChange={event => setDraftGeographyName(event.target.value)}
                    style={FIELD_STYLE}
                  />
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input type="color" value={draftGeographyColor} onChange={event => setDraftGeographyColor(event.target.value)} />
                    <input
                      value={draftGeographyColor}
                      onChange={event => setDraftGeographyColor(event.target.value)}
                      style={{ ...FIELD_STYLE, maxWidth: 120 }}
                    />
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#dce5f2" }}>
                      Type
                      <select value={draftGeographySurface} onChange={event => setDraftGeographySurface(event.target.value === "ocean" ? "ocean" : "land")} style={{ ...FIELD_STYLE, width: 110, padding: "6px 8px" }}>
                        <option value="land">terre</option>
                        <option value="ocean">ocean</option>
                      </select>
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
                </div>
                <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                  Surface
                  <select value={selectedCell?.surface ?? "ocean"} onChange={event => updateSelectedCell("surface", event.target.value)} style={FIELD_STYLE}>
                    <option value="land">land</option>
                    <option value="ocean">ocean</option>
                  </select>
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                  Geographie
                  <input value={selectedCell?.geography ?? ""} onChange={event => updateSelectedCell("geography", event.target.value)} style={FIELD_STYLE} />
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                  Difficulte
                  <input type="number" value={selectedCell?.terrainDifficulty ?? 1} onChange={event => updateSelectedCell("terrainDifficulty", event.target.value)} style={FIELD_STYLE} />
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                  Risque
                  <input type="number" value={selectedCell?.riskLevel ?? 1} onChange={event => updateSelectedCell("riskLevel", event.target.value)} style={FIELD_STYLE} />
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                  Tags
                  <input value={(selectedCell?.tags ?? []).join(", ")} onChange={event => updateSelectedCell("tags", event.target.value)} style={FIELD_STYLE} />
                </label>
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
                <div style={{ display: "grid", gap: 8, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Creer un tag</div>
                  <input
                    value={draftTagName}
                    placeholder="Nom du tag"
                    onChange={event => setDraftTagName(event.target.value)}
                    style={FIELD_STYLE}
                  />
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input type="color" value={draftTagColor} onChange={event => setDraftTagColor(event.target.value)} />
                    <input value={draftTagColor} onChange={event => setDraftTagColor(event.target.value)} style={{ ...FIELD_STYLE, maxWidth: 120 }} />
                    <button
                      type="button"
                      onClick={saveCustomTag}
                      disabled={!slugifyDraft(draftTagName)}
                      style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: slugifyDraft(draftTagName) ? "pointer" : "not-allowed", opacity: slugifyDraft(draftTagName) ? 1 : 0.55 }}
                    >
                      Sauvegarder tag
                    </button>
                  </div>
                </div>
                <div style={{ display: "grid", gap: 6, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Preparation avant application</div>
                  <div style={{ fontSize: 12, color: "#c9d3e2" }}>
                    Geographie choisie: {allGeographyPresets.find(item => item.id === pendingGeographyId)?.label ?? "aucune"}
                  </div>
                  <div style={{ fontSize: 12, color: "#c9d3e2" }}>
                    Tags choisis: {pendingTagIds.length > 0 ? pendingTagIds.join(", ") : "aucun"}
                  </div>
                  <button
                    type="button"
                    onClick={applyPendingGeographySelection}
                    disabled={!pendingGeographyId && pendingTagIds.length === 0}
                    style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(79,125,242,0.22)", color: "#eef3ff", cursor: pendingGeographyId || pendingTagIds.length > 0 ? "pointer" : "not-allowed", fontWeight: 700, opacity: pendingGeographyId || pendingTagIds.length > 0 ? 1 : 0.55 }}
                  >
                    Appliquer a la selection
                  </button>
                </div>
              </div>
            )}

            {activeHexTab === "places" && (
              <div style={{ display: "grid", gap: 8 }}>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                Ville du lore
                <select value={selectedLoreCityId} onChange={event => setSelectedLoreCityId(event.target.value)}>
                  <option value="">Choisir une ville existante</option>
                  {wikiCities.map(entry => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} ({entry.id})
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => applyLoreCityToCell(selectedLoreCityId)}
                disabled={!selectedLoreCityId}
                style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: selectedLoreCityId ? "pointer" : "not-allowed", fontWeight: 700, opacity: selectedLoreCityId ? 1 : 0.55 }}
              >
                Appliquer ville du lore
              </button>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                Creer une ville simple
                <input
                  value={draftCityName}
                  placeholder="Nom ou slug de la ville"
                  onChange={event => setDraftCityName(event.target.value)}
                />
              </label>
              <button
                type="button"
                onClick={createDraftCity}
                disabled={!slugifyDraft(draftCityName)}
                style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: slugifyDraft(draftCityName) ? "pointer" : "not-allowed", fontWeight: 700, opacity: slugifyDraft(draftCityName) ? 1 : 0.55 }}
              >
                Creer ville brouillon
              </button>
              <div style={{ fontSize: 12, color: "#c9d3e2", lineHeight: 1.45 }}>
                Mode simple base sur le schema de `lysenthe` : `territoire`, `region`, `type_ville`, `quartiers`, `batiments_importants`, `factions_presentes`, `liaisons`, `mots_cles`.
              </div>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                Lieu du lore
                <select value={selectedLoreLocationId} onChange={event => setSelectedLoreLocationId(event.target.value)}>
                  <option value="">Choisir un lieu existant</option>
                  {wikiLocations.map(entry => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} ({entry.id})
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => addLoreLocationToCell(selectedLoreLocationId)}
                disabled={!selectedLoreLocationId}
                style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: selectedLoreLocationId ? "pointer" : "not-allowed", fontWeight: 700, opacity: selectedLoreLocationId ? 1 : 0.55 }}
              >
                Ajouter lieu a la case
              </button>
              {selectedCity && (
                <>
                  <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                    Wiki entity id
                    <input value={selectedCity.wikiEntityId} onChange={event => updateCityField("wikiEntityId", event.target.value)} />
                  </label>
                  <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                    Type
                    <select value={selectedCity.kind} onChange={event => updateCityField("kind", event.target.value)}>
                      <option value="capital">capital</option>
                      <option value="secondary">secondary</option>
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                    Couleur
                    <input value={selectedCity.markerColor ?? ""} onChange={event => updateCityField("markerColor", event.target.value)} />
                  </label>
                  {selectedCityWiki && (
                    <div style={{ fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{selectedCityWiki.name}</div>
                      <div>{selectedCityWiki.snippet || "Pas de resume."}</div>
                    </div>
                  )}
                </>
              )}
              </div>
            )}

            {activeHexTab === "areas" && (
              <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, color: "#c9d3e2", lineHeight: 1.45 }}>
                Active la selection multi-cases, puis clique sur plusieurs hex pour definir une emprise de territoire ou de region.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setAreaSelectionMode(value => !value)}
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: areaSelectionMode ? "rgba(79,125,242,0.22)" : "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: "pointer", fontWeight: 700 }}
                >
                  Selection multi-cases
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAreaCellKeys([])}
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: "pointer" }}
                >
                  Vider selection
                </button>
              </div>
              <div style={{ fontSize: 12, color: "#c9d3e2" }}>
                Cases ciblees: {selectedAreaCellKeys.length > 0 ? selectedAreaCellKeys.join(" | ") : selectedCellKey ?? "aucune"}
              </div>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                Territoire du lore
                <select value={selectedTerritoryLoreId} onChange={event => setSelectedTerritoryLoreId(event.target.value)}>
                  <option value="">Choisir un territoire</option>
                  {wikiTerritories.map(entry => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} ({entry.id})
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                Nouveau territoire
                <input value={draftTerritoryId} placeholder="slug_territoire" onChange={event => setDraftTerritoryId(event.target.value)} />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                Couleur territoire
                <input value={draftTerritoryColor} onChange={event => setDraftTerritoryColor(event.target.value)} />
              </label>
              <button
                type="button"
                onClick={createTerritoryOnCell}
                disabled={!draftTerritoryId.trim() && !selectedTerritoryLoreId.trim()}
                style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: draftTerritoryId.trim() || selectedTerritoryLoreId.trim() ? "pointer" : "not-allowed", fontWeight: 700, opacity: draftTerritoryId.trim() || selectedTerritoryLoreId.trim() ? 1 : 0.55 }}
              >
                Creer / appliquer territoire
              </button>

              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                Region du lore
                <select value={selectedRegionLoreId} onChange={event => setSelectedRegionLoreId(event.target.value)}>
                  <option value="">Choisir une region</option>
                  {wikiRegions.map(entry => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} ({entry.id})
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                Nouvelle region
                <input value={draftRegionId} placeholder="slug_region" onChange={event => setDraftRegionId(event.target.value)} />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                Couleur region
                <input value={draftRegionColor} onChange={event => setDraftRegionColor(event.target.value)} />
              </label>
              <button
                type="button"
                onClick={createRegionOnCell}
                disabled={!draftRegionId.trim() && !selectedRegionLoreId.trim()}
                style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: draftRegionId.trim() || selectedRegionLoreId.trim() ? "pointer" : "not-allowed", fontWeight: 700, opacity: draftRegionId.trim() || selectedRegionLoreId.trim() ? 1 : 0.55 }}
              >
                Creer / appliquer region
              </button>
              </div>
            )}

            <div style={{ marginTop: 12, fontSize: 12, color: "#c9d3e2", lineHeight: 1.45 }}>
              {(wikiCatalogLoading || wikiCatalogError) && (
                <div>Catalogue lore: {wikiCatalogLoading ? "chargement..." : `erreur ${wikiCatalogError}`}</div>
              )}
            </div>
          </section>
        )}

        {openPanels.routes && (
          <section style={{ padding: 14, borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(10,14,22,0.9)", backdropFilter: "blur(10px)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff" }}>Routes</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{selectedRoute?.label ?? "Aucune route"}</div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <input type="checkbox" checked={routeEditorActive} onChange={() => setRouteEditorActive(value => !value)} />
                edition
              </label>
            </div>
            <label style={{ display: "grid", gap: 4, fontSize: 12, marginBottom: 8 }}>
              Route active
              <select value={selectedRouteId} onChange={event => setSelectedRouteId(event.target.value)}>
                {layout.paths.map(path => (
                  <option key={path.id} value={path.id}>
                    {path.label} ({path.kind})
                  </option>
                ))}
              </select>
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => {
                  const id = `route-${Date.now()}`;
                  patchLayout(next => {
                    const created: MapPath = { id, label: "Nouvelle route", kind: "road", cells: [] };
                    next.paths.push(created);
                  });
                  setSelectedRouteId(id);
                  setRouteEditorActive(true);
                }}
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: "pointer" }}
              >
                Ajouter
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!selectedRoute) return;
                  patchLayout(next => {
                    next.paths = next.paths.filter(path => path.id !== selectedRoute.id);
                  });
                  setSelectedRouteId(layout.paths.find(path => path.id !== selectedRoute.id)?.id ?? "");
                }}
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,160,160,0.18)", background: "rgba(130,28,28,0.22)", color: "#ffd7d7", cursor: "pointer" }}
              >
                Supprimer
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!selectedRoute) return;
                  patchLayout(next => {
                    const route = next.paths.find(path => path.id === selectedRoute.id);
                    route?.cells.pop();
                  });
                }}
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: "pointer" }}
              >
                Retirer dernier
              </button>
            </div>
            {selectedRoute && (
              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                  Label
                  <input
                    value={selectedRoute.label}
                    onChange={event => {
                      const value = event.target.value;
                      patchLayout(next => {
                        const route = next.paths.find(path => path.id === selectedRoute.id);
                        if (route) route.label = value;
                      });
                    }}
                  />
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                  Type
                  <select
                    value={selectedRoute.kind}
                    onChange={event => {
                      const value = event.target.value === "river" ? "river" : "road";
                      patchLayout(next => {
                        const route = next.paths.find(path => path.id === selectedRoute.id);
                        if (route) route.kind = value;
                      });
                    }}
                  >
                    <option value="road">road</option>
                    <option value="river">river</option>
                  </select>
                </label>
                <div style={{ fontSize: 12, color: "#c9d3e2", lineHeight: 1.45 }}>
                  {routeEditorActive ? "Clique sur les hex pour ajouter des points au centre des cases." : "Active l'edition pour tracer la route."}
                </div>
              </div>
            )}
          </section>
        )}

        {openPanels.json && (
          <section style={{ padding: 14, borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(10,14,22,0.9)", backdropFilter: "blur(10px)" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff", marginBottom: 10 }}>JSON</div>
            <textarea
              value={jsonBuffer}
              onChange={event => setJsonBuffer(event.target.value)}
              spellCheck={false}
              style={{ width: "100%", minHeight: 220, resize: "vertical", fontFamily: "Consolas, monospace", fontSize: 12 }}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <button type="button" onClick={applyJson} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: "pointer" }}>
                Appliquer JSON
              </button>
              <button type="button" onClick={() => setJsonBuffer(layoutToJson(layout))} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: "pointer" }}>
                Regenerer JSON
              </button>
              <button type="button" onClick={downloadJson} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: "pointer" }}>
                Telecharger JSON
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#eef3ff", cursor: "pointer" }}>
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
                  setJsonBuffer(await file.text());
                  event.currentTarget.value = "";
                }}
              />
            </div>
            {jsonError && <div style={{ marginTop: 8, fontSize: 12, color: "#ff9d76" }}>{jsonError}</div>}
          </section>
        )}
      </div>
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", minHeight: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, color: "#8fb3ff", fontWeight: 800, letterSpacing: 0.8 }}>MODE EDITION</div>
          <h3 style={{ margin: "4px 0 0", fontSize: 22 }}>{layout.title}</h3>
        </div>
        <div style={{ fontSize: 12, color: "#c8d0de" }}>
          {routeEditorActive ? "Cliquer un hex ajoute un point a la route active." : "Cliquer un hex ouvre l'edition de la case."}
        </div>
      </div>

      <MapCanvas
        layout={layout}
        layerVisibility={layerVisibility}
        selectedCellKey={selectedCellKey}
        highlightedCellKeys={selectedAreaCellKeys}
        selectedCityId={selectedCity?.id ?? null}
        selectedRouteId={selectedRouteId}
        routeEditorActive={routeEditorActive}
        wikiEntriesById={wikiEntriesById}
        onCellClick={cell => {
          const key = getWorldMapCellKey(cell);
          setSelectedCellKey(key);
          if (routeEditorActive) {
            addRoutePoint(cell);
            return;
          }
          if (areaSelectionMode) {
            setSelectedAreaCellKeys(current =>
              current.includes(key) ? current.filter(item => item !== key) : [...current, key]
            );
          }
        }}
        onCityClick={cityId => {
          const city = layout.cities.find(entry => entry.id === cityId);
          if (!city) return;
          setSelectedCellKey(getWorldMapCellKey(city.cell));
        }}
        minHeight="calc(100vh - 180px)"
        overlay={
          <>
            {overlay}
            <div
              style={{
                position: "absolute",
                left: hexModalPosition.x,
                top: hexModalPosition.y,
                zIndex: 6,
                width: 300,
                padding: 12,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(10,14,22,0.92)",
                backdropFilter: "blur(10px)",
                boxShadow: "0 14px 40px rgba(0,0,0,0.35)"
              }}
            >
              <div
                onMouseDown={event => {
                  hexModalDragRef.current = {
                    startX: event.clientX,
                    startY: event.clientY,
                    originX: hexModalPosition.x,
                    originY: hexModalPosition.y
                  };
                }}
                style={{ cursor: "grab", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#f4c967" }}>Analyse hex</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{selectedCellKey ?? "Aucune selection"}</div>
                </div>
                {selectedCity && (
                  <button
                    type="button"
                    onClick={() => {
                      patchLayout(next => {
                        next.cities = next.cities.filter(city => city.id !== selectedCity.id);
                        const cell = next.cells.find(entry => getWorldMapCellKey(entry.cell) === selectedCellKey);
                        if (cell) cell.cityWikiId = undefined;
                      });
                    }}
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,120,120,0.24)", background: "rgba(130,28,28,0.28)", color: "#ffd7d7", cursor: "pointer", fontWeight: 700 }}
                  >
                    Suppr ville
                  </button>
                )}
              </div>
              <div style={{ display: "grid", gap: 6, fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
                <div>Surface: {selectedCell?.surface ?? "ocean"}</div>
                <div>Geographie: {selectedCell?.geography ?? "ocean"}</div>
                <div>Difficulte: {selectedCell?.terrainDifficulty ?? 4}</div>
                <div>Risque: {selectedCell?.riskLevel ?? 2}</div>
                <div>Territoire: {selectedTerritoryWiki?.name ?? selectedCell?.territoryWikiId ?? "Aucun"}</div>
                <div>Region: {selectedRegionWiki?.name ?? selectedCell?.regionWikiId ?? "Aucune"}</div>
                <div>Ville: {selectedCityWiki?.name ?? selectedCell?.cityWikiId ?? "Aucune"}</div>
                <div>Lieux: {selectedCell?.locationWikiIds?.length ? selectedCell.locationWikiIds.join(", ") : "aucun"}</div>
                {!wikiLoading && !wikiError && selectedCityWiki && (
                  <div>Factions: {getFrontMatterList(selectedCityWiki.frontMatter, "factions_presentes").join(", ") || "aucune"}</div>
                )}
              </div>
            </div>
          </>
        }
      />
    </div>
  );
}
