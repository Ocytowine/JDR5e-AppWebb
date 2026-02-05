import React from "react";

export function SkillsTab(props: {
  skillsMode: "normal" | "manual";
  setSkillsMode: (value: "normal" | "manual") => void;
  resetSkills: () => void;
  isSectionLocked: (id: string) => boolean;
  toggleSectionLock: (id: string) => void;
  lockButtonBaseStyle: React.CSSProperties;
  getLockButtonState: (id: string) => { background: string; label: string };
  renderPendingBadge: (count: number) => React.ReactNode;
  getPendingCountForSection: (id: string) => number;
  competenceOptions: Array<{ id: string; label: string }>;
  expertises: string[];
  competences: string[];
  resolveLevel: () => number;
  computeMod: (score: number) => number;
  getScore: (key: "FOR" | "DEX" | "CON" | "INT" | "SAG" | "CHA") => number;
  skillAbilityMap: Record<string, string>;
  renderSourceDots: (sources: string[]) => React.ReactNode;
  getSkillSources: (id: string) => string[];
  canEditSkills: boolean;
  toggleCompetence: (id: string) => void;
  toggleExpertise: (id: string) => void;
}): React.JSX.Element {
  const {
    skillsMode,
    setSkillsMode,
    resetSkills,
    isSectionLocked,
    toggleSectionLock,
    lockButtonBaseStyle,
    getLockButtonState,
    renderPendingBadge,
    getPendingCountForSection,
    competenceOptions,
    expertises,
    competences,
    resolveLevel,
    computeMod,
    getScore,
    skillAbilityMap,
    renderSourceDots,
    getSkillSources,
    canEditSkills,
    toggleCompetence,
    toggleExpertise
  } = props;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 12, color: "#b0b8c4" }}>
          Cochez les competences pour simuler les impacts de jeu.
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {([
            { id: "normal", label: "Normal" },
            { id: "manual", label: "Manuel" }
          ] as const).map(mode => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setSkillsMode(mode.id)}
              style={{
                padding: "4px 8px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.15)",
                background:
                  skillsMode === mode.id
                    ? "rgba(79,125,242,0.2)"
                    : "rgba(255,255,255,0.06)",
                color: "#f5f5f5",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 700
              }}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => !isSectionLocked("skills") && resetSkills()}
          disabled={isSectionLocked("skills")}
          style={{
            padding: "4px 8px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.08)",
            color: "#f5f5f5",
            cursor: isSectionLocked("skills") ? "not-allowed" : "pointer",
            fontSize: 11,
            fontWeight: 700,
            opacity: isSectionLocked("skills") ? 0.6 : 1
          }}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => toggleSectionLock("skills")}
          style={{
            ...lockButtonBaseStyle,
            marginLeft: "auto",
            background: getLockButtonState("skills").background
          }}
        >
          {getLockButtonState("skills").label}
          {renderPendingBadge(getPendingCountForSection("skills"))}
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 10
        }}
      >
        {competenceOptions.map(skill => {
          const isExpert = expertises.includes(skill.id);
          const isProf = competences.includes(skill.id);
          const level = resolveLevel();
          const prof = 2 + Math.floor((level - 1) / 4);
          const abilityKey = skillAbilityMap[skill.id];
          const scoreKey =
            abilityKey === "STR"
              ? "FOR"
              : abilityKey === "DEX"
                ? "DEX"
                : abilityKey === "CON"
                  ? "CON"
                  : abilityKey === "INT"
                    ? "INT"
                    : abilityKey === "WIS"
                      ? "SAG"
                      : "CHA";
          const mod = computeMod(getScore(scoreKey));
          const bonus = mod + (isExpert ? prof * 2 : isProf ? prof : 0);
          const bonusLabel = bonus >= 0 ? `+${bonus}` : bonus;
          const cardBackground = isExpert
            ? "rgba(241, 196, 15, 0.18)"
            : isProf
              ? "rgba(79,125,242,0.2)"
              : "rgba(12,12,18,0.75)";
          const cardBorder = isExpert
            ? "1px solid rgba(241,196,15,0.55)"
            : isProf
              ? "1px solid rgba(79,125,242,0.55)"
              : "1px solid rgba(255,255,255,0.12)";
          const cardShadow = isExpert ? "0 0 12px rgba(241,196,15,0.45)" : "none";
          return (
            <div
              key={skill.id}
              style={{
                padding: 10,
                borderRadius: 8,
                border: cardBorder,
                background: cardBackground,
                boxShadow: cardShadow,
                display: "flex",
                flexDirection: "column",
                gap: 8
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  alignItems: "center"
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700 }}>{skill.label}</div>
                {renderSourceDots(getSkillSources(skill.id))}
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                  {skillAbilityMap[skill.id]}
                </div>
              </div>
              {skillsMode === "normal" ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 40
                  }}
                >
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: isExpert ? "#f1c40f" : isProf ? "#4f7df2" : "#f5f5f5"
                    }}
                  >
                    {bonusLabel}
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={competences.includes(skill.id)}
                        onChange={() => canEditSkills && toggleCompetence(skill.id)}
                        disabled={!canEditSkills}
                        style={{ accentColor: "#4f7df2" }}
                      />
                      <span style={{ fontSize: 12 }}>Maitrise</span>
                    </label>
                    <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={expertises.includes(skill.id)}
                        onChange={() => canEditSkills && toggleExpertise(skill.id)}
                        disabled={!canEditSkills || !competences.includes(skill.id)}
                        style={{ accentColor: "#f1c40f" }}
                      />
                      <span style={{ fontSize: 12 }}>Expertise</span>
                    </label>
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                    Bonus: {bonusLabel}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
