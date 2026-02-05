import React from "react";

export function BackgroundsTab(props: {
  isSectionLocked: (id: string) => boolean;
  lockButtonBaseStyle: React.CSSProperties;
  getLockButtonState: (id: string) => { background: string; label: string };
  renderPendingBadge: (count: number) => React.ReactNode;
  getPendingCountForSection: (id: string) => number;
  backgroundOptions: Array<{ id: string; label: string; description: string }>;
  selectedBackgroundId: string;
  handleBackgroundSelect: (bg: any) => void;
  onLockClick: () => void;
  activeBackground: any;
  getBackgroundFeatureInfo: (bg: any) => { label: string; description: string } | null;
  getBackgroundToolChoice: (bg: any) => { count: number; options: string[] } | null;
  getBackgroundLanguageChoice: (bg: any) => { count: number } | null;
  getBackgroundSkillProficiencies: (bg: any) => string[];
  getBackgroundToolProficiencies: (bg: any) => string[];
  formatEquipmentLabel: (value: string) => string;
  toolMasteryOptions: Array<{ id: string; label: string }>;
  competenceOptions: Array<{ id: string; label: string }>;
}): React.JSX.Element {
  const {
    isSectionLocked,
    lockButtonBaseStyle,
    getLockButtonState,
    renderPendingBadge,
    getPendingCountForSection,
    backgroundOptions,
    selectedBackgroundId,
    handleBackgroundSelect,
    onLockClick,
    activeBackground,
    getBackgroundFeatureInfo,
    getBackgroundToolChoice,
    getBackgroundLanguageChoice,
    getBackgroundSkillProficiencies,
    getBackgroundToolProficiencies,
    formatEquipmentLabel,
    toolMasteryOptions,
    competenceOptions
  } = props;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 12, color: "#b0b8c4" }}>
          Choisissez un historique. Un seul background peut etre actif.
        </div>
        <button
          type="button"
          onClick={onLockClick}
          style={{
            ...lockButtonBaseStyle,
            marginLeft: "auto",
            background: getLockButtonState("backgrounds").background
          }}
        >
          {getLockButtonState("backgrounds").label}
          {renderPendingBadge(getPendingCountForSection("backgrounds"))}
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
          {backgroundOptions.map(bg => {
            const isSelected = selectedBackgroundId === bg.id;
            return (
              <button
                key={bg.id}
                type="button"
                onClick={() => handleBackgroundSelect(bg)}
                disabled={isSectionLocked("backgrounds")}
                style={{
                  textAlign: "left",
                  borderRadius: 10,
                  border: `1px solid ${isSelected ? "#6fd3a8" : "rgba(255,255,255,0.12)"}`,
                  background: isSelected
                    ? "rgba(46, 204, 113, 0.14)"
                    : "rgba(12,12,18,0.75)",
                  color: "#f5f5f5",
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minHeight: 120,
                  opacity: isSectionLocked("backgrounds") ? 0.6 : 1,
                  cursor: isSectionLocked("backgrounds") ? "not-allowed" : "pointer"
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800 }}>{bg.label}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                  {bg.description}
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
          {activeBackground ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{activeBackground.label}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                {activeBackground.description}
              </div>
              {getBackgroundFeatureInfo(activeBackground) && (
                <div
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(10,10,16,0.8)",
                    fontSize: 12,
                    color: "rgba(255,255,255,0.7)"
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    {getBackgroundFeatureInfo(activeBackground)?.label}
                  </div>
                  <div>{getBackgroundFeatureInfo(activeBackground)?.description}</div>
                </div>
              )}
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                Competences: {getBackgroundSkillProficiencies(activeBackground)
                  .map(id => competenceOptions.find(c => c.id === id)?.label ?? id)
                  .join(", ") || "—"}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                Outils: {getBackgroundToolProficiencies(activeBackground)
                  .map(id => toolMasteryOptions.find(t => t.id === id)?.label ?? id)
                  .join(", ") || "—"}
              </div>
              {getBackgroundToolChoice(activeBackground) && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                  Outils (choix {getBackgroundToolChoice(activeBackground)?.count ?? 0}):{" "}
                  {(getBackgroundToolChoice(activeBackground)?.options ?? [])
                    .map(id => toolMasteryOptions.find(t => t.id === id)?.label ?? id)
                    .join(", ")}
                </div>
              )}
              {activeBackground?.toolNotes && activeBackground.toolNotes.length > 0 && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                  Outils: {activeBackground.toolNotes.join(", ")}
                </div>
              )}
              {getBackgroundLanguageChoice(activeBackground) && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                  Langues: {getBackgroundLanguageChoice(activeBackground)?.count ?? 0} au choix
                </div>
              )}
              {activeBackground?.equipment && activeBackground.equipment.length > 0 && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                  Materiel: {activeBackground.equipment.map(formatEquipmentLabel).join(", ")}
                </div>
              )}
              {getBackgroundFeatureInfo(activeBackground) && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                  Aptitude: {getBackgroundFeatureInfo(activeBackground)?.label ?? ""}
                  {getBackgroundFeatureInfo(activeBackground)?.description
                    ? ` — ${getBackgroundFeatureInfo(activeBackground)?.description}`
                    : ""}
                </div>
              )}
              {activeBackground?.traits?.bond && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                  Lien: {activeBackground.traits.bond}
                </div>
              )}
              {activeBackground?.traits?.flaw && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                  Defaut: {activeBackground.traits.flaw}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
              Aucun historique selectionne.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
