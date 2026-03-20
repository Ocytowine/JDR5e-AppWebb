import React from "react";

export function MapSelectionSummary(props: {
  selectedCellKey: string | null;
  selectedCell: {
    surface: string;
    geography: string;
    terrainDifficulty: number;
    riskLevel: number;
    governanceTerritoryId?: string;
    governanceRegionId?: string;
    geographicZoneIds?: string[];
    cityWikiId?: string;
    locationWikiIds?: string[];
  } | null;
  selectedCity: { id: string } | null;
  selectedCityWikiName?: string | null;
  selectedTerritoryName?: string | null;
  selectedRegionName?: string | null;
  selectedZoneNames?: string[];
  selectedCityFactions?: string[];
  selectedSimulationFactions?: string[];
  visible: boolean;
  position: { x: number; y: number };
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onDeleteCity: () => void;
}): React.JSX.Element | null {
  if (!props.visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: props.position.x,
        top: props.position.y,
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
        onMouseDown={props.onMouseDown}
        style={{ cursor: "grab", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#f4c967" }}>Analyse hex</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{props.selectedCellKey ?? "Aucune selection"}</div>
        </div>
        {props.selectedCity && (
          <button
            type="button"
            onClick={props.onDeleteCity}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,120,120,0.24)", background: "rgba(130,28,28,0.28)", color: "#ffd7d7", cursor: "pointer", fontWeight: 700 }}
          >
            Suppr ville
          </button>
        )}
      </div>
      <div style={{ display: "grid", gap: 6, fontSize: 12, color: "#dce5f2", lineHeight: 1.45 }}>
        <div>Surface: {props.selectedCell?.surface ?? "ocean"}</div>
        <div>Geographie: {props.selectedCell?.geography ?? "ocean"}</div>
        <div>Difficulte: {props.selectedCell?.terrainDifficulty ?? 4}</div>
        <div>Risque: {props.selectedCell?.riskLevel ?? 2}</div>
        <div>Territoire: {props.selectedTerritoryName ?? props.selectedCell?.governanceTerritoryId ?? "Aucun"}</div>
        <div>Region: {props.selectedRegionName ?? props.selectedCell?.governanceRegionId ?? "Aucune"}</div>
        <div>Zones geo: {props.selectedZoneNames?.length ? props.selectedZoneNames.join(", ") : "aucune"}</div>
        <div>Ville: {props.selectedCityWikiName ?? props.selectedCell?.cityWikiId ?? "Aucune"}</div>
        <div>Lieux: {props.selectedCell?.locationWikiIds?.length ? props.selectedCell.locationWikiIds.join(", ") : "aucun"}</div>
        {props.selectedCityFactions && props.selectedCityFactions.length > 0 && (
          <div>Factions: {props.selectedCityFactions.join(", ")}</div>
        )}
        {props.selectedSimulationFactions && props.selectedSimulationFactions.length > 0 && (
          <div>Simulation: {props.selectedSimulationFactions.join(", ")}</div>
        )}
      </div>
    </div>
  );
}
