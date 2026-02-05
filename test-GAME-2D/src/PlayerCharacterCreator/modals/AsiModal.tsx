import React from "react";

export function AsiModal(props: {
  open: boolean;
  entry: { key: string; level: number; classId: string; classLabel: string } | null;
  step: "type" | "feat" | "asi";
  type: "asi" | "feat";
  stats: Record<string, number>;
  originalStats: Record<string, number>;
  statKeys: readonly string[];
  asiBonusMap: Record<string, number>;
  getBaseScore: (key: string) => number;
  getNonAsiBonusSumForStat: (key: string) => number;
  setType: (value: "asi" | "feat") => void;
  setStep: (value: "type" | "feat" | "asi") => void;
  onClose: () => void;
  onConfirmType: () => void;
  onConfirmStats: () => void;
  updateStat: (stat: string, delta: number) => void;
  canAllocateMoreAsi: (key: string, stats: Record<string, number>) => boolean;
}): React.JSX.Element | null {
  const {
    open,
    entry,
    step,
    type,
    stats,
    originalStats,
    statKeys,
    asiBonusMap,
    getBaseScore,
    getNonAsiBonusSumForStat,
    setType,
    setStep,
    onClose,
    onConfirmType,
    onConfirmStats,
    updateStat,
    canAllocateMoreAsi
  } = props;

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000
      }}
    >
      <div
        style={{
          width: "min(560px, 92vw)",
          background: "#141421",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 12,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 800 }}>
          {entry ? `Niveau ${entry.level} — ${entry.classLabel}` : "Choix d'amelioration"}
        </div>
        {step === "type" && (
          <>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
              Souhaitez-vous augmenter les caracteristiques ou choisir un don ?
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {([
                { id: "asi", label: "Augmenter les caracteristiques" },
                { id: "feat", label: "Choisir un don" }
              ] as const).map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setType(opt.id)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background:
                      type === opt.id ? "rgba(79,125,242,0.2)" : "rgba(255,255,255,0.06)",
                    color: "#f5f5f5",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#f5f5f5",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={onConfirmType}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(46, 204, 113, 0.16)",
                  color: "#f5f5f5",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                Valider
              </button>
            </div>
          </>
        )}
        {step === "feat" && (
          <>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
              Dons indisponibles pour l'instant.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setStep("type")}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#f5f5f5",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                Retour
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#f5f5f5",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                Fermer
              </button>
            </div>
          </>
        )}
        {step === "asi" && (
          <>
            {(() => {
              const spent = Object.values(stats).reduce(
                (sum, value) => sum + (Number(value) || 0),
                0
              );
              const remaining = Math.max(0, 2 - spent);
              return (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                  Capital disponible : {remaining}
                </div>
              );
            })()}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 8
              }}
            >
              {statKeys.map(stat => {
                const base = getBaseScore(stat);
                const nonAsi = getNonAsiBonusSumForStat(stat);
                const original = Number(originalStats[stat] ?? 0) || 0;
                const totalAsi = Number(asiBonusMap[stat] ?? 0) || 0;
                const otherAsi = Math.max(0, totalAsi - original);
                const current = Number(stats[stat] ?? 0) || 0;
                const total = base + nonAsi + otherAsi + current;
                const spent = Object.values(stats).reduce(
                  (sum, value) => sum + (Number(value) || 0),
                  0
                );
                const remaining = Math.max(0, 2 - spent);
                const canIncrease = remaining > 0 && current < 2 && total < 20;
                const canDecrease = current > 0;
                return (
                  <div
                    key={`asi-modal-${stat}`}
                    style={{
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(10,10,16,0.8)",
                      padding: 8,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{stat}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                        Total: {Math.min(20, total)}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => canDecrease && updateStat(stat, -1)}
                        disabled={!canDecrease}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          border: "1px solid #333",
                          background: canDecrease ? "#141421" : "rgba(80,80,90,0.55)",
                          color: "#f5f5f5",
                          cursor: canDecrease ? "pointer" : "not-allowed",
                          display: "grid",
                          placeItems: "center",
                          fontSize: 12,
                          fontWeight: 700
                        }}
                      >
                        -
                      </button>
                      <div style={{ minWidth: 24, textAlign: "center", fontSize: 12 }}>
                        +{current}
                      </div>
                      <button
                        type="button"
                        onClick={() => canIncrease && updateStat(stat, 1)}
                        disabled={!canIncrease}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          border: "1px solid #333",
                          background: canIncrease ? "#141421" : "rgba(80,80,90,0.55)",
                          color: "#f5f5f5",
                          cursor: canIncrease ? "pointer" : "not-allowed",
                          display: "grid",
                          placeItems: "center",
                          fontSize: 12,
                          fontWeight: 700
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              {(() => {
                const spent = Object.values(stats).reduce(
                  (sum, value) => sum + (Number(value) || 0),
                  0
                );
                const remaining = Math.max(0, 2 - spent);
                const canAllocateMore = entry && canAllocateMoreAsi(entry.key, stats);
                return remaining > 0 && canAllocateMore ? (
                  <span
                    style={{ alignSelf: "center", fontSize: 11, color: "rgba(255,255,255,0.6)" }}
                  >
                    Utilisez les 2 points.
                  </span>
                ) : null;
              })()}
              <button
                type="button"
                onClick={() => setStep("type")}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#f5f5f5",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                Retour
              </button>
              <button
                type="button"
                onClick={onConfirmStats}
                disabled={(() => {
                  const spent = Object.values(stats).reduce(
                    (sum, value) => sum + (Number(value) || 0),
                    0
                  );
                  if (spent >= 2) return false;
                  if (!entry) return true;
                  return canAllocateMoreAsi(entry.key, stats);
                })()}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: (() => {
                    const spent = Object.values(stats).reduce(
                      (sum, value) => sum + (Number(value) || 0),
                      0
                    );
                    if (spent >= 2) return "rgba(46, 204, 113, 0.16)";
                    if (!entry) return "rgba(80,80,90,0.55)";
                    const canAllocateMore = canAllocateMoreAsi(entry.key, stats);
                    return canAllocateMore ? "rgba(80,80,90,0.55)" : "rgba(46, 204, 113, 0.16)";
                  })(),
                  color: "#f5f5f5",
                  cursor: (() => {
                    const spent = Object.values(stats).reduce(
                      (sum, value) => sum + (Number(value) || 0),
                      0
                    );
                    if (spent >= 2) return "pointer";
                    if (!entry) return "not-allowed";
                    const canAllocateMore = canAllocateMoreAsi(entry.key, stats);
                    return canAllocateMore ? "not-allowed" : "pointer";
                  })(),
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                Valider
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
