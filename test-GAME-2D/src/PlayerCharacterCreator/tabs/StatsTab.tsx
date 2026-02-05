import React from "react";

export function StatsTab(props: {
  statsMode: "normal" | "manual";
  setStatsMode: (value: "normal" | "manual") => void;
  canLockStats: () => boolean;
  toggleSectionLock: (id: string) => void;
  resetStats: () => void;
  isSectionLocked: (id: string) => boolean;
  lockButtonBaseStyle: React.CSSProperties;
  getLockButtonState: (id: string) => { background: string; label: string };
  renderPendingBadge: (count: number) => React.ReactNode;
  getPendingCountForSection: (id: string) => number;
  getPointBuySummary: () => { total: number; remaining: number | null; invalid: boolean };
  statKeys: readonly string[];
  getBaseScore: (key: string) => number;
  getBonusSumForStat: (key: string) => number;
  computeMod: (value: number) => number;
  getStatSources: (key: string) => string[];
  renderSourceDots: (sources: string[]) => React.ReactNode;
  setScore: (key: string, value: number) => void;
  canAdjustPointBuy: (key: string, delta: number) => boolean;
}): React.JSX.Element {
  const {
    statsMode,
    setStatsMode,
    canLockStats,
    toggleSectionLock,
    resetStats,
    isSectionLocked,
    lockButtonBaseStyle,
    getLockButtonState,
    renderPendingBadge,
    getPendingCountForSection,
    getPointBuySummary,
    statKeys,
    getBaseScore,
    getBonusSumForStat,
    computeMod,
    getStatSources,
    renderSourceDots,
    setScore,
    canAdjustPointBuy
  } = props;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 12, color: "#b0b8c4" }}>
          Ajustez les caracteristiques. Le modificateur se met a jour.
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {([
            { id: "normal", label: "Normal" },
            { id: "manual", label: "Manuel" }
          ] as const).map(mode => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setStatsMode(mode.id)}
              style={{
                padding: "4px 8px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.15)",
                background:
                  statsMode === mode.id
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
          onClick={() => !isSectionLocked("stats") && resetStats()}
          disabled={isSectionLocked("stats")}
          style={{
            padding: "4px 8px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.08)",
            color: "#f5f5f5",
            cursor: isSectionLocked("stats") ? "not-allowed" : "pointer",
            fontSize: 11,
            fontWeight: 700,
            opacity: isSectionLocked("stats") ? 0.6 : 1
          }}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => {
            if (!canLockStats()) return;
            toggleSectionLock("stats");
          }}
          style={{
            ...lockButtonBaseStyle,
            marginLeft: "auto",
            background: getLockButtonState("stats").background,
            cursor: canLockStats() ? "pointer" : "not-allowed",
            opacity: canLockStats() ? 1 : 0.7
          }}
        >
          {getLockButtonState("stats").label}
          {renderPendingBadge(getPendingCountForSection("stats"))}
        </button>
      </div>
      {(() => {
        const summary = getPointBuySummary();
        if (statsMode !== "normal") {
          return (
            <div
              style={{
                marginTop: 6,
                fontSize: 11,
                color: "rgba(255,255,255,0.7)",
                display: "flex",
                gap: 10,
                alignItems: "center"
              }}
            >
              <span>Capital: illimite (mode manuel)</span>
            </div>
          );
        }
        return (
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: "rgba(255,255,255,0.7)",
              display: "flex",
              gap: 10,
              alignItems: "center"
            }}
          >
            <span>Points: 27</span>
            {summary.invalid ? (
              <span style={{ color: "#f1c40f" }}>Hors barème (8-15)</span>
            ) : (
              <>
                <span>Utilises: {summary.total}</span>
                <span
                  style={{
                    color:
                      summary.remaining !== null && summary.remaining < 0
                        ? "#e74c3c"
                        : "#6fd3a8"
                  }}
                >
                  Restants: {summary.remaining ?? "-"}
                </span>
              </>
            )}
            <span>
              Regle: acquisition par points (8-15). Bonus via classe/historique/espece.
            </span>
          </div>
        );
      })()}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10
        }}
      >
        {statKeys.map(stat => {
          const baseScore = getBaseScore(stat);
          const bonus = getBonusSumForStat(stat);
          const totalScore = Math.max(1, Math.min(30, baseScore + bonus));
          const mod = computeMod(totalScore);
          const sources = getStatSources(stat);
          const canDecrease =
            !isSectionLocked("stats") &&
            (statsMode !== "normal" || canAdjustPointBuy(stat, -1));
          const canIncrease =
            !isSectionLocked("stats") &&
            (statsMode !== "normal" || canAdjustPointBuy(stat, 1));
          return (
            <div
              key={stat}
              style={{
                padding: 10,
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(12,12,18,0.75)",
                display: "flex",
                flexDirection: "column",
                gap: 6
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                {stat}
                {sources.length > 0 && renderSourceDots(sources)}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "30px 1fr 30px",
                  gap: 6,
                  alignItems: "center"
                }}
              >
                <button
                  type="button"
                  onClick={() => canDecrease && setScore(stat, totalScore - 1)}
                  disabled={!canDecrease}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 6,
                    border: "1px solid #333",
                    background: "#141421",
                    color: "#f5f5f5",
                    cursor: canDecrease ? "pointer" : "not-allowed",
                    opacity: canDecrease ? 1 : 0.5,
                    display: "grid",
                    placeItems: "center"
                  }}
                  aria-label={`Diminuer ${stat}`}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <rect x="2" y="5.25" width="8" height="1.5" fill="currentColor" />
                  </svg>
                </button>
                <input
                  type="number"
                  min={statsMode === "normal" ? 8 : 1}
                  max={statsMode === "normal" ? 15 : 30}
                  value={totalScore}
                  onChange={e => !isSectionLocked("stats") && setScore(stat, Number(e.target.value))}
                  disabled={isSectionLocked("stats")}
                  style={{
                    width: "100%",
                    background: "#0f0f19",
                    color: "#f5f5f5",
                    border: "1px solid #333",
                    borderRadius: 6,
                    padding: "4px 6px",
                    textAlign: "center",
                    appearance: "textfield",
                    WebkitAppearance: "textfield",
                    MozAppearance: "textfield"
                  }}
                />
                <button
                  type="button"
                  onClick={() => canIncrease && setScore(stat, totalScore + 1)}
                  disabled={!canIncrease}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 6,
                    border: "1px solid #333",
                    background: "#141421",
                    color: "#f5f5f5",
                    cursor: canIncrease ? "pointer" : "not-allowed",
                    opacity: canIncrease ? 1 : 0.5,
                    display: "grid",
                    placeItems: "center"
                  }}
                  aria-label={`Augmenter ${stat}`}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <rect x="2" y="5.25" width="8" height="1.5" fill="currentColor" />
                    <rect x="5.25" y="2" width="1.5" height="8" fill="currentColor" />
                  </svg>
                </button>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                Base: {baseScore}
                {bonus !== 0 && (
                  <span style={{ marginLeft: 6 }}>
                    Bonus: {bonus > 0 ? `+${bonus}` : bonus}
                  </span>
                )}
                <span style={{ marginLeft: 6 }}>Total: {totalScore}</span>
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                Modificateur: {mod >= 0 ? `+${mod}` : mod}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
