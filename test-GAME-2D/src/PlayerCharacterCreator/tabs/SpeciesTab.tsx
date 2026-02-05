import React from "react";

export function SpeciesTab(props: {
  isSectionLocked: (id: string) => boolean;
  lockButtonBaseStyle: React.CSSProperties;
  getLockButtonState: (id: string) => { background: string; label: string };
  renderPendingBadge: (count: number) => React.ReactNode;
  getPendingCountForSection: (id: string) => number;
  onLockClick: () => void;
  raceOptions: Array<{ id: string; label: string; description: string }>;
  selectedRaceId: string;
  handleSpeciesSelect: (id: string) => void;
  activeRace: any;
  getRaceTraits: (race: any) => Array<{ id: string; label: string }>;
}): React.JSX.Element {
  const {
    isSectionLocked,
    lockButtonBaseStyle,
    getLockButtonState,
    renderPendingBadge,
    getPendingCountForSection,
    onLockClick,
    raceOptions,
    selectedRaceId,
    handleSpeciesSelect,
    activeRace,
    getRaceTraits
  } = props;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 12, color: "#b0b8c4" }}>
          Choisissez une espece. Ce choix met a jour raceId dans le personnage.
        </div>
        <button
          type="button"
          onClick={onLockClick}
          style={{
            ...lockButtonBaseStyle,
            marginLeft: "auto",
            background: getLockButtonState("species").background
          }}
        >
          {getLockButtonState("species").label}
          {renderPendingBadge(getPendingCountForSection("species"))}
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(220px, 1.1fr) minmax(240px, 1fr)",
          gap: 12,
          alignItems: "start"
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
            alignContent: "start"
          }}
        >
          {raceOptions.map(race => {
            const isSelected = selectedRaceId === race.id;
            return (
              <button
                key={race.id}
                type="button"
                onClick={() => handleSpeciesSelect(race.id)}
                disabled={isSectionLocked("species")}
                style={{
                  textAlign: "left",
                  borderRadius: 10,
                  border: `1px solid ${
                    isSelected ? "#6fd3a8" : "rgba(255,255,255,0.12)"
                  }`,
                  background: isSelected
                    ? "rgba(46, 204, 113, 0.14)"
                    : "rgba(12,12,18,0.75)",
                  color: "#f5f5f5",
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minHeight: 120,
                  opacity: isSectionLocked("species") ? 0.6 : 1,
                  cursor: isSectionLocked("species") ? "not-allowed" : "pointer"
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800 }}>{race.label}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                  {race.description}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                  ID: {race.id}
                </div>
              </button>
            );
          })}
        </div>
        <div
          style={{
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(12,12,18,0.75)",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            minHeight: 260
          }}
        >
          <div
            style={{
              width: "100%",
              aspectRatio: "16 / 9",
              borderRadius: 10,
              border: "1px dashed rgba(255,255,255,0.18)",
              background: "rgba(8,8,12,0.65)",
              display: "grid",
              placeItems: "center",
              color: "rgba(255,255,255,0.35)",
              fontSize: 12
            }}
          >
            Image 16:9
          </div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>
            {activeRace ? activeRace.label : "Selectionnez une espece"}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
            {activeRace
              ? activeRace.description
              : "Selectionnez une espece pour voir les details."}
          </div>
          {activeRace && (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
              Vitesse: {activeRace.speed ?? "?"} | Taille: {activeRace.size ?? "?"}
            </div>
          )}
          {activeRace && getRaceTraits(activeRace).length > 0 && (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
              Traits: {getRaceTraits(activeRace).map(trait => trait.label).join(", ")}
            </div>
          )}
          {activeRace && activeRace.vision?.mode && (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
              Vision: {activeRace.vision.mode}
              {activeRace.vision.range ? ` ${activeRace.vision.range}ft` : ""}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
