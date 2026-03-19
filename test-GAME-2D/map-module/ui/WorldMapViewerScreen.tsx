import React, { useEffect, useMemo, useState } from "react";
import { getWorldMapCellKey, type MapLayerId, type WorldMapGeographicZone, type WorldMapLayout } from "../data/worldMapLayout";
import { MapCanvas, getFrontMatterList, useWikiEntries } from "./mapShared";

export function WorldMapViewerScreen(props: {
  layout: WorldMapLayout;
  onOpenEditor: () => void;
}): React.JSX.Element {
  const [selectedCellKey, setSelectedCellKey] = useState<string>(getWorldMapCellKey({ x: 13, y: 11 }));
  const [selectedCityId, setSelectedCityId] = useState<string>(props.layout.cities[0]?.id ?? "");
  const [layerVisibility, setLayerVisibility] = useState<Record<MapLayerId, boolean>>(props.layout.defaultLayers);
  const [layersOpen, setLayersOpen] = useState<boolean>(false);
  const { wikiEntriesById, wikiLoading, wikiError } = useWikiEntries(props.layout);

  useEffect(() => {
    setLayerVisibility(props.layout.defaultLayers);
    setSelectedCityId(props.layout.cities[0]?.id ?? "");
    setSelectedCellKey(current => {
      const exists = props.layout.cells.some(cell => getWorldMapCellKey(cell.cell) === current);
      return exists ? current : getWorldMapCellKey({ x: 13, y: 11 });
    });
  }, [props.layout]);

  const selectedCell =
    props.layout.cells.find(cell => getWorldMapCellKey(cell.cell) === selectedCellKey) ?? null;
  const selectedCity =
    props.layout.cities.find(city => city.id === selectedCityId) ??
    props.layout.cities.find(city => city.wikiEntityId === selectedCell?.cityWikiId) ??
    props.layout.cities[0];
  const selectedGovernanceTerritory = selectedCell?.governanceTerritoryId
    ? props.layout.governanceTerritories?.find(entry => entry.id === selectedCell.governanceTerritoryId) ?? null
    : null;
  const selectedGovernanceRegion = selectedCell?.governanceRegionId
    ? props.layout.governanceRegions?.find(entry => entry.id === selectedCell.governanceRegionId) ?? null
    : null;
  const selectedGovernance = selectedGovernanceTerritory?.governanceId
    ? props.layout.governances?.find(entry => entry.id === selectedGovernanceTerritory.governanceId) ?? null
    : selectedGovernanceRegion?.governanceId
      ? props.layout.governances?.find(entry => entry.id === selectedGovernanceRegion.governanceId) ?? null
      : null;
  const selectedTerritoryWiki = selectedGovernanceTerritory?.wikiEntityId
    ? wikiEntriesById[selectedGovernanceTerritory.wikiEntityId]
    : selectedCell?.territoryWikiId
      ? wikiEntriesById[selectedCell.territoryWikiId]
      : null;
  const selectedRegionWiki = selectedGovernanceRegion?.wikiEntityId
    ? wikiEntriesById[selectedGovernanceRegion.wikiEntityId]
    : selectedCell?.regionWikiId
      ? wikiEntriesById[selectedCell.regionWikiId]
      : null;
  const selectedGeographicZones = useMemo(
    () =>
      (selectedCell?.geographicZoneIds ?? [])
        .map(zoneId => props.layout.geographicZones?.find(entry => entry.id === zoneId) ?? null)
        .filter((entry): entry is WorldMapGeographicZone => Boolean(entry)),
    [props.layout.geographicZones, selectedCell]
  );
  const selectedGovernanceWiki = selectedGovernance?.wikiEntityId ? wikiEntriesById[selectedGovernance.wikiEntityId] : null;
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
          <h3 style={{ margin: "4px 0 0", fontSize: 22 }}>{props.layout.title}</h3>
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
        layout={props.layout}
        layerVisibility={layerVisibility}
        selectedCellKey={selectedCellKey}
        selectedCityId={selectedCity?.id ?? null}
        wikiEntriesById={wikiEntriesById}
        onCellClick={cell => {
          setSelectedCellKey(getWorldMapCellKey(cell));
          const city = props.layout.cities.find(item => getWorldMapCellKey(item.cell) === getWorldMapCellKey(cell));
          if (city) setSelectedCityId(city.id);
        }}
        onCityClick={cityId => {
          setSelectedCityId(cityId);
          const city = props.layout.cities.find(item => item.id === cityId);
          if (city) setSelectedCellKey(getWorldMapCellKey(city.cell));
        }}
        minHeight="calc(100vh - 280px)"
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 1.3fr) minmax(320px, 1fr) minmax(260px, 0.9fr)",
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
              <div>Zones geo: {selectedGeographicZones.map(zone => zone.label).join(", ") || "aucune"}</div>
            </div>
          )}
        </section>

        <section style={{ padding: 14, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(14,16,24,0.92)" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff", marginBottom: 8 }}>Organisation</div>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#8fa0b7", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 4 }}>
                Gouvernance
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{selectedGovernanceWiki?.name ?? selectedGovernance?.label ?? "Aucune"}</div>
              <div style={{ fontSize: 12, color: "#c8d0de", lineHeight: 1.45 }}>
                {selectedGovernanceWiki?.snippet ?? "Pas de gouvernance politique definie pour cette case."}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#8fa0b7", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 4 }}>
                Territoire politique
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{selectedTerritoryWiki?.name ?? "Aucun"}</div>
              <div style={{ fontSize: 12, color: "#c8d0de", lineHeight: 1.45 }}>
                {selectedTerritoryWiki?.snippet ?? "Pas de territoire politique pour cette case."}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#8fa0b7", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 4 }}>
                Region administrative
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{selectedRegionWiki?.name ?? "Aucune"}</div>
              <div style={{ fontSize: 12, color: "#c8d0de", lineHeight: 1.45 }}>
                {selectedRegionWiki?.snippet ?? "Pas de region administrative pour cette case."}
              </div>
            </div>
          </div>
        </section>

        <section style={{ padding: 14, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(14,16,24,0.92)" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#8fb3ff", marginBottom: 8 }}>Zones geo</div>
          {selectedGeographicZones.length === 0 ? (
            <div style={{ fontSize: 12, color: "#c8d0de", lineHeight: 1.45 }}>Aucune zone geographique pour cette case.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {selectedGeographicZones.map(zone => {
                const wiki = zone.wikiEntityId ? wikiEntriesById[zone.wikiEntityId] : null;
                return (
                  <div key={zone.id} style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: zone.color, display: "inline-block" }} />
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{wiki?.name ?? zone.label}</div>
                    </div>
                    <div style={{ fontSize: 11, color: "#8fa0b7", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 4 }}>
                      {zone.kind}
                    </div>
                    <div style={{ fontSize: 12, color: "#c8d0de", lineHeight: 1.45 }}>
                      {wiki?.snippet ?? "Pas de fiche de lore liee pour cette zone geographique."}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
