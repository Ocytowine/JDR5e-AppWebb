import React, { useMemo, useState } from "react";
import { WORLD_MAP_LAYOUT, getWorldMapCellKey, type MapLayerId } from "../data/worldMapLayout";
import { MapCanvas, getFrontMatterList, useWikiEntries } from "./mapShared";

export function WorldMapViewerScreen(props: {
  onOpenEditor: () => void;
}): React.JSX.Element {
  const [selectedCellKey, setSelectedCellKey] = useState<string>(getWorldMapCellKey({ x: 13, y: 11 }));
  const [selectedCityId, setSelectedCityId] = useState<string>(WORLD_MAP_LAYOUT.cities[0]?.id ?? "");
  const [layerVisibility, setLayerVisibility] = useState<Record<MapLayerId, boolean>>(WORLD_MAP_LAYOUT.defaultLayers);
  const [layersOpen, setLayersOpen] = useState<boolean>(false);
  const { wikiEntriesById, wikiLoading, wikiError } = useWikiEntries(WORLD_MAP_LAYOUT);

  const selectedCell =
    WORLD_MAP_LAYOUT.cells.find(cell => getWorldMapCellKey(cell.cell) === selectedCellKey) ?? null;
  const selectedCity =
    WORLD_MAP_LAYOUT.cities.find(city => city.id === selectedCityId) ??
    WORLD_MAP_LAYOUT.cities.find(city => city.wikiEntityId === selectedCell?.cityWikiId) ??
    WORLD_MAP_LAYOUT.cities[0];
  const selectedTerritoryWiki = selectedCell?.territoryWikiId ? wikiEntriesById[selectedCell.territoryWikiId] : null;
  const selectedRegionWiki = selectedCell?.regionWikiId ? wikiEntriesById[selectedCell.regionWikiId] : null;
  const selectedCityWiki = selectedCity?.wikiEntityId ? wikiEntriesById[selectedCity.wikiEntityId] : null;

  const infoTitle = useMemo(() => {
    if (selectedCityWiki) return selectedCityWiki.name;
    return selectedCell ? `Hex ${selectedCell.cell.x}, ${selectedCell.cell.y}` : "Aucune selection";
  }, [selectedCell, selectedCityWiki]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: "100%", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, color: "#8fb3ff", fontWeight: 800, letterSpacing: 0.8 }}>CARTE</div>
          <h3 style={{ margin: "4px 0 0", fontSize: 22 }}>{WORLD_MAP_LAYOUT.title}</h3>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setLayersOpen(value => !value)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.14)",
              background: layersOpen ? "rgba(79,125,242,0.22)" : "rgba(255,255,255,0.06)",
              color: "#f5f5f5",
              cursor: "pointer",
              fontWeight: 700
            }}
          >
            Couches
          </button>
          <button
            type="button"
            onClick={props.onOpenEditor}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(79,125,242,0.22)",
              color: "#f5f5f5",
              cursor: "pointer",
              fontWeight: 700
            }}
          >
            Edition
          </button>
        </div>
      </div>

      {layersOpen && (
        <section
          style={{
            padding: 14,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(14,16,24,0.92)"
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff", marginBottom: 10 }}>Filtres de couches</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
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

      <MapCanvas
        layout={WORLD_MAP_LAYOUT}
        layerVisibility={layerVisibility}
        selectedCellKey={selectedCellKey}
        selectedCityId={selectedCity?.id ?? null}
        wikiEntriesById={wikiEntriesById}
        onCellClick={cell => {
          setSelectedCellKey(getWorldMapCellKey(cell));
          const city = WORLD_MAP_LAYOUT.cities.find(item => getWorldMapCellKey(item.cell) === getWorldMapCellKey(cell));
          if (city) setSelectedCityId(city.id);
        }}
        onCityClick={cityId => {
          setSelectedCityId(cityId);
          const city = WORLD_MAP_LAYOUT.cities.find(item => item.id === cityId);
          if (city) setSelectedCellKey(getWorldMapCellKey(city.cell));
        }}
        minHeight="calc(100vh - 280px)"
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 1.3fr) minmax(240px, 0.8fr) minmax(240px, 0.8fr)",
          gap: 12
        }}
      >
        <section style={{ padding: 14, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(14,16,24,0.92)" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#f4c967", marginBottom: 8 }}>Selection</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{infoTitle}</div>
          {wikiLoading && <div style={{ color: "#c9cfdd", fontSize: 13 }}>Chargement wiki...</div>}
          {wikiError && <div style={{ color: "#ff9d76", fontSize: 13 }}>Erreur wiki: {wikiError}</div>}
          {!wikiLoading && !wikiError && selectedCityWiki && (
            <>
              <div style={{ fontSize: 12, color: "#8fb3ff", marginBottom: 8 }}>
                {selectedCityWiki.type} · {selectedCityWiki.relativePath}
              </div>
              <div style={{ fontSize: 13, color: "#d8e0ed", lineHeight: 1.5, marginBottom: 8 }}>
                {selectedCityWiki.snippet || "Aucun resume disponible."}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {getFrontMatterList(selectedCityWiki.frontMatter, "factions_presentes").slice(0, 5).map(faction => (
                  <span key={faction} style={{ padding: "5px 8px", borderRadius: 999, background: "rgba(143,211,255,0.12)", border: "1px solid rgba(143,211,255,0.22)", fontSize: 12 }}>
                    {faction}
                  </span>
                ))}
              </div>
            </>
          )}
          {!wikiLoading && !wikiError && !selectedCityWiki && selectedCell && (
            <div style={{ display: "grid", gap: 6, fontSize: 13, color: "#d8e0ed" }}>
              <div>Surface: {selectedCell.surface}</div>
              <div>Geographie: {selectedCell.geography}</div>
              <div>Difficulte terrain: {selectedCell.terrainDifficulty}</div>
              <div>Risque: {selectedCell.riskLevel}</div>
              <div>Tags: {(selectedCell.tags ?? []).join(", ") || "aucun"}</div>
            </div>
          )}
        </section>

        <section style={{ padding: 14, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(14,16,24,0.92)" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff", marginBottom: 8 }}>Territoire</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{selectedTerritoryWiki?.name ?? "Aucun"}</div>
          <div style={{ fontSize: 12, color: "#c8d0de", lineHeight: 1.45 }}>{selectedTerritoryWiki?.snippet ?? "Pas de territoire pour cette case."}</div>
        </section>

        <section style={{ padding: 14, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(14,16,24,0.92)" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff", marginBottom: 8 }}>Region</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{selectedRegionWiki?.name ?? "Aucune"}</div>
          <div style={{ fontSize: 12, color: "#c8d0de", lineHeight: 1.45 }}>{selectedRegionWiki?.snippet ?? "Pas de region pour cette case."}</div>
        </section>
      </div>
    </div>
  );
}
